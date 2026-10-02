# EAT60 (React + Supabase)

## Run it on your computer
1. Install Node.js (version 18 or newer) from nodejs.org.
2. In this folder: `npm install`
3. Copy `.env.example` to `.env` and paste your Supabase Project URL and anon public key
   (Supabase dashboard > Settings > API). Never use the service_role key here.
4. `npm run dev` and open the address it prints.

## Before it works
- Run `eat60_supabase.sql` in the Supabase SQL Editor (once).
- On an existing database, run `profile_fields.sql` in the Supabase SQL Editor once. It adds editable profile fields, enforces unique usernames, repairs missing profile rows, and updates the signup trigger.
- Run `profile_avatar_gender.sql` on an existing database to enable saved gender and avatar choices. New databases get these columns from `eat60_supabase.sql`.
- For an existing database, run `extend_game_types.sql` in the Supabase SQL Editor to enable Flying Burger and allow the 2-minute Quick Maths round to submit scores. Re-run it after updating this app. New projects get this support from `eat60_supabase.sql`.
- Run `weekly_leaderboard.sql` in the Supabase SQL Editor on existing installations to enable weekly rank movement compared with the previous week. New databases get it from `eat60_supabase.sql`.
- Run `claim_streak_rewards.sql` in the Supabase SQL Editor on existing installations to enable secure streak reward claims. New databases get it from `eat60_supabase.sql`.
- Run `feed_engagement.sql` in the Supabase SQL Editor on existing installations to enable feed heart likes and view counts. New databases get it from `eat60_supabase.sql`.
- Run `order_reviews.sql` in the Supabase SQL Editor on existing installations to enable customer ratings and feedback. Then rerun `admin_operations.sql` so new orders are linked to menu items for rating aggregates. New databases get the required tables and functions from `eat60_supabase.sql` and `admin_operations.sql`.
- Run `admin_operations.sql` after `eat60_supabase.sql` on new projects and on existing installations before using the admin route. Re-run it after this update to add delivery pricing controls, distance-based checkout pricing, customer voucher listing, order tax/customer detail fields, and realtime announcement delivery. The admin can set the minimum order, a base fee covering the included distance, a per-kilometre rate beyond it, the service radius, a free-delivery threshold, or free delivery for all orders.
- Checkout uses device GPS for an estimated straight-line delivery distance when available; customers can enter an address and continue with the base delivery fee if location is unavailable. GST is shown as 5% included in item prices, not added to the total. Active eligible promo coupons are selectable from More > Rewards and are revalidated on the server at order time.
- Admin news posts published in Feed studio are sent as live in-app announcements to customers with the app open. Customers also get animated full-screen order placed/delivered updates; install EAT60 from More > Download EAT60 or open `/download` directly.
- Supabase > Authentication > Providers: turn on Google (and Email).
- Supabase > Authentication > URL Configuration: add your site address
  (http://localhost:5173 for testing, and your live address later).
- Sign up in the app, then make yourself admin with the last line of the SQL file.

## Deploy to Vercel
Push this folder to GitHub and import the repository on Vercel. The included
`vercel.json` sets the Vite production build command, `dist` output directory,
and SPA fallback for direct page requests.

In Vercel, open **Project Settings > Environment Variables** and add these for
each environment you deploy (Production, Preview, and/or Development):
- `VITE_SUPABASE_URL`: your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: your Supabase anon/public key

Redeploy after changing environment variables. Do not use the Supabase
`service_role` key in a `VITE_` variable. App installation is available from
More > Download EAT60. The project includes SVG install icons; you can replace
`public/pwa-192.svg` and `public/pwa-512.svg` with your own EAT60 branding.
The public `/download` route opens the install page without requiring sign-in.

## Files
- `src/App.jsx` authentication and screen switching
- `src/features/customer/Customer.jsx` menu, cart, orders, feed, games, profile
- `src/features/admin/Admin.jsx` live orders, menu availability, outlets and feed publishing
- `src/lib/supabase.js` configured Supabase client
- `src/styles.css` the dark theme

The app requires both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; copy `.env.example` to `.env` and fill them in. The anon key is intended for browser use; never put a service role key in a `VITE_` variable. The database setup script is for a new Supabase project and is not a migration to rerun on a database that already has these tables.

## Tests
- Run `npm test` for the local administrator-route access checks.
- For database regression tests, apply `eat60_supabase.sql` and `admin_operations.sql` to a disposable Supabase database, then run `tests/database/business_rules.sql` in the SQL Editor. The script uses pgTAP, creates temporary test accounts/data, and rolls all test changes back.
