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

  const { data: callerRoles, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["admin", "moderator"]);
  if (roleError) return response({ error: "Could not verify staff access" }, 500);
  const callerIsAdmin = (callerRoles || []).some((item) => item.role === "admin");
  const callerIsModerator = (callerRoles || []).some((item) => item.role === "moderator");
  if (!callerIsAdmin && !callerIsModerator) return response({ error: "Forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }

  const action = body.action;
  const moderationActions = new Set(["post-update", "post-delete", "comment-update", "comment-delete", "report-update", "report-delete"]);
  if (!callerIsAdmin && (!callerIsModerator || !moderationActions.has(String(action)))) return response({ error: "Forbidden" }, 403);
  if (action === "users") {
    if (!callerIsAdmin) return response({ error: "Forbidden" }, 403);
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
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

  if (action === "report-update" || action === "report-delete") {
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    if (!/^[0-9a-f-]{36}$/i.test(reportId)) return response({ error: "Invalid report id" }, 400);
    const { data: currentReport, error: reportReadError } = await admin.from("community_reports")
      .select("id,reporter_id,status,moderator_reply").eq("id", reportId).maybeSingle();
    if (reportReadError) return response({ error: "Could not load report" }, 500);
    if (!currentReport) return response({ error: "Report not found" }, 404);
    const statusLabels: Record<string,string> = { open: "новая", reviewing: "в работе", resolved: "решена", dismissed: "отклонена" };
    if (action === "report-update") {
      const status = typeof body.status === "string" ? body.status : "";
      if (!["reviewing", "resolved", "dismissed"].includes(status)) return response({ error: "Invalid report status" }, 400);
      const hasReply = Object.prototype.hasOwnProperty.call(body, "reply");
      const reply = hasReply && typeof body.reply === "string" ? body.reply.trim() : "";
      if (hasReply && (typeof body.reply !== "string" || reply.length > 1000)) return response({ error: "Reply must be up to 1000 characters" }, 400);
      const replyChanged = hasReply && reply !== (currentReport.moderator_reply || "");
      const update: Record<string, unknown> = { status, reviewed_by: callerId, reviewed_at: new Date().toISOString() };
      if (hasReply) update.moderator_reply = reply || null;
      const { data, error } = await admin.from("community_reports").update(update)
        .eq("id", reportId).select("id,status,moderator_reply").maybeSingle();
      if (error) { console.error("Could not update report:", error); return response({ error: "Could not update report" }, 500); }
      if (!data) return response({ error: "Report not found" }, 404);
      if (currentReport.reporter_id && (status !== currentReport.status || replyChanged)) {
        const notice = "Жалоба: статус «" + (statusLabels[status] || status) + "»." + (replyChanged && reply ? " Ответ модерации: " + reply : "");
        const { error: noticeError } = await admin.from("notifications").insert({
          user_id: currentReport.reporter_id, kind: "report_update", body: notice,
          source_type: "community_report", source_id: reportId, actor_id: callerId,
        });
        if (noticeError) console.error("Report updated but reporter notification failed:", noticeError);
      }
      return response({ ok: true, report: data });
    }
    const notice = "Жалоба удалена из очереди после рассмотрения. Итоговый статус: «" +
      (statusLabels[currentReport.status] || currentReport.status) + "»." +
      (currentReport.moderator_reply ? " Ответ модерации: " + currentReport.moderator_reply : "");
    if (currentReport.reporter_id) {
      const { error: noticeError } = await admin.from("notifications").insert({
        user_id: currentReport.reporter_id, kind: "report_update", body: notice,
        source_type: "community_report", source_id: reportId, actor_id: callerId,
      });
      if (noticeError) { console.error("Could not notify reporter before report deletion:", noticeError); return response({ error: "Could not notify report author; report was not deleted" }, 500); }
    }
    const { data, error } = await admin.from("community_reports").delete().eq("id", reportId).select("id").maybeSingle();
    if (error) { console.error("Could not delete report:", error); return response({ error: "Could not delete report" }, 500); }
    return response({ ok: true, deleted: data?.id || reportId });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return response({ error: "Invalid target user" }, 400);
  if (action === "user-detail") {
    if (!callerIsAdmin) return response({ error: "Forbidden" }, 403);
    const [authResult, profileResult, settingsResult, rolesResult, friendsResult, postsResult, teamsResult, matchesResult, activityResult] = await Promise.all([
      admin.auth.admin.getUserById(targetUserId),
      admin.from("profiles").select("*").eq("id", targetUserId).maybeSingle(),
      admin.from("user_settings").select("*").eq("user_id", targetUserId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", targetUserId),
      admin.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`),
      admin.from("community_posts").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
      admin.from("team_members").select("role,teams(id,name,tag,game_name)").eq("user_id", targetUserId),
      admin.from("matches").select("game_id,status,score_a,score_b,played_at,created_at").or(`player_a_id.eq.${targetUserId},player_b_id.eq.${targetUserId}`).order("created_at", { ascending: false }).limit(10),
      admin.from("activity_history").select("action,game_name,result,rating_delta,created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (authResult.error || !authResult.data?.user) return response({ error: "User not found" }, 404);
    if (profileResult.error) return response({ error: "Could not load profile" }, 500);
    if (!profileResult.data) return response({ error: "Profile not found" }, 404);
    if (settingsResult.error || rolesResult.error || friendsResult.error || postsResult.error || teamsResult.error || matchesResult.error || activityResult.error) {
      console.error("Could not load admin user details", settingsResult.error, rolesResult.error, friendsResult.error, postsResult.error, teamsResult.error, matchesResult.error, activityResult.error);
      return response({ error: "Could not load full user details" }, 500);
    }
    const authUser = authResult.data.user;
    return response({
      user: {
        id: authUser.id,
        email: authUser.email || "",
        bannedUntil: authUser.banned_until || null,
        providers: (authUser.identities || []).map((identity) => identity.provider).filter(Boolean),
        createdAt: authUser.created_at,
        lastSignInAt: authUser.last_sign_in_at || null,
        emailConfirmedAt: authUser.email_confirmed_at || null,
      },
      profile: profileResult.data,
      settings: settingsResult.data || {},
      roles: rolesResult.data || [],
      friendCount: friendsResult.count || 0,
      communityPostCount: postsResult.count || 0,
      teams: teamsResult.data || [],
      matches: matchesResult.data || [],
      activity: activityResult.data || [],
    });
  }
  if (action === "post-update" || action === "post-delete" || action === "comment-update" || action === "comment-delete") {
    const contentId = typeof body.contentId === "string" ? body.contentId : "";
    if (!/^[0-9a-f-]{36}$/i.test(contentId)) return response({ error: "Invalid content id" }, 400);
    const isPost = action.startsWith("post-");
    const table = isPost ? "community_posts" : "community_post_comments";
    if (action.endsWith("-update")) {
      const text = typeof body.body === "string" ? body.body.trim() : "";
      const limit = isPost ? 5000 : 2000;
      if (!text || text.length > limit) return response({ error: "Text must contain 1–" + limit + " characters" }, 400);
      const update = isPost
        ? await admin.from(table).update({ body: text, updated_at: new Date().toISOString() }).eq("id", contentId).select("id").maybeSingle()
        : await admin.from(table).update({ body: text }).eq("id", contentId).select("id").maybeSingle();
      if (update.error) {
        console.error("Could not edit community content:", update.error);
        return response({ error: "Could not save content" }, 500);
      }
      if (!update.data) return response({ error: "Content not found" }, 404);
      return response({ ok: true, contentId });
    }
    if (isPost) {
      // Retain reports and their review history after removing a post.
      const { error: unlinkError } = await admin.from("community_reports").update({ post_id: null }).eq("post_id", contentId);
      if (unlinkError) return response({ error: "Could not preserve reports for this post" }, 500);
    }
    const removed = await admin.from(table).delete().eq("id", contentId).select("id").maybeSingle();
    if (removed.error) {
      console.error("Could not delete community content:", removed.error);
      return response({ error: "Could not delete content" }, 500);
    }
    if (!removed.data) return response({ error: "Content not found" }, 404);
    return response({ ok: true, contentId });
  }

  if (action === "user-update") {
    const input = body.profile && typeof body.profile === "object" ? body.profile as Record<string, unknown> : null;
    if (!input) return response({ error: "Invalid profile data" }, 400);
    const displayName = typeof input.display_name === "string" ? input.display_name.trim() : "";
    const username = typeof input.username === "string" ? input.username.trim().replace(/^@/, "").toLowerCase() : "";
    const gameName = typeof input.game_name === "string" ? input.game_name.trim() : "";
    const region = typeof input.region === "string" ? input.region.trim() : "";
    const rankName = typeof input.rank_name === "string" ? input.rank_name.trim() : "";
    const bio = typeof input.bio === "string" ? input.bio.trim() : "";
    const avatarRaw = typeof input.avatar_url === "string" ? input.avatar_url.trim() : "";
    let avatarUrl: string | null = null;
    if (avatarRaw) {
      try {
        const parsedAvatar = new URL(avatarRaw);
        if (parsedAvatar.protocol !== "https:" || avatarRaw.length > 2048) return response({ error: "Avatar URL must be HTTPS and at most 2048 characters" }, 400);
        avatarUrl = parsedAvatar.toString();
      } catch { return response({ error: "Invalid avatar URL" }, 400); }
    }
    const language = input.language === "en" ? "en" : input.language === "ru" ? "ru" : "";
    if (!language) return response({ error: "Invalid profile language" }, 400);
    const settingsInput = body.settings && typeof body.settings === "object" ? body.settings as Record<string, unknown> : null;
    if (!settingsInput || !["default", "dark", "light", "green", "blue", "purple", "yellow"].includes(String(settingsInput.theme))) return response({ error: "Invalid user settings" }, 400);
    for (const key of ["notify_messages", "notify_team_invites", "notify_tournaments", "notify_marketing", "discoverable"]) {
      if (typeof settingsInput[key] !== "boolean") return response({ error: "Invalid user settings" }, 400);
    }
    const level = Number(input.level);
    const rating = Number(input.rating);
    const requestedColor = input.verified_color === "" ? null : input.verified_color;
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return response({ error: "Invalid account email" }, 400);
    const { data: authTarget, error: authTargetError } = await admin.auth.admin.getUserById(targetUserId);
    if (authTargetError || !authTarget.user) return response({ error: "Could not load account" }, 404);
    const emailChanged = !!email && email !== (authTarget.user.email || "").toLowerCase();
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
      avatar_url: avatarUrl,
      language,
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
    const { error: settingsError } = await admin.from("user_settings").upsert({
      user_id: targetUserId,
      theme: settingsInput.theme,
      notify_messages: settingsInput.notify_messages,
      notify_team_invites: settingsInput.notify_team_invites,
      notify_tournaments: settingsInput.notify_tournaments,
      notify_marketing: settingsInput.notify_marketing,
      discoverable: settingsInput.discoverable,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (settingsError) {
      console.error("Profile was saved but account preferences were not updated:", settingsError);
      return response({ error: "Profile saved, but account settings could not be changed", partial: true }, 409);
    }
    if (emailChanged) {
      const { error: emailError } = await admin.auth.admin.updateUserById(targetUserId, { email });
      if (emailError) {
        console.error("Profile was saved but account email was not updated:", emailError);
        return response({ error: "Profile saved, but the account email could not be changed", partial: true }, 409);
      }
    }
    return response({ ok: true, profile: updatedProfile, identityChanged, emailChanged });
  }

  if (action === "user-delete") {
    if (targetUserId === callerId) return response({ error: "You cannot delete your own administrator account" }, 400);
    const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(targetUserId);
    if (targetAuthError || !targetAuth.user) return response({ error: "Account not found" }, 404);
    const expectedEmail = (targetAuth.user.email || "").trim().toLowerCase();
    const confirmation = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
    if (!expectedEmail || confirmation !== expectedEmail) return response({ error: "Email confirmation did not match" }, 400);
    const { data: targetRoles, error: targetRoleError } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
    if (targetRoleError) return response({ error: "Could not verify target roles" }, 500);
    if ((targetRoles || []).some((item) => item.role === "admin")) {
      const { count, error: countError } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if (countError || (count ?? 0) <= 1) return response({ error: "Cannot delete the last administrator" }, 409);
    }

    // Release non-cascading foreign keys while preserving the rest of the account's data.
    const cleanup = [
      await admin.from("community_reports").update({ reported_user_id: null, reviewed_by: null }).or("reported_user_id.eq." + targetUserId + ",reviewed_by.eq." + targetUserId),
      await admin.from("profiles").update({ verified_by: null }).eq("verified_by", targetUserId),
      await admin.from("notifications").update({ actor_id: null }).eq("actor_id", targetUserId),
      await admin.from("matches").update({ confirmed_by: null, winner_id: null }).or("confirmed_by.eq." + targetUserId + ",winner_id.eq." + targetUserId),
      await admin.from("community_groups").update({ owner_id: null }).eq("owner_id", targetUserId),
      await admin.from("tournaments").update({ owner_id: null }).eq("owner_id", targetUserId),
      await admin.from("matches").delete().eq("created_by", targetUserId),
    ];
    const cleanupError = cleanup.find((result) => result.error);
    if (cleanupError) {
      console.error("Could not prepare references for account deletion:", cleanupError.error);
      return response({ error: "Could not prepare related data for account deletion" }, 500);
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      console.error("Could not delete auth account:", deleteError);
      return response({ error: "Could not delete account" }, 500);
    }
    return response({ ok: true, deletedUserId: targetUserId });
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