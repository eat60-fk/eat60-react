-- Run once in Supabase SQL Editor to enable live order changes for the admin app.
-- The admin dashboard still checks the profiles.role = 'admin' RLS policy before reading orders.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
