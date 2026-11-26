import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "https://redpen-20.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, signature", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};
async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))].map(x => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const paychanguSecret = Deno.env.get("PAYCHANGU_SECRET_KEY");
  const webhookSecret = Deno.env.get("PAYCHANGU_WEBHOOK_SECRET");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const event = new URL(req.url).searchParams.get("event") || "action";

  if (event === "webhook") {
    if (!webhookSecret) return json({ error: "Webhook secret is not configured." }, 503);
    const raw = await req.text();
    const signature = req.headers.get("Signature") || req.headers.get("signature") || "";
    const expected = await hmacHex(webhookSecret, raw);
    if (!constantTimeEqual(signature.toLowerCase(), expected.toLowerCase())) return json({ error: "Invalid webhook signature." }, 401);
    let payload: any; try { payload = JSON.parse(raw); } catch { return json({ error: "Invalid JSON." }, 400); }
    const txRef = String(payload.tx_ref || payload.reference || "");
    if (!txRef) return json({ received: true });
    const verified = await verifyAndApply(admin, txRef, paychanguSecret);
    return verified.ok ? json({ received: true }) : json({ error: verified.error }, 400);
  }

  if (event === "callback") {
    let payload: any = {};
    try { payload = await req.json(); } catch {}
    const txRef = String(payload.tx_ref || new URL(req.url).searchParams.get("tx_ref") || "");
    if (!txRef) return json({ error: "Missing transaction reference." }, 400);
    const verified = await verifyAndApply(admin, txRef, paychanguSecret);
    return verified.ok ? json({ received: true }) : json({ error: verified.error }, 400);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required." }, 401);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return json({ error: "Invalid session." }, 401);
  if (!paychanguSecret) return json({ error: "PayChangu is not configured yet. Add PAYCHANGU_SECRET_KEY in Supabase Function Secrets." }, 503);

  let body: any; try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (body.action !== "create_checkout") return json({ error: "Unsupported action." }, 400);
  const productCode = String(body.product_code || "");
  const { data: product, error: productError } = await admin.from("billing_products").select("*").eq("code", productCode).eq("active", true).single();
  if (productError || !product || Number(product.amount_mwk) <= 0) return json({ error: "This payment option is not available yet. Pricing has not been configured." }, 400);
  let assessmentId: string | null = null;
  if (product.billing_type === "per_paper") {
    assessmentId = String(body.assessment_id || "");
    if (!assessmentId) return json({ error: "An assessment is required for a per-paper charge." }, 400);
    const { data: assessment } = await admin.from("assessments").select("id,owner_id").eq("id", assessmentId).eq("owner_id", user.id).maybeSingle();
    if (!assessment) return json({ error: "Assessment not found for this account." }, 404);
    const { data: existing } = await admin.from("paper_grading_charges").select("id").eq("user_id", user.id).eq("assessment_id", assessmentId).maybeSingle();
    if (existing) return json({ error: "This paper has already been paid for." }, 409);
  }

  const txRef = crypto.randomUUID();
  const amount = Number(product.amount_mwk);
  const { error: insertError } = await admin.from("payment_transactions").insert({ user_id: user.id, product_id: product.id, tx_ref: txRef, amount_mwk: amount, assessment_id: assessmentId });
  if (insertError) return json({ error: "Could not create payment record." }, 500);
  const callbackUrl = supabaseUrl + "/functions/v1/paychangu-payments?event=callback";
  const returnUrl = "https://redpen-20.vercel.app/settings?payment=" + encodeURIComponent(txRef);
  const checkout = await fetch("https://api.paychangu.com/payment", {
    method: "POST",
    headers: { Authorization: "Bearer " + paychanguSecret, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ amount: String(amount), currency: "MWK", email: user.email, tx_ref: txRef, callback_url: callbackUrl, return_url: returnUrl, customization: { title: product.name, description: "RedPen " + product.billing_type + " payment" }, meta: { user_id: user.id, product_code: product.code, assessment_id: assessmentId } })
  });
  const checkoutData: any = await checkout.json().catch(() => ({}));
  const checkoutUrl = checkoutData?.data?.checkout_url;
  if (!checkout.ok || checkoutData.status !== "success" || !checkoutUrl) {
    await admin.from("payment_transactions").update({ status: "failed", provider_payload: checkoutData }).eq("tx_ref", txRef);
    return json({ error: "PayChangu could not start checkout. Please try again." }, 502);
  }
  await admin.from("payment_transactions").update({ checkout_url: checkoutUrl, provider_payload: { mode: checkoutData?.data?.data?.mode || "unknown" } }).eq("tx_ref", txRef);
  return json({ checkout_url: checkoutUrl, tx_ref: txRef });
});

async function verifyAndApply(admin: any, txRef: string, secret: string | undefined) {
  if (!secret) return { ok: false, error: "Payment verification is not configured." };
  const { data: tx } = await admin.from("payment_transactions").select("*,billing_products(*)").eq("tx_ref", txRef).maybeSingle();
  if (!tx) return { ok: false, error: "Unknown transaction reference." };
  if (tx.status === "successful") return { ok: true };
  const response = await fetch("https://api.paychangu.com/verify-payment/" + encodeURIComponent(txRef), { headers: { Authorization: "Bearer " + secret, Accept: "application/json" } });
  const result: any = await response.json().catch(() => ({}));
  const payment = result?.data;
  if (!response.ok || result.status !== "success" || payment?.status !== "success") return { ok: false, error: "PayChangu has not confirmed this payment." };
  if (payment.tx_ref !== txRef || payment.currency !== "MWK" || Number(payment.amount) < Number(tx.amount_mwk)) return { ok: false, error: "Verified payment details do not match the expected transaction." };
  const { error: updateError } = await admin.from("payment_transactions").update({ status: "successful", paychangu_reference: payment.reference || null, verified_at: new Date().toISOString(), provider_payload: { status: payment.status, mode: payment.mode, channel: payment.authorization?.channel || null } }).eq("id", tx.id).eq("status", "pending");
  if (updateError) return { ok: false, error: "Could not record verified payment." };
  if (tx.billing_products.billing_type === "subscription") {
    const start = new Date();
    const end = new Date(start);
    if (tx.billing_products.interval === "year") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
    await admin.from("redpen_subscriptions").upsert({ user_id: tx.user_id, product_id: tx.product_id, payment_transaction_id: tx.id, status: "active", starts_at: start.toISOString(), ends_at: end.toISOString() }, { onConflict: "payment_transaction_id" });
  } else if (tx.billing_products.billing_type === "per_paper" && tx.assessment_id) {
    await admin.from("paper_grading_charges").upsert({ user_id: tx.user_id, assessment_id: tx.assessment_id, payment_transaction_id: tx.id }, { onConflict: "user_id,assessment_id" });
  }
  return { ok: true };
}
