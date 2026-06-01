-- =============================================================================
-- Ban-Enforcement (server-side)
--
-- Bisheriger Ban: setzt nur profiles.is_banned = true. Effekt clientseitig
-- nur in KaktusClicker (zeigt Modal). Fishing-Game, Profile-Seite, Login,
-- Leaderboards, add_xp() laufen weiter normal. Gebannte User können sich
-- neu einloggen und in den Leaderboards weiter mit ihren (gecheateten?)
-- Scores prangen.
--
-- Diese Migration baut die server-side Hälfte des Ban-Enforcements:
--   1. Leaderboard-Views filtern gebannte User raus
--   2. profile.total_xp UPDATE für gebannte wird verworfen (XP-Grinding stop)
--   3. game_saves INSERT/UPDATE für gebannte wirft Exception
--
-- WICHTIG: keine Daten werden gelöscht oder verändert. Ein Unban macht den
-- User wieder voll spielfähig — seine Saves, Badges, XP, Profile-Inhalte
-- bleiben unverändert erhalten.
-- =============================================================================


-- ----- 1. Leaderboard-Views: gebannte User raus filtern --------------------

drop view if exists public.kaktus_clicker_leaderboard cascade;
create view public.kaktus_clicker_leaderboard
as
  select
    gs.user_id,
    gs.display_name,
    gs.total_earned,
    gs.season_id,
    gs.updated_at
  from public.game_saves gs
  left join public.profiles p on p.id = gs.user_id
  where gs.game_id = 'kaktus-clicker'
    and coalesce(p.is_banned, false) = false;

grant select on public.kaktus_clicker_leaderboard to anon, authenticated;


drop view if exists public.my_fishing_kaktus_leaderboard cascade;
create view public.my_fishing_kaktus_leaderboard
as
  select
    gs.user_id,
    gs.display_name,
    gs.total_earned,
    coalesce((gs.payload ->> 'prestige')::int, 0) as prestige,
    gs.updated_at
  from public.game_saves gs
  left join public.profiles p on p.id = gs.user_id
  where gs.game_id = 'my-fishing-kaktus'
    and coalesce(p.is_banned, false) = false;

grant select on public.my_fishing_kaktus_leaderboard to anon, authenticated;


-- ----- 2. XP-Grinding für gebannte stoppen ---------------------------------
-- Trigger verwirft total_xp-Erhöhungen wenn der User gebannt ist. Silent
-- (kein Cheat-Flag, ist ja kein Cheat sondern ein erwartetes Block-Verhalten).
-- Beim Unban läuft alles weiter — total_xp wird wieder akzeptiert.

create or replace function public.profiles_ban_block_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nur bei XP-Erhöhungen relevant. Bei reinen Profile-Edits (Admin setzt
  -- z.B. avatar_url für einen gebannten User) nicht stören.
  if NEW.total_xp is null or OLD.total_xp is null or NEW.total_xp <= OLD.total_xp then
    return NEW;
  end if;

  -- OLD.is_banned weil NEW könnte der gerade-ausgeführte Unban-PATCH sein.
  -- Wir wollen blockieren so lange er gebannt WAR.
  if OLD.is_banned = true then
    NEW.total_xp := OLD.total_xp;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_ban_block_xp_trigger on public.profiles;
create trigger profiles_ban_block_xp_trigger
  before update on public.profiles
  for each row
  when (NEW.total_xp is distinct from OLD.total_xp)
  execute function public.profiles_ban_block_xp();


-- ----- 3. Save-Block für gebannte ------------------------------------------
-- Wenn ein gebannter User trotz Frontend-Block versucht zu speichern (z.B.
-- via DevTools direct upsert), kriegt er einen klaren Exception zurück.
-- Saves bleiben unverändert.
--
-- Admin-Edits via service_role gehen weiterhin durch — Service-Role-PATCHes
-- über die Netlify-Function nutzen NICHT auth.uid() und der Trigger checkt
-- nur den TARGET-User (NEW.user_id), nicht den Caller. Falls der Admin den
-- save eines gebannten Users editiert, sollte das gewollt sein (z.B. um
-- Cheat-Werte zurückzusetzen).
--
-- Daher: Trigger checkt nur ob auth.uid() == NEW.user_id (User schreibt eigenen
-- Save). Wenn ja UND user gebannt → exception. Wenn Service-Role → durchlassen.

create or replace function public.game_saves_block_banned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  banned boolean;
begin
  -- Wenn kein Auth-Context (Service-Role): durchlassen.
  begin
    caller := auth.uid();
  exception when others then
    caller := null;
  end;

  if caller is null then
    return NEW;
  end if;

  -- Nur User-eigene Saves blockieren wenn gebannt.
  if caller = NEW.user_id then
    select is_banned into banned from public.profiles where id = NEW.user_id;
    if banned = true then
      raise exception 'account_banned' using
        errcode = 'P0001',
        hint = 'Dein Account ist gesperrt. Cloud-Save deaktiviert.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists game_saves_block_banned_trigger on public.game_saves;
create trigger game_saves_block_banned_trigger
  before insert or update on public.game_saves
  for each row
  execute function public.game_saves_block_banned();
