-- =============================================================================
-- KaktusGarden Multiplayer + Cloud-Save v4
--
-- Autoritative Raum-/Slot-Vergabe fuer eingeloggte Spieler:
--   - 6 Spieler pro Raum, Slots 0..5 (UI zeigt 1/6 .. 6/6)
--   - automatisches Matchmaking fuellt immer den aeltesten freien Raum zuerst
--     (Raum ordinal=1 ist Server A); erst wenn alle vorhandenen Raeume voll
--     sind, wird der naechste Raum angelegt
--   - ein aktiver Slot pro Account und eine connection_id pro Browser-Session
--   - kurze 45-Sekunden-Lease nur zur Bereinigung abgestuerzter Verbindungen
--   - direkte Invite-Codes wechseln bei vollem Raum NICHT still in einen
--     anderen Raum, sondern liefern garden_room_full
--
-- Realtime:
--   Private Topic: garden:room:<room_uuid>
--   Presence + Broadcast sind nur fuer aktive Mitglieder dieses Raums erlaubt.
--
-- Farmdaten:
--   game_saves bleibt die einzige dauerhafte Quelle. Von fremden Saves werden
--   ausschliesslich die 64 cells des v4-Payloads exponiert bzw. gebroadcastet.
--   Inventar, Coins, Shopbestand und sonstige private Daten bleiben verborgen.
--
-- Bewusst KEIN DELETE alter KaktusGarden-Saves: Testdaten duerfen zwar
-- verworfen werden, eine idempotente Migration darf bei erneutem Ausfuehren
-- aber keine inzwischen neuen Saves loeschen. Der Client kann alte/ungueltige
-- Payloads einmalig durch einen frischen v4-Save ersetzen.
-- =============================================================================


-- ----- 1. Autoritative Raeume und aktive Slot-Leases ------------------------

create table if not exists public.kaktus_garden_rooms (
  id uuid primary key default gen_random_uuid(),
  room_ordinal bigint generated always as identity unique,
  invite_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  constraint kaktus_garden_rooms_invite_code_unique unique (invite_code),
  constraint kaktus_garden_rooms_invite_code_format check (
    invite_code = upper(invite_code)
    and invite_code ~ '^[A-Z0-9]{6}$'
  ),
  constraint kaktus_garden_rooms_status check (status in ('open', 'closed'))
);

create table if not exists public.kaktus_garden_room_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  room_id uuid not null references public.kaktus_garden_rooms (id) on delete cascade,
  slot_index smallint not null,
  connection_id uuid not null,
  joined_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  lease_expires_at timestamptz not null default (now() + interval '45 seconds'),
  constraint kaktus_garden_room_members_slot_range check (slot_index between 0 and 5),
  constraint kaktus_garden_room_members_room_slot_unique unique (room_id, slot_index)
);

create index if not exists kaktus_garden_room_members_room_lease_idx
  on public.kaktus_garden_room_members (room_id, lease_expires_at);

create index if not exists kaktus_garden_room_members_lease_idx
  on public.kaktus_garden_room_members (lease_expires_at);

alter table public.kaktus_garden_rooms enable row level security;
alter table public.kaktus_garden_room_members enable row level security;

-- Raeume und Belegungen koennen nur ueber die gehaerteten RPCs veraendert
-- werden. Der eigene aktive Membership-Datensatz darf gelesen werden, unter
-- anderem damit die Realtime-RLS-Policy die Zugehoerigkeit pruefen kann.
revoke all on table public.kaktus_garden_rooms
  from public, anon, authenticated;
revoke all on table public.kaktus_garden_room_members
  from public, anon, authenticated;
grant select on table public.kaktus_garden_room_members to authenticated;

drop policy if exists kaktus_garden_room_members_select_own
  on public.kaktus_garden_room_members;
create policy kaktus_garden_room_members_select_own
  on public.kaktus_garden_room_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and lease_expires_at > clock_timestamp()
    and not exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_banned, false) = true
    )
  );


