-- Apply manually AFTER 20261010020000_lucky_lounge_hourly_bonus.sql.
-- Shared flights; no resets, no changes to existing bets or settled payouts.
begin;
create table if not exists public.casino_crash_flights (
 id uuid primary key default gen_random_uuid(),
 starts_at timestamptz not null,
 point numeric(6,2) not null check(point between 1 and 1000),
 ends_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.casino_crash_lobby (
 singleton boolean primary key default true check(singleton),
 flight_id uuid not null references public.casino_crash_flights(id)
);
create table if not exists public.casino_crash_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default clock_timestamp()
);
alter table public.casino_crash_flights enable row level security;
alter table public.casino_crash_lobby enable row level security;
alter table public.casino_crash_presence enable row level security;
revoke all on public.casino_crash_flights,public.casino_crash_lobby,public.casino_crash_presence from public,anon,authenticated;
create index if not exists casino_crash_shared_bets on public.casino_rounds((params->>'shared_id'),user_id) where game='crash';
create unique index if not exists casino_crash_one_shared_bet on public.casino_rounds(user_id,(params->>'shared_id')) where game='crash' and params ? 'shared_id' and status<>'cancelled';

-- Always lock wallets before their private bets, matching existing wallet RPCs.
-- This helper is private and must be called under the shared lobby advisory lock.
create or replace function public.casino_crash_advance() returns public.casino_crash_flights
language plpgsql security definer set search_path='' as $$
declare f public.casino_crash_flights; next_start timestamptz; v_point numeric; r record;
begin
 select flights.* into f from public.casino_crash_lobby l join public.casino_crash_flights flights on flights.id=l.flight_id;
 if found then
  perform 1 from public.casino_wallets w where exists(select 1 from public.casino_rounds b where b.user_id=w.user_id and b.game='crash' and b.status='active' and b.params->>'shared_id'=f.id::text and (clock_timestamp()>=f.ends_at or ((b.params->>'auto')::numeric<=f.point and clock_timestamp()>=f.starts_at+(ln((b.params->>'auto')::double precision)/0.1)*interval '1 second'))) order by w.user_id for update;
  for r in select user_id from public.casino_rounds where game='crash' and status='active' and params->>'shared_id'=f.id::text and (clock_timestamp()>=f.ends_at or ((params->>'auto')::numeric<=f.point and clock_timestamp()>=f.starts_at+(ln((params->>'auto')::double precision)/0.1)*interval '1 second')) order by user_id loop
   perform public.casino_sweep_crash(r.user_id);
  end loop;
  if clock_timestamp()<f.ends_at then return f; end if;
  next_start:=f.ends_at+interval '10 seconds';
  -- No synthetic history or idle catch-up loops. After a long empty lobby,
  -- resume with a full betting window; existing bets were settled above.
  if next_start<=clock_timestamp() then next_start:=clock_timestamp()+interval '10 seconds'; end if;
 else next_start:=clock_timestamp()+interval '10 seconds';
 end if;
 v_point:=greatest(1,least(1000,floor(0.99/(1-public.casino_random(1000000000)::numeric/1000000000)*100)/100));
 insert into public.casino_crash_flights(starts_at,point,ends_at)
 values(next_start,v_point,next_start+(ln(v_point::double precision)/0.1)*interval '1 second') returning * into f;
 insert into public.casino_crash_lobby(singleton,flight_id) values(true,f.id) on conflict(singleton) do update set flight_id=excluded.flight_id;
 return f;
end $$;

