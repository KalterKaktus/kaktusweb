create table if not exists public.game_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null default 'kaktus-clicker',
  payload jsonb not null default '{}'::jsonb,
  total_earned double precision not null default 0,
  display_name text not null default 'Spieler',
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index if not exists game_saves_leaderboard_idx
  on public.game_saves (game_id, total_earned desc);

alter table public.game_saves enable row level security;

create policy game_saves_select_own
  on public.game_saves
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy game_saves_insert_own
  on public.game_saves
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy game_saves_update_own
  on public.game_saves
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy game_saves_select_leaderboard
  on public.game_saves
  for select
  to anon, authenticated
  using (game_id = 'kaktus-clicker');

create policy profiles_select_leaderboard
  on public.profiles
  for select
  to anon, authenticated
  using (username is not null);