-- ----- 2. Race-sicheres A-first Matchmaking -------------------------------

-- Erlaubt auch das erneute Anwenden nach einer fruehen Testversion mit einer
-- anderen OUT-Signatur (zum Beispiel noch ohne server_now).
drop function if exists public.garden_join_room(uuid, text);
create or replace function public.garden_join_room(
  p_connection_id uuid,
  p_invite_code text default null
)
returns table (
  room_id uuid,
  room_ordinal bigint,
  invite_code text,
  slot_index smallint,
  connection_id uuid,
  lease_expires_at timestamptz,
  occupancy integer,
  channel_topic text,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_invite_code text := nullif(upper(btrim(p_invite_code)), '');
  v_member public.kaktus_garden_room_members%rowtype;
  v_room public.kaktus_garden_rooms%rowtype;
  v_slot smallint;
  v_create_attempts integer := 0;
begin
  if v_user_id is null then
    raise exception 'garden_login_required' using errcode = 'P0001';
  end if;

  if p_connection_id is null then
    raise exception 'garden_connection_id_required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user_id and coalesce(p.is_banned, false) = true
  ) then
    raise exception 'garden_account_banned' using errcode = 'P0001';
  end if;

  -- Ein kurzer globaler Transaction-Lock macht Auswahl + Insert atomar. Bei
  -- sechs Spielern pro Raum ist die winzige Serialisierung deutlich robuster
  -- als clientseitiges Presence-Matchmaking und verhindert Doppel-Slots.
  perform pg_advisory_xact_lock(hashtextextended('kaktus-garden-room-allocation', 0));

  delete from public.kaktus_garden_room_members m
  where m.lease_expires_at <= v_now;

  select m.*
  into v_member
  from public.kaktus_garden_room_members m
  where m.user_id = v_user_id;

  if found then
    if v_member.connection_id <> p_connection_id then
      raise exception 'garden_already_connected' using errcode = 'P0001';
    end if;

    update public.kaktus_garden_room_members m
    set heartbeat_at = v_now,
        lease_expires_at = v_now + interval '45 seconds'
    where m.user_id = v_user_id
      and m.connection_id = p_connection_id
    returning m.* into v_member;

    select r.*
    into strict v_room
    from public.kaktus_garden_rooms r
    where r.id = v_member.room_id;
  elsif v_invite_code is not null then
    select r.*
    into v_room
    from public.kaktus_garden_rooms r
    where r.invite_code = v_invite_code
      and r.status = 'open';

    if not found then
      raise exception 'garden_room_not_found' using errcode = 'P0001';
    end if;

    select candidate.slot_index::smallint
    into v_slot
    from generate_series(0, 5) as candidate(slot_index)
    where not exists (
      select 1
      from public.kaktus_garden_room_members m
      where m.room_id = v_room.id
        and m.slot_index = candidate.slot_index
    )
    order by candidate.slot_index
    limit 1;

    if v_slot is null then
      raise exception 'garden_room_full' using errcode = 'P0001';
    end if;
  else
    -- A-first: immer room_ordinal aufsteigend und darin den kleinsten Slot.
    select r.*
    into v_room
    from public.kaktus_garden_rooms r
    where r.status = 'open'
      and (
        select count(*)
        from public.kaktus_garden_room_members m
        where m.room_id = r.id
      ) < 6
    order by r.room_ordinal
    limit 1;

    if not found then
      -- invite_code ist kurz und unique. Die Schleife faengt die extrem
      -- unwahrscheinliche Kollision ab, ohne das Matchmaking abzubrechen.
      loop
        begin
          insert into public.kaktus_garden_rooms default values
          returning * into v_room;
          exit;
        exception when unique_violation then
          v_create_attempts := v_create_attempts + 1;
          if v_create_attempts >= 8 then
            raise exception 'garden_room_create_failed' using errcode = 'P0001';
          end if;
        end;
      end loop;
    end if;

    select candidate.slot_index::smallint
    into v_slot
    from generate_series(0, 5) as candidate(slot_index)
    where not exists (
      select 1
      from public.kaktus_garden_room_members m
      where m.room_id = v_room.id
        and m.slot_index = candidate.slot_index
    )
    order by candidate.slot_index
    limit 1;
  end if;

  -- Bei einem Reconnect steht der Slot bereits in v_member; bei einem neuen
  -- Join wird er jetzt reserviert.
  if v_member.user_id is null then
    if v_slot is null then
      -- Defense in depth fuer inkonsistente manuelle DB-Aenderungen.
      raise exception 'garden_room_full' using errcode = 'P0001';
    end if;

    insert into public.kaktus_garden_room_members (
      user_id, room_id, slot_index, connection_id,
      joined_at, heartbeat_at, lease_expires_at
    ) values (
      v_user_id, v_room.id, v_slot, p_connection_id,
      v_now, v_now, v_now + interval '45 seconds'
    )
    returning * into v_member;
  end if;

  update public.kaktus_garden_rooms r
  set last_active_at = v_now
  where r.id = v_room.id;

  room_id := v_room.id;
  room_ordinal := v_room.room_ordinal;
  invite_code := v_room.invite_code;
  slot_index := v_member.slot_index;
  connection_id := v_member.connection_id;
  lease_expires_at := v_member.lease_expires_at;
  select count(*)::integer
  into occupancy
  from public.kaktus_garden_room_members m
  where m.room_id = v_room.id
    and m.lease_expires_at > v_now;
  channel_topic := 'garden:room:' || v_room.id::text;
  server_now := v_now;

  return next;
