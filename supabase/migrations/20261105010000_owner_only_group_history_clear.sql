-- Only the group owner can clear the group's full message history.
-- Members may still delete messages they authored individually.
drop policy if exists "Authors delete group messages" on public.community_group_messages;
drop policy if exists "Group owners and admins delete group messages" on public.community_group_messages;
drop policy if exists "Group owners delete group messages" on public.community_group_messages;
drop policy if exists "Authors delete own group messages" on public.community_group_messages;

create policy "Authors delete own group messages"
on public.community_group_messages
for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Group owners delete group messages"
on public.community_group_messages
for delete to authenticated
using (
  exists (
    select 1
    from public.community_groups g
    where g.id = community_group_messages.group_id
      and g.owner_id = (select auth.uid())
  )
);
