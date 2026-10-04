-- Start customer activity fresh while retaining all customer profiles and menu data.
-- This permanently deletes order/game history and resets customer reward balances.
-- Review the scope before running in Supabase SQL Editor.

begin;

-- Cascades remove each order's items, reviews, coupon redemption, and stage events.
-- RESTART IDENTITY resets the generated order numbers as well.
truncate table public.orders restart identity cascade;

truncate table public.game_scores, public.game_sessions,
  public.weekly_game_rewards, public.user_rewards restart identity cascade;

-- Preserve profile identity and contact details, but reset progress and wallet value.
update public.profiles
set coins = 0,
    xp = 0,
    streak = 0,
    longest_streak = 0,
    last_order_date = null;

-- Keep coupon definitions and limits, but clear their historical redemption counts.
update public.coupons
set used_count = 0;

commit;
