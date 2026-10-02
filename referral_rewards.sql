-- Referral rewards for existing EAT60 databases. Safe to rerun.
-- New customers receive 2,500 coins after redeeming a code; referrers can
-- claim 3,000 coins for each invited customer who has redeemed successfully.

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_signups (
  referred_user uuid primary key references public.profiles(id) on delete cascade,
  referrer_user uuid not null references public.profiles(id) on delete cascade,
  signup_code text not null,
  new_user_claimed boolean not null default false,
  referrer_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  new_user_claimed_at timestamptz,
  referrer_claimed_at timestamptz,
  constraint referral_signups_not_self check (referred_user <> referrer_user)
);

insert into public.referral_codes (user_id, code)
select p.id, 'EAT-' || upper(substr(replace(p.id::text, '-', ''), 1, 12))
from public.profiles p
on conflict (user_id) do nothing;

alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
revoke all on public.referral_codes, public.referral_signups from anon, authenticated;
grant select on public.referral_signups to authenticated;

drop policy if exists "referral signup parties can view" on public.referral_signups;
create policy "referral signup parties can view" on public.referral_signups
  for select to authenticated
  using (referred_user = auth.uid() or referrer_user = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_referral_code text;
  v_referrer uuid;
begin
  v_base := left(regexp_replace(lower(split_part(coalesce(new.email, 'player'), '@', 1)), '[^a-z0-9_]+', '_', 'g'), 13);
  insert into public.profiles (id, name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Player'),
    coalesce(nullif(v_base, ''), 'player') || '_' || substr(replace(new.id::text, '-', ''), 1, 10)
  )
  on conflict (id) do nothing;

  insert into public.referral_codes (user_id, code)
  values (new.id, 'EAT-' || upper(substr(replace(new.id::text, '-', ''), 1, 12)))
  on conflict (user_id) do nothing;

  v_referral_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  if v_referral_code <> '' then
    select user_id into v_referrer
    from public.referral_codes
    where code = v_referral_code;

    if v_referrer is not null and v_referrer <> new.id then
      insert into public.referral_signups (referred_user, referrer_user, signup_code)
      values (new.id, v_referrer, v_referral_code)
      on conflict (referred_user) do nothing;
    end if;
  end if;
  return new;
end $$;

create or replace function public.customer_referral_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_invites jsonb;
  v_pending_coins integer;
  v_can_redeem boolean;
  v_new_user_claimed boolean;
begin
  if v_user is null then raise exception 'Please log in first'; end if;

  select code into v_code from public.referral_codes where user_id = v_user;
  select coalesce(jsonb_agg(jsonb_build_object(
    'username', p.username,
    'joined_at', r.created_at,
    'claimed', r.new_user_claimed,
    'referrer_reward_claimed', r.referrer_claimed
  ) order by r.created_at desc), '[]'::jsonb)
  into v_invites
  from public.referral_signups r
  join public.profiles p on p.id = r.referred_user
  where r.referrer_user = v_user;

  select count(*)::integer * 3000 into v_pending_coins
  from public.referral_signups
  where referrer_user = v_user and new_user_claimed and not referrer_claimed;

  select exists(
    select 1 from public.referral_signups
    where referred_user = v_user and not new_user_claimed
  ) and not exists(select 1 from public.orders o where o.user_id = v_user)
  into v_new_user_claimed;

  select not exists(select 1 from public.referral_signups where referred_user = v_user)
    and not exists(select 1 from public.orders o where o.user_id = v_user)
  into v_can_redeem
  from public.profiles p where p.id = v_user;

  return jsonb_build_object(
    'code', v_code,
    'invites', v_invites,
    'pending_referrer_coins', coalesce(v_pending_coins, 0),
    'can_claim_new_user', coalesce(v_new_user_claimed, false),
    'can_redeem_code', coalesce(v_can_redeem, false)
  );
end $$;

create or replace function public.claim_referral_reward(p_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_referrer uuid;
  v_signup public.referral_signups%rowtype;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_created_at timestamptz;
begin
  if v_user is null then raise exception 'Please log in first'; end if;
  if exists(select 1 from public.orders where user_id = v_user) then
    raise exception 'Referral rewards must be claimed before your first order';
  end if;

  select * into v_signup from public.referral_signups
  where referred_user = v_user for update;

  if not found then
    if v_code = '' then raise exception 'Enter a referral code to continue'; end if;
    select created_at into v_created_at from public.profiles where id = v_user for update;
    if v_created_at is null or exists(select 1 from public.orders where user_id = v_user) then
      raise exception 'Referral codes are available to new customers only';
    end if;
    select user_id into v_referrer from public.referral_codes where code = v_code;
    if v_referrer is null then raise exception 'That referral code is not valid'; end if;
    if v_referrer = v_user then raise exception 'You cannot redeem your own referral code'; end if;

    insert into public.referral_signups (referred_user, referrer_user, signup_code)
    values (v_user, v_referrer, v_code)
    on conflict (referred_user) do nothing;
    select * into v_signup from public.referral_signups
    where referred_user = v_user for update;
  end if;

  if v_signup.new_user_claimed then raise exception 'Your referral reward has already been claimed'; end if;

  update public.referral_signups
  set new_user_claimed = true, new_user_claimed_at = now()
  where referred_user = v_user and not new_user_claimed;
  if not found then raise exception 'Your referral reward has already been claimed'; end if;

  update public.profiles set coins = coins + 2500 where id = v_user;
  return jsonb_build_object('coins_awarded', 2500, 'referrer_reward', 3000);
end $$;

create or replace function public.claim_referral_bonus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_invites integer;
  v_coins integer;
begin
  if v_user is null then raise exception 'Please log in first'; end if;

  update public.referral_signups
  set referrer_claimed = true, referrer_claimed_at = now()
  where referrer_user = v_user and new_user_claimed and not referrer_claimed;
  get diagnostics v_invites = row_count;
  v_coins := v_invites * 3000;

  if v_coins > 0 then
    update public.profiles set coins = coins + v_coins where id = v_user;
  end if;

  return jsonb_build_object('coins_awarded', v_coins, 'invites_claimed', v_invites);
end $$;

revoke all on function public.customer_referral_dashboard() from public, anon;
revoke all on function public.claim_referral_reward(text) from public, anon;
revoke all on function public.claim_referral_bonus() from public, anon;
grant execute on function public.customer_referral_dashboard() to authenticated;
grant execute on function public.claim_referral_reward(text) to authenticated;
grant execute on function public.claim_referral_bonus() to authenticated;
notify pgrst, 'reload schema';
