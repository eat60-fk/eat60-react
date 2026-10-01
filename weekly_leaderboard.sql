-- Adds real week-over-week movement to the weekly league standings.
-- Run this once in Supabase SQL Editor on an existing installation.
drop function if exists public.get_leaderboard();

create function public.get_leaderboard()
returns table (rank bigint, previous_rank bigint, name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with week_bounds as (
    select date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as this_week,
           (date_trunc('week', now() at time zone 'Asia/Kolkata') - interval '7 days') at time zone 'Asia/Kolkata' as last_week
  ), current_scores as (
    select g.user_id, p.name, sum(g.xp)::bigint as xp
    from game_scores g join profiles p on p.id = g.user_id cross join week_bounds w
    where g.played_at >= w.this_week
    group by g.user_id, p.name
  ), previous_scores as (
    select g.user_id, rank() over (order by sum(g.xp) desc) as previous_rank
    from game_scores g cross join week_bounds w
    where g.played_at >= w.last_week and g.played_at < w.this_week
    group by g.user_id
  )
  select rank() over (order by c.xp desc), ps.previous_rank, c.name, c.xp, (c.user_id = auth.uid())
  from current_scores c left join previous_scores ps on ps.user_id = c.user_id
  order by 1 limit 20 $$;

revoke all on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;
notify pgrst, 'reload schema';
