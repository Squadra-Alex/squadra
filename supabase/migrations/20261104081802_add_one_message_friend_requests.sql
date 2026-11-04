alter table public.friendships add column if not exists message_request boolean not null default false;
alter table public.direct_messages add column if not exists request_friendship_id uuid references public.friendships(id) on delete cascade;
create unique index if not exists direct_messages_one_request_message_idx on public.direct_messages(request_friendship_id) where request_friendship_id is not null;

drop policy if exists "users send messages to friends" on public.direct_messages;
create policy "users send messages to friends or one message request"
on public.direct_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and receiver_id <> (select auth.uid())
  and (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = (select auth.uid()) and f.addressee_id = direct_messages.receiver_id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = direct_messages.receiver_id))
    )
    or (
      request_friendship_id is not null
      and exists (
        select 1 from public.friendships f
        where f.id = direct_messages.request_friendship_id
          and f.message_request = true
          and f.status = 'pending'
          and f.requester_id = (select auth.uid())
          and f.addressee_id = direct_messages.receiver_id
      )
    )
  )
);

create or replace function public.send_initial_message(p_receiver uuid, p_body text)
returns setof public.direct_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sender uuid := auth.uid();
  v_friendship public.friendships%rowtype;
  v_message public.direct_messages%rowtype;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_receiver is null or p_receiver = v_sender then raise exception 'INVALID_RECIPIENT'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 4000 then raise exception 'INVALID_MESSAGE'; end if;

  if exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_sender and f.addressee_id = p_receiver)
        or (f.addressee_id = v_sender and f.requester_id = p_receiver))
  ) then
    insert into public.direct_messages(sender_id, receiver_id, body)
    values (v_sender, p_receiver, btrim(p_body))
    returning * into v_message;
    return next v_message;
    return;
  end if;

  select * into v_friendship
  from public.friendships f
  where (f.requester_id = v_sender and f.addressee_id = p_receiver)
     or (f.requester_id = p_receiver and f.addressee_id = v_sender)
  order by (f.status = 'pending' and f.message_request) desc, f.created_at desc
  limit 1
  for update;

  if not found then
    insert into public.friendships(requester_id, addressee_id, status, message_request)
    values (v_sender, p_receiver, 'pending', true)
    returning * into v_friendship;
  elsif v_friendship.status = 'pending'
    and v_friendship.message_request
    and v_friendship.requester_id = v_sender
    and v_friendship.addressee_id = p_receiver then
    null;
  else
    raise exception 'FRIEND_REQUEST_REQUIRED';
  end if;

  insert into public.direct_messages(sender_id, receiver_id, body, request_friendship_id)
  values (v_sender, p_receiver, btrim(p_body), v_friendship.id)
  returning * into v_message;
  return next v_message;
end;
$$;

revoke all on function public.send_initial_message(uuid, text) from public, anon;
grant execute on function public.send_initial_message(uuid, text) to authenticated;