end;
$$;


drop function if exists public.garden_room_heartbeat(uuid);
create or replace function public.garden_room_heartbeat(p_connection_id uuid)
returns table (
  lease_expires_at timestamptz,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_room_id uuid;
  v_lease_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'garden_login_required' using errcode = 'P0001';
  end if;

  if p_connection_id is null then
    raise exception 'garden_connection_id_required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user_id and coalesce(p.is_banned, false) = true
  ) then
    raise exception 'garden_account_banned' using errcode = 'P0001';
  end if;

  update public.kaktus_garden_room_members m
  set heartbeat_at = v_now,
      lease_expires_at = v_now + interval '45 seconds'
  where m.user_id = v_user_id
    and m.connection_id = p_connection_id
    and m.lease_expires_at > v_now
  returning m.room_id, m.lease_expires_at
  into v_room_id, v_lease_expires_at;

  if not found then
    raise exception 'garden_lease_expired' using errcode = 'P0001';
  end if;

  update public.kaktus_garden_rooms r
  set last_active_at = v_now
  where r.id = v_room_id;

  lease_expires_at := v_lease_expires_at;
  server_now := v_now;
  return next;
end;
$$;


create or replace function public.garden_leave_room(p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception 'garden_login_required' using errcode = 'P0001';
  end if;

  if p_connection_id is null then
    raise exception 'garden_connection_id_required' using errcode = '22023';
  end if;

  -- Mit Join serialisieren, damit ein gleichzeitig frei werdender A-Slot nicht
  -- versehentlich zur Anlage von Server B fuehrt.
  perform pg_advisory_xact_lock(hashtextextended('kaktus-garden-room-allocation', 0));

  delete from public.kaktus_garden_room_members m
  where m.user_id = v_user_id
    and m.connection_id = p_connection_id
  returning m.room_id into v_room_id;

  if v_room_id is null then
    return false;
  end if;

  update public.kaktus_garden_rooms r
  set last_active_at = clock_timestamp()
  where r.id = v_room_id;

  return true;
end;
$$;


-- ----- 3. Save-v4-Struktur serverseitig absichern --------------------------

create or replace function public.game_saves_validate_kaktus_garden_payload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p jsonb := new.payload;
  v_allowed_crops text[] := array[
    'carrot', 'radish', 'strawberry', 'lettuce', 'beetroot', 'onion',
    'potato', 'cauliflower', 'celery', 'tomato', 'broccoli', 'corn',
    'pumpkin', 'leek', 'wheat', 'bamboo', 'eggplant', 'grape', 'pepper'
  ];
begin
  if new.game_id <> 'kaktus-garden' then
    return new;
  end if;

  if pg_column_size(p) > 1048576 then
    raise exception 'garden_save_too_large' using errcode = '22023';
  end if;

  if jsonb_typeof(p) is distinct from 'object'
    or (p -> 'version') is distinct from '4'::jsonb
    or jsonb_typeof(p -> 'revision') is distinct from 'number'
    or jsonb_typeof(p -> 'coins') is distinct from 'number'
    or jsonb_typeof(p -> 'seeds') is distinct from 'object'
    or jsonb_typeof(p -> 'harvest') is distinct from 'array'
    or jsonb_typeof(p -> 'cells') is distinct from 'array'
    or jsonb_typeof(p -> 'shop') is distinct from 'object'
    or jsonb_typeof(p -> 'shop' -> 'slot') is distinct from 'number'
    or jsonb_typeof(p -> 'shop' -> 'stock') is distinct from 'object'
    or jsonb_typeof(p -> 'selectedSlot') is distinct from 'number'
    or jsonb_typeof(p -> 'lastSavedAt') is distinct from 'number'
  then
    raise exception 'garden_save_invalid_v4' using errcode = '22023';
  end if;

  -- Separat nach dem Typcheck: PostgreSQL darf boolesche Teilausdruecke
  -- umordnen; jsonb_array_length() auf einem Nicht-Array darf nie laufen.
  if jsonb_array_length(p -> 'cells') <> 64 then
    raise exception 'garden_save_invalid_v4' using errcode = '22023';
  end if;

  if (p ->> 'revision')::numeric < 0
    or (p ->> 'coins')::numeric < 0
    or (p ->> 'selectedSlot')::numeric < 0
    or (p ->> 'selectedSlot')::numeric > 8
    or (p ->> 'lastSavedAt')::numeric < 0
    or (p -> 'shop' ->> 'slot')::numeric < 0
    or (p -> 'shop' ->> 'slot')::numeric
      > floor(extract(epoch from clock_timestamp()) / 300)
    or (p ->> 'revision')::numeric > 9007199254740990
    or (p ->> 'revision')::numeric <> trunc((p ->> 'revision')::numeric)
    or (p ->> 'coins')::numeric <> trunc((p ->> 'coins')::numeric)
    or (p ->> 'selectedSlot')::numeric <> trunc((p ->> 'selectedSlot')::numeric)
    or (p ->> 'lastSavedAt')::numeric <> trunc((p ->> 'lastSavedAt')::numeric)
    or (p -> 'shop' ->> 'slot')::numeric <> trunc((p -> 'shop' ->> 'slot')::numeric)
  then
    raise exception 'garden_save_invalid_numbers' using errcode = '22023';
  end if;

  -- Ein alter v2/v3-Testsave darf bewusst einmal durch v4 ersetzt werden.
  -- Sobald aber ein gueltiger v4-Stand existiert, kann kein spaeter eintreffender
  -- Request eine aeltere Revision darueber schreiben. Identische Retries sind
  -- erlaubt; eine veraenderte Payload braucht zwingend eine hoehere Revision.
  if tg_op = 'UPDATE'
    and old.game_id = 'kaktus-garden'
    and (old.payload -> 'version') = '4'::jsonb
    and jsonb_typeof(old.payload -> 'revision') = 'number'
    and (old.payload ->> 'revision')::numeric >= 0
    and (old.payload ->> 'revision')::numeric < 9007199254740990
    and (old.payload ->> 'revision')::numeric = trunc((old.payload ->> 'revision')::numeric)
  then
    if (p ->> 'revision')::numeric < (old.payload ->> 'revision')::numeric then
      raise exception 'garden_save_stale_revision' using errcode = '40001';
    end if;

    if (p ->> 'revision')::numeric = (old.payload ->> 'revision')::numeric
      and p is distinct from old.payload
    then
      raise exception 'garden_save_revision_conflict' using errcode = '40001';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_each(p -> 'seeds') as seed(crop_id, amount)
    where not (seed.crop_id = any(v_allowed_crops))
      or jsonb_typeof(seed.amount) is distinct from 'number'
      or case
        when jsonb_typeof(seed.amount) = 'number'
          then seed.amount::text::numeric <= 0
            or seed.amount::text::numeric <> trunc(seed.amount::text::numeric)
        else false
      end
  ) then
    raise exception 'garden_save_invalid_seeds' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p -> 'harvest') as harvested(item)
    where jsonb_typeof(harvested.item) is distinct from 'object'
      or jsonb_typeof(harvested.item -> 'cropId') is distinct from 'string'
      or not ((harvested.item ->> 'cropId') = any(v_allowed_crops))
      or jsonb_typeof(harvested.item -> 'weight') is distinct from 'number'
      or case
        when jsonb_typeof(harvested.item -> 'weight') = 'number'
          then (harvested.item ->> 'weight')::numeric <= 0
        else false
      end
  ) then
    raise exception 'garden_save_invalid_harvest' using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_each(p -> 'seeds') as seed(crop_id, amount)
  ) + (
    select count(distinct harvested.item ->> 'cropId')
    from jsonb_array_elements(p -> 'harvest') as harvested(item)
  ) > 9 then
    raise exception 'garden_save_inventory_full' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p -> 'cells') as cell(item)
    where cell.item <> 'null'::jsonb
      and (
        jsonb_typeof(cell.item) is distinct from 'object'
        or jsonb_typeof(cell.item -> 'cropId') is distinct from 'string'
        or not ((cell.item ->> 'cropId') = any(v_allowed_crops))
        or jsonb_typeof(cell.item -> 'plantedAt') is distinct from 'number'
        or jsonb_typeof(cell.item -> 'readyAt') is distinct from 'number'
        or jsonb_typeof(cell.item -> 'harvested') is distinct from 'number'
        or case
          when jsonb_typeof(cell.item -> 'plantedAt') = 'number'
            and jsonb_typeof(cell.item -> 'readyAt') = 'number'
            and jsonb_typeof(cell.item -> 'harvested') = 'number'
          then (cell.item ->> 'plantedAt')::numeric < 0
            or (cell.item ->> 'readyAt')::numeric < 0
            or (cell.item ->> 'harvested')::numeric < 0
            or (cell.item ->> 'harvested')::numeric <> trunc((cell.item ->> 'harvested')::numeric)
          else false
        end
      )
  ) then
    raise exception 'garden_save_invalid_cells' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p -> 'shop' -> 'stock') as stock(crop_id, amount)
    where not (stock.crop_id = any(v_allowed_crops))
      or jsonb_typeof(stock.amount) is distinct from 'number'
      or case
        when jsonb_typeof(stock.amount) = 'number'
          then stock.amount::text::numeric < 0
            or stock.amount::text::numeric <> trunc(stock.amount::text::numeric)
        else false
      end
  ) then
    raise exception 'garden_save_invalid_shop' using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_object_keys(p -> 'shop' -> 'stock') as stock_key(crop_id)
  ) <> cardinality(v_allowed_crops)
    or exists (
      select 1
      from unnest(v_allowed_crops) as allowed(crop_id)
      where not (p -> 'shop' -> 'stock') ? allowed.crop_id
    )
  then
    raise exception 'garden_save_invalid_shop' using errcode = '22023';
  end if;

  -- updated_at kommt fuer Garden immer von der DB, nicht von der Client-Uhr.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists game_saves_validate_kaktus_garden_payload_trigger
  on public.game_saves;
