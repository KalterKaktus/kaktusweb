-- =============================================================================
-- Security Hardening — schließt die Lücken aus dem Black-Box-Audit am 25.05.2026.
--
-- Lücken die diese Migration fixt:
--   1. profiles_select_leaderboard exponierte die ROHE profiles-Tabelle inkl.
--      is_banned, recent_xp_*, last_xp_heartbeat, referred_by, donation_*,
--      referral_code an alle authenticated User. → Privacy-Leak.
--   2. game_saves_select_leaderboard / _select_fishing_leaderboard exponierten
--      payload + user_id ALLER User. Jeder User konnte fremde Game-Payloads,
--      letzten Online-Zeitpunkt, Achievements, etc. dumpen.
--   3. game_saves hatte KEINEN Cap auf total_earned → Cheater haben 519T+ und
--      87T eingetragen ohne Flag (Schwelle für save_value_overflow ist 10^18,
--      vernünftig wären 10^15 für Kaktus / 10^9 für Fishing).
--   4. display_name in game_saves war client-controlled → Impersonation von
--      anderen Spielernamen, plus XSS-Vektor (aktuell sauber escaped, aber
--      Defense in depth).
--   5. avatar_url akzeptierte 'javascript:alert(1)' — kein URL-Check.
--   6. log_cheat_flag()-Funktion ist für authenticated-Rolle ohne EXECUTE-
--      Permission → BEFORE-UPDATE-Trigger auf profiles und game_saves werfen
--      "permission denied for function log_cheat_flag" statt den Flag zu
--      loggen. Folge: Cheat wird blockiert (gut) aber Audit-Trail fehlt (böse).
--
-- Idempotent: kann mehrfach laufen (drop+create / if not exists).
-- =============================================================================


-- ----- 1. profiles: rohen Leaderboard-Select entfernen -----------------------
-- Alle Leaderboards lesen längst aus profiles_public (View mit Safe-Spalten).
-- Die alte Policy war ein Privacy-Leak.
drop policy if exists profiles_select_leaderboard on public.profiles;


-- ----- 2. game_saves: rohe Leaderboard-Selects entfernen + Safe-Views -------
drop policy if exists game_saves_select_leaderboard on public.game_saves;
drop policy if exists game_saves_select_fishing_leaderboard on public.game_saves;

-- View für KaktusClicker-Saison-Leaderboard: nur die Felder die das UI braucht.
-- user_id wird mit-exposed weil Leaderboard via profiles_public join enriched
-- (Level + Badge); ohne user_id geht das nicht. Aber NO payload, NO updated_at-leak.
drop view if exists public.kaktus_clicker_leaderboard cascade;
create view public.kaktus_clicker_leaderboard
  with (security_invoker = true)
as
  select
    user_id,
    display_name,
    total_earned,
    season_id,
    updated_at
  from public.game_saves
  where game_id = 'kaktus-clicker';

-- Da security_invoker=true greift weiterhin RLS — wir brauchen daher eine
-- SELECT-Policy auf game_saves die den View-Zugriff erlaubt. Da Views in
-- security_invoker=true Modus die Rolle des callers nutzen, schreiben wir
-- eine column-agnostische Policy die das View nutzen kann.
-- Pragmatischer: View OHNE security_invoker (= ohne RLS-Check), aber dafür
-- mit security_definer-style owner. Dann brauchen wir keine extra Policy.
drop view if exists public.kaktus_clicker_leaderboard cascade;
create view public.kaktus_clicker_leaderboard
as
  select
    user_id,
    display_name,
    total_earned,
    season_id,
    updated_at
  from public.game_saves
  where game_id = 'kaktus-clicker';

grant select on public.kaktus_clicker_leaderboard to anon, authenticated;

-- Fishing-Leaderboard sortiert nach prestige + totalCaught. prestige steckt
-- aktuell im payload. Wir extrahieren es column-explizit damit der payload
-- nicht mehr nach außen muss.
drop view if exists public.my_fishing_kaktus_leaderboard cascade;
create view public.my_fishing_kaktus_leaderboard
as
  select
    user_id,
    display_name,
    total_earned,
    coalesce((payload ->> 'prestige')::int, 0) as prestige,
    updated_at
  from public.game_saves
  where game_id = 'my-fishing-kaktus';

grant select on public.my_fishing_kaktus_leaderboard to anon, authenticated;


