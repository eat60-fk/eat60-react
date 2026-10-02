begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(50);

create temporary table eat60_test_fixture (
  customer_id uuid not null,
  admin_id uuid not null,
  game_session uuid,
  brand_id text,
  menu_item_id bigint,
  variant_id bigint,
  extra_id bigint,
  coupon_code text,
  order_id bigint
);
grant select, insert, update on eat60_test_fixture to authenticated;

insert into eat60_test_fixture (customer_id, admin_id)
values (gen_random_uuid(), gen_random_uuid());

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
select customer_id, 'authenticated', 'authenticated',
       'eat60-customer-' || replace(customer_id::text, '-', '') || '@example.test',
       '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from eat60_test_fixture
union all
select admin_id, 'authenticated', 'authenticated',
       'eat60-admin-' || replace(admin_id::text, '-', '') || '@example.test',
       '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from eat60_test_fixture;

update public.profiles
set coins = 10000, xp = 0, streak = 0, longest_streak = 0, last_order_date = null,
    city = 'Ballia'
where id = (select customer_id from eat60_test_fixture);
update public.profiles
set role = 'admin'
where id = (select admin_id from eat60_test_fixture);

update public.settings
set delivery_fee = 20, min_order = 1, min_delivery_km = 2, delivery_per_km = 5,
    free_delivery_minimum = 200, delivery_free = false, max_delivery_km = 5, max_coin_pct = 20,
    streak_break_days = 30, store_online = true
where id = 1;

update eat60_test_fixture
set brand_id = 'test-' || replace(customer_id::text, '-', ''),
    coupon_code = 'T' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where true;

insert into public.brands (id, name, is_open)
select brand_id, 'EAT60 test outlet', true from eat60_test_fixture;

with inserted as (
  insert into public.menu_items (brand_id, category, name, is_available)
  select brand_id, 'Test', 'EAT60 test item', true from eat60_test_fixture
  returning id
)
update eat60_test_fixture set menu_item_id = inserted.id from inserted;

with inserted as (
  insert into public.item_variants (item_id, label, price)
  select menu_item_id, 'Regular', 100 from eat60_test_fixture
  returning id
)
update eat60_test_fixture set variant_id = inserted.id from inserted;

with inserted as (
  insert into public.item_extras (item_id, name, price, is_available)
  select menu_item_id, 'Test extra', 10, true from eat60_test_fixture
  returning id
)
update eat60_test_fixture set extra_id = inserted.id from inserted;

insert into public.coupons (
  code, description, discount_type, discount_value, minimum_order,
  maximum_discount, usage_limit, per_user_limit, is_active
)
select coupon_code, 'EAT60 regression coupon', 'percent', 50, 200, 50, 1, 1, true
from eat60_test_fixture;

insert into public.streak_rewards (milestone, gift, is_active)
values (1, 'EAT60 regression reward', true)
on conflict (milestone) do update
set gift = excluded.gift, is_active = true;

select set_config('request.jwt.claim.sub', customer_id::text, true)
from eat60_test_fixture;
set local role authenticated;

select is(public.is_admin(), false, 'customer is not an administrator');
select is((public.validate_coupon(
  (select coupon_code from eat60_test_fixture), 220
)->>'discount_amount')::integer, 50, 'coupon preview respects maximum discount');
select is((public.validate_coupon(
  (select coupon_code from eat60_test_fixture), 199
)->>'valid'), 'false', 'coupon preview enforces minimum subtotal');
select is((select count(*)::integer from public.customer_available_coupons()), 1,
  'customer can browse an active unused voucher');

update eat60_test_fixture as fixture
set order_id = public.place_order_with_coupon(
  jsonb_build_array(jsonb_build_object(
    'variant_id', fixture.variant_id,
    'qty', 2,
    'extras', jsonb_build_array(jsonb_build_object('id', fixture.extra_id))
  )),
  true, 'Test delivery address', '9000000000', fixture.coupon_code, 'Test Shopper', 3.5
);

select ok((select order_id is not null from eat60_test_fixture),
  'order placement returns an order id');
select is((select subtotal from public.orders
  where id = (select order_id from eat60_test_fixture)), 220,
  'server calculates item and extra prices');
select is((select coupon_discount from public.orders
  where id = (select order_id from eat60_test_fixture)), 50,
  'order applies the capped coupon discount');
select is((select coin_discount from public.orders
  where id = (select order_id from eat60_test_fixture)), 34,
  'coin discount is capped against the post-coupon subtotal');
select is((select coins_used from public.orders
  where id = (select order_id from eat60_test_fixture)), 3400,
  'order debits the corresponding number of coins');
select is((select total from public.orders
  where id = (select order_id from eat60_test_fixture)), 136,
  'server calculates the final total with free delivery');
