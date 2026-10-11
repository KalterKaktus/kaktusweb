-- Apply manually after 20261011010000_lucky_lounge_fair_economy.sql.
-- One shared round: 15s betting, 8s spin, 5s result. No idle synthetic rounds.
-- Private outcomes are never replicated. Realtime tables contain safe UI data.
begin;

create table if not exists public.casino_roulette_rounds (
 id uuid primary key default gen_random_uuid(),
 betting_ends_at timestamptz not null,
 spin_ends_at timestamptz not null,
 result_ends_at timestamptz not null,
 landing_index integer not null check(landing_index between 0 and 199),
 outcome text not null check(outcome in('red','black','green')),
 settled boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 check(spin_ends_at>betting_ends_at and result_ends_at>spin_ends_at)
);
create table if not exists public.casino_roulette_lobby (
 singleton boolean primary key default true check(singleton),
 round_id uuid not null references public.casino_roulette_rounds(id)
);
create table if not exists public.casino_roulette_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default clock_timestamp()
);
create table if not exists public.casino_roulette_live (
 singleton boolean primary key default true check(singleton),
 round_id uuid not null,
 phase text not null check(phase in('waiting','spinning','result')),
 betting_ends_at timestamptz not null,
 spin_ends_at timestamptz not null,
 result_ends_at timestamptz not null,
 outcome text check(outcome in('red','black','green')),
 landing_index integer check(landing_index between 0 and 199),
 revision bigint not null default 0,
 check(phase<>'waiting' or(outcome is null and landing_index is null))
);
create table if not exists public.casino_roulette_bets_live (
 id uuid not null,
 user_id uuid not null,
 round_id uuid not null,
 name text not null,
 color text not null check(color in('red','black','green')),
 stake numeric(22,2) not null,
 status text not null check(status in('active','won','lost')),
 payout numeric(22,2) not null default 0,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,id)
);
create index if not exists casino_roulette_live_round on public.casino_roulette_bets_live(round_id,created_at);
create index if not exists casino_roulette_private_bets on public.casino_rounds((params->>'roulette_id'),user_id) where game='roulette';
-- Roulette accepts several color bets per account in one shared round.
drop index if exists public.casino_one_active_game;
create unique index casino_one_active_game on public.casino_rounds(user_id,game) where status='active' and game<>'roulette';

alter table public.casino_roulette_rounds enable row level security;
alter table public.casino_roulette_lobby enable row level security;
alter table public.casino_roulette_presence enable row level security;
alter table public.casino_roulette_live enable row level security;
alter table public.casino_roulette_bets_live enable row level security;
revoke all on public.casino_roulette_rounds,public.casino_roulette_lobby,public.casino_roulette_presence,public.casino_roulette_live,public.casino_roulette_bets_live from public,anon,authenticated;
grant select on public.casino_roulette_live,public.casino_roulette_bets_live to authenticated;
drop policy if exists casino_roulette_live_read on public.casino_roulette_live;
create policy casino_roulette_live_read on public.casino_roulette_live for select to authenticated
 using(auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and not p.is_banned));
drop policy if exists casino_roulette_bets_read on public.casino_roulette_bets_live;
create policy casino_roulette_bets_read on public.casino_roulette_bets_live for select to authenticated
 using(auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and not p.is_banned)
  and round_id=(select round_id from public.casino_roulette_live where singleton));

create or replace function public.casino_roulette_color(p_slot integer) returns text
language sql immutable set search_path='' as $$
 select case when p_slot in(0,100) then 'green'
  when(p_slot<100 and mod(p_slot,2)=1) or(p_slot>100 and mod(p_slot,2)=0) then 'red' else 'black' end;
$$;

