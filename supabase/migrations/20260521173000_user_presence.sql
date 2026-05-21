create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  path text not null default '/',
  last_seen timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen desc);

alter table public.user_presence enable row level security;

drop policy if exists user_presence_select_own on public.user_presence;
create policy user_presence_select_own
  on public.user_presence
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_presence_insert_own on public.user_presence;
create policy user_presence_insert_own
  on public.user_presence
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_presence_update_own on public.user_presence;
create policy user_presence_update_own
  on public.user_presence
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