create trigger game_saves_validate_kaktus_garden_payload_trigger
  before insert or update on public.game_saves
  for each row
  when (new.game_id = 'kaktus-garden')
  execute function public.game_saves_validate_kaktus_garden_payload();


-- ----- 4. Sichere aktive Farmansicht (nur eigener aktueller Raum) ----------

drop view if exists public.kaktus_garden_farms cascade;
create view public.kaktus_garden_farms
  with (security_invoker = false, security_barrier = true)
as
  select
    member.room_id,
    room.room_ordinal,
    room.invite_code,
    member.slot_index,
    member.user_id,
    coalesce(nullif(btrim(profile.username), ''), nullif(save.display_name, ''), 'Spieler')
      as display_name,
    profile.avatar_url,
    greatest(
      0,
      least(9999, floor(sqrt(coalesce(profile.total_xp, 0)::numeric / 8))::int)
    ) as level,
    member.heartbeat_at as last_seen,
    save.updated_at,
    case
      when save.payload @> '{"version": 4}'::jsonb
        and case
          when jsonb_typeof(save.payload -> 'cells') = 'array'
            then jsonb_array_length(save.payload -> 'cells') = 64
          else false
        end
      then save.payload -> 'cells'
      else (
        select jsonb_agg('null'::jsonb order by empty_cell.cell_index)
        from generate_series(0, 63) as empty_cell(cell_index)
      )
    end as cells,
    jsonb_build_object(
      'version', 4,
      'playerId', member.user_id::text,
      'gridSize', jsonb_build_object('columns', 8, 'rows', 8),
      'cells',
        case
          when save.payload @> '{"version": 4}'::jsonb
            and case
              when jsonb_typeof(save.payload -> 'cells') = 'array'
                then jsonb_array_length(save.payload -> 'cells') = 64
              else false
            end
          then save.payload -> 'cells'
          else (
            select jsonb_agg('null'::jsonb order by empty_cell.cell_index)
            from generate_series(0, 63) as empty_cell(cell_index)
          )
        end,
      'capturedAt',
        case
          when save.updated_at is null then null
          else (extract(epoch from save.updated_at) * 1000)::bigint
        end
    ) as farm_snapshot
  from public.kaktus_garden_room_members member
  join public.kaktus_garden_rooms room on room.id = member.room_id
  join public.kaktus_garden_room_members viewer
    on viewer.user_id = auth.uid()
   and viewer.room_id = member.room_id
   and viewer.lease_expires_at > clock_timestamp()
  left join public.profiles profile on profile.id = member.user_id
  left join public.game_saves save
    on save.user_id = member.user_id
   and save.game_id = 'kaktus-garden'
  where member.lease_expires_at > clock_timestamp()
    and coalesce(profile.is_banned, false) = false;

