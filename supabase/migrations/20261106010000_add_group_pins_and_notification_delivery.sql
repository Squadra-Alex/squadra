alter table public.user_settings
  add column if not exists pinned_community_group_ids text[] not null default '{}';

create unique index if not exists notifications_event_start_once_idx
  on public.notifications(user_id, source_type, source_id)
  where kind = 'event_start' and source_type in ('platform_event', 'tournament');

create or replace function private.create_social_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  row_data jsonb := to_jsonb(new);
  recipient uuid;
  actor uuid;
  text_body text;
  event_kind text;
  link_type text;
  link_id text;
  enabled boolean := true;
begin
  if tg_table_name = 'direct_messages' then
    recipient := (row_data->>'receiver_id')::uuid;
    actor := (row_data->>'sender_id')::uuid;
    text_body := 'Новое сообщение от игрока'; event_kind := 'message';
    link_type := 'message'; link_id := row_data->>'sender_id';
  elsif tg_table_name = 'team_invites' then
    recipient := (row_data->>'invitee_id')::uuid;
    actor := (row_data->>'inviter_id')::uuid;
    text_body := 'Тебя пригласили в команду'; event_kind := 'team_invite';
    link_type := 'team'; link_id := row_data->>'team_id';
  elsif tg_table_name = 'community_post_comments' then
    link_id := row_data->>'post_id';
    recipient := (select p.user_id from public.community_posts p where p.id = (row_data->>'post_id')::uuid);
    actor := (row_data->>'user_id')::uuid;
    text_body := 'Новый комментарий к публикации'; event_kind := 'comment'; link_type := 'post';
  elsif tg_table_name = 'user_follows' then
    recipient := (row_data->>'following_id')::uuid;
    actor := (row_data->>'follower_id')::uuid;
    text_body := 'На тебя подписался игрок'; event_kind := 'follow';
    link_type := 'player'; link_id := row_data->>'follower_id';
  elsif tg_table_name = 'friendships' then
    link_id := row_data->>'requester_id';
    if tg_op = 'UPDATE' and row_data->>'status' = 'accepted' then
      recipient := (row_data->>'requester_id')::uuid; actor := (row_data->>'addressee_id')::uuid;
      text_body := 'Заявка в друзья принята'; event_kind := 'friend';
    else
      recipient := (row_data->>'addressee_id')::uuid; actor := (row_data->>'requester_id')::uuid;
      text_body := 'Новая заявка в друзья'; event_kind := 'friend';
    end if;
    link_type := 'player'; link_id := actor::text;
  elsif tg_table_name = 'matches' then
    actor := (row_data->>'created_by')::uuid;
    recipient := case when (row_data->>'player_a_id')::uuid = actor then (row_data->>'player_b_id')::uuid else (row_data->>'player_a_id')::uuid end;
    text_body := 'Проверь и подтверди результат матча'; event_kind := 'match_confirmation';
    link_type := 'match'; link_id := row_data->>'id';
  elsif tg_table_name = 'community_group_messages' then
    insert into public.notifications(user_id,kind,body,source_type,source_id,actor_id)
    select m.user_id,'group_message','Новое сообщение в группе','group',row_data->>'group_id',(row_data->>'user_id')::uuid
    from public.community_group_members m
    where m.group_id = (row_data->>'group_id') and m.user_id <> (row_data->>'user_id')::uuid;
    return new;
  end if;

  if event_kind = 'friend' then
    select coalesce(s.notify_friend_requests, true) into enabled from public.user_settings s where s.user_id = recipient;
    enabled := coalesce(enabled, true);
  elsif event_kind = 'team_invite' then
    select coalesce(s.notify_team_invites, true) into enabled from public.user_settings s where s.user_id = recipient;
    enabled := coalesce(enabled, true);
  elsif event_kind = 'message' then
    select coalesce(s.notify_messages, true) into enabled from public.user_settings s where s.user_id = recipient;
    enabled := coalesce(enabled, true);
  end if;

  if enabled and recipient is not null and recipient <> actor and
     (tg_table_name <> 'friendships' or tg_op = 'UPDATE' or row_data->>'status' = 'pending') then
    insert into public.notifications(user_id,kind,body,source_type,source_id,actor_id)
    values(recipient,event_kind,text_body,link_type,link_id,actor);
  end if;
  return new;
end;
$function$;

create or replace function private.notify_started_squadra_events()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.notifications(user_id,kind,body,source_type,source_id,actor_id)
  select r.user_id,'event_start','Событие «'||e.title||'» уже началось.','platform_event',e.id::text,e.owner_id
  from public.platform_event_registrations r
  join public.platform_events e on e.id = r.event_id
  join public.user_settings s on s.user_id = r.user_id and s.notify_events
  where e.starts_at <= now() and e.starts_at > now() - interval '10 minutes'
  on conflict (user_id, source_type, source_id) where kind = 'event_start' and source_type in ('platform_event','tournament') do nothing;

  insert into public.notifications(user_id,kind,body,source_type,source_id,actor_id)
  select distinct recipients.user_id,'event_start','Турнир «'||t.name||'» уже начался.','tournament',t.id,t.owner_id
  from public.tournament_registrations r
  join public.tournaments t on t.id = r.tournament_id
  join lateral (
    select r.user_id
    union
    select tm.user_id from public.team_members tm where tm.team_id = r.team_id
  ) recipients on true
  join public.user_settings s on s.user_id = recipients.user_id and s.notify_tournaments
  where t.starts_at <= now() and t.starts_at > now() - interval '10 minutes'
    and t.status in ('upcoming','registration','live')
  on conflict (user_id, source_type, source_id) where kind = 'event_start' and source_type in ('platform_event','tournament') do nothing;
end;
$function$;

revoke all on function private.notify_started_squadra_events() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.unschedule(jobid) from cron.job where jobname = 'squadra-event-start-notifications';
select cron.schedule('squadra-event-start-notifications','* * * * *','select private.notify_started_squadra_events()');
