alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists avatar_url text;

create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

alter table public.admin_messages enable row level security;

drop policy if exists admin_messages_select_own on public.admin_messages;
create policy admin_messages_select_own
  on public.admin_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists admin_messages_update_own on public.admin_messages;
create policy admin_messages_update_own
  on public.admin_messages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.admin_messages;
exception
  when duplicate_object then null;
end
$$;
