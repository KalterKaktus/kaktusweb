-- =============================================================================
-- Cleanup: existing xp_rate_limit Flags als ignored resolvet.
--
-- Grund: die meisten xp_rate_limit Flags waren false-positives aus dem
-- xp-service.js wo Heartbeat (60s-Timer) und FlushPending (30s-Timer) bei
-- exakt 60s parallel feuerten — 2 add_xp RPCs gingen <10ms auseinander raus.
--
-- Fix: Single-Flight Lock in js/xp-service.js (callAddXp wartet auf
-- vorherigen in-flight Call) — Race ist client-seitig eliminiert. Neue
-- xp_rate_limit Flags entstehen jetzt nur noch bei echtem Manipulationsversuch
-- (Cheater spammt add_xp Rpc aus DevTools).
--
-- Die alten Flags sind nicht löschbar (cheat_flags ist audit-trail), aber
-- resolvet damit das Adminpanel nicht mehr darauf zeigt.
-- =============================================================================

update public.cheat_flags
set resolved_at = coalesce(resolved_at, now()),
    resolution = 'ignored'
where flag_type = 'xp_rate_limit'
  and resolved_at is null;
