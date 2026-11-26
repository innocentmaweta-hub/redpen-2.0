import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function parseJson(content: string) {
  const cleaned = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The grading model did not return a valid JSON assessment.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || token === authorization) return reply({ error: "A signed-in RedPen account is required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || publishableKeys.default;
    if (!supabaseUrl || !anonKey) return reply({ error: "Supabase authentication is not configured for this function." }, 500);
    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return reply({ error: "Your session is invalid or has expired. Sign in again." }, 401);

    const apiKey = Deno.env.get("AI_API_KEY");
    if (!apiKey) return reply({ error: "AI grading is not activated yet. Add AI_API_KEY in Supabase → Edge Functions → Secrets." }, 503);

    const body = await req.json();
    const schemeText = String(body.schemeText || "").slice(0, 85000);
    const paperText = String(body.paperText || "").slice(0, 85000);
    const schemeImages = Array.isArray(body.schemeImages) ? body.schemeImages.slice(0, 3) : [];
    const paperImages = Array.isArray(body.paperImages) ? body.paperImages.slice(0, 3) : [];
    const sourceWarnings = Array.isArray(body.sourceWarnings) ? body.sourceWarnings.map((item: unknown) => String(item).slice(0, 500)).slice(0, 10) : [];
    if (!schemeText.trim() && !schemeImages.length) return reply({ error: "The marking scheme could not be read. Upload a readable PDF, image or text file." }, 400);
    if (!paperText.trim() && !paperImages.length) return reply({ error: "The student's answer paper could not be read. Upload a readable PDF or image." }, 400);

    const model = Deno.env.get("AI_MODEL") || "openai/gpt-4.1-mini";
    const provider = Deno.env.get("AI_PROVIDER") || "openrouter";
    const baseUrl = (Deno.env.get("AI_BASE_URL") || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const userContent: any[] = [{
      type: "text",
      text: `MARKING SCHEME (reference; do not invent criteria):\n${schemeText || "[The scheme is supplied as page images.]"}\n\nSTUDENT ANSWER PAPER:\n${paperText || "[The student's paper is supplied as page images.]"}\n\nAssess every identifiable question against the scheme. Apply partial credit only when supported by the scheme. Do not penalise spelling unless the scheme requires it. Do not infer unreadable answers. If a response cannot be read, mark that question as needing review and explain why. Extract student name, candidate/examination number and class only when visible; otherwise return empty strings. Return JSON only with this exact shape: {"student":{"name":"","id":"","className":""},"questions":[{"label":"Question 1","max":10,"score":0,"feedback":"Evidence-based explanation"}],"overallFeedback":"Constructive summary","needsReview":false,"reviewNotes":[]}. Scores must be numeric and between zero and the maximum. Every question and sub-question should be represented when the scheme makes it identifiable. The maximum mark must come from the scheme. Do not fabricate missing scheme pages or answers.\n\nSOURCE WARNINGS: ${sourceWarnings.length ? sourceWarnings.join(' | ') : 'None'}. If any source warning exists, set needsReview to true and include each warning in reviewNotes.`,
    }];
    for (const imageUrl of [...schemeImages, ...paperImages]) {
      if (typeof imageUrl === "string" && /^data:image\/(png|jpeg|webp);base64,/i.test(imageUrl)) {
        userContent.push({ type: "image_url", image_url: { url: imageUrl, detail: "high" } });
      }
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(provider === "openrouter" ? { "HTTP-Referer": "https://redpen.app", "X-Title": "RedPen 2.0" } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a careful examination marker. Follow the supplied marking scheme exactly. Be transparent about uncertainty. Never invent student answers, marks, or criteria." },
          { role: "user", content: userContent },
        ],
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `AI provider returned HTTP ${response.status}.`;
      return reply({ error: message, provider, model }, response.status === 429 ? 429 : 502);
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return reply({ error: "The AI provider returned an empty grading response.", provider, model }, 502);
    const result = parseJson(content);
    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      return reply({ error: "The AI response did not contain question-level marks. Please check the document quality and retry.", provider, model }, 502);
    }
    const questions = result.questions.map((q: any, index: number) => {
      const max = Number(q.max);
      const score = Number(q.score);
      if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(score) || score < 0 || score > max) {
        throw new Error(`The model returned invalid marks for question ${index + 1}. No result was saved.`);
      }
      return { id: crypto.randomUUID(), label: String(q.label || `Question ${index + 1}`).slice(0, 200), max, score, feedback: String(q.feedback || "").slice(0, 3000) };
    });
    const total = questions.reduce((sum: number, q: any) => sum + q.score, 0);
    const maximum = questions.reduce((sum: number, q: any) => sum + q.max, 0);
    return reply({
      student: {
        name: String(result.student?.name || "").slice(0, 200),
        id: String(result.student?.id || "").slice(0, 100),
        className: String(result.student?.className || "").slice(0, 100),
      },
      questions,
      total,
      maximum,
      percentage: maximum ? Math.round(total / maximum * 1000) / 10 : 0,
      overallFeedback: String(result.overallFeedback || "").slice(0, 6000),
      needsReview: Boolean(result.needsReview),
      reviewNotes: Array.isArray(result.reviewNotes) ? result.reviewNotes.map((x: unknown) => String(x).slice(0, 500)).slice(0, 20) : [],
      provider,
      model,
      usage: payload.usage || null,
    });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "AI grading failed unexpectedly." }, 500);
  }
});
