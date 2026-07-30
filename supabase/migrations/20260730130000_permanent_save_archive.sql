-- Permanentes Spielstand-Archiv.
--
-- Warum zusätzlich zu game_saves_history:
--   history schreibt bei UPDATE den NEUEN Zustand. Der Stand VOR einer
--   Zerstörung liegt dort nur implizit in der vorherigen Zeile — man muss ihn
--   rekonstruieren, und wenn jemand irgendwann die Prune-Zeile aktiviert
--   (auskommentiert in 20260525150000), ist er endgültig weg.
--
-- Dieses Archiv ist bewusst anders:
--   - append-only, wird NIE aufgeräumt
--   - schreibt den Zustand VOR der Zerstörung
--   - trägt einen Grund, damit nachvollziehbar bleibt was passiert ist
--
-- Ausgelöst wird es bei:
--   DELETE                     → immer
--   UPDATE mit sinkendem Wert  → Wipe, Admin-Reset, Saison-Reset
-- Normales Spielen erhöht total_earned nur, löst also nichts aus.


create table if not exists public.game_saves_archive (
  id             bigserial primary key,
  user_id        uuid not null,
  game_id        text not null,
  payload        jsonb not null,
  total_earned   numeric,
  display_name   text,
  season_id      text,
  reason         text not null,
  archived_at    timestamptz not null default now(),
  archived_by    uuid,
  archived_by_role text
);

create index if not exists game_saves_archive_user_idx
  on public.game_saves_archive (user_id, game_id, archived_at desc);

comment on table public.game_saves_archive is
  'Append-only. Zustand VOR Löschung/Reset. Niemals automatisch löschen.';


-- ----- Zugriff: nur Service-Role ------------------------------------------
-- Kein SELECT für anon/authenticated: hier stehen vollständige Spielstände.

alter table public.game_saves_archive enable row level security;

drop policy if exists game_saves_archive_no_public on public.game_saves_archive;
create policy game_saves_archive_no_public
  on public.game_saves_archive
  for select
  to anon, authenticated
  using (false);

revoke all on public.game_saves_archive from anon, authenticated;


-- ----- Trigger: vor der Zerstörung sichern ---------------------------------

create or replace function public.game_saves_archive_before_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  caller_role text;
  why text;
  old_total numeric;
  new_total numeric;
begin
  begin
    caller := auth.uid();
  exception when others then
    caller := null;
  end;

  if caller is null then
    caller_role := 'system';
  elsif caller = OLD.user_id then
    caller_role := 'user';
  else
    caller_role := 'admin';
  end if;

  if TG_OP = 'DELETE' then
    why := 'pre_delete';
  else
    old_total := coalesce(OLD.total_earned, 0);
    new_total := coalesce(NEW.total_earned, 0);

    -- Nur sichern wenn tatsächlich Fortschritt verschwindet. Normales Spielen
    -- erhöht den Wert, das erzeugt also keine Archiv-Einträge.
    if new_total >= old_total then
      return NEW;
    end if;

    -- Nichts zu retten wenn vorher schon leer.
    if old_total <= 0 and coalesce(OLD.payload, '{}'::jsonb) = '{}'::jsonb then
      return NEW;
    end if;

    if new_total = 0 and coalesce(NEW.payload, '{}'::jsonb) = '{}'::jsonb then
      why := 'pre_wipe';
    elsif caller_role = 'admin' then
      why := 'pre_admin_edit';
    elsif caller_role = 'system' then
      why := 'pre_system_reset';   -- z.B. Monats-Saison-Reset
    else
      why := 'value_decreased';
    end if;
  end if;

  insert into public.game_saves_archive
    (user_id, game_id, payload, total_earned, display_name, season_id,
     reason, archived_by, archived_by_role)
  values
    (OLD.user_id, OLD.game_id, coalesce(OLD.payload, '{}'::jsonb), OLD.total_earned,
     OLD.display_name, OLD.season_id, why, caller, caller_role);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists game_saves_archive_before_loss_trigger on public.game_saves;
create trigger game_saves_archive_before_loss_trigger
  before update or delete on public.game_saves
  for each row
  execute function public.game_saves_archive_before_loss();


-- ----- Wiederherstellen aus dem Archiv --------------------------------------

create or replace function public.restore_from_archive(archive_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.game_saves_archive%rowtype;
begin
  select * into a from public.game_saves_archive where id = archive_id;
  if not found then
    raise exception 'Archiv-Eintrag % nicht gefunden', archive_id;
  end if;

  insert into public.game_saves
    (user_id, game_id, payload, total_earned, display_name, season_id, updated_at)
  values
    (a.user_id, a.game_id, a.payload, a.total_earned, a.display_name, a.season_id, now())
  on conflict (user_id, game_id) do update
    set payload      = excluded.payload,
        total_earned = excluded.total_earned,
        season_id    = excluded.season_id,
        updated_at   = now();
end;
$$;

revoke all on function public.restore_from_archive(bigint) from public, anon, authenticated;
grant execute on function public.restore_from_archive(bigint) to service_role;


-- ----- Bequeme Übersicht fürs Adminpanel -----------------------------------

drop view if exists public.recoverable_saves cascade;
create view public.recoverable_saves as
  select a.id as archive_id,
         a.user_id,
         p.username,
         a.game_id,
         a.reason,
         a.total_earned,
         a.archived_at,
         a.archived_by_role
  from public.game_saves_archive a
  left join public.profiles p on p.id = a.user_id
  order by a.archived_at desc;
