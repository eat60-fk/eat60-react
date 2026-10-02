-- Home-page ad banners and voucher-backed streak rewards.
-- Run after admin_operations.sql on an existing EAT60 database. Safe to rerun.

alter table public.settings
  add column if not exists home_ad_image_url text not null default '',
  add column if not exists home_ad_link text not null default '',
  add column if not exists home_ad_alt text not null default '',
  add column if not exists home_ad_active boolean not null default false,
  add column if not exists home_ad_starts_at timestamptz,
  add column if not exists home_ad_ends_at timestamptz;

alter table public.coupons
  add column if not exists is_streak_reward boolean not null default false;
alter table public.streak_rewards
  add column if not exists coupon_code text;
alter table public.user_rewards
  add column if not exists coupon_code text;

alter table public.streak_rewards enable row level security;
drop policy if exists "read" on public.streak_rewards;
drop policy if exists "read streak rewards" on public.streak_rewards;
create policy "read streak rewards" on public.streak_rewards for select using (public.is_admin());

create or replace function public.customer_streak_rewards()
returns table(milestone int, gift text, coin_reward int, has_voucher boolean)
language sql stable security definer set search_path = public as $$
  select r.milestone, r.gift, r.coin_reward, r.coupon_code is not null
  from public.streak_rewards r
  where r.is_active and auth.uid() is not null
  order by r.milestone
$$;

create or replace function public.admin_save_streak_reward(
  p_milestone int,
  p_gift text,
  p_coin_reward int default 0,
  p_coupon_code text default null,
  p_discount_type text default null,
  p_discount_value int default null,
  p_minimum_order int default 0,
  p_maximum_discount int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_milestone is null or p_milestone < 1 then raise exception 'Enter a streak milestone greater than zero'; end if;
  if nullif(trim(coalesce(p_gift, '')), '') is null then raise exception 'Enter a reward description'; end if;
  if coalesce(p_coin_reward, -1) < 0 then raise exception 'Coin reward cannot be negative'; end if;

  if v_code is not null then
    if v_code !~ '^[A-Z0-9_-]{3,32}$' then raise exception 'Voucher code must be 3–32 letters, numbers, underscores, or hyphens'; end if;
    if p_discount_type not in ('percent', 'fixed') or coalesce(p_discount_value, 0) < 1 then
      raise exception 'Enter valid voucher discount details';
    end if;
    if p_discount_type = 'percent' and p_discount_value > 100 then
      raise exception 'Percentage discount cannot be greater than 100';
    end if;
    if coalesce(p_minimum_order, -1) < 0 or (p_maximum_discount is not null and p_maximum_discount < 1) then
      raise exception 'Voucher order limits must be valid non-negative amounts';
    end if;
    if exists (
      select 1 from public.coupons c
      where c.code = v_code
        and not exists (select 1 from public.streak_rewards r where r.coupon_code = v_code and r.milestone = p_milestone)
    ) then
      raise exception 'That code is already used by another coupon';
    end if;
    insert into public.coupons (
      code, description, discount_type, discount_value, minimum_order,
      maximum_discount, usage_limit, per_user_limit, starts_at, expires_at,
      is_active, is_streak_reward
    ) values (
      v_code, 'Streak reward · day ' || p_milestone, p_discount_type, p_discount_value,
      coalesce(p_minimum_order, 0), p_maximum_discount, null, 1, null, null, true, true
    )
    on conflict (code) do update set
      description = excluded.description,
      discount_type = excluded.discount_type,
      discount_value = excluded.discount_value,
      minimum_order = excluded.minimum_order,
      maximum_discount = excluded.maximum_discount,
      usage_limit = null,
      per_user_limit = 1,
      starts_at = null,
      expires_at = null,
      is_active = true,
      is_streak_reward = true;
  elsif p_discount_type is not null or p_discount_value is not null then
    raise exception 'Enter a voucher code to save the voucher discount';
  end if;

  insert into public.streak_rewards (milestone, gift, coin_reward, coupon_code, is_active)
  values (p_milestone, trim(p_gift), p_coin_reward, v_code, true)
  on conflict (milestone) do update set
    gift = excluded.gift,
    coin_reward = excluded.coin_reward,
    coupon_code = excluded.coupon_code,
    is_active = true;
end $$;

create or replace function public.claim_streak_reward(p_milestone int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_gift text;
  v_coin_reward int;
  v_coupon_code text;
  v_coins_awarded int := 0;
  v_best int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select gift, coin_reward, coupon_code
  into v_gift, v_coin_reward, v_coupon_code
  from public.streak_rewards
  where milestone = p_milestone and is_active for update;
  if v_gift is null then raise exception 'This streak reward is not available'; end if;
  select greatest(coalesce(longest_streak, 0), coalesce(streak, 0))
  into v_best from public.profiles where id = auth.uid();
  if coalesce(v_best, 0) < p_milestone then raise exception 'Keep your order streak going to unlock this reward'; end if;

  insert into public.user_rewards (user_id, milestone, gift, coin_reward, coupon_code)
  values (auth.uid(), p_milestone, v_gift, v_coin_reward, v_coupon_code)
  on conflict (user_id, milestone) do nothing;

  update public.user_rewards
  set claimed = true, gift = v_gift, coin_reward = v_coin_reward, coupon_code = v_coupon_code
  where user_id = auth.uid() and milestone = p_milestone
    and (claimed = false or (coin_reward = 0 and v_coin_reward > 0))
  returning coin_reward into v_coins_awarded;

  if found and v_coins_awarded > 0 then
    update public.profiles set coins = coins + v_coins_awarded where id = auth.uid();
  else
    v_coins_awarded := 0;
  end if;
  return jsonb_build_object(
    'milestone', p_milestone, 'gift', v_gift, 'claimed', true,
    'coins_awarded', v_coins_awarded, 'coupon_code', v_coupon_code
  );
end $$;

create or replace function public.customer_available_coupons()
returns table(
  code text,
  description text,
  discount_type text,
  discount_value int,
  minimum_order int,
  maximum_discount int,
  expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.code,c.description,c.discount_type,c.discount_value,c.minimum_order,c.maximum_discount,c.expires_at
  from public.coupons c
  where auth.uid() is not null
    and c.is_active
    and (c.starts_at is null or now() >= c.starts_at)
    and (c.expires_at is null or now() < c.expires_at)
    and (c.usage_limit is null or c.used_count < c.usage_limit)
    and (select count(*) from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = auth.uid()) < c.per_user_limit
    and (
      not c.is_streak_reward
      or exists (select 1 from public.user_rewards ur where ur.user_id = auth.uid() and ur.coupon_code = c.code and ur.claimed)
    )
  order by c.created_at desc
$$;

revoke all on function public.admin_save_streak_reward(int, text, int, text, text, int, int, int) from public, anon;
revoke all on function public.customer_streak_rewards() from public, anon;
grant execute on function public.admin_save_streak_reward(int, text, int, text, text, int, int, int) to authenticated;
grant execute on function public.claim_streak_reward(int) to authenticated;
grant execute on function public.customer_available_coupons() to authenticated;
grant execute on function public.customer_streak_rewards() to authenticated;
notify pgrst, 'reload schema';
