-- EAT60: admin-managed footer version and threshold free-item offer.
-- Run after eat60_supabase.sql and admin_operations.sql in Supabase SQL Editor.
alter table public.settings
  add column if not exists app_version text not null default '1.0.0',
  add column if not exists gift_offer_active boolean not null default false,
  add column if not exists gift_offer_variant_id bigint references public.item_variants(id) on delete set null,
  add column if not exists gift_offer_minimum integer not null default 199 check (gift_offer_minimum >= 0);

create or replace function public.place_order_with_gift(
  p_items jsonb,
  p_use_coins boolean,
  p_address text,
  p_phone text,
  p_coupon_code text default null,
  p_customer_name text default null,
  p_distance_km numeric default null,
  p_use_offer boolean default true,
  p_gift_variant_id bigint default null
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_gift_count integer;
  v_paid_items jsonb;
  v_settings settings%rowtype;
  v_variant item_variants%rowtype;
  v_item menu_items%rowtype;
  v_order_id bigint;
  v_subtotal integer;
begin
  if p_gift_variant_id is null then
    return public.place_order_with_coupon(
      p_items, p_use_coins, p_address, p_phone, p_coupon_code,
      p_customer_name, p_distance_km, p_use_offer
    );
  end if;

  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into v_settings from public.settings where id = 1;
  if not coalesce(v_settings.gift_offer_active, false)
    or v_settings.gift_offer_variant_id is distinct from p_gift_variant_id then
    raise exception 'This free-item offer is no longer available';
  end if;
  if coalesce(p_use_coins, false)
    or nullif(upper(trim(coalesce(p_coupon_code, ''))), '') is not null
    or coalesce(p_use_offer, false) then
    raise exception 'Use the free gift on its own offer; remove the coupon, coins, or daily deal first';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Your cart is invalid'; end if;

  select count(*) into v_gift_count
  from jsonb_array_elements(p_items) as items(line)
  where (line->>'variant_id')::bigint = p_gift_variant_id;
  if v_gift_count <> 1 then raise exception 'Add exactly one free gift to your cart'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as items(line)
    where (line->>'variant_id')::bigint = p_gift_variant_id
      and (coalesce((line->>'qty')::integer, 1) <> 1
        or jsonb_array_length(coalesce(line->'extras', '[]'::jsonb)) <> 0)
  ) then raise exception 'The free gift must be one item without extras'; end if;

  select coalesce(jsonb_agg(line), '[]'::jsonb) into v_paid_items
  from jsonb_array_elements(p_items) as items(line)
  where (line->>'variant_id')::bigint <> p_gift_variant_id;
  if jsonb_array_length(v_paid_items) = 0 then raise exception 'Add qualifying items before the free gift'; end if;

  select * into v_variant from public.item_variants where id = p_gift_variant_id;
  if not found then raise exception 'The free item is no longer on the menu'; end if;
  select * into v_item from public.menu_items where id = v_variant.item_id;
  if not found or not v_item.is_available then raise exception 'The free item is unavailable'; end if;
  if not exists (select 1 from public.brands where id = v_item.brand_id and is_open) then
    raise exception 'The free item outlet is closed right now';
  end if;

  -- The base checkout routine validates address, distance, stock, minimum order,
  -- and creates the order. The gift is excluded from all paid totals and savings.
  v_order_id := public.place_order_with_coupon(
    v_paid_items, false, p_address, p_phone, null,
    p_customer_name, p_distance_km, false
  );
  select subtotal into v_subtotal from public.orders where id = v_order_id for update;
  if coalesce(v_subtotal, 0) < coalesce(v_settings.gift_offer_minimum, 199) then
    raise exception 'Add items worth ₹% to unlock the free gift', v_settings.gift_offer_minimum;
  end if;

  insert into public.order_items(order_id, menu_item_id, brand_id, item_name, qty, unit_price, extra_details)
  values(v_order_id, v_item.id, v_item.brand_id, v_item.name || ' (' || v_variant.label || ') · FREE GIFT', 1, 0, '[]'::jsonb);
  return v_order_id;
end;
$$;

revoke all on function public.place_order_with_gift(jsonb,boolean,text,text,text,text,numeric,boolean,bigint) from public, anon;
grant execute on function public.place_order_with_gift(jsonb,boolean,text,text,text,text,numeric,boolean,bigint) to authenticated;
notify pgrst, 'reload schema';
