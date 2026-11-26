import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function secretKey() {
  if (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  return secrets.default || "";
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = secretKey();
    if (!token || !key || !url) return reply({ error: "Authentication service is not configured." }, 401);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Sign in again to manage institution members." }, 401);
    const actorId = authData.user.id;
    const { action, institutionId } = await req.json();
    if (!institutionId || typeof institutionId !== "string") return reply({ error: "Choose an institution first." }, 400);

    const { data: institution, error: institutionError } = await admin.from("institutions")
      .select("id,name,owner_id").eq("id", institutionId).maybeSingle();
    if (institutionError || !institution) return reply({ error: "Institution not found." }, 404);
    const isOwner = institution.owner_id === actorId;
    const { data: actorMembership } = await admin.from("institution_memberships")
      .select("member_role").eq("institution_id", institutionId).eq("user_id", actorId).maybeSingle();
    const isAdmin = actorMembership?.member_role === "admin";
    if (!isOwner && !isAdmin) return reply({ error: "Only the institution owner or an institution administrator can manage teachers." }, 403);

    if (action === "list_members") {
      const { data: memberships, error } = await admin.from("institution_memberships")
        .select("id,user_id,member_role,created_at").eq("institution_id", institutionId).order("created_at");
      if (error) throw error;
      const users = new Map<string, any>();
      for (let page = 1; page <= 10; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        for (const user of data.users) users.set(user.id, user);
        if (data.users.length < 1000) break;
      }
      return reply({
        institution,
        members: [
          { id: "owner", user_id: institution.owner_id, email: users.get(institution.owner_id)?.email || "", name: users.get(institution.owner_id)?.user_metadata?.full_name || "Institution owner", member_role: "owner", created_at: null },
          ...(memberships || []).map((m: any) => ({ ...m, email: users.get(m.user_id)?.email || "", name: users.get(m.user_id)?.user_metadata?.full_name || "" })),
        ],
      });
    }

    if (action === "add_member") {
      const email = String(req.headers.get("x-redpen-member-email") || "").trim().toLowerCase();
      const role = req.headers.get("x-redpen-member-role") === "admin" ? "admin" : "teacher";
      if (!email || !email.includes("@")) return reply({ error: "Enter a valid teacher email address." }, 400);
      if (role === "admin" && !isOwner) return reply({ error: "Only the institution owner can appoint another administrator." }, 403);
      let target: any = null;
      for (let page = 1; page <= 10 && !target; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        target = data.users.find((u: any) => u.email?.toLowerCase() === email) || null;
        if (data.users.length < 1000) break;
      }
      if (!target) return reply({ error: "No RedPen account uses that email yet. Ask the teacher to register first, then add them here." }, 404);
      if (target.id === institution.owner_id) return reply({ error: "The institution owner already has full access." }, 409);
      const { data, error } = await admin.from("institution_memberships").upsert({
        institution_id: institutionId, user_id: target.id, member_role: role,
      }, { onConflict: "institution_id,user_id" }).select("id,user_id,member_role,created_at").single();
      if (error) throw error;
      return reply({ member: { ...data, email: target.email, name: target.user_metadata?.full_name || "" } });
    }

    if (action === "remove_member") {
      const membershipId = String(req.headers.get("x-redpen-membership-id") || "");
      const { data: membership, error: lookupError } = await admin.from("institution_memberships")
        .select("id,user_id,member_role").eq("id", membershipId).eq("institution_id", institutionId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!membership) return reply({ error: "Teacher membership not found." }, 404);
      if (!isOwner && membership.member_role === "admin") return reply({ error: "Only the institution owner can remove an administrator." }, 403);
      const { error } = await admin.from("institution_memberships").delete().eq("id", membershipId);
      if (error) throw error;
      return reply({ success: true });
    }
    return reply({ error: "Unknown institution action." }, 400);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Institution operation failed." }, 500);
  }
});
