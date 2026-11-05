-- PREPARED ONLY. Apply manually after reviewing; this file is not applied by deploys.
-- All identity and game transitions come from the authenticated Netlify function.
begin;

create table if not exists public.kaktuslife_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 guest_id uuid references auth.users(id) on delete cascade,
 guest_ready boolean not null default false,
 revision bigint not null default 0 check (revision >= 0),
 state jsonb,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp() + interval '30 days',
 closed_at timestamptz,
 check (guest_id is null or guest_id <> host_id),
 check (not guest_ready or guest_id is not null),
 check (state is null or (jsonb_typeof(state) = 'object' and state->>'status' in ('playing','finished')))
);
alter table public.kaktuslife_rooms add column if not exists closed_at timestamptz;
create index if not exists kaktuslife_rooms_host on public.kaktuslife_rooms(host_id, created_at desc);
create index if not exists kaktuslife_rooms_guest on public.kaktuslife_rooms(guest_id);

create table if not exists public.kaktuslife_requests (
 actor_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 room_id uuid not null references public.kaktuslife_rooms(id) on delete cascade,
 intent jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id, request_id)
);
create index if not exists kaktuslife_requests_rate on public.kaktuslife_requests(actor_id, created_at desc);

alter table public.kaktuslife_rooms enable row level security;
alter table public.kaktuslife_requests enable row level security;
-- No policies: anon/authenticated have no table or RPC access, including reads.
revoke all on public.kaktuslife_rooms, public.kaktuslife_requests from public, anon, authenticated, service_role;

create or replace function public.kaktuslife_require_actor(p_actor uuid, p_lock boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare banned boolean;
begin
 if p_actor is null then raise exception 'life.errors.auth'; end if;
 -- Profile lock serializes writes/receipts for an actor, including cross-room UUID reuse.
 if p_lock then select is_banned into banned from public.profiles where id=p_actor for update;
 else select is_banned into banned from public.profiles where id=p_actor; end if;
 if not found then raise exception 'life.errors.auth'; end if;
 if banned then raise exception 'life.errors.banned'; end if;
end $$;

create or replace function public.kaktuslife_public_room(p_room public.kaktuslife_rooms) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p_room.id,'code',p_room.code,'hostId',p_room.host_id,'guestId',p_room.guest_id,
  'hostName',coalesce(nullif(left(regexp_replace(h.username,'[[:cntrl:]]','','g'),40),''),'Kaktus'),
  'guestName',case when p_room.guest_id is null then null else coalesce(nullif(left(regexp_replace(g.username,'[[:cntrl:]]','','g'),40),''),'Kaktus') end,
  'guestReady',p_room.guest_ready,'revision',p_room.revision,'state',p_room.state,'closed',p_room.closed_at is not null)
 from public.profiles h left join public.profiles g on g.id=p_room.guest_id where h.id=p_room.host_id
$$;