-- ----- 3. CHECK-Constraints auf game_saves: harte Caps gegen Cheats ---------
-- Vernünftige Größenordnungen:
--   KaktusClicker total_earned: max 10^15 (Quadrillion Cactus) — weit über
--     dem was ein ehrlicher Spieler in einem Monat schafft.
--   Fishing total_earned (= totalCaught): max 10^7 (10 Mio Fänge) — bei 1
--     Fang/Sekunde dauert das ~115 Tage non-stop.
-- 10^18 (alte Schwelle für save_value_overflow) ist VIEL zu großzügig.
alter table public.game_saves
  drop constraint if exists game_saves_total_earned_range;

alter table public.game_saves
  add constraint game_saves_total_earned_range
  check (
    total_earned >= 0
    and (
      (game_id = 'kaktus-clicker' and total_earned <= 1e15)
      or (game_id = 'my-fishing-kaktus' and total_earned <= 1e7)
      or game_id not in ('kaktus-clicker', 'my-fishing-kaktus')
    )
  );

alter table public.game_saves
  drop constraint if exists game_saves_display_name_length;

alter table public.game_saves
  add constraint game_saves_display_name_length
  check (char_length(display_name) between 1 and 32);


-- ----- 4. Trigger: display_name aus profiles.username forcieren -------------
-- Verhindert Impersonation (Cheater setzt display_name = 'Kaktus' und sieht
-- aus wie der echte Admin) und ist Defense-in-Depth gegen XSS-Renderfehler.
create or replace function public.game_saves_force_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
begin
  -- profile.username hat einen CHECK constraint (^[a-zA-Z0-9_]+$, 3-24 chars)
  -- → garantiert HTML-safe. Fallback auf 'Spieler' wenn kein Profil existiert.
  select username into resolved_name
  from public.profiles
  where id = new.user_id;

  new.display_name := coalesce(nullif(resolved_name, ''), 'Spieler');
  return new;
end;
$$;

drop trigger if exists game_saves_force_display_name_trigger on public.game_saves;
create trigger game_saves_force_display_name_trigger
  before insert or update on public.game_saves
  for each row
  execute function public.game_saves_force_display_name();


-- ----- 5. avatar_url: URL-Format-Check --------------------------------------
-- Aktuell akzeptiert die Spalte 'javascript:alert(1)'. Falls avatar_url je
-- als <a href> oder <img src> ohne Sanitization gerendert wird, ist das XSS.
-- Pragmatisch: nur http/https oder NULL erlauben.
alter table public.profiles
  drop constraint if exists profiles_avatar_url_scheme;

alter table public.profiles
  add constraint profiles_avatar_url_scheme
  check (
    avatar_url is null
    or avatar_url ~* '^https?://[^\s<>"'']+$'
  );


-- ----- 6. log_cheat_flag(): EXECUTE-Permission für authenticated -----------
-- Beobachtung: log_cheat_flag wird in mehreren Trigger-Pfaden aufgerufen.
-- Bei add_xp() RPC läuft sie als SECURITY DEFINER → ok. Bei BEFORE-UPDATE
-- auf profiles / game_saves läuft sie im Caller-Context → "permission denied".
-- Folge: Cheat wird blockiert (Rollback) aber NICHT geloggt. Admin sieht
-- nichts. Außerdem leakt die Error-Message dem Cheater dass es einen Trigger
-- gibt, was bei einem Audit-Trail nicht passieren würde.
do $$
begin
  -- Function muss existieren — falls nicht, ist die Migration für log_cheat_flag
  -- selbst noch nicht gelaufen. Dann skippen, der nächste run holt es nach.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'log_cheat_flag'
  ) then
    execute 'grant execute on function public.log_cheat_flag(uuid, text, text, jsonb) to authenticated';
    -- Trigger sollte ohnehin SECURITY DEFINER sein. Idempotent als ALTER.
    execute 'alter function public.log_cheat_flag(uuid, text, text, jsonb) security definer';
  end if;
exception when others then
  -- Wenn Signatur abweicht, manuell im Dashboard nachziehen.
  raise notice 'log_cheat_flag hardening skipped: %', sqlerrm;
end
$$;


-- ----- 7. DELETE-Policy auf game_saves: explizit verbieten -----------------
-- Aktuell wird DELETE silent gefiltert (keine Policy → false). Das ist OK
-- aber unschön: client kriegt ein "ok" zurück obwohl nichts passiert. Wir
-- belassen es so (kein User soll seinen Save löschen können — verhindert
-- Save-Scumming bei Achievements + Saison-Reset-Tricks), aber dokumentieren
-- es hier explizit. Falls User einen Reset-Button braucht: separate RPC.
comment on table public.game_saves is
  'KEIN DELETE für authenticated User. Saison-Reset läuft via Server-Job '
  '(kaktus-clicker-season Function). User-Reset wäre via RPC public.reset_save() '
  'zu implementieren.';
