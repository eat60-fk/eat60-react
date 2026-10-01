-- Adds gender and one of ten selectable profile avatars. Safe to rerun.
alter table public.profiles add column if not exists gender text not null default 'other';
alter table public.profiles add column if not exists avatar_id smallint not null default 1;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_gender_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_gender_check check (gender in ('male','female','other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_avatar_id_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_avatar_id_check check (avatar_id between 1 and 10);
  end if;
end $$;

revoke update (gender, avatar_id) on public.profiles from authenticated;
grant update (gender, avatar_id) on public.profiles to authenticated;
notify pgrst, 'reload schema';
