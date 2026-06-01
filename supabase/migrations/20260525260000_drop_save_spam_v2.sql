-- =============================================================================
-- save_spam-Trigger droppen v2 — source-based search
--
-- v1 (20260525240000) hat nur Namen mit 'save_spam' gematched und nichts
-- gedroppt → der Trigger heißt offenbar anders. v2 enumeriert alle Trigger-
-- Functions auf game_saves und scant ihre Source nach 'save_spam'-String.
-- Was matched, fliegt raus.
--
-- Falls keine Function 'save_spam' im Body hat: listet als raise notice alle
-- existierenden trigger-Namen auf game_saves auf, damit du im Supabase
-- Dashboard → Logs den richtigen identifizieren kannst.
-- =============================================================================

do $$
declare
  trig record;
  fn_src text;
  dropped_count int := 0;
begin
  for trig in
    select
      t.tgname,
      p.proname,
      n.nspname,
      p.oid as proc_oid,
      pg_get_functiondef(p.oid) as fn_def
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'public.game_saves'::regclass
      and not t.tgisinternal
  loop
    -- Wenn Function-Body 'save_spam' enthält (= ruft log_cheat_flag mit dem
    -- flag_type 'save_spam' auf), ist das unser Ziel.
    if trig.fn_def ilike '%save_spam%' then
      execute format('drop trigger if exists %I on public.game_saves', trig.tgname);
      execute format('drop function if exists %I.%I() cascade', trig.nspname, trig.proname);
      dropped_count := dropped_count + 1;
      raise notice 'DROPPED trigger % (function %.%)', trig.tgname, trig.nspname, trig.proname;
    end if;
  end loop;

  if dropped_count = 0 then
    raise notice '----- KEIN Trigger mit save_spam-Body gefunden. Listing alle game_saves Trigger: -----';
    for trig in
      select t.tgname, p.proname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.game_saves'::regclass and not t.tgisinternal
    loop
      raise notice '  trigger=% | function=%', trig.tgname, trig.proname;
    end loop;
    raise notice '----- Falls einer davon save_spam fired, schick mir den Namen + ich passe die Drop-Migration an. -----';
  end if;
end
$$;

-- Existing save_spam Flags als ignored markieren (audit cleanup)
update public.cheat_flags
set resolved_at = coalesce(resolved_at, now()),
    resolution = 'ignored'
where flag_type = 'save_spam'
  and resolved_at is null;
