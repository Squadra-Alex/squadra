create or replace function private.notify_team_join_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_name text;
  enabled boolean;
  message_text text;
begin
  if old.status is not distinct from new.status or new.status not in ('accepted','declined') then
    return new;
  end if;
  select t.name into team_name from public.teams t where t.id=new.team_id;
  select coalesce(s.notify_team_invites,true) into enabled from public.user_settings s where s.user_id=new.user_id;
  if coalesce(enabled,true) then
    message_text := case when new.status='accepted'
      then 'Заявку в команду «'||coalesce(team_name,'')||'» приняли.'
      else 'Заявку в команду «'||coalesce(team_name,'')||'» отклонили.' end;
    insert into public.notifications(user_id,kind,body,source_type,source_id,actor_id)
    values(new.user_id,'team_join_decision',message_text,'team',new.team_id::text,auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.notify_team_join_decision() from public,anon,authenticated;
drop trigger if exists notify_team_join_decision on public.team_join_requests;
create trigger notify_team_join_decision
after update of status on public.team_join_requests
for each row execute function private.notify_team_join_decision();