select is((select delivery_distance_km from public.orders
  where id = (select order_id from eat60_test_fixture)), 3.5::numeric,
  'order retains the delivery distance estimate');
select is((select delivery_fee_before_discount from public.orders
  where id = (select order_id from eat60_test_fixture)), 28,
  'server charges per km beyond the included distance before waiving delivery');
select is((select delivery_fee from public.orders
  where id = (select order_id from eat60_test_fixture)), 0,
  'free-delivery threshold sets the final fee to zero');
select is((select gst_amount from public.orders
  where id = (select order_id from eat60_test_fixture)), 10,
  'server calculates GST as included in the item subtotal');
select is((select customer_name from public.orders
  where id = (select order_id from eat60_test_fixture)), 'Test Shopper',
  'server stores the customer name supplied at checkout');
select is((public.validate_coupon(
  (select coupon_code from eat60_test_fixture), 220
)->>'valid'), 'false', 'coupon per-user redemption limit is enforced');
select is((select count(*)::integer from public.customer_available_coupons()), 0,
  'redeemed voucher is no longer offered to that customer');

update eat60_test_fixture
set game_session = public.start_game_session('snake');
reset role;
update public.game_sessions
set started_at = now() - interval '3 seconds'
where id = (select game_session from eat60_test_fixture);
set local role authenticated;
select is((public.submit_game_score(
  (select game_session from eat60_test_fixture), 150
)->>'xp')::integer, 35,
  '15 Snake food scores earn 35 XP');
reset role;
update public.game_sessions set started_at = now() - interval '6 seconds'
where user_id = (select customer_id from eat60_test_fixture);
set local role authenticated;
update eat60_test_fixture
set game_session = public.start_game_session('burger');
reset role;
update public.game_sessions
set started_at = now() - interval '12 seconds'
where id = (select game_session from eat60_test_fixture);
set local role authenticated;
select is((public.submit_game_score(
  (select game_session from eat60_test_fixture), 80
)->>'xp')::integer, 30,
  '8 Flying Burger pipes earn 30 XP');
reset role;
update public.game_sessions set started_at = now() - interval '6 seconds'
where user_id = (select customer_id from eat60_test_fixture);
set local role authenticated;
update eat60_test_fixture
set game_session = public.start_game_session('qmaths');
reset role;
update public.game_sessions
set started_at = now() - interval '10 seconds'
where id = (select game_session from eat60_test_fixture);
set local role authenticated;
select throws_ok(
  $$select public.submit_game_score(
    (select game_session from eat60_test_fixture), 0
  )$$,
  'P0001', 'Game session ended too early',
  'Quick Maths cannot be submitted before its timed round finishes'
);
reset role;
update public.game_sessions set started_at = now() - interval '6 seconds'
where user_id = (select customer_id from eat60_test_fixture);
set local role authenticated;
update eat60_test_fixture
set game_session = public.start_game_session('qmaths');
reset role;
update public.game_sessions
set started_at = now() - interval '117 seconds'
where id = (select game_session from eat60_test_fixture);
set local role authenticated;
select is((public.submit_game_score(
  (select game_session from eat60_test_fixture), 10
)->>'xp')::integer, 43,
  '10 Quick Maths answers earn 43 XP');
reset role;
update public.game_sessions set started_at = now() - interval '6 seconds'
where user_id = (select customer_id from eat60_test_fixture);
set local role authenticated;
update eat60_test_fixture
set game_session = public.start_game_session('snake');
reset role;
update public.game_sessions
set started_at = now() - interval '6 seconds'
where id = (select game_session from eat60_test_fixture);
set local role authenticated;
select is((public.submit_game_score(
  (select game_session from eat60_test_fixture), 400
)->>'xp')::integer, 60,
  'Snake XP is capped at 60 after the target score');
reset role;
update public.game_sessions set started_at = now() - interval '6 seconds'
where user_id = (select customer_id from eat60_test_fixture);
set local role authenticated;
update eat60_test_fixture
set game_session = public.start_game_session('qmaths');
reset role;
update public.game_sessions
set started_at = now() - interval '117 seconds'
where id = (select game_session from eat60_test_fixture);
set local role authenticated;
select is((public.submit_game_score(
  (select game_session from eat60_test_fixture), 0
)->>'xp')::integer, 10,
  'a valid completed game awards 10 participation XP');
select throws_ok(
  $$select public.submit_game_score(
    (select game_session from eat60_test_fixture), 0
  )$$,
  'P0001', 'Game session is invalid or already used',
  'completed game sessions cannot be claimed a second time'
);
select is((select xp from public.profiles
  where id = (select customer_id from eat60_test_fixture)), 178,
  'game XP awards are added to the customer profile');
