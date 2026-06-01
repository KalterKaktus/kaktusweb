-- =============================================================================
-- Autoclicker-Detection für KaktusClicker (kombinierte Migration)
--
-- Zwei Detection-Layers + Autoban-Konfiguration in einem File:
--
-- Layer 1 (server-side, unumgehbar): kaktus_clicker_cps_throttle Trigger
--   prüft beim Save die avg-cps via (delta_clicks / delta_seconds). Wenn
--   >22 cps über min 30s Save-Fenster → Save reject + Flag.
--
-- Layer 2 (client-telemetry, umgehbar wenn JS gepatcht): log_clicker_telemetry
--   RPC nimmt clientseitig berechnete Metriken (max_cps_1s + CV) und checkt:
--   - max_cps_1s > 22  → Burst-Flag
--   - cv < 0.05 + window >= 60s → Konstanter-Rhythmus-Flag
--
-- Auto-Ban Konfiguration: alle drei Flag-Types laufen als severity 'warn'.
-- Sie zählen NICHT zum Tier-2-Accumulator (sonst würde mehrfaches Klicken
-- den User automatisch bannen). Stattdessen: Client zeigt User ein Popup
-- ("Autoklicker verderben den Spielspaß und sind verboten"), Admin sieht den
-- Flag im Adminpanel und entscheidet manuell.
--
-- Idempotent.
-- =============================================================================


-- ----- Layer 1: Server-side avg-CPS Trigger --------------------------------

create or replace function public.kaktus_clicker_cps_throttle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_clicks numeric;
  new_clicks numeric;
  delta_clicks numeric;
  delta_seconds numeric;
  avg_cps numeric;
begin
  if NEW.game_id <> 'kaktus-clicker' or TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  old_clicks := coalesce((OLD.payload ->> 'totalClicks')::numeric, 0);
  new_clicks := coalesce((NEW.payload ->> 'totalClicks')::numeric, 0);
  delta_clicks := new_clicks - old_clicks;
  if delta_clicks < 1 then return NEW; end if;

  delta_seconds := extract(epoch from (now() - coalesce(OLD.updated_at, now())));
  if delta_seconds < 30 then return NEW; end if;

  avg_cps := delta_clicks / delta_seconds;

  if avg_cps > 22 then
    begin
      perform public.log_cheat_flag(
        NEW.user_id, 'autoclicker_detected', 'warn',
        jsonb_build_object(
          'delta_clicks', delta_clicks,
          'delta_seconds', delta_seconds,
          'avg_cps', round(avg_cps, 2),
          'old_clicks', old_clicks,
          'new_clicks', new_clicks
        )
      );
    exception when others then
      raise notice 'log_cheat_flag failed: %', sqlerrm;
    end;
    return OLD;  -- Save reject — Flag persistiert, kein Auto-Ban (warn + excluded)
  end if;

  return NEW;
end;
$$;

drop trigger if exists kaktus_clicker_cps_throttle_trigger on public.game_saves;
create trigger kaktus_clicker_cps_throttle_trigger
  before update on public.game_saves
  for each row
  when (NEW.game_id = 'kaktus-clicker')
  execute function public.kaktus_clicker_cps_throttle();


-- ----- Layer 2: Client-Telemetry RPC ---------------------------------------

create or replace function public.log_clicker_telemetry(
  p_window_seconds int,
  p_click_count int,
  p_max_cps_1s numeric,
  p_cv numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
begin
  begin caller := auth.uid(); exception when others then caller := null; end;
  if caller is null then return; end if;
  if coalesce(p_window_seconds, 0) < 30 then return; end if;
  if coalesce(p_click_count, 0) < 30 then return; end if;

  -- humanly unmöglicher 1-Sekunden-Burst
  if p_max_cps_1s > 22 then
    perform public.log_cheat_flag(
      caller, 'autoclicker_burst', 'warn',
      jsonb_build_object(
        'max_cps_1s', p_max_cps_1s,
        'window_seconds', p_window_seconds,
        'click_count', p_click_count
      )
    );
    return;
  end if;

  -- konstanter Rhythmus über sustained Periode (cv < 5% Variance über >=60s)
  if p_cv is not null and p_cv >= 0 and p_cv < 0.05 and p_window_seconds >= 60 then
    perform public.log_cheat_flag(
      caller, 'autoclicker_constant_rhythm', 'warn',
      jsonb_build_object(
        'cv', p_cv,
        'window_seconds', p_window_seconds,
        'click_count', p_click_count,
        'max_cps_1s', p_max_cps_1s
      )
    );
    return;
  end if;
end;
$$;

revoke all on function public.log_clicker_telemetry(int, int, numeric, numeric) from public, anon;
grant execute on function public.log_clicker_telemetry(int, int, numeric, numeric) to authenticated;


-- ----- Autoban-Trigger: autoclicker-types vom Accumulator ausschließen ----

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
  autoclicker_flag_types text[] := array[
    'autoclicker_detected',
    'autoclicker_burst',
    'autoclicker_constant_rhythm'
  ];
begin
  select is_banned into is_already_banned from public.profiles where id = NEW.user_id;
  if coalesce(is_already_banned, false) = true then return NEW; end if;

  if NEW.severity = 'critical' or NEW.flag_type = any(critical_flag_types) then
    should_ban := true;
    ban_reason := format('Tier-1 critical: %s', NEW.flag_type);
  else
    -- Tier-2 Accumulator: warn-flags zählen ABER autoclicker-types ausnehmen.
    -- Autoclicker → Popup für User, manueller Ban durch Admin im Bedarfsfall.
    select count(*) into warn_count
    from public.cheat_flags
    where user_id = NEW.user_id
      and severity = 'warn'
      and flag_type <> all(autoclicker_flag_types)
      and created_at > now() - interval '10 minutes';

    if warn_count >= 5 then
      should_ban := true;
      ban_reason := format('Tier-2 accumulator: %s warn flags in 10min (autoclicker excluded)', warn_count);
    end if;
  end if;

  if not should_ban then return NEW; end if;

  set local session_replication_role = 'replica';

  update public.profiles
    set is_banned = true, updated_at = now()
    where id = NEW.user_id;

  update public.cheat_flags
    set resolved_at = now(),
        resolved_by = null,
        resolution = 'auto_banned'
    where user_id = NEW.user_id
      and resolved_at is null;

  insert into public.game_saves_history
    (user_id, game_id, operation, payload, total_earned, display_name, season_id, changed_by, changed_by_role)
  select
    user_id, game_id, 'UPDATE', payload, total_earned, display_name, season_id,
    null, 'system'
  from public.game_saves
  where user_id = NEW.user_id;

  update public.game_saves
    set total_earned = 0, payload = '{}'::jsonb, updated_at = now()
    where user_id = NEW.user_id;

  raise notice 'AUTO-BAN: user=% reason=%', NEW.user_id, ban_reason;
  return NEW;
end;
$$;
