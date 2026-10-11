-- Squadra account data schema
-- Run once in Supabase Dashboard -> SQL Editor.
-- Safe to rerun: tables, indexes, functions, triggers, seeds and policies are idempotent.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  game_name text not null default 'CS2',
  region text not null default 'EU',
  language text not null default 'ru',
  rank_name text not null default 'Unranked',
  rating integer not null default 0 check (rating >= 0),
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  kd numeric(5,2) not null default 0 check (kd >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_unique_idx on public.profiles (lower(username));
create index if not exists profiles_username_search_idx on public.profiles (lower(username));
create index if not exists profiles_game_region_idx on public.profiles (game_name, region);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_messages boolean not null default true,
  notify_team_invites boolean not null default true,
  notify_tournaments boolean not null default true,
  notify_marketing boolean not null default false,
  discoverable boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_name text not null,
  hours_played integer not null default 0 check (hours_played >= 0),
  added_at timestamptz not null default now(),
  unique (user_id, game_name)
);
create index if not exists user_library_user_idx on public.user_library(user_id);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships(requester_id,status);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id,status);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index if not exists direct_messages_pair_idx on public.direct_messages(sender_id,receiver_id,created_at);
create index if not exists direct_messages_receiver_idx on public.direct_messages(receiver_id,created_at);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  tag text not null default '' check (char_length(tag) <= 12),
  game_name text not null,
  region text not null,
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teams_owner_idx on public.teams(owner_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','captain','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id,user_id)
);
create index if not exists team_members_user_idx on public.team_members(user_id);

create or replace function public.add_team_owner_membership()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  insert into public.team_members(team_id,user_id,role)
  values(new.id,new.owner_id,'owner')
  on conflict (team_id,user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.add_team_owner_membership() from public, anon, authenticated;
drop trigger if exists teams_add_owner on public.teams;
create trigger teams_add_owner after insert on public.teams
for each row execute function public.add_team_owner_membership();

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (team_id,invitee_id),
  check (inviter_id <> invitee_id)
);
create index if not exists team_invites_invitee_idx on public.team_invites(invitee_id,status);

create or replace function public.accept_team_invite_add_member()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.status='accepted' and old.status<>'accepted' then
    insert into public.team_members(team_id,user_id,role)
    values(new.team_id,new.invitee_id,'member')
    on conflict(team_id,user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.accept_team_invite_add_member() from public, anon, authenticated;
drop trigger if exists team_invite_add_member on public.team_invites;
create trigger team_invite_add_member after update of status on public.team_invites
for each row execute function public.accept_team_invite_add_member();

create table if not exists public.matchmaking_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game_name text not null default 'CS2',
  role text not null default 'Любая',
  rating_tolerance text not null default '± 500 рейтинга',
  region text not null default 'EU',
  play_time text not null default 'Сейчас',
  language text not null default 'Русский',
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  game_name text not null default '',
  result text not null default '',
  rating_delta integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_history_user_date_idx on public.activity_history(user_id,created_at desc);

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default 'fa-trophy',
  target integer not null default 1 check (target > 0),
  sort_order integer not null default 0
);
create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,achievement_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_date_idx on public.community_posts(created_at desc);
create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_date_idx on public.community_post_comments(post_id,created_at);

