-- =============================================================================
-- game_saves_total_earned_range Constraint entfernen.
--
-- Der harte Cap von 1e15 für kaktus-clicker (eingeführt in
-- 20260525120000_security_hardening.sql) war zu eng: der legitime Top-Spieler
-- hat 9.97e14 in weniger als einer Woche erreicht und konnte ab da nicht
-- mehr cloud-saven ("Cloud-Fehler"), weil Postgres jeden Upsert mit Werten
-- > 1e15 mit check_violation abgelehnt hat.
--
-- Anti-Cheat läuft jetzt über autoban_system + display_name-Force-Trigger
-- (siehe 20260525200000_autoban_system.sql, 20260525210000_autoban_fix.sql),
-- nicht mehr über harte Server-Caps.
-- =============================================================================

alter table public.game_saves
  drop constraint if exists game_saves_total_earned_range;
