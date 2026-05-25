-- =============================================================================
-- HOTFIX: Auto-Ban Endlosschleife + Audit-Trail-Verlust
--
-- Bugs aus dem letzten Pentest:
--
-- 1. STACK OVERFLOW (P0054) bei profile-tampering Versuchen.
--    Trigger-Sequenz: user updates vip → profile_tamper trigger revertet +
--    INSERT cheat_flags → cheat_flags_autoban → UPDATE profile is_banned →
--    profile_tamper feuert WIEDER (sieht is_banned change durch denselben user
--    via auth.uid()) → revert + log → INSERT → ... ad infinitum.
--    Fix: cheat_flags_autoban setzt `session_replication_role = replica` für
--    die Dauer der ban-Aktion → alle BEFORE/AFTER-Trigger werden für DIESE
--    UPDATEs übersprungen. profile_tamper greift nicht mehr ein.
--
-- 2. AUDIT-TRAIL-VERLUST bei `raise exception` Triggern (initial_cap,
--    delta_throttle, validate_fishing_payload). Die Exception rollt die ganze
--    Transaction zurück → der vorher geschriebene cheat_flags-Eintrag
--    verschwindet → kein Audit, kein Auto-Ban-Trigger.
--    Fix: trigger return null (für INSERT) bzw return OLD (für UPDATE) statt
--    raise. Der Save wird silent abgelehnt, der Flag bleibt persistent,
--    autoban-Trigger feuert → User wird gebannt.
--
-- Client-Erleben: bei abgelehntem Save kein Error im SDK, aber nichts
-- gespeichert (rowCount=0). Game-State wird beim nächsten Page-Load aus dem
-- letzten erfolgreichen Save geladen — kosmetisch verwirrend für Cheater,
-- aber das ist OK.
-- =============================================================================


-- ----- 1. cheat_flags_autoban: session_replication_role bypass ------------

create or replace function public.cheat_flags_autoban()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_already_banned boolean;
  warn_count int;
  should_ban boolean := false;
  ban_reason text;
  critical_flag_types text[] := array[
    'profile_tamper',
    'fishing_payload_invalid_prestige',
    'fishing_payload_invalid_area',
    'fishing_payload_upgrade_out_of_range',
    'fishing_payload_bestkg_anomaly',
    'fishing_payload_bestvalue_anomaly',
    'fishing_payload_too_many_areas',
    'fishing_payload_invalid_upgrade',
    'save_value_overflow',
    'save_jump_suspicious',
    'new_account_high_score'
  ];
begin
  select is_banned into is_already_banned from public.profiles where id = NEW.user_id;
  if coalesce(is_already_banned, false) = true then
    return NEW;
  end if;

  if NEW.severity = 'critical' or NEW.flag_type = any(critical_flag_types) then
    should_ban := true;
    ban_reason := format('Tier-1 critical: %s', NEW.flag_type);
  else
    select count(*) into warn_count
    from public.cheat_flags
    where user_id = NEW.user_id
      and severity = 'warn'
      and created_at > now() - interval '10 minutes';

    if warn_count >= 5 then
      should_ban := true;
      ban_reason := format('Tier-2 accumulator: %s warn flags in 10min', warn_count);
    end if;
  end if;

  if not should_ban then
    return NEW;
  end if;

  -- WICHTIG: disable alle anderen Trigger für DIESEN ban-vorgang, sodass
  -- profile_tamper / xp_throttle / etc. nicht in eine Endlosschleife laufen.
  -- SET LOCAL ist auto-reset am Ende der Transaction.
  set local session_replication_role = 'replica';

  -- (a) Account bannen
  update public.profiles
    set is_banned = true, updated_at = now()
    where id = NEW.user_id;

  -- (b) Alle offenen Flags als auto_banned markieren
  update public.cheat_flags
    set resolved_at = now(),
        resolved_by = null,
        resolution = 'auto_banned'
    where user_id = NEW.user_id
      and resolved_at is null;

  -- (c) Pre-ban State manuell in History sichern. Der history-Trigger ist
  -- via session_replication_role=replica disabled, daher direkter Insert.
  insert into public.game_saves_history
    (user_id, game_id, operation, payload, total_earned, display_name, season_id, changed_by, changed_by_role)
  select
    user_id, game_id, 'UPDATE', payload, total_earned, display_name, season_id,
    null, 'system'
  from public.game_saves
  where user_id = NEW.user_id;

  -- (d) Auto-Reset: total_earned=0 + payload leer
  update public.game_saves
    set total_earned = 0, payload = '{}'::jsonb, updated_at = now()
    where user_id = NEW.user_id;

  raise notice 'AUTO-BAN: user=% reason=%', NEW.user_id, ban_reason;

  return NEW;
end;
$$;


-- ----- 2. initial_cap: silent reject statt raise ---------------------------

create or replace function public.game_saves_initial_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_age interval;
  is_new boolean;
  fishing_limit constant numeric := 1000;
  clicker_limit constant numeric := 10000000;
  effective_limit numeric;
