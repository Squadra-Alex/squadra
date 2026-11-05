alter table public.user_settings
  add column if not exists notify_friend_requests boolean not null default true,
  add column if not exists notify_events boolean not null default true;