-- A personal cashout must NEVER reveal the shared flight's future crash point.
create or replace function public.casino_public_round(p_uid uuid,p_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select (to_jsonb(r)-'user_id'-'secret')||case
  when r.status<>'active' and r.game='mines' then jsonb_build_object('mines',r.secret->'mines')
  when r.status<>'active' and r.game='crash' and
   (not(r.params ? 'shared_id') or exists(select 1 from public.casino_crash_flights f where f.id::text=r.params->>'shared_id' and clock_timestamp()>=f.ends_at))
   then jsonb_build_object('crash_point',r.secret->'point')
  else '{}'::jsonb end from public.casino_rounds r where r.user_id=p_uid and r.id=p_id;
$$;
create or replace function public.casino_crash_public(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'version',1,
 'flight',jsonb_build_object('id',f.id,'starts_at',f.starts_at,'phase',case when clock_timestamp()<f.starts_at then 'waiting' when clock_timestamp()>=f.ends_at then 'crashed' else 'running' end)
  ||case when clock_timestamp()>=f.ends_at then jsonb_build_object('point',f.point) else '{}'::jsonb end,
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'point',h.point,'ended_at',h.ends_at) order by h.ends_at) from(select * from public.casino_crash_flights where ends_at<=clock_timestamp() order by ends_at desc limit 20) h),'[]'::jsonb),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'name',p.username,'stake',r.stake,'status',r.status,'cashout',r.state->'cashout','payout',r.payout) order by r.created_at) from(select * from public.casino_rounds where game='crash' and params->>'shared_id'=f.id::text and status<>'cancelled' order by created_at limit 100) r join public.profiles p on p.id=r.user_id and not p.is_banned),'[]'::jsonb),
 'player_count',(select count(*) from public.casino_rounds r join public.profiles p on p.id=r.user_id and not p.is_banned where r.game='crash' and r.params->>'shared_id'=f.id::text and r.status<>'cancelled'),
 'total_staked',(select coalesce(sum(r.stake),0) from public.casino_rounds r join public.profiles p on p.id=r.user_id and not p.is_banned where r.game='crash' and r.params->>'shared_id'=f.id::text and r.status<>'cancelled'),
 'online_count',(select count(*) from public.casino_crash_presence s join public.profiles p on p.id=s.user_id and not p.is_banned where s.last_seen_at>clock_timestamp()-interval '15 seconds'),
 'cashouts',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'name',p.username,'stake',r.stake,'payout',r.payout,'cashout',r.state->'cashout','at',(r.state->>'starts_at')::timestamptz+(ln(nullif((r.state->>'cashout')::double precision,0))/0.1)*interval '1 second') order by r.created_at) from(select * from public.casino_rounds where game='crash' and params ? 'shared_id' and status='won' and created_at>clock_timestamp()-interval '100 seconds' and (state->>'starts_at')::timestamptz+(ln(nullif((state->>'cashout')::double precision,0))/0.1)*interval '1 second'>clock_timestamp()-interval '10 seconds' order by created_at desc limit 10) r join public.profiles p on p.id=r.user_id and not p.is_banned),'[]'::jsonb),
 'own_round',(select public.casino_public_round(p_uid,r.id) from public.casino_rounds r where r.user_id=p_uid and r.game='crash' and (r.params->>'shared_id'=f.id::text or (r.status='active' and not(r.params ? 'shared_id'))) order by r.created_at desc limit 1)
 ) from public.casino_crash_lobby l join public.casino_crash_flights f on f.id=l.flight_id;
$$;
create or replace function public.casino_crash_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=public.casino_require_user();
 perform pg_catalog.pg_advisory_xact_lock(610100300);
 perform public.casino_crash_advance();
 perform 1 from public.casino_wallets where user_id=u for update;
 perform public.casino_sweep_crash(u);
 insert into public.casino_crash_presence(user_id) values(u) on conflict(user_id) do update set last_seen_at=clock_timestamp() where casino_crash_presence.last_seen_at<clock_timestamp()-interval '5 seconds';
 return public.casino_snapshot(u)||jsonb_build_object('crash',public.casino_crash_public(u));
