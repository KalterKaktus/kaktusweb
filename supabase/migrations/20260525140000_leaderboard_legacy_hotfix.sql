-- =============================================================================
-- HOTFIX: alter Client-Code (vor dem Deploy der 25.05.2026 Patches) liest
-- direkt aus public.game_saves für Leaderboards. Die Lockdown-Migration
-- 20260525120000_security_hardening.sql hat dort die SELECT-Policies entfernt
-- → jeder User sieht nur noch seine eigene Zeile → Leaderboards leer.
--
-- Diese Migration restoriert die alten Policies TEMPORÄR damit der Live-Site
-- nicht broken aussieht. Nach dem Deploy der neuen Client-Patches (die aus
-- public.kaktus_clicker_leaderboard / public.my_fishing_kaktus_leaderboard
-- Views lesen, ohne payload-Leak) können diese Policies wieder gedroppt
-- werden — siehe Cleanup-Block unten.
--
-- Trade-off während des Übergangs: payload + user_id sind wieder für alle
-- Spielstände lesbar (Privacy-Leak). Nur laufen lassen wenn das Leaderboard
-- akut leer ist und der Deploy noch dauert.
-- =============================================================================

-- Restore — exakt wie ursprünglich in 20260521130000_create_game_saves.sql
drop policy if exists game_saves_select_leaderboard on public.game_saves;
create policy game_saves_select_leaderboard
  on public.game_saves
  for select
  to anon, authenticated
  using (game_id = 'kaktus-clicker');

drop policy if exists game_saves_select_fishing_leaderboard on public.game_saves;
create policy game_saves_select_fishing_leaderboard
  on public.game_saves
  for select
  to anon, authenticated
  using (game_id = 'my-fishing-kaktus');


-- ----- NACH DEM DEPLOY: diesen Block laufen lassen um den Privacy-Leak ------
-- wieder zu schließen. Auskommentiert damit er nicht versehentlich mit dem
-- Hotfix zusammen läuft.
--
-- drop policy if exists game_saves_select_leaderboard on public.game_saves;
-- drop policy if exists game_saves_select_fishing_leaderboard on public.game_saves;