begin
  select now() - u.created_at into account_age
  from auth.users u
  where u.id = NEW.user_id;

  is_new := coalesce(account_age, interval '999 days') < interval '24 hours';
  if not is_new then return NEW; end if;

  if NEW.game_id = 'my-fishing-kaktus' then
    effective_limit := fishing_limit;
  elsif NEW.game_id = 'kaktus-clicker' then
    effective_limit := clicker_limit;
  else
    return NEW;
  end if;

  if NEW.total_earned > effective_limit then
    -- Flag persistieren — KEIN raise, sondern silent skip via return null.
    -- Sonst würde die Transaction rollback und der Flag wäre weg → kein autoban.
    begin
      perform public.log_cheat_flag(
        NEW.user_id, 'new_account_high_score', 'critical',
        jsonb_build_object(
          'game_id', NEW.game_id,
          'total_earned', NEW.total_earned,
          'limit', effective_limit,
          'account_age_hours', extract(epoch from account_age) / 3600
        )
      );
    exception when others then
      raise notice 'log_cheat_flag failed: %', sqlerrm;
    end;
    return null;  -- skip insert silent — autoban-Trigger handelt den Rest
  end if;

  return NEW;
end;
$$;


-- ----- 3. delta_throttle: silent reject statt raise -----------------------

create or replace function public.game_saves_delta_throttle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta_seconds double precision;
  ratio double precision;
begin
  if TG_OP <> 'UPDATE' then return NEW; end if;
  if coalesce(OLD.total_earned, 0) = 0 then return NEW; end if;
  if NEW.total_earned <= OLD.total_earned then return NEW; end if;

  ratio := NEW.total_earned / NULLIF(OLD.total_earned, 0);
  delta_seconds := extract(epoch from (now() - coalesce(OLD.updated_at, now())));

  if ratio > 100 and delta_seconds < 60 then
    begin
      perform public.log_cheat_flag(
        NEW.user_id, 'save_jump_suspicious', 'critical',
        jsonb_build_object(
          'game_id', NEW.game_id,
          'old_total_earned', OLD.total_earned,
          'new_total_earned', NEW.total_earned,
          'ratio', ratio,
          'delta_seconds', delta_seconds
        )
      );
    exception when others then raise notice 'log_cheat_flag failed: %', sqlerrm; end;
    return OLD;  -- skip update — Save bleibt unverändert + Flag ist persistent
  end if;

  return NEW;
end;
$$;


-- ----- 4. validate_fishing_payload: silent reject statt raise -------------

create or replace function public.game_saves_validate_fishing_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  prestige_val int;
  areas jsonb;
  area_text text;
  upgrade_key text;
  upgrade_val int;
  valid_areas text[] := array['pond', 'lake', 'ocean'];
  best_kg numeric;
  best_value numeric;
  violation text := null;
  details jsonb := '{}'::jsonb;
begin
  if NEW.game_id <> 'my-fishing-kaktus' then return NEW; end if;
  p := coalesce(NEW.payload, '{}'::jsonb);

  -- Sammle alle Violations und logge dann genau einen Flag-Typ.
  prestige_val := coalesce((p ->> 'prestige')::int, 0);
  if prestige_val < 0 or prestige_val > 2 then
    violation := 'fishing_payload_invalid_prestige';
    details := jsonb_build_object('prestige', prestige_val);
  end if;

  if violation is null then
    areas := p -> 'unlockedAreas';
    if areas is not null and jsonb_typeof(areas) = 'array' then
      if jsonb_array_length(areas) > 3 then
        violation := 'fishing_payload_too_many_areas';
        details := jsonb_build_object('count', jsonb_array_length(areas));
      else
        for area_text in select jsonb_array_elements_text(areas) loop
          if not (area_text = any(valid_areas)) then
            violation := 'fishing_payload_invalid_area';
            details := jsonb_build_object('area', area_text);
            exit;
          end if;
        end loop;
      end if;
    end if;
  end if;

  if violation is null then
    for upgrade_key in select jsonb_object_keys(coalesce(p -> 'upgrades', '{}'::jsonb)) loop
      if not (upgrade_key = any(array['rod', 'line', 'hook', 'luck', 'sonar'])) then
        violation := 'fishing_payload_invalid_upgrade';
        details := jsonb_build_object('upgrade', upgrade_key);
        exit;
      end if;
      upgrade_val := coalesce((p -> 'upgrades' ->> upgrade_key)::int, 0);
      if upgrade_val < 0 or upgrade_val > 5 then
        violation := 'fishing_payload_upgrade_out_of_range';
        details := jsonb_build_object('upgrade', upgrade_key, 'value', upgrade_val);
        exit;
      end if;
    end loop;
  end if;

  if violation is null then
    best_kg := coalesce((p -> 'stats' ->> 'bestWeightKg')::numeric, 0);
    if best_kg < 0 or best_kg > 100 then
      violation := 'fishing_payload_bestkg_anomaly';
      details := jsonb_build_object('bestWeightKg', best_kg);
    end if;
  end if;

  if violation is null then
    best_value := coalesce((p -> 'stats' ->> 'bestCatchValue')::numeric, 0);
    if best_value < 0 or best_value > 10000000 then
      violation := 'fishing_payload_bestvalue_anomaly';
      details := jsonb_build_object('bestCatchValue', best_value);
    end if;
  end if;

  if violation is not null then
    begin
      perform public.log_cheat_flag(NEW.user_id, violation, 'critical', details);
    exception when others then raise notice 'log_cheat_flag failed: %', sqlerrm; end;
    -- silent skip — Save wird abgelehnt, Flag bleibt persistent, autoban greift
    if TG_OP = 'INSERT' then return null; else return OLD; end if;
  end if;

  return NEW;
end;
$$;
