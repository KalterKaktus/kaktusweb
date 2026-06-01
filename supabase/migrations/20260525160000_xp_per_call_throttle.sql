-- =============================================================================
-- XP-Pump-Fix: Per-Call-Throttle für total_xp
--
-- Lücke: add_xp() RPC hat zwei Caps (1000 XP/Call + 5000 XP/60s-Window), aber
-- KEIN Mindest-Abstand zwischen Calls. Cheater konnte in <1 Sekunde 5 Calls
-- absetzen und sofort 5000 XP holen (Black-Box gemessen: 10 Calls in 763ms,
-- 5000 XP added). Nach 60s konnte das Window erneut gefüllt werden.
--
-- Strategie ohne add_xp()-Source zu patchen: BEFORE-UPDATE-Trigger auf
-- public.profiles. Wenn total_xp erhöht wird und der letzte XP-Update
-- weniger als 1 Sekunde her ist, wird die Erhöhung verworfen + ein
-- xp_rate_limit Cheat-Flag geloggt.
--
-- Der Trigger pflegt die Spalte last_xp_call_at selbst — egal ob add_xp()
-- sie kennt oder nicht. Das ist die einzige Spalte die wir hinzufügen.
--
-- Legitimer Client-Code (xp-service.js) batcht XP eh mit 30s-Flush-Interval
-- → kein User wird durch diese Throttle beeinträchtigt. Nur Direkt-RPC-Spam
-- aus DevTools wird geblockt.
-- =============================================================================

-- Neue Spalte für per-Call-Timestamp. recent_xp_window_start kann nicht
-- reused werden, weil die nur am Window-Start gesetzt wird, nicht pro Call.
alter table public.profiles
  add column if not exists last_xp_call_at timestamptz;


create or replace function public.profiles_xp_throttle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta_seconds double precision;
  delta_xp bigint;
begin
  -- Nur prüfen wenn total_xp gerade erhöht wird. Bei reinen Profile-Edits
  -- (z.B. avatar_url, vip, equipped_badge) skippen — sonst würde der
  -- Throttle bei jedem Profil-Update zuschlagen.
  if NEW.total_xp is null or OLD.total_xp is null or NEW.total_xp <= OLD.total_xp then
    return NEW;
  end if;

  delta_xp := NEW.total_xp - OLD.total_xp;

  -- Wenn ein vorheriger XP-Call existiert: Mindest-Abstand 1 Sekunde.
  if OLD.last_xp_call_at is not null then
    delta_seconds := extract(epoch from (now() - OLD.last_xp_call_at));

    if delta_seconds < 1 then
      -- Cheat-Flag loggen (best-effort — wenn log_cheat_flag fehlt, skip).
      begin
        perform public.log_cheat_flag(
          NEW.id,
          'xp_rate_limit',
          'warn',
          jsonb_build_object(
            'delta_ms', round(delta_seconds * 1000),
            'attempted_delta_xp', delta_xp,
            'old_total_xp', OLD.total_xp
          )
        );
      exception when others then
        raise notice 'log_cheat_flag fehlt oder failed: %', sqlerrm;
      end;

      -- XP-Erhöhung zurückrollen — last_xp_call_at NICHT updaten, sonst
      -- könnte ein cheater den timestamp resetten durch failed calls.
      NEW.total_xp := OLD.total_xp;
      NEW.last_xp_call_at := OLD.last_xp_call_at;
      return NEW;
    end if;
  end if;

  -- Erfolgreicher XP-Call: timestamp pflegen.
  NEW.last_xp_call_at := now();
  return NEW;
end;
$$;


drop trigger if exists profiles_xp_throttle_trigger on public.profiles;
create trigger profiles_xp_throttle_trigger
  before update on public.profiles
  for each row
  when (NEW.total_xp is distinct from OLD.total_xp)
  execute function public.profiles_xp_throttle();


-- ----- Admin-Bypass-Hinweis ------------------------------------------------
-- Wenn Admin im Panel total_xp setzt (PATCH via service_role), läuft dieser
-- Trigger auch durch. Das ist meist OK weil zwischen Admin-Edits viel mehr
-- als 1 Sekunde vergeht. Falls der Admin VIEL editet, gibt es ggf. einen
-- false-positive xp_rate_limit Flag — kann ignoriert werden.
--
-- Echte Spieler sind nicht betroffen: xp-service.js batcht XP-Events lokal
-- und flushed alle 30s einen einzigen Call ab. Per-Call-Mindestabstand 1s
-- liegt 30× darunter.
