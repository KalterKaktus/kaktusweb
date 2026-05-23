drop policy if exists game_saves_select_fishing_leaderboard on public.game_saves;

create policy game_saves_select_fishing_leaderboard
  on public.game_saves
  for select
  to anon, authenticated
  using (game_id = 'my-fishing-kaktus');
