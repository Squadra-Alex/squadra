import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://squadra.forum",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  let secretKey = "";
  try { secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { /* ignore malformed optional key set */ }
  const serviceRoleKey = secretKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !serviceRoleKey) return response({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Unauthorized" }, 401);
  const callerId = authData.user.id;

  const { data: adminRole, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError || !adminRole) return response({ error: "Forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }

  const action = body.action;
  if (action === "users") {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) return response({ error: "Could not load users" }, 500);
    return response({
      users: (data.users || []).map((u) => ({
        id: u.id,
        email: u.email || "",
        bannedUntil: u.banned_until || null,
        isAnonymous: !!u.is_anonymous,
      })),
    });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return response({ error: "Invalid target user" }, 400);
  if (targetUserId === callerId && (action === "ban" || action === "revoke_role")) {
    return response({ error: "You cannot remove your own access" }, 400);
  }

  if (action === "verify") {
    const color = body.color === "blue" || body.color === "green" ? body.color : null;
    const { error } = await admin.from("profiles").update({
      verified_color: color,
      verified_at: color ? new Date().toISOString() : null,
      verified_by: color ? callerId : null,
    }).eq("id", targetUserId);
    if (error) return response({ error: "Could not update verification badge" }, 500);
    return response({ ok: true, color });
  }

  if (action === "ban" || action === "unban") {
    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
    if ((targetRoles || []).some((r) => r.role === "admin")) {
      return response({ error: "Administrator accounts cannot be banned here" }, 403);
    }
    const days = action === "ban" ? Math.max(1, Math.min(365, Number(body.days) || 7)) : 0;
    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: action === "ban" ? `${days}d` : "none",
    });
    if (error) return response({ error: "Could not update ban status" }, 500);
    return response({ ok: true, banned: action === "ban", days });
  }

  if (action === "grant_role" || action === "revoke_role") {
    const role = body.role;
    if (role !== "admin" && role !== "moderator") return response({ error: "Invalid role" }, 400);
    if (action === "revoke_role" && role === "admin") {
      const { count, error } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if (error || (count ?? 0) <= 1) return response({ error: "Cannot remove the last administrator" }, 409);
    }
    const query = action === "grant_role"
      ? await admin.from("user_roles").upsert({ user_id: targetUserId, role }, { onConflict: "user_id,role" })
      : await admin.from("user_roles").delete().eq("user_id", targetUserId).eq("role", role);
    if (query.error) return response({ error: "Could not update role" }, 500);
    return response({ ok: true, role, granted: action === "grant_role" });
  }

  return response({ error: "Unsupported action" }, 400);
});