create or replace function private.game_player_counts()
returns table (game_name text, player_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select g.name, count(p.id)::bigint
  from public.games as g
  left join public.profiles as p on p.game_name = g.name
  where g.is_active is true
  group by g.name
  order by g.name;
$function$;

revoke all on function private.game_player_counts() from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.game_player_counts() to anon, authenticated;

create or replace function public.get_game_player_counts()
returns table (game_name text, player_count bigint)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.game_player_counts();
$function$;

revoke all on function public.get_game_player_counts() from public;
grant execute on function public.get_game_player_counts() to anon, authenticated;
