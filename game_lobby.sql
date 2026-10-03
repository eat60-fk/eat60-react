-- Per-game lobby scores for the customer pre-game screen.
-- Run this once in Supabase SQL Editor after the existing game score setup.
-- The function returns only the public top ten and the caller's own best/rank.

create or replace function public.get_game_lobby(p_game text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_top_ten jsonb;
  v_my_best integer;
  v_my_rank bigint;
  v_active_players integer;
begin
  if auth.uid() is null then
    raise exception 'Please log in first';
  end if;

  if p_game is null or p_game not in ('snake', 'burger', 'qmaths', 'rider') then
    raise exception 'Invalid game';
  end if;

  with best_by_player as (
    select
      scores.user_id,
      profiles.name,
      max(scores.score)::integer as best_score
    from public.game_scores as scores
    join public.profiles as profiles on profiles.id = scores.user_id
    where scores.game = p_game
    group by scores.user_id, profiles.name
  ), ranked_players as (
    select
      row_number() over (order by best_score desc, lower(name), user_id) as player_rank,
      user_id,
      name,
      best_score
    from best_by_player
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', player_rank,
        'name', name,
        'score', best_score
      ) order by player_rank
    ) filter (where player_rank <= 10),
    '[]'::jsonb
  )
  into v_top_ten
  from ranked_players;

  with best_by_player as (
    select
      scores.user_id,
      profiles.name,
      max(scores.score)::integer as best_score
    from public.game_scores as scores
    join public.profiles as profiles on profiles.id = scores.user_id
    where scores.game = p_game
    group by scores.user_id, profiles.name
  ), ranked_players as (
    select
      row_number() over (order by best_score desc, lower(name), user_id) as player_rank,
      user_id,
      best_score
    from best_by_player
  )
  select best_score, player_rank
  into v_my_best, v_my_rank
  from ranked_players
  where user_id = auth.uid();

  select count(distinct scores.user_id)::integer
  into v_active_players
  from public.game_scores as scores
  where scores.game = p_game
    and scores.played_at >= date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';

  return jsonb_build_object(
    'game', p_game,
    'top_players', v_top_ten,
    'my_best_score', v_my_best,
    'my_rank', v_my_rank,
    'active_players', v_active_players
  );
end;
$$;

revoke all on function public.get_game_lobby(text) from public, anon;
grant execute on function public.get_game_lobby(text) to authenticated;

notify pgrst, 'reload schema';