create table if not exists public.tournaments (
  id text primary key,
  name text not null,
  game_name text not null,
  status text not null default 'registration' check (status in ('upcoming','registration','live','finished')),
  prize text not null default '',
  starts_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(tournament_id,user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'system',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_date_idx on public.notifications(user_id,created_at desc);

create or replace function public.create_squadra_account()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  base_name text;
  safe_name text;
begin
  base_name := coalesce(
    nullif(new.raw_user_meta_data->>'preferred_username',''),
    nullif(new.raw_user_meta_data->>'name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'player'
  );
  safe_name := lower(regexp_replace(base_name,'[^a-zA-Z0-9_]+','_','g'));
  safe_name := trim(both '_' from safe_name);
  if safe_name = '' then safe_name := 'player'; end if;

  insert into public.profiles(id,username,display_name,avatar_url)
  values(
    new.id,
    left(safe_name,24) || '_' || substr(replace(new.id::text,'-',''),1,6),
    coalesce(nullif(new.raw_user_meta_data->>'name',''),base_name),
    coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture')
  )
  on conflict(id) do nothing;

  insert into public.user_settings(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.matchmaking_preferences(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_squadra_account() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_squadra on auth.users;
create trigger on_auth_user_created_squadra after insert on auth.users
for each row execute function public.create_squadra_account();

-- Backfill users who registered before this schema was installed.
insert into public.profiles(id,username,display_name,avatar_url)
select
  u.id,
  left(
    trim(both '_' from lower(regexp_replace(
      coalesce(nullif(u.raw_user_meta_data->>'preferred_username',''),nullif(u.raw_user_meta_data->>'name',''),nullif(split_part(coalesce(u.email,''),'@',1),''),'player'),
      '[^a-zA-Z0-9_]+','_','g'
    ))),
    24
  ) || '_' || substr(replace(u.id::text,'-',''),1,6),
  coalesce(nullif(u.raw_user_meta_data->>'name',''),nullif(split_part(coalesce(u.email,''),'@',1),''),'Player'),
  coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture')
from auth.users u
on conflict(id) do nothing;
insert into public.user_settings(user_id) select id from auth.users on conflict(user_id) do nothing;
insert into public.matchmaking_preferences(user_id) select id from auth.users on conflict(user_id) do nothing;

insert into public.achievements(id,title,description,icon,target,sort_order) values
  ('season_champion','Чемпион сезона','Победите в сезонном турнире','fa-trophy',1,1),
  ('sniper','Снайпер','1000 точных попаданий','fa-bullseye',1000,2),
  ('lightning','Молния','Победа за 5 минут','fa-bolt',1,3),
  ('legend','Легенда','Войти в топ-100','fa-crown',1,4),
  ('on_fire','На огне','10 побед подряд','fa-fire-flame-curved',10,5),
  ('collector','Коллекционер','Собрать 50 скинов','fa-gem',50,6)
on conflict(id) do nothing;

insert into public.tournaments(id,name,game_name,status,prize) values
  ('squadra-cup','Squadra Cup','CS2','live','₽ 500 000'),
  ('winter-league','Winter League','Dota 2','registration','₽ 250 000'),
  ('spring-championship','Spring Championship','Valorant','upcoming','₽ 1 000 000')
on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_library enable row level security;
alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.matchmaking_preferences enable row level security;
alter table public.activity_history enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.notifications enable row level security;

grant usage on schema public to authenticated;
grant select on public.profiles,public.teams,public.team_members,public.community_posts,public.community_post_likes,public.community_post_comments,public.achievements,public.user_achievements,public.tournaments to authenticated;
grant select,insert,update,delete on public.user_settings,public.user_library,public.friendships,public.direct_messages,public.teams,public.team_members,public.team_invites,public.matchmaking_preferences,public.activity_history,public.community_posts,public.community_post_likes,public.community_post_comments,public.tournament_registrations,public.notifications to authenticated;
revoke update on public.profiles from authenticated;
grant update(username,display_name,avatar_url,bio,game_name,region,language) on public.profiles to authenticated;
revoke update on public.friendships from authenticated;
grant update(status) on public.friendships to authenticated;
revoke update on public.direct_messages from authenticated;
grant update(read_at) on public.direct_messages to authenticated;
revoke update on public.team_invites from authenticated;
grant update(status) on public.team_invites to authenticated;

drop policy if exists "profiles visible to authenticated users" on public.profiles;
create policy "profiles visible to authenticated users" on public.profiles for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists "users manage own settings" on public.user_settings;
create policy "users manage own settings" on public.user_settings for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "users manage own library" on public.user_library;
create policy "users manage own library" on public.user_library for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "friend participants read requests" on public.friendships;
create policy "friend participants read requests" on public.friendships for select to authenticated using (requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists "users send friend requests" on public.friendships;
create policy "users send friend requests" on public.friendships for insert to authenticated with check (requester_id=(select auth.uid()) and status='pending' and requester_id<>addressee_id);
drop policy if exists "participants update friend requests" on public.friendships;
create policy "participants update friend requests" on public.friendships for update to authenticated using (requester_id=(select auth.uid()) or addressee_id=(select auth.uid())) with check (requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists "participants delete friend requests" on public.friendships;
create policy "participants delete friend requests" on public.friendships for delete to authenticated using (requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));

drop policy if exists "message participants read messages" on public.direct_messages;
create policy "message participants read messages" on public.direct_messages for select to authenticated using (sender_id=(select auth.uid()) or receiver_id=(select auth.uid()));
drop policy if exists "users send messages as self" on public.direct_messages;
create policy "users send messages to friends" on public.direct_messages for insert to authenticated with check (
  sender_id=(select auth.uid())
  and receiver_id<>(select auth.uid())
  and exists (
    select 1 from public.friendships f
    where f.status='accepted'
      and ((f.requester_id=(select auth.uid()) and f.addressee_id=receiver_id)
        or (f.addressee_id=(select auth.uid()) and f.requester_id=receiver_id))
  )
);
drop policy if exists "receivers mark messages read" on public.direct_messages;
create policy "receivers mark messages read" on public.direct_messages for update to authenticated using (receiver_id=(select auth.uid())) with check (receiver_id=(select auth.uid()));

drop policy if exists "authenticated users read teams" on public.teams;
create policy "authenticated users read teams" on public.teams for select to authenticated using (true);
drop policy if exists "users create own teams" on public.teams;
create policy "users create own teams" on public.teams for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy if exists "owners update own teams" on public.teams;
create policy "owners update own teams" on public.teams for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists "owners delete own teams" on public.teams;
create policy "owners delete own teams" on public.teams for delete to authenticated using (owner_id=(select auth.uid()));

drop policy if exists "authenticated users read team membership" on public.team_members;
create policy "authenticated users read team membership" on public.team_members for select to authenticated using (true);
drop policy if exists "team owners create owner membership" on public.team_members;
drop policy if exists "owners and accepted invitees join teams" on public.team_members;
create policy "owners and accepted invitees join teams" on public.team_members for insert to authenticated
with check (
  user_id=(select auth.uid()) and (
    (role='owner' and exists(select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())))
    or
    (role='member' and exists(select 1 from public.team_invites i where i.team_id=team_id and i.invitee_id=(select auth.uid()) and i.status='accepted'))
  )
);
drop policy if exists "team owners remove members" on public.team_members;
create policy "team owners remove members" on public.team_members for delete to authenticated
using (exists(select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));

drop policy if exists "team invite participants read invites" on public.team_invites;
create policy "team invite participants read invites" on public.team_invites for select to authenticated using (inviter_id=(select auth.uid()) or invitee_id=(select auth.uid()));
drop policy if exists "team owners invite users" on public.team_invites;
create policy "team owners invite users" on public.team_invites for insert to authenticated
with check (inviter_id=(select auth.uid()) and exists(select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));
drop policy if exists "invitee updates team invite" on public.team_invites;
create policy "invitee updates team invite" on public.team_invites for update to authenticated using (invitee_id=(select auth.uid())) with check (invitee_id=(select auth.uid()));
drop policy if exists "invite participants delete invites" on public.team_invites;
create policy "invite participants delete invites" on public.team_invites for delete to authenticated using (inviter_id=(select auth.uid()) or invitee_id=(select auth.uid()));

drop policy if exists "users manage own matchmaking preferences" on public.matchmaking_preferences;
create policy "users manage own matchmaking preferences" on public.matchmaking_preferences for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "users read own activity" on public.activity_history;
create policy "users read own activity" on public.activity_history for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "users add own activity" on public.activity_history;
create policy "users add own activity" on public.activity_history for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "users delete own activity" on public.activity_history;
create policy "users delete own activity" on public.activity_history for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists "achievements are readable" on public.achievements;
create policy "achievements are readable" on public.achievements for select to authenticated using (true);
drop policy if exists "users manage own achievement progress" on public.user_achievements;
create policy "users manage own achievement progress" on public.user_achievements for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "authenticated users read posts" on public.community_posts;
create policy "authenticated users read posts" on public.community_posts for select to authenticated using (true);
drop policy if exists "users create own posts" on public.community_posts;
create policy "users create own posts" on public.community_posts for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "authors update own posts" on public.community_posts;
create policy "authors update own posts" on public.community_posts for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "authors delete own posts" on public.community_posts;
create policy "authors delete own posts" on public.community_posts for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists "authenticated users read post likes" on public.community_post_likes;
create policy "authenticated users read post likes" on public.community_post_likes for select to authenticated using (true);
drop policy if exists "users like as self" on public.community_post_likes;
create policy "users like as self" on public.community_post_likes for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "users remove own likes" on public.community_post_likes;
create policy "users remove own likes" on public.community_post_likes for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists "authenticated users read comments" on public.community_post_comments;
create policy "authenticated users read comments" on public.community_post_comments for select to authenticated using (true);
drop policy if exists "users add own comments" on public.community_post_comments;
create policy "users add own comments" on public.community_post_comments for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "authors delete own comments" on public.community_post_comments;
create policy "authors delete own comments" on public.community_post_comments for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists "tournaments are readable" on public.tournaments;
create policy "tournaments are readable" on public.tournaments for select to authenticated using (true);
drop policy if exists "users manage own tournament registrations" on public.tournament_registrations;
create policy "users manage own tournament registrations" on public.tournament_registrations for all to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and (team_id is null or exists(
    select 1 from public.team_members tm where tm.team_id=tournament_registrations.team_id and tm.user_id=(select auth.uid())
  ))
);

drop policy if exists "users manage own notifications" on public.notifications;
create policy "users manage own notifications" on public.notifications for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists settings_touch_updated_at on public.user_settings;
create trigger settings_touch_updated_at before update on public.user_settings for each row execute function public.set_updated_at();
drop trigger if exists teams_touch_updated_at on public.teams;
create trigger teams_touch_updated_at before update on public.teams for each row execute function public.set_updated_at();
drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at before update on public.friendships for each row execute function public.set_updated_at();
drop trigger if exists matchmaking_touch_updated_at on public.matchmaking_preferences;
create trigger matchmaking_touch_updated_at before update on public.matchmaking_preferences for each row execute function public.set_updated_at();
drop trigger if exists posts_touch_updated_at on public.community_posts;
create trigger posts_touch_updated_at before update on public.community_posts for each row execute function public.set_updated_at();
drop trigger if exists achievements_touch_updated_at on public.user_achievements;
create trigger achievements_touch_updated_at before update on public.user_achievements for each row execute function public.set_updated_at();

-- The Google sign-in code only needs the public publishable key in index.html.
-- Never expose Supabase secret/service_role keys in the browser.

-- Index foreign keys used by ownership and participant queries.
create index if not exists community_post_comments_user_id_idx on public.community_post_comments(user_id);
create index if not exists community_post_likes_user_id_idx on public.community_post_likes(user_id);
create index if not exists community_posts_user_id_idx on public.community_posts(user_id);
create index if not exists team_invites_inviter_id_idx on public.team_invites(inviter_id);
create index if not exists tournament_registrations_team_id_idx on public.tournament_registrations(team_id);
create index if not exists tournament_registrations_user_id_idx on public.tournament_registrations(user_id);
create index if not exists user_achievements_achievement_id_idx on public.user_achievements(achievement_id);
