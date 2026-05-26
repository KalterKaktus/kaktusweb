-- =============================================================================
-- Cleanup: Skin-System + Autoclicker-Detection entfernen.
--
-- Beide Features sind aus dem Spiel raus. Skin-System wird durch eine fixe
-- pink Blume als Standard ersetzt (rein CSS/HTML, kein DB-State). Autoclicker-
-- Detection war zu nervig und der user wollte ihn nicht.
--
-- Bereits live in der DB ausgeführt — diese Migration ist für Repo-/Replay-
-- Konsistenz. Idempotent.
-- =============================================================================

-- Skin-System
drop function if exists public.set_cosmetics(jsonb) cascade;
alter table public.profiles drop column if exists cosmetics;

-- Autoclicker-Detection
drop trigger if exists kaktus_clicker_cps_throttle_trigger on public.game_saves;
drop function if exists public.kaktus_clicker_cps_throttle() cascade;
drop function if exists public.log_clicker_telemetry(int, int, numeric, numeric) cascade;

-- Existing autoclick flags als ignored resolvet (Adminpanel-Cleanup)
update public.cheat_flags
set resolved_at = coalesce(resolved_at, now()),
    resolution = 'ignored'
where flag_type in ('autoclicker_detected', 'autoclicker_burst', 'autoclicker_constant_rhythm')
  and resolved_at is null;