create or replace function public.kaktuslife_snapshot(p_actor uuid,p_room_id uuid,p_request_id uuid default null,p_intent jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.kaktuslife_rooms; receipt public.kaktuslife_requests; replay boolean := false;
begin
 perform public.kaktuslife_require_actor(p_actor);
 if p_request_id is not null then
  select * into receipt from public.kaktuslife_requests where actor_id=p_actor and request_id=p_request_id;
  if found then
   if receipt.intent is distinct from p_intent or receipt.room_id is distinct from p_room_id then raise exception 'life.errors.requestConflict'; end if;
   replay := true;
  end if;
 end if;
 -- Only the exact successful close receipt may replay after closing has expired the lobby.
 select * into r from public.kaktuslife_rooms where id=p_room_id and (expires_at>clock_timestamp()
  or (replay and p_intent->>'op'='close' and closed_at is not null));
 if not found then raise exception 'life.errors.notFound'; end if;
 if p_actor is distinct from r.host_id and p_actor is distinct from r.guest_id then raise exception 'life.errors.forbidden'; end if;
 return jsonb_build_object('room',public.kaktuslife_public_room(r),'replayed',replay);
end $$;

create or replace function public.kaktuslife_lobby(p_actor uuid,p_operation text,p_request_id uuid,p_intent jsonb,
 p_room_id uuid default null,p_code text default null,p_revision bigint default null,p_ready boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.kaktuslife_rooms; receipt public.kaktuslife_requests;
begin
 perform public.kaktuslife_require_actor(p_actor,true);
 if p_request_id is null or p_intent is null then raise exception 'life.errors.invalidRequest'; end if;
 select * into receipt from public.kaktuslife_requests where actor_id=p_actor and request_id=p_request_id;
 if found then
  if receipt.intent is distinct from p_intent then raise exception 'life.errors.requestConflict'; end if;
  return public.kaktuslife_snapshot(p_actor,receipt.room_id,p_request_id,p_intent);
 end if;
 if (select count(*) from public.kaktuslife_requests where actor_id=p_actor and created_at>clock_timestamp()-interval '1 minute') >= 60 then raise exception 'life.errors.rateLimit'; end if;
 if p_operation='create' then
  if p_intent is distinct from jsonb_build_object('op','create') or p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{10}$' then raise exception 'life.errors.invalidRequest'; end if;
  if (select count(*) from public.kaktuslife_rooms where host_id=p_actor and expires_at>clock_timestamp() and (state is null or state->>'status'='playing')) >= 3
   or (select count(*) from public.kaktuslife_rooms where host_id=p_actor and created_at>clock_timestamp()-interval '1 hour') >= 10 then raise exception 'life.errors.rateLimit'; end if;
  insert into public.kaktuslife_rooms(code,host_id) values(p_code,p_actor) returning * into r;
 elsif p_operation='join' then
  if p_intent is distinct from jsonb_build_object('op','join','code',p_code) then raise exception 'life.errors.invalidRequest'; end if;
  select * into r from public.kaktuslife_rooms where code=p_code and expires_at>clock_timestamp() for update;
  if not found then raise exception 'life.errors.notFound'; end if;
  if p_actor is distinct from r.host_id and p_actor is distinct from r.guest_id then
   if r.guest_id is not null then raise exception 'life.errors.full'; end if;
   if r.state is not null then raise exception 'life.errors.alreadyStarted'; end if;
   if (select count(*) from public.kaktuslife_rooms where guest_id=p_actor and expires_at>clock_timestamp() and (state is null or state->>'status'='playing')) >= 5 then raise exception 'life.errors.rateLimit'; end if;
   update public.kaktuslife_rooms set guest_id=p_actor,guest_ready=false,revision=revision+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  end if;
 elsif p_operation in ('ready','rematch','close') then
  select * into r from public.kaktuslife_rooms where id=p_room_id and expires_at>clock_timestamp() for update;
  if not found then raise exception 'life.errors.notFound'; end if;
  if p_actor is distinct from r.host_id and p_actor is distinct from r.guest_id then raise exception 'life.errors.forbidden'; end if;
  if p_revision is distinct from r.revision then raise exception 'life.errors.conflict'; end if;
  if p_operation='ready' then
   if p_intent is distinct from jsonb_build_object('op','action','roomId',p_room_id,'action',jsonb_build_object('type','ready','ready',p_ready)) then raise exception 'life.errors.invalidRequest'; end if;
   if p_actor is distinct from r.guest_id then raise exception 'life.errors.forbidden'; end if;
   if r.state is not null then raise exception 'life.errors.alreadyStarted'; end if;
   update public.kaktuslife_rooms set guest_ready=p_ready,revision=revision+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  elsif p_operation='close' then
   if p_intent is distinct from jsonb_build_object('op','close','roomId',p_room_id) then raise exception 'life.errors.invalidRequest'; end if;
   if p_actor is distinct from r.host_id then raise exception 'life.errors.forbidden'; end if;
   if r.state is not null then raise exception 'life.errors.alreadyStarted'; end if;
   update public.kaktuslife_rooms set closed_at=clock_timestamp(),expires_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  else
   if p_intent is distinct from jsonb_build_object('op','rematch','roomId',p_room_id) then raise exception 'life.errors.invalidRequest'; end if;
   if r.state->>'status' is distinct from 'finished' then raise exception 'life.errors.notFinished'; end if;
   update public.kaktuslife_rooms set state=null,guest_ready=false,revision=revision+1,updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days' where id=r.id returning * into r;
  end if;
 else raise exception 'life.errors.invalidRequest'; end if;
 insert into public.kaktuslife_requests(actor_id,request_id,room_id,intent) values(p_actor,p_request_id,r.id,p_intent);
 return jsonb_build_object('room',public.kaktuslife_public_room(r),'replayed',false);
end $$;

create or replace function public.kaktuslife_commit(p_actor uuid,p_room_id uuid,p_request_id uuid,p_intent jsonb,p_revision bigint,p_state jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.kaktuslife_rooms; receipt public.kaktuslife_requests; kind text;
begin
 perform public.kaktuslife_require_actor(p_actor,true);
 if p_request_id is null or p_intent is null then raise exception 'life.errors.invalidRequest'; end if;
 -- Receipt is checked BEFORE revision. A lost response can safely retry even after later turns.
 select * into receipt from public.kaktuslife_requests where actor_id=p_actor and request_id=p_request_id;
 if found then
  if receipt.intent is distinct from p_intent or receipt.room_id is distinct from p_room_id then raise exception 'life.errors.requestConflict'; end if;
  return public.kaktuslife_snapshot(p_actor,p_room_id,p_request_id,p_intent);
 end if;
 select * into r from public.kaktuslife_rooms where id=p_room_id and expires_at>clock_timestamp() for update;
 if not found then raise exception 'life.errors.notFound'; end if;
 if p_actor is distinct from r.host_id and p_actor is distinct from r.guest_id then raise exception 'life.errors.forbidden'; end if;
 if p_revision is distinct from r.revision then raise exception 'life.errors.conflict'; end if;
 if (select count(*) from public.kaktuslife_requests where actor_id=p_actor and created_at>clock_timestamp()-interval '1 minute') >= 60 then raise exception 'life.errors.rateLimit'; end if;
 kind := p_intent->'action'->>'type';
 if p_intent->>'op' is distinct from 'action' or p_intent->>'roomId' is distinct from p_room_id::text or kind is null then raise exception 'life.errors.invalidRequest'; end if;
 if kind='start' then
  if p_actor is distinct from r.host_id then raise exception 'life.errors.forbidden'; end if;
  if r.state is not null then raise exception 'life.errors.alreadyStarted'; end if;
  if r.guest_id is null or not r.guest_ready then raise exception 'life.errors.notReady'; end if;
 elsif kind in ('roll','choose','end') then
  if r.state->>'status' is distinct from 'playing' then raise exception 'life.errors.invalidAction'; end if;
  if r.state->'players'->((r.state->>'turn')::integer)->>'id' is distinct from p_actor::text then raise exception 'life.errors.forbidden'; end if;
 else raise exception 'life.errors.invalidAction'; end if;
 -- Defense in depth: only server-generated states for these exact seats can be committed.
 if (jsonb_typeof(p_state)='object' and pg_column_size(p_state)<131072 and p_state->>'version'='1'
  and p_state->>'status' in ('playing','finished') and jsonb_array_length(p_state->'players')=2
  and p_state->'players'->0->>'id'=r.host_id::text and p_state->'players'->1->>'id'=r.guest_id::text) is distinct from true
 then raise exception 'life.errors.invalidAction'; end if;
 update public.kaktuslife_rooms set state=p_state,revision=revision+1,updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days' where id=r.id returning * into r;
 insert into public.kaktuslife_requests(actor_id,request_id,room_id,intent) values(p_actor,p_request_id,r.id,p_intent);
 return jsonb_build_object('room',public.kaktuslife_public_room(r),'replayed',false);
end $$;

revoke all on function public.kaktuslife_require_actor(uuid,boolean),public.kaktuslife_public_room(public.kaktuslife_rooms),
 public.kaktuslife_snapshot(uuid,uuid,uuid,jsonb),public.kaktuslife_lobby(uuid,text,uuid,jsonb,uuid,text,bigint,boolean),
 public.kaktuslife_commit(uuid,uuid,uuid,jsonb,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.kaktuslife_snapshot(uuid,uuid,uuid,jsonb),public.kaktuslife_lobby(uuid,text,uuid,jsonb,uuid,text,bigint,boolean),
 public.kaktuslife_commit(uuid,uuid,uuid,jsonb,bigint,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
