-- Enables heart likes and distinct signed-in-user view counts for feed posts.
-- Run once in the Supabase SQL Editor on an existing installation.
alter table public.reactions drop constraint if exists reactions_emoji_check;
alter table public.reactions
  add constraint reactions_emoji_check check (emoji in ('🔥','😋','👍','❤️'));

create table if not exists public.feed_views (
  post_id bigint not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.feed_views enable row level security;
drop policy if exists "own feed view read" on public.feed_views;
create policy "own feed view read" on public.feed_views for select using (user_id = auth.uid());
drop policy if exists "record own feed view" on public.feed_views;
create policy "record own feed view" on public.feed_views for insert with check (user_id = auth.uid());

create or replace view public.feed_view_counts as
  select post_id, count(*)::int as total from public.feed_views group by post_id;
grant select on public.feed_view_counts to anon, authenticated;
notify pgrst, 'reload schema';