revoke all on table public.kaktus_garden_farms
  from public, anon, authenticated;
grant select on table public.kaktus_garden_farms to authenticated;

comment on view public.kaktus_garden_farms is
  'KaktusGarden-v4-Farmen (64 cells) ausschliesslich fuer aktive Mitglieder '
  'des eigenen Raums. Keine Coins, Samen, Ernte oder Shopdaten.';


create or replace function public.garden_room_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_membership public.kaktus_garden_room_members%rowtype;
  v_room public.kaktus_garden_rooms%rowtype;
  v_members jsonb;
  v_empty_cells jsonb;
begin
  if v_user_id is null then
    raise exception 'garden_login_required' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user_id and coalesce(p.is_banned, false) = true
  ) then
    raise exception 'garden_account_banned' using errcode = 'P0001';
  end if;

  select m.*
  into v_membership
  from public.kaktus_garden_room_members m
  where m.user_id = v_user_id
    and m.lease_expires_at > v_now;

  if not found then
    raise exception 'garden_lease_expired' using errcode = 'P0001';
  end if;

  select r.*
  into strict v_room
  from public.kaktus_garden_rooms r
  where r.id = v_membership.room_id;

  select jsonb_agg('null'::jsonb order by empty_cell.cell_index)
  into v_empty_cells
  from generate_series(0, 63) as empty_cell(cell_index);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', member.user_id::text,
        'connectionId', member.connection_id::text,
        'slotIndex', member.slot_index,
        'displayName', coalesce(
          nullif(btrim(profile.username), ''),
          nullif(save.display_name, ''),
          'Spieler'
        ),
        'level', greatest(
          0,
          least(9999, floor(sqrt(coalesce(profile.total_xp, 0)::numeric / 8))::int)
        ),
        'avatarUrl', profile.avatar_url,
        'cells',
          case
            when save.payload @> '{"version": 4}'::jsonb
              and case
                when jsonb_typeof(save.payload -> 'cells') = 'array'
                  then jsonb_array_length(save.payload -> 'cells') = 64
                else false
              end
            then save.payload -> 'cells'
            else v_empty_cells
          end,
        'updatedAt',
          case
            when save.updated_at is null then null
            else (extract(epoch from save.updated_at) * 1000)::bigint
          end
      ) order by member.slot_index
    ),
    '[]'::jsonb
  )
  into v_members
  from public.kaktus_garden_room_members member
  left join public.profiles profile on profile.id = member.user_id
  left join public.game_saves save
    on save.user_id = member.user_id
   and save.game_id = 'kaktus-garden'
  where member.room_id = v_room.id
    and member.lease_expires_at > v_now
    and coalesce(profile.is_banned, false) = false;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id::text,
      'ordinal', v_room.room_ordinal,
      'inviteCode', v_room.invite_code
    ),
    'members', v_members,
    'capturedAt', (extract(epoch from v_now) * 1000)::bigint
  );