end $$;
create or replace function public.casino_crash_action(p_request_id uuid,p_action text,p_flight_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; f public.casino_crash_flights; w public.casino_wallets; r public.casino_rounds; prior public.casino_game_requests; intent jsonb; v_stake numeric; target numeric; mult numeric; decision_at timestamptz;
begin
 if p_request_id is null or p_flight_id is null or p_action is null or p_action not in('start','cancel','cashout') or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'casino_invalid_request'; end if;
 u:=public.casino_require_user();
 perform pg_catalog.pg_advisory_xact_lock(610100300);
 f:=public.casino_crash_advance();
 select * into strict w from public.casino_wallets where user_id=u for update;
 intent:=jsonb_build_object('game','crash-shared','action',p_action,'flight',p_flight_id,'payload',p_payload);
 select * into prior from public.casino_game_requests where user_id=u and request_id=p_request_id;
 if found then
  if prior.intent<>intent then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('crash',public.casino_crash_public(u),'round',public.casino_public_round(u,prior.round_id),'replayed',true);
 end if;
 if exists(select 1 from public.casino_transactions where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 if p_action='start' then
  if f.id<>p_flight_id or clock_timestamp()>=f.starts_at then raise exception 'casino_invalid_state'; end if;
  if exists(select 1 from public.casino_rounds where user_id=u and game='crash' and (status='active' or (params->>'shared_id'=f.id::text and status<>'cancelled'))) then raise exception 'casino_invalid_active_round'; end if;
  if coalesce(p_payload->>'stake','') !~ '^[0-9]{1,6}([.][0-9]{1,2})?$' then raise exception 'casino_invalid_bet'; end if;
  v_stake:=(p_payload->>'stake')::numeric;
  if v_stake<1 or v_stake>100000 then raise exception 'casino_invalid_bet'; end if;
  if w.chips<v_stake then raise exception 'casino_insufficient_chips'; end if;
  if p_payload->>'auto' is not null and p_payload->>'auto' !~ '^[0-9]{1,4}([.][0-9]{1,2})?$' then raise exception 'casino_invalid_bet'; end if;
  target:=(p_payload->>'auto')::numeric;
  if target is not null and (target<1.01 or target>1000) then raise exception 'casino_invalid_bet'; end if;
  if exists(select 1 from public.casino_game_requests where user_id=u and created_at>clock_timestamp()-interval '180 milliseconds') then raise exception 'casino_rate_limit'; end if;
  if clock_timestamp()>=f.starts_at then raise exception 'casino_invalid_state'; end if;
  insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values(u,p_request_id,'crash',v_stake,jsonb_build_object('shared_id',f.id,'auto',target,'rtp',0.99),jsonb_build_object('point',f.point),jsonb_build_object('starts_at',f.starts_at)) returning * into r;
  update public.casino_wallets set chips=chips-v_stake,rounds=rounds+1,total_wagered=total_wagered+v_stake,tracked_wagered=tracked_wagered+v_stake,revision=revision+1 where user_id=u;
 else
  select * into r from public.casino_rounds where user_id=u and game='crash' and params->>'shared_id'=p_flight_id::text and status<>'cancelled' order by created_at desc limit 1 for update;
  if not found then raise exception 'casino_invalid_round'; end if;
  if r.status='active' then
   select * into strict f from public.casino_crash_flights where id=p_flight_id;
   decision_at:=clock_timestamp();
   if p_action='cancel' then
    if decision_at>=f.starts_at then raise exception 'casino_invalid_state'; end if;
    update public.casino_rounds set status='cancelled',payout=stake,version=version+1 where user_id=u and id=r.id;
    update public.casino_wallets set chips=chips+r.stake,rounds=rounds-1,total_wagered=total_wagered-r.stake,tracked_wagered=tracked_wagered-r.stake,revision=revision+1 where user_id=u;
   else
    if decision_at<f.starts_at then raise exception 'casino_invalid_state'; end if;
    target:=(r.params->>'auto')::numeric;
    if target is not null and target<=f.point and decision_at>=f.starts_at+(ln(target::double precision)/0.1)*interval '1 second' then mult:=target;
    elsif decision_at>=f.ends_at then mult:=0;
    else mult:=floor(exp(extract(epoch from(decision_at-f.starts_at))*0.1)*100)/100; end if;
    update public.casino_rounds set state=state||jsonb_build_object('cashout',mult) where user_id=u and id=r.id;
    perform public.casino_finish_decimal(u,r.id,trunc(r.stake*mult,2));
   end if;
  end if;
 end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 return public.casino_snapshot(u)||jsonb_build_object('crash',public.casino_crash_public(u),'round',public.casino_public_round(u,r.id),'replayed',false);
end $$;

-- Preserve old outbox requests and ongoing personal rounds; forbid new ones.
do $$ begin
 if to_regprocedure('public.casino_game_action_personal_legacy(uuid,text,text,uuid,jsonb)') is null then
  alter function public.casino_game_action(uuid,text,text,uuid,jsonb) rename to casino_game_action_personal_legacy;
 end if;
end $$;
create or replace function public.casino_game_action(p_request_id uuid,p_game text,p_action text,p_round_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_game='crash' and p_action='start' and not exists(select 1 from public.casino_game_requests where user_id=auth.uid() and request_id=p_request_id) then raise exception 'casino_invalid_state'; end if;
 return public.casino_game_action_personal_legacy(p_request_id,p_game,p_action,p_round_id,p_payload);
end $$;
revoke all on function public.casino_crash_advance(),public.casino_crash_public(uuid),public.casino_crash_state(),public.casino_crash_action(uuid,text,uuid,jsonb),public.casino_game_action_personal_legacy(uuid,text,text,uuid,jsonb),public.casino_game_action(uuid,text,text,uuid,jsonb),public.casino_public_round(uuid,uuid) from public,anon,authenticated;
grant execute on function public.casino_crash_state(),public.casino_crash_action(uuid,text,uuid,jsonb),public.casino_game_action(uuid,text,text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