select is((select sum(coins)::integer from public.game_scores
  where user_id = (select customer_id from eat60_test_fixture)), 125,
  'game coin rewards stop at the 125-coin IST daily cap');
select is((select xp from public.get_leaderboard() where is_me), 138::bigint,
  'only the three highest-XP plays per day count on the weekly board');
reset role;
update public.game_scores
set played_at = (date_trunc('week', now() at time zone 'Asia/Kolkata') - interval '1 week'
  + interval '1 hour') at time zone 'Asia/Kolkata'
where user_id = (select customer_id from eat60_test_fixture);
select is(public.settle_weekly_game_rewards(), 1,
  'weekly settlement credits the top eligible player');
select is(public.settle_weekly_game_rewards(), 0,
  're-running weekly settlement does not pay winners twice');
select is((select count(*)::integer from public.weekly_game_rewards
  where user_id = (select customer_id from eat60_test_fixture)), 1,
  'settlement records one idempotency row per winner and week');

select throws_ok(
  $$select public.place_order_with_coupon(
    (select jsonb_build_array(jsonb_build_object('variant_id',variant_id,'qty',1)) from eat60_test_fixture),
    false,'Test delivery address','9000000000',null,'Test Shopper',5.1
  )$$,
  'P0001', null,
  'server rejects an estimated distance beyond the delivery radius'
);
select throws_ok(
  $$select public.admin_update_order(1, 'accepted')$$,
  'P0001', 'Admins only',
  'customer cannot advance an order through the admin function'
);
select throws_ok(
  $$insert into public.order_reviews(order_id, user_id, rating)
    select order_id, customer_id, 5 from eat60_test_fixture$$,
  '42501', null,
  'customer cannot review an order before it is delivered'
);

reset role;
select is((select used_count from public.coupons
  where code = (select coupon_code from eat60_test_fixture)), 1,
  'successful placement consumes one coupon use');
select set_config('request.jwt.claim.sub', admin_id::text, true)
from eat60_test_fixture
limit 1;
set local role authenticated;

select is(public.is_admin(), true, 'authorized administrator is recognized');
select throws_ok(
  $$select public.admin_update_order(
    (select order_id from eat60_test_fixture), 'delivered'
  )$$,
  'P0001', 'Record payment before marking delivered',
  'order stages cannot be skipped'
);
select lives_ok($$select public.admin_update_order(
  (select order_id from eat60_test_fixture), 'accepted'
)$$, 'admin accepts the order');
select lives_ok($$select public.admin_update_order(
  (select order_id from eat60_test_fixture), 'preparing'
)$$, 'accepted order can enter preparation');
select lives_ok($$select public.admin_update_order(
  (select order_id from eat60_test_fixture), 'ready'
)$$, 'prepared order can be marked ready');
select lives_ok($$select public.admin_update_order(
  (select order_id from eat60_test_fixture), 'out_for_delivery'
)$$, 'ready order can be dispatched');
select lives_ok($$select public.admin_update_order(
  (select order_id from eat60_test_fixture), 'payment_received', null, 'cash'
)$$, 'payment can be recorded after dispatch');
select lives_ok($$select public.admin_update_order(
  (select order_id from eat60_test_fixture), 'delivered'
)$$, 'paid order can be delivered');

reset role;
select is((select streak from public.profiles
  where id = (select customer_id from eat60_test_fixture)), 1,
  'delivery increments the customer streak');
select is((select count(*)::integer from public.user_rewards
  where user_id = (select customer_id from eat60_test_fixture) and milestone = 1), 1,
  'delivery creates the reached streak reward');
select set_config('request.jwt.claim.sub', customer_id::text, true)
from eat60_test_fixture
limit 1;
set local role authenticated;

select is((public.claim_streak_reward(1)->>'claimed'), 'true',
  'customer can claim a reached streak reward');
select is((select count(*)::integer from public.user_rewards
  where user_id = auth.uid() and milestone = 1), 1,
  'repeated claims do not create duplicate rewards');
select lives_ok($$insert into public.order_reviews(order_id, user_id, rating, feedback)
  select order_id, customer_id, 5, 'Great food and delivery' from eat60_test_fixture$$,
  'customer can review their delivered order');
select is((select rating from public.order_reviews
  where order_id = (select order_id from eat60_test_fixture)), 5,
  'saved order rating is visible to its owner');
select is((select average_rating from public.menu_item_ratings
  where menu_item_id = (select menu_item_id from eat60_test_fixture)), 5.0::numeric,
  'item rating view aggregates delivered order feedback');
select throws_ok(
  $$insert into public.order_reviews(order_id, user_id, rating)
    select order_id, customer_id, 4 from eat60_test_fixture$$,
  '23505', null,
  'each delivered order can only be reviewed once'
);

select * from finish();
rollback;
