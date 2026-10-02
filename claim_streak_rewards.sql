-- Allows a customer to claim a streak milestone they have reached.
-- Run this once in Supabase SQL Editor on an existing installation.
alter table public.streak_rewards
  add column if not exists is_active boolean not null default true;
alter table public.streak_rewards
  add column if not exists coin_reward int not null default 0 check (coin_reward >= 0);
alter table public.user_rewards
  add column if not exists coin_reward int not null default 0 check (coin_reward >= 0);
alter table public.streak_rewards
  add column if not exists coupon_code text;
alter table public.user_rewards
  add column if not exists coupon_code text;

create or replace function public.claim_streak_reward(p_milestone int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gift text; v_coin_reward int; v_coupon_code text; v_coins_awarded int := 0; v_best int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select gift, coin_reward, coupon_code into v_gift, v_coin_reward, v_coupon_code from public.streak_rewards
  where milestone = p_milestone and is_active for update;
  if v_gift is null then raise exception 'That streak reward does not exist'; end if;
  select greatest(coalesce(longest_streak, 0), coalesce(streak, 0)) into v_best from public.profiles where id = auth.uid();
  if coalesce(v_best, 0) < p_milestone then raise exception 'Keep your order streak going to unlock this reward'; end if;
  insert into public.user_rewards (user_id, milestone, gift, coin_reward, coupon_code)
  values (auth.uid(), p_milestone, v_gift, v_coin_reward, v_coupon_code)
  on conflict (user_id, milestone) do nothing;
  update public.user_rewards set claimed = true, gift = v_gift, coin_reward = v_coin_reward, coupon_code = v_coupon_code
  where user_id = auth.uid() and milestone = p_milestone
    and (claimed = false or (coin_reward = 0 and v_coin_reward > 0))
  returning coin_reward into v_coins_awarded;
  if found and v_coins_awarded > 0 then
    update public.profiles set coins = coins + v_coins_awarded where id = auth.uid();
  else
    v_coins_awarded := 0;
  end if;
  return jsonb_build_object('milestone', p_milestone, 'gift', v_gift, 'claimed', true, 'coins_awarded', v_coins_awarded, 'coupon_code', v_coupon_code);
end $$;

revoke all on function public.claim_streak_reward(int) from public, anon;
grant execute on function public.claim_streak_reward(int) to authenticated;
notify pgrst, 'reload schema';
