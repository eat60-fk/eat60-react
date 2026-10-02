-- Upgrade game scoring to server-timed sessions and capped daily game coins.
-- Run after admin_operations.sql on existing Supabase installations.
alter table public.game_scores
  drop constraint if exists game_scores_game_check;

alter table public.game_scores
  add constraint game_scores_game_check
  check (game in ('snake', 'burger', 'qmaths', 'rider'));

alter table public.settings
  alter column daily_coin_cap set default 125;
update public.settings set daily_coin_cap = 125 where daily_coin_cap = 50;

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('snake','burger','qmaths','rider')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz
);
alter table public.game_sessions
  drop constraint if exists game_sessions_game_check;

alter table public.game_sessions
  add constraint game_sessions_game_check
  check (game in ('snake', 'burger', 'qmaths', 'rider'));

create index if not exists game_sessions_user_started_idx
  on public.game_sessions(user_id, started_at desc);
alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from public, anon, authenticated;

drop function if exists public.submit_game_score(text, int, int);

create or replace function public.start_game_session(p_game text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_session_id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if p_game is null or p_game not in ('snake','burger','qmaths','rider') then raise exception 'Invalid game'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Player profile not found'; end if;
  if exists(select 1 from public.game_sessions where user_id=auth.uid() and started_at>now()-interval '5 seconds') then
    raise exception 'Slow down a little';
  end if;
  insert into public.game_sessions(user_id,game,started_at,expires_at)
  values(
    auth.uid(),p_game,now()+interval '5 seconds',
    now()+interval '5 seconds'+case p_game when 'snake' then interval '10 minutes' when 'burger' then interval '10 minutes' when 'rider' then interval '10 minutes' else interval '140 seconds' end
  )
  returning id into v_session_id;
  return v_session_id;
end $$;

create or replace function public.submit_game_score(p_session_id uuid,p_score int)
returns json language plpgsql security definer set search_path=public as $$
declare s public.settings%rowtype; p public.profiles%rowtype; v_session public.game_sessions%rowtype;
        v_xp int; v_coins int; v_today int; v_max int; v_target_score int; v_duration_ms int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if p_session_id is null or p_score is null or p_score<0 then raise exception 'Invalid score'; end if;
  select * into v_session from public.game_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found or v_session.completed_at is not null then raise exception 'Game session is invalid or already used'; end if;
  if now()>v_session.expires_at then raise exception 'Game session expired'; end if;
  v_duration_ms:=floor(extract(epoch from (now()-v_session.started_at))*1000)::int;
  if (v_session.game='qmaths' and v_duration_ms<115000)
    or (v_session.game<>'qmaths' and v_duration_ms<2000) then
    raise exception 'Game session ended too early';
  end if;
  v_max:=case v_session.game when 'snake' then (v_duration_ms/140)*10 when 'burger' then (v_duration_ms/1200)*10 when 'rider' then (v_duration_ms/1200)*10 else v_duration_ms/600 end;
  if p_score>v_max then raise exception 'Invalid score'; end if;

  select * into p from public.profiles where id=auth.uid() for update;
  select * into s from public.settings where id=1;
  select coalesce(sum(coins),0) into v_today from public.game_scores
  where user_id=auth.uid() and (played_at at time zone 'Asia/Kolkata')::date=public.today_ist();
  -- Arcade scores use their validated game scale; Maths stores correct answers.
  v_target_score:=case v_session.game when 'snake' then 300 when 'burger' then 200 when 'rider' then 200 else 15 end;
  v_xp:=10+round(50*least(p_score::numeric/v_target_score,1))::integer;
  v_coins:=greatest(0,least(p_score,s.daily_coin_cap-v_today));

  update public.game_sessions set completed_at=now() where id=v_session.id;
  insert into public.game_scores(user_id,game,score,duration_ms,xp,coins)
  values(auth.uid(),v_session.game,p_score,v_duration_ms,v_xp,v_coins);
  update public.profiles set xp=xp+v_xp,coins=coins+v_coins where id=auth.uid();
  return json_build_object('xp',v_xp,'coins',v_coins,'duration_ms',v_duration_ms);
end $$;

revoke all on function public.start_game_session(text) from public, anon;
revoke all on function public.submit_game_score(uuid,int) from public, anon;
grant execute on function public.start_game_session(text) to authenticated;
grant execute on function public.submit_game_score(uuid,int) to authenticated;
notify pgrst, 'reload schema';
