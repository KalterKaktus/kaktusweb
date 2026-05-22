create table if not exists public.admin_game_events (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 minute')
);

create index if not exists admin_game_events_game_created_idx
  on public.admin_game_events (game_id, created_at desc);

alter table public.admin_game_events enable row level security;

drop policy if exists admin_game_events_select_live on public.admin_game_events;
create policy admin_game_events_select_live
  on public.admin_game_events
  for select
  to anon, authenticated
  using (expires_at > now());

do $$
begin
  alter publication supabase_realtime add table public.admin_game_events;
exception
  when duplicate_object then null;
end
$$;
