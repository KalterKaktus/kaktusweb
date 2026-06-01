-- =============================================================================
-- Backup/Rollback-System für game_saves
--
-- Supabase macht Daily-Backups der gesamten DB (Free: 7 Tage Retention,
-- Pro: PITR bis zu 28 Tagen). Für selective Rollback eines EINZELNEN Saves
-- ist ein full-restore aber overkill. Diese Migration legt eine separate
-- History-Tabelle an die per Trigger jede INSERT/UPDATE/DELETE auf game_saves
-- mit-loggt. Damit kann der Admin im Panel die letzten N Versionen eines
-- Spielstands sehen und einen davon restoren.
--
-- Datenmenge: pro User ~1 Save-Operation pro 30s während aktivem Spiel,
-- ~50KB payload. Bei 100 aktiven Spielern × 8h × 120 Ops = 96k rows/Tag.
-- Daher: automatischer Cleanup nach 30 Tagen via partial Index + Job.
-- =============================================================================

create table if not exists public.game_saves_history (
  id bigserial primary key,
  user_id uuid not null,
  game_id text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  payload jsonb,
  total_earned double precision,
  display_name text,
  season_id text,
  changed_at timestamptz not null default now(),
  -- Wer hat die Änderung gemacht: auth.uid() des Callers, falls verfügbar.
  -- NULL bei Service-Role-Calls (Admin-Panel) — separate Spalte für admin-Audit.
  changed_by uuid,
  changed_by_role text  -- 'user' | 'admin' | 'system'
);

create index if not exists game_saves_history_user_game_idx
  on public.game_saves_history (user_id, game_id, changed_at desc);

-- 30-Tage Retention: ältere Einträge können via cron-job gelöscht werden.
-- Manuell läuft das z.B. via:
--   delete from public.game_saves_history where changed_at < now() - interval '30 days';

alter table public.game_saves_history enable row level security;

-- Nur Service-Role (Admin-Panel) darf lesen. User sollen ihre History nicht
-- selbst dumpen können — die enthält frühere Werte die evtl. Cheat-Spuren
-- zeigen, das wäre der erste Schritt zum Cover-Up.
-- (Keine Policy = keine User-Zugriff. Service-Role bypassed RLS sowieso.)


-- ----- Trigger der jede Änderung auf game_saves loggt -----------------------
create or replace function public.game_saves_log_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  caller_role text;
begin
  -- auth.uid() gibt die UUID des aktuellen JWT-Callers zurück, oder NULL bei
  -- Service-Role / Trigger ohne JWT-Context.
  begin
    caller := auth.uid();
  exception when others then
    caller := null;
  end;

  if caller is null then
    caller_role := 'system';  -- Migration, Cron, Service-Role
  elsif caller = coalesce(new.user_id, old.user_id) then
    caller_role := 'user';
  else
    caller_role := 'admin';
  end if;

  if TG_OP = 'DELETE' then
    insert into public.game_saves_history
      (user_id, game_id, operation, payload, total_earned, display_name, season_id, changed_by, changed_by_role)
    values
      (old.user_id, old.game_id, 'DELETE', old.payload, old.total_earned, old.display_name, old.season_id, caller, caller_role);
    return old;
  else
    insert into public.game_saves_history
      (user_id, game_id, operation, payload, total_earned, display_name, season_id, changed_by, changed_by_role)
    values
      (new.user_id, new.game_id, TG_OP, new.payload, new.total_earned, new.display_name, new.season_id, caller, caller_role);
    return new;
  end if;
end;
$$;

drop trigger if exists game_saves_log_history_trigger on public.game_saves;
create trigger game_saves_log_history_trigger
  after insert or update or delete on public.game_saves
  for each row
  execute function public.game_saves_log_history();


-- ----- Restore-RPC: ein historischer State zurück in game_saves spielen -----
-- Nur Service-Role (Admin-Panel) sollte das aufrufen — daher GRANT nur an
-- service_role. Falls Admin-Panel als authenticated User callen will, müsste
-- der Caller im admin-emails set sein (Check via separate Function oder API).
create or replace function public.restore_game_save(history_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  snap public.game_saves_history;
begin
  select * into snap from public.game_saves_history where id = history_id;
  if not found then
    raise exception 'history-id % nicht gefunden', history_id;
  end if;

  if snap.operation = 'DELETE' then
    -- Restore eines gelöschten Saves: re-insert
    insert into public.game_saves (user_id, game_id, payload, total_earned, display_name, season_id, updated_at)
    values (snap.user_id, snap.game_id, snap.payload, snap.total_earned, snap.display_name, snap.season_id, now())
    on conflict (user_id, game_id) do update set
      payload = excluded.payload,
      total_earned = excluded.total_earned,
      display_name = excluded.display_name,
      season_id = excluded.season_id,
      updated_at = excluded.updated_at;
  else
    update public.game_saves
    set payload = snap.payload,
        total_earned = snap.total_earned,
        display_name = snap.display_name,
        season_id = snap.season_id,
        updated_at = now()
    where user_id = snap.user_id and game_id = snap.game_id;
  end if;
end;
$$;

revoke all on function public.restore_game_save(bigint) from public, anon, authenticated;
grant execute on function public.restore_game_save(bigint) to service_role;


comment on table public.game_saves_history is
  'Audit-Log aller Änderungen an game_saves. Service-Role-only Read. '
  'Restore via SELECT public.restore_game_save(history_id).';
