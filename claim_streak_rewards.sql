-- Allows a customer to claim a streak milestone they have reached.
-- Run this once in Supabase SQL Editor on an existing installation.
create or replace function public.claim_streak_reward(p_milestone int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gift text; v_best int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select gift into v_gift from public.streak_rewards where milestone = p_milestone;
  if v_gift is null then raise exception 'That streak reward does not exist'; end if;
  select greatest(coalesce(longest_streak, 0), coalesce(streak, 0)) into v_best from public.profiles where id = auth.uid();
  if coalesce(v_best, 0) < p_milestone then raise exception 'Keep your order streak going to unlock this reward'; end if;
  insert into public.user_rewards (user_id, milestone, gift)
  values (auth.uid(), p_milestone, v_gift) on conflict (user_id, milestone) do nothing;
  update public.user_rewards set claimed = true
  where user_id = auth.uid() and milestone = p_milestone and claimed = false;
  return jsonb_build_object('milestone', p_milestone, 'gift', v_gift, 'claimed', true);
end $$;

revoke all on function public.claim_streak_reward(int) from public, anon;
grant execute on function public.claim_streak_reward(int) to authenticated;
notify pgrst, 'reload schema';
