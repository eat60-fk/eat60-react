-- EAT60 menu import for the Supabase SQL Editor.
-- This version uses only the existing public.brands, public.menu_items,
-- and public.item_variants tables. It creates no tables and deletes no data.
-- Add-ons were omitted because the supplied list has no prices or parent dishes:
-- Extra Cheese, Extra Tomato, Extra Capsicum, Extra Corn, Extra Onion, Extra Mushroom, Extra Paneer, Cheese Burst Crust, Black Olive, Jalapeno, Red Paprika

-- The source list uses outlet id "bev". Insert that outlet if it is missing.
-- Check public.brands first and change "bev" ids below if needed.
INSERT INTO public.brands (id, name, emoji)
VALUES ('bev', 'Beverages', '🥤')
ON CONFLICT (id) DO NOTHING;

-- Update matching dishes and insert missing ones. Matching uses both brand and
-- exact item name, so same-named dishes in different outlets remain separate.
WITH incoming (brand_id, category, name, description, is_available) AS (
  VALUES
-- ------------------------------------------------------------------------
    -- BRAND: The Pizza Galaxy (pg)
    -- ------------------------------------------------------------------------
    ('pg', 'Pizza', 'Margherita', 'Cheese, tomato, basil', true),
    ('pg', 'Pizza', 'Tandoori Paneer Pizza', 'Capsicum, onion, red paprika, paneer in tandoori sauce', true),
    ('pg', 'Pizza', 'Onion Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Tomato Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Golden Corn Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Capsicum Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Paneer Onion Pizza (7 inches)', null, true),
    ('pg', 'Pizza', 'Paneer Capsicum Pizza (7 inches)', null, true),
    ('pg', 'Pizza', 'Mushroom N Corn Pizza (7 inches)', null, true),
    ('pg', 'Pizza', 'Mushroom N Capsicum (7 inches)', null, true),
    ('pg', 'Pizza', 'Country Special Pizza', null, true),
    ('pg', 'Pizza', 'Kids Delight Pizza', null, true),
    ('pg', 'Pizza', 'Cheese and Corn Pizza', null, true),
    ('pg', 'Pizza', 'Peppy Paneer Pizza', null, true),
    ('pg', 'Pizza', 'Veggie Paradise Pizza', null, true),
    ('pg', 'Pizza', 'Deluxe Margherita Pizza', null, true),
    ('pg', 'Pizza', 'Mushroom Delight Pizza', null, true),
    ('pg', 'Pizza', 'Paneer Overload Pizza', null, true),
    ('pg', 'Pizza', 'Paneer Makhani Pizza', null, true),
    ('pg', 'Pizza', 'Veg Schezwan Pizza', null, true),
    ('pg', 'Pizza', 'Veg Extravaganza Pizza', null, true),
    ('pg', 'Pizza', 'Farmhouse Pizza', null, true),
    ('pg', 'Pizza', 'Achaari Pizza', null, true),
    ('pg', 'Burger', 'Aloo Tikki Burger', null, true),
    ('pg', 'Burger', 'Paneer Burger', null, true),
    ('pg', 'Burger', 'Cheese Burger', null, true),
    ('pg', 'Burger', 'Maharaja Burger', null, true),
    ('pg', 'Maggie', 'Maggi', null, true),
    ('pg', 'Maggie', 'Butter Maggi', null, true),
    ('pg', 'Maggie', 'Paneer Maggi', null, true),
    ('pg', 'Chinese', 'Noodles', null, false),
    ('pg', 'Chinese', 'Paneer Noodles', null, false),
    ('pg', 'Sides', 'Salted Fries', null, false),
    ('pg', 'Sides', 'Masala Fries', null, false),
    ('pg', 'Sides', 'Peri Peri Fries', null, false),
    ('pg', 'Dessert', 'Choco Lava Cake', null, false),

    -- ------------------------------------------------------------------------
    -- BRAND: Cheesy Town (ct)
    -- ------------------------------------------------------------------------
    ('ct', 'Pizza', 'Capsicum Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Onion Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Tomato Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Goldnen Corn Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Paneer Onion Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Mushroom and Corn (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Capsicum Paneer Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Tomato and Corn Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Margherita Pizza', null, true),
    ('ct', 'Pizza', 'Veg Lover Pizza', null, true),
    ('ct', 'Pizza', 'The Mexicana Pizza', null, true),
    ('ct', 'Pizza', 'Spicy Indian Pizza', null, true),
    ('ct', 'Pizza', 'Veggie Paradise Pizza (CT)', null, true),
    ('ct', 'Pizza', 'Deluxe Margherita Pizza (CT)', null, true),
    ('ct', 'Pizza', 'Paneer Overloaded Pizza', null, true),
    ('ct', 'Pizza', 'Farm House Pizza', null, true),
    ('ct', 'Pizza', 'Achari Paneer Pizza', null, true),
    ('ct', 'Burger', 'Veg Burger', null, true),
    ('ct', 'Burger', 'Tandoori Burger', null, true),
    ('ct', 'Burger', 'Veg Double Decker Burger', null, true),
    ('ct', 'Maggie', 'Plain Maggi', null, true),
    ('ct', 'Maggie', 'Paneer Masala Maggi', null, true),
    ('ct', 'Maggie', 'Double Masala Maggi', null, false),
    ('ct', 'Maggie', 'Cheese Butter Maggi', null, false),
    ('ct', 'Sandwich', 'Veg Sandwich', null, false),
    ('ct', 'Sandwich', 'Cheese Grilled Sandwich', null, false),
    ('ct', 'Sandwich', 'Sweet Corn Sandwich', null, false),
    ('ct', 'Sandwich', 'Paneer Sandwich', null, false),
    ('ct', 'Sides', 'Regular French Fries', null, false),
    ('ct', 'Sides', 'Peri Peri French Fries', null, false),
    
    -- ------------------------------------------------------------------------
    -- BRAND: Wok Story (ws)
    -- ------------------------------------------------------------------------
    ('ws', 'Chinese', 'Veg Hakka Noodles', 'Wok tossed with sauces', false),
    ('ws', 'Chinese', 'Veg Manchurian', 'Gravy or dry', false),
    ('ws', 'Chinese', 'Crispy Chilli Mushroom', null, false),
    ('ws', 'Chinese', 'Crispy Chilli Potato', null, false),
    ('ws', 'Chinese', 'Crispy Chilli Paneer', null, false),
    ('ws', 'Chinese', 'Chilli Mushroom in Gravy', null, false),
    ('ws', 'Chinese', 'Chilli Paneer in Gravy', null, false),
    ('ws', 'Chinese', 'Schezwan Fried Rice', null, false),
    ('ws', 'Chinese', 'Paneer Fried Rice', null, false),
    ('ws', 'Chinese', 'Veg Fried Rice', null, false),
    ('ws', 'Chinese', 'Desi Chowmein', null, false),
    ('ws', 'Chinese', 'Chilli Garlic Noodles', null, false),
    ('ws', 'Chinese', 'Schezwan Noodles', null, false),
    ('ws', 'Chinese', 'Paneer Hakka Noodles', null, false),
    ('ws', 'Chinese', 'Hakka Noodles', null, false),
    ('ws', 'Pasta', 'Macaroni', null, false),
    ('ws', 'Pasta', 'White Sauce Pasta', null, false),
    ('ws', 'Pasta', 'Red Sauce Pasta', null, false),
    ('ws', 'Maggie', 'Spicy Schezwan Maggi', null, true),
    ('ws', 'Maggie', 'Cheese N Corn Maggi', null, true),
    ('ws', 'Maggie', 'Supreme Butter Maggi', null, false),
    ('ws', 'Maggie', 'Masala Maggi', null, true),
    ('ws', 'Pizza', 'Onion Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Capsicum Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Tomato Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Golden Corn Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Paneer N Onion Pizza [7Inches]', null, true),
    ('ws', 'Pizza', 'Mushroom N Capsicum Pizza [7Inches]', null, true),
    ('ws', 'Pizza', 'Veg Schezwan Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Veg Schezwan Pizza [9 Inches]', null, true),

    -- ------------------------------------------------------------------------
    -- BRAND: Wraps (wr)
    -- ------------------------------------------------------------------------
    ('wr', 'Wraps', 'Paneer Kathi Roll', 'Paneer, onion, mint chutney', true),
    ('wr', 'Wraps', 'Veg Cheese Wrap', 'Veggies, cheese, sauce', true),

    -- ------------------------------------------------------------------------
    -- BRAND: Beverages (bev)
    -- ------------------------------------------------------------------------
    ('bev', 'Beverages', 'Coca-Cola (250 ml)', null, false),
    ('bev', 'Beverages', 'Thums Up (250 ml)', null, false),
    ('bev', 'Beverages', 'Sprite (250 ml)', null, false),
    ('bev', 'Beverages', 'Aquafina Water (1.0 L)', null, false),
    ('bev', 'Beverages', 'Aquafina Water (500 ml)', null, false),
    ('bev', 'Beverages', 'Bisleri (500 ml)', null, false),
    ('bev', 'Beverages', 'Bisleri (1.0 L)', null, false),
    ('bev', 'Beverages', 'Kinley (1.0 L)', null, false),
    ('bev', 'Beverages', 'Bailley (1.0 L)', null, false),
    ('bev', 'Beverages', 'Tata Copper (1.0 L)', null, false),
    ('bev', 'Beverages', 'Dukes Soda (750 ml)', null, false),
    ('bev', 'Beverages', 'Evervess Soda (750 ml)', null, false),
    ('bev', 'Beverages', 'Pepsi Cola (400 ml)', null, false),
    ('bev', 'Beverages', 'Fanta (250 ml)', null, false)
), updated AS (
  UPDATE public.menu_items AS item
  SET category = incoming.category,
      description = COALESCE(incoming.description, item.description),
      is_available = incoming.is_available
  FROM incoming
  WHERE item.brand_id = incoming.brand_id
    AND item.name = incoming.name
  RETURNING item.brand_id, item.name
)
INSERT INTO public.menu_items (brand_id, category, name, description, is_available)
SELECT incoming.brand_id, incoming.category, incoming.name,
       incoming.description, incoming.is_available
