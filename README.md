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
- For an existing database, apply the game/leaderboard updates in this order: `admin_operations.sql`, `extend_game_types.sql`, then `weekly_leaderboard.sql`. New projects get these features from `eat60_supabase.sql` plus `admin_operations.sql`.
- Game rounds use one-use server-timed sessions; the submitted score is checked against elapsed time and cannot exceed the game’s plausible score rate. Quick Maths must reach the end of its two-minute round, and Snake/Burger sessions must last at least two seconds. XP is awarded on the server: 10 participation XP plus up to 50 performance XP, rounded to the nearest integer and capped at 60. Targets are 30 Snake food, 20 Burger pipes, or 15 correct Quick Maths answers; Snake and Burger game scores count 10 points per food/pipe. Game coins are separately capped at 125 per customer per IST day.
- Weekly standings count each player's best three plays per IST day, while profile XP remains the separate all-time total. Weekly top-10 prizes (500/300/200 coins for the top three and 100 coins for ranks 4–10) are credited after the week ends.
- Automatic weekly prize settlement uses Supabase `pg_cron`. Ensure the `pg_cron` extension is enabled for the project before applying the setup/migration SQL; weekly settlement is scheduled for Monday 00:05 IST. If project policy does not permit `pg_cron`, schedule `settle_weekly_game_rewards()` using an authorized server-side scheduler.
- Run `claim_streak_rewards.sql` in the Supabase SQL Editor on existing installations to enable secure streak reward claims. New databases get it from `eat60_supabase.sql`.
- Run `referral_rewards.sql` in the Supabase SQL Editor on existing installations to create personal referral codes and secure referral claims. New databases get this schema and its RPCs from `eat60_supabase.sql`. A new customer can redeem one code before placing an order for 2,500 coins; the referrer can claim 3,000 coins after that redemption.
- Run `feed_engagement.sql` in the Supabase SQL Editor on existing installations to enable feed heart likes and view counts. New databases get it from `eat60_supabase.sql`.
- Run `order_reviews.sql` in the Supabase SQL Editor on existing installations to enable customer ratings and feedback. Then rerun `admin_operations.sql` so new orders are linked to menu items for rating aggregates. New databases get the required tables and functions from `eat60_supabase.sql` and `admin_operations.sql`.
- Run `admin_operations.sql` after `eat60_supabase.sql` on new projects and on existing installations before using the admin route. Re-run it after this update to add delivery pricing controls, distance-based checkout pricing, customer voucher listing, order tax/customer detail fields, and realtime announcement delivery. The admin can set the minimum order, a base fee covering the included distance, a per-kilometre rate beyond it, the service radius, a free-delivery threshold, or free delivery for all orders.
- Run `admin_ads_rewards.sql` after `admin_operations.sql` on existing and new databases. It adds scheduled partner image/GIF ads, voucher-backed streak rewards, private voucher visibility until a reward is claimed, and the customer-safe streak catalog RPC. Ad uploads use the existing public `menu-images` bucket; the banner only appears during its configured active window.
- The admin Settings tab manages the founder photo/name/social links, customer support phone, and each outlet's Zomato and Swiggy links. Existing databases should rerun `admin_operations.sql` to add the About page settings fields; founder photos upload to the existing public `menu-images` storage bucket.
- About lists only outlets currently marked Open in Admin > Outlets. Edit each outlet's About category, tagline, Zomato link, and Swiggy link there; new admin-created outlets can be configured the same way. Existing databases should rerun `admin_operations.sql` before using these fields.
- The public `/about` and `/careers` pages are indexable; Careers shows future opportunities. More also includes shareable referral links, invite claim status, social channels, and FAQs with configured call/WhatsApp support.
- The app caches the public menu/About content, customer order history, profile, feed, cart, checkout and profile drafts, leaderboard/game scores, and public Supabase images for unstable connections. Visited customer and admin screens stay mounted when switching tabs, preserving in-progress forms and filters. Orders, coupon validation, referral claims, and game score submissions still require a connection and are not shown as completed while offline.
- Checkout uses device GPS for an estimated straight-line delivery distance when available; customers can enter an address and continue with the base delivery fee if location is unavailable. GST is shown as 5% included in item prices, not added to the total. Active eligible promo coupons are selectable from More > Rewards and are revalidated on the server at order time.
- Admin news posts published in Feed studio are sent as live in-app announcements to customers with the app open. Customers also get animated full-screen order placed/delivered updates; install EAT60 from More > Download EAT60 or open `/download` directly.
- The separate administrator PWA is available at `/download-adminapp`; its installed app opens the protected `/admin/orders` workspace. `/admineat60` remains available as a sign-in and legacy entry route.
- Admin workspaces have protected direct links: `/admin/orders`, `/admin/dashboard`, `/admin/menu`, `/admin/outlets`, `/admin/growth`, `/admin/promos`, `/admin/rewards`, `/admin/feed`, `/admin/more`, and `/admin/setting`. Settings sections are available at `/admin/setting`, `/admin/setting/business`, and `/admin/setting/about`; `/admin/settings` remains a supported alias.
- Customer destinations have shareable paths such as `/wallet`, `/order-history`, `/games`, `/leaderboard`, `/order`, `/cart`, `/profile`, and `/setting`. Private account routes require sign-in and are marked `noindex`; the public `/download` page is indexable. The site publishes Organization structured data for EAT60 serving Ballia, without inventing a street address or phone number.
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
The admin install page at `/download-adminapp` uses a separate manifest and
launches the protected admin orders route at `/admin/orders`; the legacy
`/admineat60` route remains available as a sign-in entry point.

## Files
- `src/App.jsx` authentication and screen switching
- `src/features/customer/Customer.jsx` menu, cart, orders, feed, games, profile
- `src/features/admin/Admin.jsx` live orders, menu availability, outlets and feed publishing
- `src/lib/supabase.js` configured Supabase client
- `src/styles.css` the dark theme

The app requires both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; copy `.env.example` to `.env` and fill them in. The anon key is intended for browser use; never put a service role key in a `VITE_` variable. The database setup script is for a new Supabase project and is not a migration to rerun on a database that already has these tables.

## Tests
- Run `npm test` for the local administrator-route access checks.
- For database regression tests, apply `eat60_supabase.sql` and `admin_operations.sql` to a disposable Supabase database, then run `tests/database/business_rules.sql` in the SQL Editor. The script uses pgTAP, creates temporary test accounts/data, verifies referral and streak coin payouts, server-timed game XP, best-three weekly standings, idempotent weekly coin settlement, and rolls all test changes back.
