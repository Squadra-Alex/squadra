-- Account deletion cascades through activity tables that refresh achievements.
-- During a cascade the auth.users row may already be gone, so do not recreate
-- user_achievements for a user that is being deleted.
create or replace function private.refresh_user_achievements(target_user uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  a record;
  current_progress integer;
begin
  if target_user is null or not exists (
    select 1 from auth.users where id = target_user
  ) then
    return;
  end if;

  for a in select id, target, metric from public.achievements loop
    current_progress := case a.metric
      when 'matches' then coalesce((select matches_played from public.profiles where id = target_user), 0)
      when 'wins' then coalesce((select wins from public.profiles where id = target_user), 0)
      when 'teams' then (select count(*)::integer from public.teams where owner_id = target_user)
      when 'tournaments' then (select count(*)::integer from public.tournament_registrations where user_id = target_user)
      when 'posts' then (select count(*)::integer from public.community_posts where user_id = target_user)
      when 'friends' then (select count(*)::integer from public.friendships where status = 'accepted' and (requester_id = target_user or addressee_id = target_user))
      else 0
    end;

    insert into public.user_achievements(user_id, achievement_id, progress, unlocked_at)
    values(target_user, a.id, least(current_progress, a.target), case when current_progress >= a.target then now() else null end)
    on conflict(user_id, achievement_id) do update set
      progress = excluded.progress,
      unlocked_at = coalesce(public.user_achievements.unlocked_at, excluded.unlocked_at),
      updated_at = now();
  end loop;
end;
$function$;
