create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (
    username is null
    or (char_length(username) >= 3 and char_length(username) <= 24)
  ),
  constraint profiles_username_format check (
    username is null
    or username ~ '^[a-zA-Z0-9_]+$'
  )
);

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
