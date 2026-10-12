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
  if (action === "user-update") {
    const input = body.profile && typeof body.profile === "object" ? body.profile as Record<string, unknown> : null;
    if (!input) return response({ error: "Invalid profile data" }, 400);
    const displayName = typeof input.display_name === "string" ? input.display_name.trim() : "";
    const username = typeof input.username === "string" ? input.username.trim().replace(/^@/, "").toLowerCase() : "";
    const gameName = typeof input.game_name === "string" ? input.game_name.trim() : "";
    const region = typeof input.region === "string" ? input.region.trim() : "";
    const rankName = typeof input.rank_name === "string" ? input.rank_name.trim() : "";
    const bio = typeof input.bio === "string" ? input.bio.trim() : "";
    const level = Number(input.level);
    const rating = Number(input.rating);
    const requestedColor = input.verified_color === "" ? null : input.verified_color;
    if (!displayName || displayName.length > 32) return response({ error: "Display name must be 1–32 characters" }, 400);
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return response({ error: "Username must be 3–24 characters using letters, numbers, and underscores" }, 400);
    if (gameName.length > 60 || region.length > 40 || rankName.length > 40 || bio.length > 400) return response({ error: "One or more fields exceed their character limit" }, 400);
    if (!Number.isInteger(level) || level < 1 || level > 100 || !Number.isInteger(rating) || rating < 0 || rating > 100000) return response({ error: "Level or rating is outside the allowed range" }, 400);
    if (requestedColor !== null && requestedColor !== "blue" && requestedColor !== "green") return response({ error: "Invalid verification color" }, 400);

    const { data: currentProfile, error: currentProfileError } = await admin
      .from("profiles")
      .select("display_name,username")
      .eq("id", targetUserId)
      .maybeSingle();
    if (currentProfileError) return response({ error: "Could not load profile before update" }, 500);
    if (!currentProfile) return response({ error: "Profile not found" }, 404);
    const identityChanged = (currentProfile.display_name || "") !== displayName || (currentProfile.username || "") !== username;
    const nextColor = identityChanged ? null : requestedColor;
    const profileUpdate: Record<string, unknown> = {
      display_name: displayName,
      username,
      game_name: gameName,
      region,
      rank_name: rankName,
      level,
      rating,
      bio,
      verified_color: nextColor,
      verified_at: nextColor ? new Date().toISOString() : null,
      verified_by: nextColor ? callerId : null,
      updated_at: new Date().toISOString(),
    };
    const { data: updatedProfile, error: updateError } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", targetUserId)
      .select("id,display_name,username,verified_color")
      .maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") return response({ error: "Username already taken" }, 409);
      console.error("Could not update admin-managed profile:", updateError);
      return response({ error: "Could not update profile" }, 500);
    }
    if (!updatedProfile) return response({ error: "Profile not found" }, 404);
    return response({ ok: true, profile: updatedProfile, identityChanged });
  }

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