FROM incoming
WHERE NOT EXISTS (
  SELECT 1 FROM updated
  WHERE updated.brand_id = incoming.brand_id AND updated.name = incoming.name
)
AND NOT EXISTS (
  SELECT 1 FROM public.menu_items AS existing
  WHERE existing.brand_id = incoming.brand_id AND existing.name = incoming.name
);

-- Update or insert the supplied sizes/prices in the table the app reads:
-- public.item_variants. Outlet + item name are both used to find the parent dish.
WITH incoming (brand_id, item_name, label, price) AS (
  VALUES
  ('pg', 'Onion Pizza (7 Inches, Small)', 'Default', 139),
  ('pg', 'Tomato Pizza (7 Inches, Small)', 'Default', 139),
  ('pg', 'Golden Corn Pizza (7 Inches, Small)', 'Default', 139),
  ('pg', 'Capsicum Pizza (7 Inches, Small)', 'Default', 139),
  ('pg', 'Paneer Onion Pizza (7 inches)', 'Default', 169),
  ('pg', 'Paneer Capsicum Pizza (7 inches)', 'Default', 169),
  ('pg', 'Mushroom N Corn Pizza (7 inches)', 'Default', 169),
  ('pg', 'Mushroom N Capsicum (7 inches)', 'Default', 169),
  ('pg', 'Country Special Pizza', 'Regular', 165),
  ('pg', 'Country Special Pizza', 'Medium', 309),
  ('pg', 'Country Special Pizza', 'Large', 449),
  ('pg', 'Kids Delight Pizza', 'Regular', 165),
  ('pg', 'Kids Delight Pizza', 'Medium', 309),
  ('pg', 'Kids Delight Pizza', 'Large', 449),
  ('pg', 'Margherita', 'Regular', 165),
  ('pg', 'Margherita', 'Medium', 309),
  ('pg', 'Margherita', 'Large', 449),
  ('pg', 'Cheese and Corn Pizza', 'Regular', 165),
  ('pg', 'Cheese and Corn Pizza', 'Medium', 309),
  ('pg', 'Cheese and Corn Pizza', 'Large', 449),
  ('pg', 'Peppy Paneer Pizza', 'Regular', 210),
  ('pg', 'Peppy Paneer Pizza', 'Medium', 405),
  ('pg', 'Peppy Paneer Pizza', 'Large', 610),
  ('pg', 'Veggie Paradise Pizza', 'Regular', 210),
  ('pg', 'Veggie Paradise Pizza', 'Medium', 405),
  ('pg', 'Veggie Paradise Pizza', 'Large', 610),
  ('pg', 'Deluxe Margherita Pizza', 'Regular', 210),
  ('pg', 'Deluxe Margherita Pizza', 'Medium', 405),
  ('pg', 'Deluxe Margherita Pizza', 'Large', 610),
  ('pg', 'Mushroom Delight Pizza', 'Regular', 210),
  ('pg', 'Mushroom Delight Pizza', 'Medium', 405),
  ('pg', 'Mushroom Delight Pizza', 'Large', 610),
  ('pg', 'Paneer Overload Pizza', 'Regular', 210),
  ('pg', 'Paneer Overload Pizza', 'Medium', 405),
  ('pg', 'Paneer Overload Pizza', 'Large', 610),
  ('pg', 'Paneer Makhani Pizza', 'Regular', 379),
  ('pg', 'Paneer Makhani Pizza', 'Medium', 739),
  ('pg', 'Paneer Makhani Pizza', 'Large', 1118),
  ('pg', 'Veg Schezwan Pizza', 'Regular', 379),
  ('pg', 'Veg Schezwan Pizza', 'Medium', 739),
  ('pg', 'Veg Schezwan Pizza', 'Large', 1118),
  ('pg', 'Veg Extravaganza Pizza', 'Regular', 379),
  ('pg', 'Veg Extravaganza Pizza', 'Medium', 739),
  ('pg', 'Veg Extravaganza Pizza', 'Large', 1118),
  ('pg', 'Farmhouse Pizza', 'Regular', 379),
  ('pg', 'Farmhouse Pizza', 'Medium', 739),
  ('pg', 'Farmhouse Pizza', 'Large', 1118),
  ('pg', 'Tandoori Paneer Pizza', 'Regular', 379),
  ('pg', 'Tandoori Paneer Pizza', 'Medium', 739),
  ('pg', 'Tandoori Paneer Pizza', 'Large', 1118),
  ('pg', 'Achaari Pizza', 'Regular', 379),
  ('pg', 'Achaari Pizza', 'Medium', 739),
  ('pg', 'Achaari Pizza', 'Large', 1118),
  ('ct', 'Capsicum Pizza (Small, 7 inches)', 'Default', 169),
  ('ct', 'Onion Pizza (Small, 7 inches)', 'Default', 169),
  ('ct', 'Tomato Pizza (Small, 7 inches)', 'Default', 169),
  ('ct', 'Goldnen Corn Pizza (Small, 7 inches)', 'Default', 169),
  ('ct', 'Paneer Onion Pizza (Small, 7 inches)', 'Default', 199),
  ('ct', 'Mushroom and Corn (Small, 7 inches)', 'Default', 199),
  ('ct', 'Capsicum Paneer Pizza (Small, 7 inches)', 'Default', 199),
  ('ct', 'Tomato and Corn Pizza (Small, 7 inches)', 'Default', 199),
  ('ct', 'Margherita Pizza', 'Regular', 239),
  ('ct', 'Margherita Pizza', 'Medium', 475),
  ('ct', 'Margherita Pizza', 'Large', 719),
  ('ct', 'Veg Lover Pizza', 'Regular', 239),
  ('ct', 'Veg Lover Pizza', 'Medium', 475),
  ('ct', 'Veg Lover Pizza', 'Large', 719),
  ('ct', 'The Mexicana Pizza', 'Regular', 259),
  ('ct', 'The Mexicana Pizza', 'Medium', 509),
  ('ct', 'The Mexicana Pizza', 'Large', 779),
  ('ct', 'Spicy Indian Pizza', 'Regular', 259),
  ('ct', 'Spicy Indian Pizza', 'Medium', 509),
  ('ct', 'Spicy Indian Pizza', 'Large', 779),
  ('ct', 'Veggie Paradise Pizza (CT)', 'Regular', 269),
  ('ct', 'Veggie Paradise Pizza (CT)', 'Medium', 535),
  ('ct', 'Veggie Paradise Pizza (CT)', 'Large', 808),
  ('ct', 'Deluxe Margherita Pizza (CT)', 'Regular', 269),
  ('ct', 'Deluxe Margherita Pizza (CT)', 'Medium', 535),
  ('ct', 'Deluxe Margherita Pizza (CT)', 'Large', 808),
  ('ct', 'Paneer Overloaded Pizza', 'Regular', 299),
  ('ct', 'Paneer Overloaded Pizza', 'Medium', 595),
  ('ct', 'Paneer Overloaded Pizza', 'Large', 895),
  ('ct', 'Farm House Pizza', 'Regular', 299),
  ('ct', 'Farm House Pizza', 'Medium', 595),
  ('ct', 'Farm House Pizza', 'Large', 895),
  ('ct', 'Achari Paneer Pizza', 'Regular', 299),
  ('ct', 'Achari Paneer Pizza', 'Medium', 595),
  ('ct', 'Achari Paneer Pizza', 'Large', 895),
  ('ws', 'Chilli Mushroom in Gravy', 'Half', 169),
  ('ws', 'Chilli Mushroom in Gravy', 'Full', 269),
  ('ws', 'Chilli Paneer in Gravy', 'Half', 169),
  ('ws', 'Chilli Paneer in Gravy', 'Full', 269),
  ('ws', 'Schezwan Fried Rice', 'Half', 110),
  ('ws', 'Schezwan Fried Rice', 'Full', 210),
  ('ws', 'Paneer Fried Rice', 'Half', 115),
  ('ws', 'Paneer Fried Rice', 'Full', 215),
  ('ws', 'Veg Fried Rice', 'Half', 99),
  ('ws', 'Veg Fried Rice', 'Full', 180),
  ('ws', 'Desi Chowmein', 'Half', 85),
  ('ws', 'Desi Chowmein', 'Full', 160),
  ('ws', 'Chilli Garlic Noodles', 'Half', 115),
  ('ws', 'Chilli Garlic Noodles', 'Full', 215),
  ('ws', 'Schezwan Noodles', 'Half', 125),
  ('ws', 'Schezwan Noodles', 'Full', 225),
  ('ws', 'Paneer Hakka Noodles', 'Half', 115),
  ('ws', 'Paneer Hakka Noodles', 'Full', 215),
  ('ws', 'Hakka Noodles', 'Half', 99),
  ('ws', 'Hakka Noodles', 'Full', 180),
  ('ws', 'Macaroni', 'Half', 85),
  ('ws', 'Macaroni', 'Full', 160),
  ('ws', 'White Sauce Pasta', 'Half', 150),
  ('ws', 'White Sauce Pasta', 'Full', 250),
  ('ws', 'Red Sauce Pasta', 'Half', 120),
  ('ws', 'Red Sauce Pasta', 'Full', 220),
  ('ws', 'Spicy Schezwan Maggi', 'Half', 105),
  ('ws', 'Spicy Schezwan Maggi', 'Full', 170),
  ('ws', 'Cheese N Corn Maggi', 'Half', 125),
  ('ws', 'Cheese N Corn Maggi', 'Full', 225),
  ('ws', 'Supreme Butter Maggi', 'Half', 125),
  ('ws', 'Supreme Butter Maggi', 'Full', 225),
  ('ws', 'Masala Maggi', 'Half', 85),
  ('ws', 'Masala Maggi', 'Full', 150),
  ('ws', 'Onion Pizza [7 Inches]', 'Default', 119),
  ('ws', 'Capsicum Pizza [7 Inches]', 'Default', 119),
  ('ws', 'Tomato Pizza [7 Inches]', 'Default', 119),
  ('ws', 'Golden Corn Pizza [7 Inches]', 'Default', 119),
  ('ws', 'Paneer N Onion Pizza [7Inches]', 'Default', 155),
  ('ws', 'Mushroom N Capsicum Pizza [7Inches]', 'Default', 155),
  ('ws', 'Veg Schezwan Pizza [7 Inches]', 'Default', 249),
  ('ws', 'Veg Schezwan Pizza [9 Inches]', 'Default', 498)
), updated AS (
  UPDATE public.item_variants AS variant
  SET price = incoming.price
  FROM incoming
  JOIN public.menu_items AS item
    ON item.brand_id = incoming.brand_id
   AND item.name = incoming.item_name
  WHERE variant.item_id = item.id
    AND variant.label = incoming.label
  RETURNING variant.item_id, variant.label
)
INSERT INTO public.item_variants (item_id, label, price)
SELECT item.id, incoming.label, incoming.price
FROM incoming
JOIN public.menu_items AS item
  ON item.brand_id = incoming.brand_id
 AND item.name = incoming.item_name
