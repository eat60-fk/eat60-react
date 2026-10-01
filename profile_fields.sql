-- Adds editable profile details and case-insensitive unique usernames to an
-- existing EAT60 database. Safe to rerun.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists area text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists gender text not null default 'other';
alter table public.profiles add column if not exists avatar_id smallint not null default 1;

update public.profiles as p
set username = coalesce(
  nullif(left(regexp_replace(lower(split_part(coalesce(u.email, 'player'), '@', 1)), '[^a-z0-9_]+', '_', 'g'), 13), ''),
  'player'
) || '_' || substr(replace(p.id::text, '-', ''), 1, 10)
from auth.users as u
where p.id = u.id and (p.username is null or p.username = '');

insert into public.profiles (id, name, username)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email, ''), '@', 1), 'Player'),
  coalesce(
    nullif(left(regexp_replace(lower(split_part(coalesce(u.email, 'player'), '@', 1)), '[^a-z0-9_]+', '_', 'g'), 13), ''),
    'player'
  ) || '_' || substr(replace(u.id::text, '-', ''), 1, 10)
from auth.users as u
left join public.profiles as p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

create unique index if not exists profiles_username_unique on public.profiles (lower(username));
alter table public.profiles alter column username set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_gender_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_gender_check check (gender in ('male','female','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_id_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_avatar_id_check check (avatar_id between 1 and 10);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check check (username ~ '^[a-z0-9_]{3,24}$');
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_base text;
begin
  v_base := left(regexp_replace(lower(split_part(coalesce(new.email, 'player'), '@', 1)), '[^a-z0-9_]+', '_', 'g'), 13);
  insert into public.profiles (id, name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Player'),
    coalesce(nullif(v_base, ''), 'player') || '_' || substr(replace(new.id::text, '-', ''), 1, 10)
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke update (name, phone) on public.profiles from authenticated;
grant update (name, username, phone, address, area, city, gender, avatar_id) on public.profiles to authenticated;

notify pgrst, 'reload schema';