-- Must run under roulette's advisory lock, before the caller locks its wallet.
-- Multiple settlement wallets are acquired in user-id order to avoid deadlocks.
create or replace function public.casino_roulette_advance() returns public.casino_roulette_rounds
language plpgsql security definer set search_path='' as $$
declare f public.casino_roulette_rounds; b record; current_phase text; slot integer; ends timestamptz; amount numeric;
begin
 select q.* into f from public.casino_roulette_lobby l join public.casino_roulette_rounds q on q.id=l.round_id;
 if found then
  if clock_timestamp()>=f.spin_ends_at and not f.settled then
   perform 1 from public.casino_wallets w where exists(select 1 from public.casino_rounds r where r.user_id=w.user_id and r.game='roulette' and r.status='active' and r.params->>'roulette_id'=f.id::text) order by w.user_id for update;
   for b in select * from public.casino_rounds where game='roulette' and status='active' and params->>'roulette_id'=f.id::text order by user_id,id loop
    amount:=case when b.params->>'color'<>f.outcome then 0 when f.outcome='green' then b.stake*100 else public.casino_round_ratio(b.stake*100*200,99) end;
    update public.casino_rounds set state=state||jsonb_build_object('outcome',f.outcome,'landing_index',f.landing_index,'color',params->>'color','settled_at',clock_timestamp()) where user_id=b.user_id and id=b.id;
    perform public.casino_finish_decimal(b.user_id,b.id,amount);
    update public.casino_roulette_bets_live set status=case when amount>0 then 'won' else 'lost' end,payout=amount where user_id=b.user_id and id=b.id;
   end loop;
   update public.casino_roulette_rounds set settled=true where id=f.id; f.settled:=true;
  end if;
  if clock_timestamp()<f.result_ends_at then
   current_phase:=case when clock_timestamp()<f.betting_ends_at then 'waiting' when clock_timestamp()<f.spin_ends_at then 'spinning' else 'result' end;
   update public.casino_roulette_live set phase=current_phase,outcome=case when current_phase='waiting' then null else f.outcome end,landing_index=case when current_phase='waiting' then null else f.landing_index end,revision=revision+1 where singleton and phase<>current_phase;
   return f;
  end if;
 end if;
 -- A full window on reopening; never fabricate empty past results.
 ends:=clock_timestamp()+interval '15 seconds'; slot:=public.casino_random(200);
 insert into public.casino_roulette_rounds(betting_ends_at,spin_ends_at,result_ends_at,landing_index,outcome)
 values(ends,ends+interval '8 seconds',ends+interval '13 seconds',slot,public.casino_roulette_color(slot)) returning * into f;
 insert into public.casino_roulette_lobby(singleton,round_id) values(true,f.id) on conflict(singleton) do update set round_id=excluded.round_id;
 insert into public.casino_roulette_live(singleton,round_id,phase,betting_ends_at,spin_ends_at,result_ends_at,outcome,landing_index)
 values(true,f.id,'waiting',f.betting_ends_at,f.spin_ends_at,f.result_ends_at,null,null)
 on conflict(singleton) do update set round_id=excluded.round_id,phase='waiting',betting_ends_at=excluded.betting_ends_at,spin_ends_at=excluded.spin_ends_at,result_ends_at=excluded.result_ends_at,outcome=null,landing_index=null,revision=casino_roulette_live.revision+1;
 return f;
end $$;

create or replace function public.casino_roulette_public(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('version',1,
 'round',jsonb_build_object('id',f.id,'phase',case when clock_timestamp()<f.betting_ends_at then 'waiting' when clock_timestamp()<f.spin_ends_at then 'spinning' else 'result' end,'betting_ends_at',f.betting_ends_at,'spin_ends_at',f.spin_ends_at,'result_ends_at',f.result_ends_at)
  ||case when clock_timestamp()>=f.betting_ends_at then jsonb_build_object('outcome',f.outcome,'landing_index',f.landing_index) else '{}'::jsonb end,
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'name',p.username,'color',r.params->>'color','stake',r.stake,'status',r.status,'payout',r.payout) order by r.created_at,r.id) from public.casino_rounds r join public.profiles p on p.id=r.user_id and not p.is_banned where r.game='roulette' and r.params->>'roulette_id'=f.id::text),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'outcome',h.outcome,'landing_index',h.landing_index,'ended_at',h.spin_ends_at) order by h.spin_ends_at) from(select * from public.casino_roulette_rounds where settled and spin_ends_at<=clock_timestamp() order by spin_ends_at desc limit 20) h),'[]'::jsonb),
 'online_count',(select count(*) from public.casino_roulette_presence s join public.profiles p on p.id=s.user_id and not p.is_banned where s.last_seen_at>clock_timestamp()-interval '15 seconds'))
 from public.casino_roulette_lobby l join public.casino_roulette_rounds f on f.id=l.round_id;
$$;

create or replace function public.casino_roulette_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=public.casino_require_user(); perform pg_catalog.pg_advisory_xact_lock(610110200);
 perform public.casino_roulette_advance(); perform 1 from public.casino_wallets where user_id=u for update;
 perform public.casino_sweep_crash(u);
 insert into public.casino_roulette_presence(user_id) values(u) on conflict(user_id) do update set last_seen_at=clock_timestamp() where casino_roulette_presence.last_seen_at<clock_timestamp()-interval '5 seconds';
 return public.casino_snapshot(u)||jsonb_build_object('roulette',public.casino_roulette_public(u));
