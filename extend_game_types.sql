-- Adds Flying Burger to the existing game's database rules.
-- Run once in Supabase SQL Editor for a database already set up with eat60_supabase.sql.
alter table public.game_scores
  drop constraint if exists game_scores_game_check;

alter table public.game_scores
  add constraint game_scores_game_check
  check (game in ('snake', 'burger', 'qmaths'));

create or replace function public.submit_game_score(p_game text, p_score int, p_duration_ms int)
returns json language plpgsql security definer set search_path = public as $$
declare s settings%rowtype; v_xp int; v_coins int; v_today int; v_max int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into s from settings where id = 1;
  if p_game not in ('snake','burger','qmaths') or p_score < 0 or p_duration_ms < 1000 then
    raise exception 'Invalid score';
  end if;
  v_max := case p_game when 'snake' then p_duration_ms / 140 else p_duration_ms / 600 end;
  if p_game = 'burger' and p_duration_ms > 25000 then raise exception 'Invalid score'; end if;
  if p_game = 'qmaths' and p_duration_ms > 125000 then raise exception 'Invalid score'; end if;
  if p_score > v_max then raise exception 'Invalid score'; end if;
  if exists (
    select 1 from game_scores
    where user_id = auth.uid() and played_at > now() - interval '5 seconds'
  ) then raise exception 'Slow down a little'; end if;

  select coalesce(sum(coins), 0) into v_today from game_scores
  where user_id = auth.uid()
    and (played_at at time zone 'Asia/Kolkata')::date = today_ist();
  v_xp := p_score * 10;
  v_coins := greatest(0, least(p_score, s.daily_coin_cap - v_today));

  insert into game_scores (user_id, game, score, duration_ms, xp, coins)
  values (auth.uid(), p_game, p_score, p_duration_ms, v_xp, v_coins);
  update profiles set xp = xp + v_xp, coins = coins + v_coins where id = auth.uid();
  return json_build_object('xp', v_xp, 'coins', v_coins);
end $$;

notify pgrst, 'reload schema';