end;
$$;


-- ----- 5. Farm-Aenderungen sicher in den Raum broadcasten -----------------

create or replace function public.garden_broadcast_farm_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.kaktus_garden_room_members%rowtype;
begin
  if new.game_id <> 'kaktus-garden' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and (new.payload -> 'cells') is not distinct from (old.payload -> 'cells')
  then
    return new;
  end if;

  select member.*
  into v_member
  from public.kaktus_garden_room_members member
  left join public.profiles profile on profile.id = member.user_id
  where member.user_id = new.user_id
    and member.lease_expires_at > clock_timestamp()
    and coalesce(profile.is_banned, false) = false;

  if not found then
    return new;
  end if;

  -- Realtime-Probleme duerfen einen bereits validierten Cloud-Save niemals
  -- zurueckrollen. Ein spaeterer room_snapshot stellt den Zustand wieder her.
  begin
    perform realtime.send(
      jsonb_build_object(
        'userId', new.user_id::text,
        'slotIndex', v_member.slot_index,
        'cells', new.payload -> 'cells',
        'updatedAt', (extract(epoch from new.updated_at) * 1000)::bigint
      ),
      'farm-changed',
      'garden:room:' || v_member.room_id::text,
      true
    );
  exception when others then
    raise warning 'garden_broadcast_farm_update failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists garden_broadcast_farm_update_trigger
  on public.game_saves;
