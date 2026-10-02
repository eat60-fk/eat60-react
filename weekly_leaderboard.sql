-- Weekly top-three-per-day standings and automatically credited prizes.
-- Run after extend_game_types.sql on existing Supabase installations.
create extension if not exists pg_cron with schema pg_catalog;
do $$
declare v_job record;
begin
  for v_job in select jobid from cron.job where jobname in ('eat60-weekly-game-rewards', 'eat60-monthly-city-champions') loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;
drop function if exists public.get_city_leaderboard();
drop function if exists public.settle_monthly_city_champions();

create table if not exists public.weekly_game_rewards (
  week_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null check (rank between 1 and 10),
  coins int not null check (coins > 0),
  awarded_at timestamptz not null default now(),
  primary key (week_start, user_id),
  unique (week_start, rank)
);

alter table public.weekly_game_rewards enable row level security;
revoke all on public.weekly_game_rewards from public, anon, authenticated;

create or replace function public.get_leaderboard()
returns table (rank bigint, previous_rank bigint, name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with week_bounds as (
    select date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as this_week,
           (date_trunc('week', now() at time zone 'Asia/Kolkata') - interval '7 days') at time zone 'Asia/Kolkata' as last_week
  ), ranked_plays as (
    select g.user_id, g.xp, g.played_at, g.id,
      row_number() over (
        partition by g.user_id, (g.played_at at time zone 'Asia/Kolkata')::date
        order by g.xp desc, g.played_at, g.id
      ) as daily_play
    from public.game_scores g
  ), current_scores as (
    select g.user_id, p.name, sum(g.xp)::bigint as xp
    from ranked_plays g join public.profiles p on p.id = g.user_id cross join week_bounds w
    where g.played_at >= w.this_week and g.daily_play <= 3
    group by g.user_id, p.name
  ), previous_scores as (
    select g.user_id, row_number() over (order by sum(g.xp) desc, g.user_id) as previous_rank
    from ranked_plays g cross join week_bounds w
    where g.played_at >= w.last_week and g.played_at < w.this_week and g.daily_play <= 3
    group by g.user_id
  )
  select rank() over (order by c.xp desc, c.user_id), ps.previous_rank, c.name, c.xp, (c.user_id = auth.uid())
  from current_scores c left join previous_scores ps on ps.user_id = c.user_id
  order by 1 limit 20
$$;

create or replace function public.settle_weekly_game_rewards()
returns integer language plpgsql security definer set search_path = public as $$
declare v_week_start date; v_previous_week date; v_awarded integer;
begin
  v_week_start := date_trunc('week', now() at time zone 'Asia/Kolkata')::date;
  v_previous_week := v_week_start - 7;
  with week_bounds as (
    select v_previous_week::timestamp at time zone 'Asia/Kolkata' as week_start,
           v_week_start::timestamp at time zone 'Asia/Kolkata' as week_end
  ), ranked_plays as (
    select g.user_id, g.xp, g.played_at, g.id,
      row_number() over (
        partition by g.user_id, (g.played_at at time zone 'Asia/Kolkata')::date
        order by g.xp desc, g.played_at, g.id
      ) as daily_play
    from public.game_scores g cross join week_bounds w
    where g.played_at >= w.week_start and g.played_at < w.week_end
  ), totals as (
    select user_id, sum(xp)::integer as total_xp
    from ranked_plays where daily_play <= 3 group by user_id
  ), winners as (
    select user_id, row_number() over (order by total_xp desc, user_id)::integer as place
    from totals
  ), inserted as (
    insert into public.weekly_game_rewards(week_start, user_id, rank, coins)
    select v_previous_week, user_id, place,
      case place when 1 then 500 when 2 then 300 when 3 then 200 else 100 end
    from winners where place <= 10
    on conflict (week_start, user_id) do nothing
    returning user_id, coins
  )
  update public.profiles p set coins = p.coins + i.coins
  from inserted i where p.id = i.user_id;
  get diagnostics v_awarded = row_count;
  return v_awarded;
end $$;

revoke all on function public.get_leaderboard() from public, anon;
revoke all on function public.settle_weekly_game_rewards() from public, anon, authenticated;
grant execute on function public.get_leaderboard() to authenticated;
do $$
begin
  perform cron.schedule('eat60-weekly-game-rewards', '35 18 * * 0', 'select public.settle_weekly_game_rewards();');
end $$;

notify pgrst, 'reload schema';
