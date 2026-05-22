alter table public.game_saves
  add column if not exists season_id text;

create index if not exists game_saves_season_leaderboard_idx
  on public.game_saves (game_id, season_id, total_earned desc);

create table if not exists public.game_season_archives (
  game_id text not null,
  season_id text not null,
  top_entries jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  primary key (game_id, season_id)
);

alter table public.game_season_archives enable row level security;

drop policy if exists game_season_archives_select_public on public.game_season_archives;
create policy game_season_archives_select_public
  on public.game_season_archives
  for select
  to anon, authenticated
  using (true);

create or replace function public.kaktus_clicker_current_season_id()
returns text
language sql
stable
as $$
  select to_char(timezone('Europe/Berlin', now()), 'YYYY-MM');
$$;

update public.game_saves
set
  season_id = public.kaktus_clicker_current_season_id(),
  payload = jsonb_set(
    payload,
    '{season}',
    jsonb_build_object('id', public.kaktus_clicker_current_season_id()),
    true
  )
where game_id = 'kaktus-clicker'
  and season_id is null;

create or replace function public.kaktus_clicker_guard_season()
returns trigger
language plpgsql
as $$
declare
  current_season text := public.kaktus_clicker_current_season_id();
begin
  if new.game_id = 'kaktus-clicker' then
    if coalesce(new.season_id, '') <> current_season then
      raise exception 'kaktus-clicker save season is stale';
    end if;

    if coalesce(new.payload #>> '{season,id}', '') <> current_season then
      raise exception 'kaktus-clicker payload season is stale';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists kaktus_clicker_guard_season_trigger on public.game_saves;
create trigger kaktus_clicker_guard_season_trigger
  before insert or update on public.game_saves
  for each row
  execute function public.kaktus_clicker_guard_season();
