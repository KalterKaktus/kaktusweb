-- KaktusGarden: Die neueste Browser-Session eines Accounts uebernimmt den
-- aktiven Slot. Ein bereits verbundener Account darf dadurch einem Invite-Link
-- folgen; die alte Session verliert beim naechsten Heartbeat ihre Lease.

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
  v_current_room public.kaktus_garden_rooms%rowtype;
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

  perform pg_advisory_xact_lock(hashtextextended('kaktus-garden-room-allocation', 0));

  delete from public.kaktus_garden_room_members m
  where m.lease_expires_at <= v_now;

  select m.*
  into v_member
  from public.kaktus_garden_room_members m
  where m.user_id = v_user_id;

  if v_member.user_id is not null then
    select r.*
    into strict v_current_room
    from public.kaktus_garden_rooms r
    where r.id = v_member.room_id;

    -- Exakt dieselbe Session darf ihren Slot bei Reload/Reconnect behalten,
    -- solange kein anderer Invite-Code angefordert wurde.
    if v_member.connection_id = p_connection_id
      and (v_invite_code is null or v_current_room.invite_code = v_invite_code)
    then
      update public.kaktus_garden_room_members m
      set heartbeat_at = v_now,
          lease_expires_at = v_now + interval '45 seconds'
      where m.user_id = v_user_id
        and m.connection_id = p_connection_id
      returning m.* into v_member;

      v_room := v_current_room;
    else
      -- Neue Session oder bewusst anderer Invite: alter Slot wird innerhalb
      -- derselben Transaktion freigegeben. Scheitert der Ziel-Join, rollt
      -- PostgreSQL das Delete automatisch zurueck.
      delete from public.kaktus_garden_room_members m
      where m.user_id = v_user_id;
      v_member.user_id := null;
    end if;
  end if;

  if v_member.user_id is null then
    if v_invite_code is not null then
      select r.*
      into v_room
      from public.kaktus_garden_rooms r
      where r.invite_code = v_invite_code
        and r.status = 'open';

      if not found then
        raise exception 'garden_room_not_found' using errcode = 'P0001';
      end if;
    else
      -- Ohne Invite weiterhin A-first: aeltester freier Raum vor neuem Raum.
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

revoke execute on function public.garden_join_room(uuid, text)
  from public, anon;
grant execute on function public.garden_join_room(uuid, text)
  to authenticated;

comment on function public.garden_join_room(uuid, text) is
  'A-first KaktusGarden-Matchmaking; die neueste Account-Session uebernimmt und kann einem Invite folgen.';


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
    if exists (
      select 1
      from public.kaktus_garden_room_members m
      where m.user_id = v_user_id
        and m.connection_id <> p_connection_id
        and m.lease_expires_at > v_now
    ) then
      raise exception 'garden_session_replaced' using errcode = 'P0001';
    end if;
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

revoke execute on function public.garden_room_heartbeat(uuid)
  from public, anon;
grant execute on function public.garden_room_heartbeat(uuid)
  to authenticated;

comment on function public.garden_room_heartbeat(uuid) is
  'Verlaengert die Garden-Lease oder meldet garden_session_replaced an eine uebernommene alte Session.';
