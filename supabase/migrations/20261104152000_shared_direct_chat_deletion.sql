create table if not exists public.direct_chat_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  peer_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, peer_id),
  constraint direct_chat_states_not_self check (user_id <> peer_id)
);
alter table public.direct_chat_states enable row level security;
create policy "chat participants read deletion state" on public.direct_chat_states for select to authenticated using (user_id = (select auth.uid()) or peer_id = (select auth.uid()));
create policy "users hide own chat" on public.direct_chat_states for insert to authenticated with check (user_id = (select auth.uid()) and peer_id <> (select auth.uid()));
create policy "users update own chat state" on public.direct_chat_states for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and peer_id <> (select auth.uid()));
create policy "users unhide own chat" on public.direct_chat_states for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.direct_chat_states to authenticated;
create policy "participants delete chat after both hide" on public.direct_messages for delete to authenticated using (
 (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
 and exists (select 1 from public.direct_chat_states s where s.user_id = direct_messages.sender_id and s.peer_id = direct_messages.receiver_id)
 and exists (select 1 from public.direct_chat_states s where s.user_id = direct_messages.receiver_id and s.peer_id = direct_messages.sender_id)
);
create or replace function public.reset_chat_deletion_after_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 delete from public.direct_chat_states
 where (user_id = new.sender_id and peer_id = new.receiver_id)
    or (user_id = new.receiver_id and peer_id = new.sender_id);
 return new;
end;
$$;
revoke all on function public.reset_chat_deletion_after_message() from public, anon, authenticated;
create trigger reset_chat_deletion_after_message after insert on public.direct_messages
for each row execute function public.reset_chat_deletion_after_message();
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_chat_states') then
  alter publication supabase_realtime add table public.direct_chat_states;
 end if;
end $$;