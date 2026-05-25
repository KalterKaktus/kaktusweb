-- =============================================================================
-- save_spam-Trigger entfernen
--
-- Grund: feuert auch im legitimen Game-Betrieb false-positives. KaktusClicker
-- hat 10 verschiedene Save-Stellen (auto-save 15s, prestige, achievement,
-- offline-progress, manual-save, beforeunload, online-zeit-tick, admin-events,
-- monatssaison-reset, zurücksetzen). Diese kollidieren regelmäßig <2s
-- auseinander → save_spam Flag bei normalen Spielern.
--
-- Save-Spam ist redundant durch andere Layers:
--   - delta_throttle (>100× Sprung in <60s)
--   - CHECK constraints (total_earned caps)
--   - validate_fishing_payload (semantische Caps)
--   - autoclick_throttle (CPS-Check für KK)
--   - delta-/jump-Detection im autoban
--
-- Direct-Upsert-Spam aus DevTools wird also auch ohne save_spam erkannt
-- (über die Werte die der Cheater einträgt, nicht über die Save-Frequenz).
--
-- Diese Migration ist defensiv: Trigger-Name + Function-Name kennen wir nicht
-- (Source in nicht-committed level_system.sql). DO-Block enumeriert pg_trigger
-- und pg_proc nach 'save_spam' im Namen und droppt was matched.
-- =============================================================================

do $$
declare
  trig record;
  fn record;
begin
  -- 1. Alle Trigger droppen deren Name 'save_spam' enthält
  for trig in
    select t.tgname, c.relname as table_name, n.nspname as schema_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and (t.tgname ilike '%save_spam%' or t.tgname ilike '%save%spam%')
  loop
    execute format('drop trigger if exists %I on %I.%I', trig.tgname, trig.schema_name, trig.table_name);
    raise notice 'dropped trigger: %.%.%', trig.schema_name, trig.table_name, trig.tgname;
  end loop;

  -- 2. Alle Functions droppen deren Name 'save_spam' enthält (CASCADE für ggf. übersehene Trigger)
  for fn in
    select p.proname, n.nspname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname ilike '%save_spam%' or p.proname ilike '%save%spam%')
  loop
    execute format('drop function if exists %I.%I(%s) cascade', fn.nspname, fn.proname, fn.args);
    raise notice 'dropped function: %.%(%)', fn.nspname, fn.proname, fn.args;
  end loop;
end
$$;


-- 3. Existing save_spam Flags als 'ignored' resolvet (auch resolved-flags
-- aufräumen, sodass das Adminpanel clean wird)
update public.cheat_flags
set resolved_at = coalesce(resolved_at, now()),
    resolution = 'ignored'
where flag_type = 'save_spam'
  and resolved_at is null;
