-- =============================================================================
-- Phase 1 + 2 Full Lockdown — Antwort auf Codex' aggressiven Pentest-Report.
--
-- Befunde die diese Migration fixt:
--   1. XP-Throttle-Bypass: `last_xp_call_at`, `recent_xp_total`,
--      `recent_xp_window_start`, `last_xp_heartbeat` waren via direct UPDATE
--      durch User selbst editierbar → 1s-Throttle umgehbar.
--   2. profiles_public exposed donation_total_cents/_count anonym. Fixed:
--      diese Felder raus aus der View — wer Donator-Highlight will, kriegt
--      bool is_donator = (donation_total_cents > 0).
--   3. game_saves payload war komplett client-authoritative. Fishing-Cheat
--      9.999.999 Fänge + Prestige 2 + Max-Upgrades ging durch ohne Flag.
--      Fixed: BEFORE-Trigger validiert payload-Felder gegen Spiel-Caps.
--   4. Save-Delta-Throttle: total_earned 100 → 9.999.999 in 1 Sekunde
--      ohne save_jump_suspicious Flag → Trigger fehlt oder ist broken.
--      Fixed: neuer Trigger der >100× Sprünge in <60s blockt + flagged.
--
-- Idempotent.
-- =============================================================================


-- ----- 1. Throttle-Spalten gegen User-Tampering schützen -------------------
-- Pattern: BEFORE-UPDATE-Trigger checkt ob auth.uid() = id (User editiert sich
-- selbst) UND eine geschützte Spalte ändert → revert auf OLD-Wert. Service-Role
-- (Admin-Panel) hat keinen auth.uid() → läuft durch. SECURITY-DEFINER-RPCs wie
-- add_xp() ändern dieselben Spalten — die müssen `set local role` oder andere
-- Mittel nutzen, sonst greift der Trigger auch dort. Workaround: wir checken
-- speziell ob die Änderung von auth.uid() = id KOMMT — bei add_xp() ist das
-- der Fall, aber die Function läuft als SECURITY DEFINER → auth.uid() bleibt
-- der User. Daher: wir prüfen statt dessen ob `pg_trigger_depth() > 1` (= wir
-- sind in einem nested trigger / RPC-Aufruf, also vertrauenswürdig). Falls
-- pg_trigger_depth = 1 (direkter UPDATE vom Client) → blockieren.

create or replace function public.profiles_throttle_cols_protect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  is_self boolean;
  rpc_context boolean;
begin
  begin
    caller := auth.uid();
  exception when others then
    caller := null;
  end;

  -- Service-Role (kein auth context) → durchlassen.
  if caller is null then
    return NEW;
  end if;

  is_self := (caller = NEW.id);

  -- Wenn nicht self, greift schon RLS — hier nichts zu tun.
  if not is_self then
    return NEW;
  end if;

  -- Wir sind in einem nested call (z.B. add_xp RPC → UPDATE) wenn depth > 1.
  -- pg_trigger_depth() = 1 bei direktem Client-UPDATE.
  rpc_context := (pg_trigger_depth() > 1);
  if rpc_context then
    return NEW;
  end if;

  -- Direkter Client-UPDATE auf geschützte Spalten → revert.
  if NEW.last_xp_call_at is distinct from OLD.last_xp_call_at then
    NEW.last_xp_call_at := OLD.last_xp_call_at;
  end if;
  if NEW.recent_xp_total is distinct from OLD.recent_xp_total then
    NEW.recent_xp_total := OLD.recent_xp_total;
  end if;
  if NEW.recent_xp_window_start is distinct from OLD.recent_xp_window_start then
    NEW.recent_xp_window_start := OLD.recent_xp_window_start;
  end if;
  if NEW.last_xp_heartbeat is distinct from OLD.last_xp_heartbeat then
    NEW.last_xp_heartbeat := OLD.last_xp_heartbeat;
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_throttle_cols_protect_trigger on public.profiles;
create trigger profiles_throttle_cols_protect_trigger
  before update on public.profiles
  for each row
  execute function public.profiles_throttle_cols_protect();


-- ----- 2. profiles_public minimalisieren -----------------------------------
-- donation_total_cents / donation_count waren anonym lesbar → potenzielle
-- Datenschutz-Anfrage. Wir exposen stattdessen einen Boolean is_donator damit
-- VIPs/Donator-Highlights weiterhin gehen, aber die exakten Beträge privat
-- bleiben. referral_code muss public bleiben weil Referral-System (User teilt
-- seinen Code) sonst nicht funktioniert.

drop view if exists public.profiles_public cascade;
create view public.profiles_public
as
  select
    p.id,
    p.username,
    p.avatar_url,
    p.total_xp,
    floor(sqrt(coalesce(p.total_xp, 0)::numeric / 8))::int as level,
    p.equipped_badge,
    p.vip,
    p.vip_color,
    p.referral_code,
    (coalesce(p.donation_total_cents, 0) > 0) as is_donator,
    (
      select coalesce(jsonb_agg(badge_id), '[]'::jsonb)
      from public.user_badges where user_id = p.id
    ) as badges
  from public.profiles p
  where p.username is not null;

grant select on public.profiles_public to anon, authenticated;


