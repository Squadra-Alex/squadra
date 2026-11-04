drop policy if exists "participants update friend requests" on public.friendships;
create policy "addressees respond to friend requests"
on public.friendships for update to authenticated
using (addressee_id = (select auth.uid()))
with check (addressee_id = (select auth.uid()));