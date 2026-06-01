-- =============================================================================
-- xp_rate_limit Trigger killen
--
-- Mein profiles_xp_throttle Trigger (aus 20260525160000_xp_per_call_throttle.sql)
-- hatte zuviele false-positives: Heartbeat (60s) + Flush-Pending (30s) im
-- xp-service.js kollidieren alle 60s exakt → 2 add_xp RPCs <10ms auseinander
-- → trigger flagged.
--
-- Die existing add_xp() RPC hat schon einen robusten Throttle:
--   - max 1000 XP pro Call
--   - max 5000 XP / 30s pro User (xp_throttle_hit Flag)
--   - heartbeat: max 1 Call / 50s
--
-- Mein Per-Call-1s-Lock ist redundant + nur störend. Weg damit.
-- Plus: js/xp-service.js hat jetzt single-flight Lock (callAddXp wartet auf
-- vorigen in-flight) → race ist client-seitig eliminiert.
-- =============================================================================

drop trigger if exists profiles_xp_throttle_trigger on public.profiles;
drop function if exists public.profiles_xp_throttle() cascade;

update public.cheat_flags
set resolved_at = coalesce(resolved_at, now()),
    resolution = 'ignored'
where flag_type = 'xp_rate_limit'
  and resolved_at is null;