-- ----- 3. Fishing payload-Validation ---------------------------------------
-- Hardcoded gegen Spiel-Design:
--   prestige: 0-2 (3 Areas: pond, lake, ocean)
--   unlockedAreas: ⊂ [pond, lake, ocean], max 3
--   upgrades.{rod,line,hook,luck,sonar}: max 5 (maxLevel laut data/upgrades.js)
--   stats.bestWeightKg: ≤ 100 (matched catch_event_kg_anomaly threshold)
--   stats.bestCatchValue: ≤ 10_000_000 (matched catch_event_value_anomaly)
--
-- KaktusClicker payload-Validation: lassen wir aus. Der existing season-guard
-- trigger + total_earned-CHECK + display_name-trigger reichen für den
-- offensichtlichen Cheat (Score-Fake). Hardcap für interne Buildings/Upgrades
-- wäre zu spielgebunden und würde game-balance-changes brechen.

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
begin
  if NEW.game_id <> 'my-fishing-kaktus' then
    return NEW;
  end if;

  p := coalesce(NEW.payload, '{}'::jsonb);

  -- prestige
  prestige_val := coalesce((p ->> 'prestige')::int, 0);
  if prestige_val < 0 or prestige_val > 2 then
    raise exception 'fishing_payload_invalid_prestige' using
      hint = format('prestige=%s ausserhalb 0-2', prestige_val);
  end if;

  -- unlockedAreas: muss array sein, jedes Element in valid_areas
  areas := p -> 'unlockedAreas';
  if areas is not null and jsonb_typeof(areas) = 'array' then
    if jsonb_array_length(areas) > 3 then
      raise exception 'fishing_payload_too_many_areas' using
        hint = format('unlockedAreas hat %s Einträge (max 3)', jsonb_array_length(areas));
    end if;
    for area_text in select jsonb_array_elements_text(areas)
    loop
      if not (area_text = any(valid_areas)) then
        raise exception 'fishing_payload_invalid_area' using
          hint = format('unlockedAreas enthält "%s" — nicht erlaubt', area_text);
      end if;
    end loop;
  end if;

  -- upgrades: jedes Level 0-5
  for upgrade_key in select jsonb_object_keys(coalesce(p -> 'upgrades', '{}'::jsonb))
  loop
    if not (upgrade_key = any(array['rod', 'line', 'hook', 'luck', 'sonar'])) then
      raise exception 'fishing_payload_invalid_upgrade' using
        hint = format('upgrades.%s ist nicht erlaubt', upgrade_key);
    end if;
    upgrade_val := coalesce((p -> 'upgrades' ->> upgrade_key)::int, 0);
    if upgrade_val < 0 or upgrade_val > 5 then
      raise exception 'fishing_payload_upgrade_out_of_range' using
        hint = format('upgrades.%s=%s ausserhalb 0-5', upgrade_key, upgrade_val);
    end if;
  end loop;

  -- stats caps
  best_kg := coalesce((p -> 'stats' ->> 'bestWeightKg')::numeric, 0);
  if best_kg < 0 or best_kg > 100 then
    raise exception 'fishing_payload_bestkg_anomaly' using
      hint = format('stats.bestWeightKg=%s ausserhalb 0-100', best_kg);
  end if;

  best_value := coalesce((p -> 'stats' ->> 'bestCatchValue')::numeric, 0);
  if best_value < 0 or best_value > 10000000 then
    raise exception 'fishing_payload_bestvalue_anomaly' using
      hint = format('stats.bestCatchValue=%s ausserhalb 0-10M', best_value);
  end if;

  return NEW;
end;
$$;

drop trigger if exists game_saves_validate_fishing_payload_trigger on public.game_saves;
create trigger game_saves_validate_fishing_payload_trigger
  before insert or update on public.game_saves
  for each row
  when (NEW.game_id = 'my-fishing-kaktus')
  execute function public.game_saves_validate_fishing_payload();


-- ----- 4. Save-Delta-Throttle ----------------------------------------------
-- Wenn total_earned von OLD auf NEW um Faktor 100+ steigt und das letzte
-- Update <60s her ist → save_jump_suspicious Flag + reject. Skippt UPDATE
-- bei OLD.total_earned = 0 (neuer Save, jeder Sprung ist legitim Anfangs-Boost).

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
  -- Nur UPDATE betrachten (INSERT hat keine baseline)
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  -- Skip wenn baseline 0 (neuer Save, legitimer Initial-Score)
  if coalesce(OLD.total_earned, 0) = 0 then
    return NEW;
  end if;

  -- Nur bei Steigerung
  if NEW.total_earned <= OLD.total_earned then
    return NEW;
  end if;

  ratio := NEW.total_earned / NULLIF(OLD.total_earned, 0);
  delta_seconds := extract(epoch from (now() - coalesce(OLD.updated_at, now())));

  -- >100× Sprung in <60s → verdächtig
  if ratio > 100 and delta_seconds < 60 then
    begin
      perform public.log_cheat_flag(
        NEW.user_id,
        'save_jump_suspicious',
        'critical',
        jsonb_build_object(
          'game_id', NEW.game_id,
          'old_total_earned', OLD.total_earned,
          'new_total_earned', NEW.total_earned,
          'ratio', ratio,
          'delta_seconds', delta_seconds
        )
      );
    exception when others then
      raise notice 'log_cheat_flag failed: %', sqlerrm;
    end;
    raise exception 'save_jump_suspicious' using
      hint = format('total_earned-Sprung von %s auf %s in %ss (ratio %s×) wird abgelehnt',
                    OLD.total_earned, NEW.total_earned, round(delta_seconds::numeric, 1), round(ratio::numeric, 1));
  end if;

  return NEW;
end;
$$;

drop trigger if exists game_saves_delta_throttle_trigger on public.game_saves;
create trigger game_saves_delta_throttle_trigger
  before update on public.game_saves
  for each row
  execute function public.game_saves_delta_throttle();