end $$;

create or replace function public.casino_roulette_action(p_request_id uuid,p_round_id uuid,p_color text,p_stake numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; f public.casino_roulette_rounds; w public.casino_wallets; r public.casino_rounds; prior public.casino_game_requests; intent jsonb;
begin
 if p_request_id is null or p_round_id is null or p_color is null or p_color not in('red','black','green') or p_stake is null or p_stake<1 or p_stake>100000 or p_stake<>trunc(p_stake,2) then raise exception 'casino_invalid_bet'; end if;
 u:=public.casino_require_user(); perform pg_catalog.pg_advisory_xact_lock(610110200); f:=public.casino_roulette_advance();
 select * into strict w from public.casino_wallets where user_id=u for update;
 intent:=jsonb_build_object('game','roulette','action','bet','round',p_round_id,'color',p_color,'stake',p_stake);
 select * into prior from public.casino_game_requests where user_id=u and request_id=p_request_id;
 if found then
  if prior.intent<>intent then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('roulette',public.casino_roulette_public(u),'round',public.casino_public_round(u,prior.round_id),'replayed',true);
 end if;
 if exists(select 1 from public.casino_transactions where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 if f.id<>p_round_id or clock_timestamp()>=f.betting_ends_at then raise exception 'casino_invalid_state'; end if;
 if w.chips<p_stake then raise exception 'casino_insufficient_chips'; end if;
 if coalesce((select sum(stake) from public.casino_rounds where user_id=u and game='roulette' and params->>'roulette_id'=f.id::text and params->>'color'=p_color),0)+p_stake>100000 then raise exception 'casino_invalid_bet'; end if;
 if(select count(*) from public.casino_game_requests req where req.user_id=u and req.intent->>'game'='roulette' and req.created_at>clock_timestamp()-interval '1 second')>=30 then raise exception 'casino_rate_limit'; end if;
 if(select count(*) from public.casino_rounds where game='roulette' and params->>'roulette_id'=f.id::text)>=1000 then raise exception 'casino_rate_limit'; end if;
 -- Recheck after locks and validation, immediately before the debit.
 if clock_timestamp()>=f.betting_ends_at then raise exception 'casino_invalid_state'; end if;
 insert into public.casino_rounds(user_id,id,game,stake,params,state)
 values(u,p_request_id,'roulette',p_stake,jsonb_build_object('roulette_id',f.id,'color',p_color,'fair_version',1,'rtp',1),jsonb_build_object('color',p_color)) returning * into r;
 update public.casino_wallets set chips=chips-p_stake,rounds=rounds+1,total_wagered=total_wagered+p_stake,tracked_wagered=tracked_wagered+p_stake,revision=revision+1 where user_id=u;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 insert into public.casino_roulette_bets_live(id,user_id,round_id,name,color,stake,status)
 select r.id,u,f.id,p.username,p_color,p_stake,'active' from public.profiles p where p.id=u;
 update public.casino_roulette_live set revision=revision+1 where singleton;
 return public.casino_snapshot(u)||jsonb_build_object('roulette',public.casino_roulette_public(u),'round',public.casino_public_round(u,r.id),'replayed',false);
end $$;

-- Any wallet reopening also finishes old roulette bets, even when nobody is
-- currently viewing Roulette. Settlement is independent of browser animation.
create or replace function public.casino_get_wallet() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=public.casino_require_user(); perform pg_catalog.pg_advisory_xact_lock(610110200);
 if exists(select 1 from public.casino_roulette_lobby) then perform public.casino_roulette_advance(); end if;
 perform 1 from public.casino_wallets where user_id=u for update; perform public.casino_sweep_crash(u);
 return public.casino_snapshot(u);
end $$;

-- Only the two safe projections enter Realtime. Private RNG/card/wallet tables
-- are deliberately excluded. Supabase normally already has this publication.
do $$ begin
 if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_roulette_live') then alter publication supabase_realtime add table public.casino_roulette_live; end if;
  if not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_roulette_bets_live') then alter publication supabase_realtime add table public.casino_roulette_bets_live; end if;
 end if;
end $$;
revoke all on function public.casino_roulette_color(integer),public.casino_roulette_advance(),public.casino_roulette_public(uuid),public.casino_roulette_state(),public.casino_roulette_action(uuid,uuid,text,numeric),public.casino_get_wallet() from public,anon,authenticated;
grant execute on function public.casino_roulette_state(),public.casino_roulette_action(uuid,uuid,text,numeric),public.casino_get_wallet() to authenticated;
notify pgrst,'reload schema';
commit;