create trigger garden_broadcast_farm_update_trigger
  after insert or update on public.game_saves
  for each row
  when (new.game_id = 'kaktus-garden')
  execute function public.garden_broadcast_farm_update();


-- ----- 6. Ban entfernt eine aktive Garden-Mitgliedschaft ------------------

create or replace function public.garden_remove_banned_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_banned = true and old.is_banned is distinct from true then
    perform pg_advisory_xact_lock(hashtextextended('kaktus-garden-room-allocation', 0));
    delete from public.kaktus_garden_room_members m
    where m.user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists garden_remove_banned_membership_trigger
  on public.profiles;
create trigger garden_remove_banned_membership_trigger
  after update of is_banned on public.profiles
  for each row
  execute function public.garden_remove_banned_membership();


-- ----- 7. Private Presence-/Broadcast-Autorisierung ------------------------

-- Supabase verwaltet realtime.messages. In einer lokalen Postgres-Instanz
-- ohne Realtime-Schema bleibt die Migration trotzdem ausfuehrbar; im echten
-- Supabase-Projekt werden beide Policies angelegt.
do $migration$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists garden_room_realtime_read on realtime.messages';
    execute 'drop policy if exists garden_room_realtime_write on realtime.messages';

    execute $policy$
      create policy garden_room_realtime_read
      on realtime.messages
      for select
      to authenticated
      using (
        realtime.messages.extension in ('broadcast', 'presence')
        and exists (
          select 1
          from public.kaktus_garden_room_members member
          where member.user_id = (select auth.uid())
            and member.lease_expires_at > clock_timestamp()
            and not exists (
              select 1
              from public.profiles profile
              where profile.id = member.user_id
                and coalesce(profile.is_banned, false) = true
            )
            and (select realtime.topic()) = 'garden:room:' || member.room_id::text
        )
      )
    $policy$;

    execute $policy$
      create policy garden_room_realtime_write
      on realtime.messages
      for insert
      to authenticated
      with check (
        realtime.messages.extension in ('broadcast', 'presence')
        and exists (
          select 1
          from public.kaktus_garden_room_members member
          where member.user_id = (select auth.uid())
            and member.lease_expires_at > clock_timestamp()
            and not exists (
              select 1
              from public.profiles profile
              where profile.id = member.user_id
                and coalesce(profile.is_banned, false) = true
            )
            and (select realtime.topic()) = 'garden:room:' || member.room_id::text
        )
      )
    $policy$;
  else
    raise notice 'realtime.messages fehlt; Garden-Realtime-Policies uebersprungen';
  end if;