WHERE NOT EXISTS (
  SELECT 1 FROM updated
  WHERE updated.item_id = item.id AND updated.label = incoming.label
)
AND NOT EXISTS (
  SELECT 1 FROM public.item_variants AS existing
  WHERE existing.item_id = item.id AND existing.label = incoming.label
);

-- Review these available items: they have no size/price yet, so customers
-- cannot add them to an order until a variant price is added.
WITH imported (brand_id, category, name, description, is_available) AS (
  VALUES
-- ------------------------------------------------------------------------
    -- BRAND: The Pizza Galaxy (pg)
    -- ------------------------------------------------------------------------
    ('pg', 'Pizza', 'Margherita', 'Cheese, tomato, basil', true),
    ('pg', 'Pizza', 'Tandoori Paneer Pizza', 'Capsicum, onion, red paprika, paneer in tandoori sauce', true),
    ('pg', 'Pizza', 'Onion Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Tomato Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Golden Corn Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Capsicum Pizza (7 Inches, Small)', null, true),
    ('pg', 'Pizza', 'Paneer Onion Pizza (7 inches)', null, true),
    ('pg', 'Pizza', 'Paneer Capsicum Pizza (7 inches)', null, true),
    ('pg', 'Pizza', 'Mushroom N Corn Pizza (7 inches)', null, true),
    ('pg', 'Pizza', 'Mushroom N Capsicum (7 inches)', null, true),
    ('pg', 'Pizza', 'Country Special Pizza', null, true),
    ('pg', 'Pizza', 'Kids Delight Pizza', null, true),
    ('pg', 'Pizza', 'Cheese and Corn Pizza', null, true),
    ('pg', 'Pizza', 'Peppy Paneer Pizza', null, true),
    ('pg', 'Pizza', 'Veggie Paradise Pizza', null, true),
    ('pg', 'Pizza', 'Deluxe Margherita Pizza', null, true),
    ('pg', 'Pizza', 'Mushroom Delight Pizza', null, true),
    ('pg', 'Pizza', 'Paneer Overload Pizza', null, true),
    ('pg', 'Pizza', 'Paneer Makhani Pizza', null, true),
    ('pg', 'Pizza', 'Veg Schezwan Pizza', null, true),
    ('pg', 'Pizza', 'Veg Extravaganza Pizza', null, true),
    ('pg', 'Pizza', 'Farmhouse Pizza', null, true),
    ('pg', 'Pizza', 'Achaari Pizza', null, true),
    ('pg', 'Burger', 'Aloo Tikki Burger', null, true),
    ('pg', 'Burger', 'Paneer Burger', null, true),
    ('pg', 'Burger', 'Cheese Burger', null, true),
    ('pg', 'Burger', 'Maharaja Burger', null, true),
    ('pg', 'Maggie', 'Maggi', null, true),
    ('pg', 'Maggie', 'Butter Maggi', null, true),
    ('pg', 'Maggie', 'Paneer Maggi', null, true),
    ('pg', 'Chinese', 'Noodles', null, false),
    ('pg', 'Chinese', 'Paneer Noodles', null, false),
    ('pg', 'Sides', 'Salted Fries', null, false),
    ('pg', 'Sides', 'Masala Fries', null, false),
    ('pg', 'Sides', 'Peri Peri Fries', null, false),
    ('pg', 'Dessert', 'Choco Lava Cake', null, false),

    -- ------------------------------------------------------------------------
    -- BRAND: Cheesy Town (ct)
    -- ------------------------------------------------------------------------
    ('ct', 'Pizza', 'Capsicum Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Onion Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Tomato Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Goldnen Corn Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Paneer Onion Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Mushroom and Corn (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Capsicum Paneer Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Tomato and Corn Pizza (Small, 7 inches)', null, true),
    ('ct', 'Pizza', 'Margherita Pizza', null, true),
    ('ct', 'Pizza', 'Veg Lover Pizza', null, true),
    ('ct', 'Pizza', 'The Mexicana Pizza', null, true),
    ('ct', 'Pizza', 'Spicy Indian Pizza', null, true),
    ('ct', 'Pizza', 'Veggie Paradise Pizza (CT)', null, true),
    ('ct', 'Pizza', 'Deluxe Margherita Pizza (CT)', null, true),
    ('ct', 'Pizza', 'Paneer Overloaded Pizza', null, true),
    ('ct', 'Pizza', 'Farm House Pizza', null, true),
    ('ct', 'Pizza', 'Achari Paneer Pizza', null, true),
    ('ct', 'Burger', 'Veg Burger', null, true),
    ('ct', 'Burger', 'Tandoori Burger', null, true),
    ('ct', 'Burger', 'Veg Double Decker Burger', null, true),
    ('ct', 'Maggie', 'Plain Maggi', null, true),
    ('ct', 'Maggie', 'Paneer Masala Maggi', null, true),
    ('ct', 'Maggie', 'Double Masala Maggi', null, false),
    ('ct', 'Maggie', 'Cheese Butter Maggi', null, false),
    ('ct', 'Sandwich', 'Veg Sandwich', null, false),
    ('ct', 'Sandwich', 'Cheese Grilled Sandwich', null, false),
    ('ct', 'Sandwich', 'Sweet Corn Sandwich', null, false),
    ('ct', 'Sandwich', 'Paneer Sandwich', null, false),
    ('ct', 'Sides', 'Regular French Fries', null, false),
    ('ct', 'Sides', 'Peri Peri French Fries', null, false),
    
    -- ------------------------------------------------------------------------
    -- BRAND: Wok Story (ws)
    -- ------------------------------------------------------------------------
    ('ws', 'Chinese', 'Veg Hakka Noodles', 'Wok tossed with sauces', false),
    ('ws', 'Chinese', 'Veg Manchurian', 'Gravy or dry', false),
    ('ws', 'Chinese', 'Crispy Chilli Mushroom', null, false),
    ('ws', 'Chinese', 'Crispy Chilli Potato', null, false),
    ('ws', 'Chinese', 'Crispy Chilli Paneer', null, false),
    ('ws', 'Chinese', 'Chilli Mushroom in Gravy', null, false),
    ('ws', 'Chinese', 'Chilli Paneer in Gravy', null, false),
    ('ws', 'Chinese', 'Schezwan Fried Rice', null, false),
    ('ws', 'Chinese', 'Paneer Fried Rice', null, false),
    ('ws', 'Chinese', 'Veg Fried Rice', null, false),
    ('ws', 'Chinese', 'Desi Chowmein', null, false),
    ('ws', 'Chinese', 'Chilli Garlic Noodles', null, false),
    ('ws', 'Chinese', 'Schezwan Noodles', null, false),
    ('ws', 'Chinese', 'Paneer Hakka Noodles', null, false),
    ('ws', 'Chinese', 'Hakka Noodles', null, false),
    ('ws', 'Pasta', 'Macaroni', null, false),
    ('ws', 'Pasta', 'White Sauce Pasta', null, false),
    ('ws', 'Pasta', 'Red Sauce Pasta', null, false),
    ('ws', 'Maggie', 'Spicy Schezwan Maggi', null, true),
    ('ws', 'Maggie', 'Cheese N Corn Maggi', null, true),
    ('ws', 'Maggie', 'Supreme Butter Maggi', null, false),
    ('ws', 'Maggie', 'Masala Maggi', null, true),
    ('ws', 'Pizza', 'Onion Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Capsicum Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Tomato Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Golden Corn Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Paneer N Onion Pizza [7Inches]', null, true),
    ('ws', 'Pizza', 'Mushroom N Capsicum Pizza [7Inches]', null, true),
    ('ws', 'Pizza', 'Veg Schezwan Pizza [7 Inches]', null, true),
    ('ws', 'Pizza', 'Veg Schezwan Pizza [9 Inches]', null, true),

    -- ------------------------------------------------------------------------
    -- BRAND: Wraps (wr)
    -- ------------------------------------------------------------------------
    ('wr', 'Wraps', 'Paneer Kathi Roll', 'Paneer, onion, mint chutney', true),
    ('wr', 'Wraps', 'Veg Cheese Wrap', 'Veggies, cheese, sauce', true),

    -- ------------------------------------------------------------------------
    -- BRAND: Beverages (bev)
    -- ------------------------------------------------------------------------
    ('bev', 'Beverages', 'Coca-Cola (250 ml)', null, false),
    ('bev', 'Beverages', 'Thums Up (250 ml)', null, false),
    ('bev', 'Beverages', 'Sprite (250 ml)', null, false),
    ('bev', 'Beverages', 'Aquafina Water (1.0 L)', null, false),
    ('bev', 'Beverages', 'Aquafina Water (500 ml)', null, false),
    ('bev', 'Beverages', 'Bisleri (500 ml)', null, false),
    ('bev', 'Beverages', 'Bisleri (1.0 L)', null, false),
    ('bev', 'Beverages', 'Kinley (1.0 L)', null, false),
    ('bev', 'Beverages', 'Bailley (1.0 L)', null, false),
    ('bev', 'Beverages', 'Tata Copper (1.0 L)', null, false),
    ('bev', 'Beverages', 'Dukes Soda (750 ml)', null, false),
    ('bev', 'Beverages', 'Evervess Soda (750 ml)', null, false),
    ('bev', 'Beverages', 'Pepsi Cola (400 ml)', null, false),
    ('bev', 'Beverages', 'Fanta (250 ml)', null, false)
)
SELECT item.brand_id, item.name, item.category
FROM public.menu_items AS item
JOIN imported ON imported.brand_id = item.brand_id AND imported.name = item.name
WHERE item.is_available = true
  AND NOT EXISTS (
    SELECT 1 FROM public.item_variants AS variant WHERE variant.item_id = item.id
  )
ORDER BY item.brand_id, item.category, item.name;
