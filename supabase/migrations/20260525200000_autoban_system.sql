-- =============================================================================
-- Auto-Ban System mit Staffelung (Codex' Empfehlung umgesetzt)
--
-- Tier 1 — kritischer Flag → SOFORT auto-ban
--   profile_tamper, fishing_payload_*, save_value_overflow,
--   save_jump_suspicious, account_banned_save_attempt, new_account_high_score
--
-- Tier 2 — Warn-Akkumulator → bei 5+ warn-Flags in 10 min → auto-ban
--   xp_rate_limit, xp_oversize_call, xp_throttle_hit, save_spam,
--   badge_equip_without_owning, vip_color_without_vip, catch_event_*
--
-- Initial-Save-Cap (Codex' "neuer Account + Rank 1 Save"):
--   Accounts jünger als 24h dürfen beim ersten Save nicht direkt Rank 1
--   einnehmen — Limits: Fishing 1000 Fänge, KK 10M Cactus.
--   → über Limit: kritischer Flag 'new_account_high_score' → Tier-1-Autoban
--
-- Auto-Reset bei Auto-Ban:
--   Beim Autoban wird game_saves.total_earned auf 0 + payload auf {} gesetzt.
--   Der vorherige State ist in game_saves_history erhalten — bei Unban kann
--   der Admin via restore_game_save(history_id) alles wiederherstellen.
--
-- Auto-Ban-Logging:
--   resolution = 'auto_banned' (statt 'banned' für manuelle Bans).
--   resolved_by = NULL (System).
--   Adminpanel kann differenzieren + Quick-Unban anbieten.
-- =============================================================================


-- ----- 1. Initial-Save-Cap für junge Accounts ------------------------------
-- Trigger auf game_saves INSERT. Holt account-age via auth.users.created_at.
-- Wenn account < 24h alt UND total_earned > Spiel-spezifisches Limit
-- → log_cheat_flag(critical, 'new_account_high_score') + reject.
-- Auto-Ban-Trigger fängt den kritischen Flag und sperrt sofort.

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
  clicker_limit constant numeric := 10000000;  -- 10 Mio Cactus
  effective_limit numeric;
begin
  -- Holt account-age aus auth.users (RLS-bypassed via SECURITY DEFINER).
  select now() - u.created_at into account_age
  from auth.users u
  where u.id = NEW.user_id;

  is_new := coalesce(account_age, interval '999 days') < interval '24 hours';

  if not is_new then
    return NEW;
  end if;

  -- Limits pro Spiel
  if NEW.game_id = 'my-fishing-kaktus' then
    effective_limit := fishing_limit;
  elsif NEW.game_id = 'kaktus-clicker' then
    effective_limit := clicker_limit;
  else
    return NEW;
  end if;

  if NEW.total_earned > effective_limit then
    begin
      perform public.log_cheat_flag(
        NEW.user_id,
        'new_account_high_score',
        'critical',
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
    raise exception 'new_account_high_score' using
      hint = format('Neuer Account (%s alt) versucht direkt total_earned=%s — limit=%s',
                    account_age, NEW.total_earned, effective_limit);
  end if;

  return NEW;
end;
$$;

drop trigger if exists game_saves_initial_cap_trigger on public.game_saves;
create trigger game_saves_initial_cap_trigger
  before insert on public.game_saves
  for each row
  execute function public.game_saves_initial_cap();


-- ----- 2. Auto-Ban-Trigger -------------------------------------------------
-- Feuert nach jedem cheat_flags INSERT. Logik:
--   Tier 1 (sofort): bestimmte flag_types ODER severity='critical' → ban
--   Tier 2 (accumulate): >= 5 warn-flags vom selben User in <10 min → ban
--
-- Auto-Ban macht 3 Dinge atomar:
--   a) profiles.is_banned = true
--   b) alle offenen cheat_flags des Users → resolution='auto_banned'
--   c) Auto-Reset: game_saves total_earned=0 + payload='{}'
--      (history-Trigger speichert den alten state für restore_game_save)

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
  -- Wenn User schon gebannt: skip (egal ob durch admin oder vorigen autoban)
  select is_banned into is_already_banned from public.profiles where id = NEW.user_id;
  if coalesce(is_already_banned, false) = true then
    return NEW;
  end if;

  -- Tier 1: kritischer flag-type oder severity='critical' → instant ban
  if NEW.severity = 'critical' or NEW.flag_type = any(critical_flag_types) then
    should_ban := true;
    ban_reason := format('Tier-1 critical: %s', NEW.flag_type);
  else
    -- Tier 2: 5+ warn-Flags in den letzten 10 Minuten → ban
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

  -- (a) Account bannen
  update public.profiles set is_banned = true, updated_at = now() where id = NEW.user_id;

  -- (b) Alle offenen Flags des Users als auto_banned markieren
  update public.cheat_flags
  set resolved_at = now(),
      resolved_by = null,  -- NULL = system / auto
      resolution = 'auto_banned'
  where user_id = NEW.user_id
    and resolved_at is null;

  -- (c) Auto-Reset: total_earned=0 + payload leer. History-Trigger fängt
  -- den vorherigen state, sodass admin via restore_game_save(history_id)
  -- alles wiederherstellen kann beim Unban.
  update public.game_saves
  set total_earned = 0,
      payload = '{}'::jsonb,
      updated_at = now()
  where user_id = NEW.user_id;

  raise notice 'AUTO-BAN: user=% reason=%', NEW.user_id, ban_reason;

  return NEW;
end;
$$;

drop trigger if exists cheat_flags_autoban_trigger on public.cheat_flags;
create trigger cheat_flags_autoban_trigger
  after insert on public.cheat_flags
  for each row
  execute function public.cheat_flags_autoban();


-- ----- 3. Helper-View: zuletzt auto-banned User ---------------------------
-- Für das Adminpanel: was wurde automatisch gebannt + warum + wann.
-- Plus: link auf die history-id mit dem letzten pre-ban-state für restore.

drop view if exists public.auto_banned_users cascade;
create view public.auto_banned_users
as
  select
    p.id as user_id,
    p.username,
    p.is_banned,
    (
      select cf.created_at from public.cheat_flags cf
      where cf.user_id = p.id and cf.resolution = 'auto_banned'
      order by cf.created_at desc limit 1
    ) as banned_at,
    (
      select cf.flag_type from public.cheat_flags cf
      where cf.user_id = p.id and cf.resolution = 'auto_banned'
      order by cf.created_at desc limit 1
    ) as ban_trigger_flag,
    (
      select count(*) from public.cheat_flags cf
      where cf.user_id = p.id and cf.resolution = 'auto_banned'
    ) as auto_banned_flag_count,
    (
      -- letzter game_saves_history-Eintrag VOR dem ban (für restore)
      select gsh.id from public.game_saves_history gsh
      where gsh.user_id = p.id
        and gsh.changed_at < (
          select min(cf.created_at) from public.cheat_flags cf
          where cf.user_id = p.id and cf.resolution = 'auto_banned'
        )
      order by gsh.changed_at desc limit 1
    ) as restore_history_id
  from public.profiles p
  where p.is_banned = true
    and exists (
      select 1 from public.cheat_flags cf
      where cf.user_id = p.id and cf.resolution = 'auto_banned'
    );

-- View nur für service_role lesbar (Adminpanel queryt via Backend).
revoke all on public.auto_banned_users from public, anon, authenticated;
grant select on public.auto_banned_users to service_role;