end;
$migration$;


-- ----- 8. RPC-Rechte: ausschliesslich eingeloggte Spieler ------------------

revoke execute on function public.garden_join_room(uuid, text)
  from public, anon;
revoke execute on function public.garden_room_heartbeat(uuid)
  from public, anon;
revoke execute on function public.garden_leave_room(uuid)
  from public, anon;
revoke execute on function public.garden_room_snapshot()
  from public, anon;

grant execute on function public.garden_join_room(uuid, text) to authenticated;
grant execute on function public.garden_room_heartbeat(uuid) to authenticated;
grant execute on function public.garden_leave_room(uuid) to authenticated;
grant execute on function public.garden_room_snapshot() to authenticated;

-- Triggerfunktionen sind niemals direkte Client-RPCs.
revoke execute on function public.game_saves_validate_kaktus_garden_payload()
  from public, anon, authenticated;
revoke execute on function public.garden_broadcast_farm_update()
  from public, anon, authenticated;
revoke execute on function public.garden_remove_banned_membership()
  from public, anon, authenticated;

comment on function public.garden_join_room(uuid, text) is
  'Race-sicheres KaktusGarden-Matchmaking. Ohne Code A-first; mit vollem Code garden_room_full.';
comment on function public.garden_room_heartbeat(uuid) is
  'Alle ca. 15 Sekunden aufrufen; verlaengert die technische Slot-Lease auf 45 Sekunden.';
comment on function public.garden_leave_room(uuid) is
  'Gibt den eigenen Slot sofort frei; falsche connection_id kann keine andere Session trennen.';
comment on function public.garden_room_snapshot() is
  'Sicherer Snapshot des eigenen aktiven Raums; exponiert je Mitglied nur Profilanzeige und 64 cells.';
