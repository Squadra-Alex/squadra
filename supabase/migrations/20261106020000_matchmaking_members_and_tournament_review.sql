alter table public.tournament_registrations
  add column if not exists status text not null default 'pending'
    check (status in ('pending','approved','rejected'));

drop policy if exists "admins review tournament registrations" on public.tournament_registrations;
create policy "admins review tournament registrations" on public.tournament_registrations
  for update to authenticated
  using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
  with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

create table if not exists public.matchmaking_post_members (
  post_id uuid not null references public.matchmaking_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.matchmaking_post_members enable row level security;
grant select,insert,delete on public.matchmaking_post_members to authenticated;
drop policy if exists "authenticated read matchmaking members" on public.matchmaking_post_members;
create policy "authenticated read matchmaking members" on public.matchmaking_post_members
  for select to authenticated using (true);
drop policy if exists "users join matchmaking as self" on public.matchmaking_post_members;
create policy "users join matchmaking as self" on public.matchmaking_post_members
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists(
      select 1 from public.matchmaking_posts p where p.id=post_id
      and (select count(*) from public.matchmaking_post_members m where m.post_id=p.id)<5
    )
  );
drop policy if exists "users leave matchmaking as self" on public.matchmaking_post_members;
create policy "users leave matchmaking as self" on public.matchmaking_post_members
  for delete to authenticated using (user_id=(select auth.uid()));
create index if not exists matchmaking_post_members_user_idx on public.matchmaking_post_members(user_id);

alter publication supabase_realtime add table public.matchmaking_post_members;
alter publication supabase_realtime add table public.tournament_registrations;
