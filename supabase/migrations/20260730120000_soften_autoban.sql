-- Autoban entschärfen: warnen statt bannen, und niemals Daten anfassen.
--
-- Was schiefging (Fall vom 30.07.2026):
--   `game_saves_initial_cap` hat bei einem Account < 24 h und über 10 Mio
--   total_earned im Clicker einen 'critical'-Flag gesetzt UND den Spielstand
--   mit `return null` still verworfen. 10 Mio sind im Clicker aber normales
--   Spielen — Gebäude gehen bis 3.83e32. Der Flag hat dann den Autoban
--   ausgelöst, und der hat `payload='{}'` geschrieben.
--
-- Drei unabhängige Fehler, alle hier behoben:
--   1. Grenze viel zu niedrig                  → 1 Mrd statt 10 Mio
--   2. Trigger verwirft den Spielstand         → speichert jetzt normal
--   3. Autoban überschreibt game_saves         → fasst Daten nicht mehr an
--
-- Grundsatz ab jetzt: Automatik darf flaggen, aber niemals bannen wegen
-- Punktzahl und niemals Spielstände verändern. Löschen nur manuell.


-- ----- 1. initial_cap: warnen statt verwerfen ------------------------------

create or replace function public.game_saves_initial_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_age interval;
  is_new boolean;
  -- Fishing zählt gefangene Fische, Clicker zählt Kakteen — komplett andere
  -- Größenordnungen, daher getrennte Grenzen. Beide bewusst so hoch, dass
  -- ehrliches Spielen sie nicht erreicht.
  fishing_limit constant numeric := 50000;
  clicker_limit constant numeric := 1000000000;   -- 1 Mrd
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
    -- Nur protokollieren. severity 'warn' statt 'critical', damit der
    -- Autoban-Trigger nicht auslöst.
    begin
      perform public.log_cheat_flag(
        NEW.user_id, 'new_account_high_score', 'warn',
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
  end if;

  -- WICHTIG: immer NEW zurückgeben. Früher stand hier `return null`, was den
  -- Spielstand still verworfen hat — die Spielerin sah "gespeichert", in der
  -- Cloud kam nichts an.
  return NEW;
end;
$$;


-- ----- 2. Autoban: Punktzahl-Flag entfernen + Daten in Ruhe lassen ---------

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
  -- 'new_account_high_score' ist hier RAUS. Es reichte nicht, die severity auf
  -- 'warn' zu setzen: der flag_type stand zusätzlich in dieser Liste und hätte
  -- weiterhin sofort gebannt.
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
    'save_jump_suspicious'
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
      and created_at > now() - interval '10 minutes'
      -- Punktzahl-Warnungen dürfen auch den Tier-2-Zähler nicht füllen,
      -- sonst bannt ein schnell spielender Neuling sich über 5 Saves selbst.
      and flag_type <> 'new_account_high_score';

    if warn_count >= 5 then
      should_ban := true;
      ban_reason := format('Tier-2 accumulator: %s warn flags in 10min', warn_count);
    end if;
  end if;

  if not should_ban then
    return NEW;
  end if;

  update public.profiles set is_banned = true, updated_at = now() where id = NEW.user_id;

  update public.cheat_flags
  set resolved_at = now(),
      resolved_by = null,
      resolution = 'auto_banned'
  where user_id = NEW.user_id
    and resolved_at is null;

  -- Der frühere Auto-Reset (total_earned=0, payload='{}') ist ersatzlos
  -- entfernt. Ein Ban sperrt den Zugang — er löscht keine Daten. Spielstände
  -- werden ausschließlich manuell über das Adminpanel geändert oder gelöscht.

  raise notice 'AUTO-BAN: user=% reason=% (Spielstand unangetastet)', NEW.user_id, ban_reason;

  return NEW;
end;
$$;
