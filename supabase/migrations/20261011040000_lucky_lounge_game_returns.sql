-- Apply manually after 20261011030000_lucky_lounge_blackjack.sql.
-- New rounds only: Plinko/Dino/Crash 101%; Mines unchanged; Roulette 2x/100x.
-- Crash retains P(survive to m)=1/m and adds 1% to successful payouts.
-- Existing round parameters and roulette windows retain their original rules.
begin;
alter table public.casino_roulette_rounds add column if not exists payout_version integer not null default 1 check(payout_version in(1,2));

create or replace function public.casino_plinko_rules(p_difficulty text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n integer; risk text; weights numeric[]; denominator numeric:=0; multipliers jsonb:='[]';
begin
 case p_difficulty
 when 'easy' then n:=8; risk:='low'; weights:=array[56,21,11,10,5,10,11,21,56];
 when 'normal' then n:=12; risk:='medium'; weights:=array[330,110,40,20,11,6,3,6,11,20,40,110,330];
 when 'hard' then n:=16; risk:='high'; weights:=array[10000,1300,260,90,40,20,2,2,2,2,2,20,40,90,260,1300,10000];
 else raise exception 'casino_invalid_bet'; end case;
 for k in 0..n loop denominator:=denominator+public.casino_choose(n,k)*weights[k+1]; end loop;
 denominator:=denominator*100;
 for k in 0..n loop weights[k+1]:=weights[k+1]*101; end loop;
 for k in 0..n loop multipliers:=multipliers||jsonb_build_array(weights[k+1]*power(2::numeric,n)/denominator); end loop;
 return jsonb_build_object('rows',n,'risk',risk,'weights',to_jsonb(weights),'denominator',denominator,'multipliers',multipliers);
end $$;

create or replace function public.casino_snapshot(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'rules',jsonb_build_object('economy','casino-v1','fair_version',1,'target_rtp',1,'game_rtp',jsonb_build_object('plinko',1.01,'dino',1.01,'crash',1.01,'mines',1,'coinflip',1,'roulette_red_black',0.99,'roulette_green',1),'min_stake',1,
  'plinko',jsonb_build_object('easy',public.casino_plinko_rules('easy'),'normal',public.casino_plinko_rules('normal'),'hard',public.casino_plinko_rules('hard'))),
 'currency_decimals',2,'wallet',to_jsonb(w)-'legacy_snapshot'-'user_id','server_now',clock_timestamp(),
 'daily_available',false,'bonus_amount',50,
 'bonus_available',w.last_bonus_at is null or w.last_bonus_at+interval '1 hour'<=clock_timestamp(),
 'next_bonus_at',coalesce(w.last_bonus_at+interval '1 hour',clock_timestamp()),
 'next_daily_at',coalesce(w.last_bonus_at+interval '1 hour',clock_timestamp()),
 'active_rounds',coalesce((select jsonb_agg(public.casino_public_round(p_uid,r.id)) from public.casino_rounds r where r.user_id=p_uid and r.status='active'),'[]'::jsonb),
 'latest_rounds',coalesce((select jsonb_agg(public.casino_public_round(p_uid,r.id)) from (select distinct on(game) * from public.casino_rounds where user_id=p_uid order by game,created_at desc) r),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
 select request_id,kind as game,stake,payout,slot,path,created_at from public.casino_transactions where user_id=p_uid and kind not in('daily','bonus') order by created_at desc limit 12
 )r),'[]'::jsonb)) from public.casino_wallets w where w.user_id=p_uid;
$$;

create or replace function public.casino_game_action(p_request_id uuid,p_game text,p_action text,p_round_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; r public.casino_rounds; w public.casino_wallets; prior public.casino_game_requests;
 intent jsonb; result jsonb; existed boolean; cleared integer; count integer; tile integer;
 numerator numeric; denominator numeric; mult numeric; amount numeric;
begin
 if p_game='crash' then
  if p_action='start' and not exists(select 1 from public.casino_game_requests where user_id=auth.uid() and request_id=p_request_id) then raise exception 'casino_invalid_state'; end if;
  return public.casino_game_action_personal_legacy(p_request_id,p_game,p_action,p_round_id,p_payload);
 end if;
 if p_request_id is null or p_game is null or p_game not in('mines','dino') or p_action is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'casino_invalid_request'; end if;
 u:=public.casino_require_user(); select * into strict w from public.casino_wallets where user_id=u for update;
 select * into prior from public.casino_game_requests where user_id=u and request_id=p_request_id; existed:=found;
 if p_action='start' then
  result:=public.casino_game_action_personal_legacy(p_request_id,p_game,p_action,p_round_id,p_payload);
  if existed then return result; end if;
  update public.casino_rounds set params=params||jsonb_build_object('rtp',case when p_game='dino' then 1.01 else 1 end,'fair_version',1) where user_id=u and id=p_request_id;
  return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,p_request_id),'replayed',false);
 end if;
 intent:=jsonb_build_object('game',p_game,'action',p_action,'round',p_round_id,'payload',p_payload);
 if existed then
  if prior.intent<>intent then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,prior.round_id),'replayed',true);
 end if;
 if exists(select 1 from public.casino_transactions where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 select * into r from public.casino_rounds where user_id=u and id=p_round_id and game=p_game for update;
 if not found then raise exception 'casino_invalid_round'; end if;
 if r.params->>'fair_version' is distinct from '1' then return public.casino_game_action_personal_legacy(p_request_id,p_game,p_action,p_round_id,p_payload); end if;
 if r.status<>'active' then raise exception 'casino_invalid_round'; end if;
 if (p_payload->>'version') is distinct from r.version::text then raise exception 'casino_invalid_state'; end if;
 cleared:=coalesce((r.state->>'cleared')::integer,0);
 if p_action='cancel' and cleared=0 then
  update public.casino_rounds set status='cancelled',payout=r.stake,version=version+1 where user_id=u and id=r.id;
  update public.casino_wallets set chips=chips+r.stake,rounds=rounds-1,total_wagered=total_wagered-r.stake,tracked_wagered=tracked_wagered-r.stake,revision=revision+1 where user_id=u;
 elsif p_action='cashout' then
  if cleared=0 then raise exception 'casino_invalid_state'; end if;
  if p_game='mines' then numerator:=r.stake*100*public.casino_choose(25,cleared); denominator:=public.casino_choose(25-(r.params->>'mines')::integer,cleared);
  else numerator:=r.stake*100*power(100::numeric,cleared)*coalesce((r.params->>'rtp')::numeric,1)*100; denominator:=power((r.params->>'chance')::numeric,cleared)*100; end if;
  update public.casino_rounds set state=state||jsonb_build_object('cashout',(r.state->>'multiplier')::numeric) where user_id=u and id=r.id;
  perform public.casino_finish_decimal(u,r.id,public.casino_round_ratio(numerator,denominator));
 elsif p_action='reveal' and p_game='mines' then
  if coalesce(p_payload->>'tile','') !~ '^([0-9]|1[0-9]|2[0-4])$' then raise exception 'casino_invalid_request'; end if;
  tile:=(p_payload->>'tile')::integer;
  if r.state->'revealed' @> jsonb_build_array(tile) then raise exception 'casino_invalid_state'; end if;
  update public.casino_rounds set state=state||jsonb_build_object('revealed',(state->'revealed')||jsonb_build_array(tile),'last_tile',tile),version=version+1 where user_id=u and id=r.id;
  if r.secret->'mines' @> jsonb_build_array(tile) then perform public.casino_finish_decimal(u,r.id,0);
  else
   count:=(r.params->>'mines')::integer; numerator:=public.casino_choose(25,cleared+1); denominator:=public.casino_choose(25-count,cleared+1); mult:=numerator/denominator;
   update public.casino_rounds set state=state||jsonb_build_object('cleared',cleared+1,'multiplier',mult,'potential',trunc(r.stake*mult,2)) where user_id=u and id=r.id;
   if cleared+1=25-count then perform public.casino_finish_decimal(u,r.id,public.casino_round_ratio(r.stake*100*numerator,denominator)); end if;
  end if;
  update public.casino_wallets set revision=revision+1 where user_id=u;
 elsif p_action='jump' and p_game='dino' then
  if clock_timestamp()<(r.state->>'next_action_at')::timestamptz then raise exception 'casino_rate_limit'; end if;
  if public.casino_random(100)<(r.params->>'chance')::integer then
   numerator:=power(100::numeric,cleared+1)*coalesce((r.params->>'rtp')::numeric,1)*100; denominator:=power((r.params->>'chance')::numeric,cleared+1)*100; mult:=numerator/denominator;
   update public.casino_rounds set state=state||jsonb_build_object('cleared',cleared+1,'multiplier',mult,'potential',trunc(r.stake*mult,2),'next_action_at',clock_timestamp()+interval '500 milliseconds'),version=version+1 where user_id=u and id=r.id;
   if cleared+1=12 then perform public.casino_finish_decimal(u,r.id,public.casino_round_ratio(r.stake*100*numerator,denominator)); end if;
  else perform public.casino_finish_decimal(u,r.id,0); end if;
  update public.casino_wallets set revision=revision+1 where user_id=u;
 else raise exception 'casino_invalid_action'; end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,r.id),'replayed',false);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'casino_invalid_bet';
end $$;

create or replace function public.casino_sweep_crash(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.casino_rounds; elapsed double precision; point numeric; target numeric; amount numeric;
begin
 select * into r from public.casino_rounds where user_id=p_uid and game='crash' and status='active' for update;
 if not found then return; end if;
 elapsed:=greatest(0,extract(epoch from(clock_timestamp()-(r.state->>'starts_at')::timestamptz)));
 point:=(r.secret->>'point')::numeric; target:=(r.params->>'auto')::numeric;
 if target is not null and target<=point and elapsed>=ln(target::double precision)/0.1 then
  amount:=case when r.params->>'fair_version'='1' then public.casino_round_ratio(r.stake*100*target*100*case when (r.params->>'rtp')::numeric>=1 then (r.params->>'rtp')::numeric*100 else 100 end,10000) else trunc(r.stake*target,2) end;
  update public.casino_rounds set state=state||jsonb_build_object('cashout',target) where user_id=p_uid and id=r.id;
  perform public.casino_finish_decimal(p_uid,r.id,amount);
 elsif elapsed>=ln(point::double precision)/0.1 and clock_timestamp()>=(r.state->>'starts_at')::timestamptz then perform public.casino_finish_decimal(p_uid,r.id,0);
 end if;
end $$;

create or replace function public.casino_crash_advance() returns public.casino_crash_flights
language plpgsql security definer set search_path='' as $$
declare f public.casino_crash_flights; next_start timestamptz; v_point numeric; r record;
begin
 select flights.* into f from public.casino_crash_lobby l join public.casino_crash_flights flights on flights.id=l.flight_id;
 if found then
  -- Preserve lock order and settle automatic cashouts/losses at the crash,
  -- regardless of how long the result remains on screen.
  perform 1 from public.casino_wallets w where exists(select 1 from public.casino_rounds b where b.user_id=w.user_id and b.game='crash' and b.status='active' and b.params->>'shared_id'=f.id::text and (clock_timestamp()>=f.ends_at or ((b.params->>'auto')::numeric<=f.point and clock_timestamp()>=f.starts_at+(ln((b.params->>'auto')::double precision)/0.1)*interval '1 second'))) order by w.user_id for update;
  for r in select user_id from public.casino_rounds where game='crash' and status='active' and params->>'shared_id'=f.id::text and (clock_timestamp()>=f.ends_at or ((params->>'auto')::numeric<=f.point and clock_timestamp()>=f.starts_at+(ln((params->>'auto')::double precision)/0.1)*interval '1 second')) order by user_id loop
   perform public.casino_sweep_crash(r.user_id);
  end loop;
  if clock_timestamp()<f.ends_at+interval '5 seconds' then return f; end if;
  next_start:=f.ends_at+interval '15 seconds';
  -- Reopening an idle lobby still gives a complete betting window.
  if next_start<=clock_timestamp() then next_start:=clock_timestamp()+interval '10 seconds'; end if;
 else next_start:=clock_timestamp()+interval '10 seconds';
 end if;
 v_point:=public.casino_crash_point_fair();
 insert into public.casino_crash_flights(starts_at,point,ends_at,rtp)
 values(next_start,v_point,next_start+(ln(v_point::double precision)/0.1)*interval '1 second',1.01) returning * into f;
 insert into public.casino_crash_lobby(singleton,flight_id) values(true,f.id) on conflict(singleton) do update set flight_id=excluded.flight_id;
 return f;
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
  insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values(u,p_request_id,'crash',v_stake,jsonb_build_object('shared_id',f.id,'auto',target,'rtp',f.rtp,'fair_version',case when f.rtp>=1 then 1 else 0 end),jsonb_build_object('point',f.point),jsonb_build_object('starts_at',f.starts_at)) returning * into r;
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
    else mult:=case when r.params->>'fair_version'='1' then ceil(exp(extract(epoch from(decision_at-f.starts_at))*0.1)*100)/100 else floor(exp(extract(epoch from(decision_at-f.starts_at))*0.1)*100)/100 end; end if;
    update public.casino_rounds set state=state||jsonb_build_object('cashout',mult) where user_id=u and id=r.id;
    perform public.casino_finish_decimal(u,r.id,case when r.params->>'fair_version'='1' then public.casino_round_ratio(r.stake*100*mult*100*case when (r.params->>'rtp')::numeric>=1 then (r.params->>'rtp')::numeric*100 else 100 end,10000) else trunc(r.stake*mult,2) end);
   end if;
  end if;
 end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 return public.casino_snapshot(u)||jsonb_build_object('crash',public.casino_crash_public(u),'round',public.casino_public_round(u,r.id),'replayed',false);
end $$;

create or replace function public.casino_crash_public(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'version',1,
 'flight',jsonb_build_object('id',f.id,'starts_at',f.starts_at,'payout_factor',case when f.rtp>=1 then f.rtp else 1 end,'phase',case when clock_timestamp()<f.starts_at then 'waiting' when clock_timestamp()>=f.ends_at then 'crashed' else 'running' end)
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

create or replace function public.casino_roulette_advance() returns public.casino_roulette_rounds
language plpgsql security definer set search_path='' as $$
declare f public.casino_roulette_rounds; b record; current_phase text; slot integer; ends timestamptz; amount numeric;
begin
 select q.* into f from public.casino_roulette_lobby l join public.casino_roulette_rounds q on q.id=l.round_id;
 if found then
  if clock_timestamp()>=f.spin_ends_at and not f.settled then
   perform 1 from public.casino_wallets w where exists(select 1 from public.casino_rounds r where r.user_id=w.user_id and r.game='roulette' and r.status='active' and r.params->>'roulette_id'=f.id::text) order by w.user_id for update;
   for b in select * from public.casino_rounds where game='roulette' and status='active' and params->>'roulette_id'=f.id::text order by user_id,id loop
    amount:=case when b.params->>'color'<>f.outcome then 0 when f.outcome='green' then b.stake*100 when f.payout_version=2 then b.stake*2 else public.casino_round_ratio(b.stake*100*200,99) end;
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
 insert into public.casino_roulette_rounds(betting_ends_at,spin_ends_at,result_ends_at,landing_index,outcome,payout_version)
 values(ends,ends+interval '8 seconds',ends+interval '13 seconds',slot,public.casino_roulette_color(slot),2) returning * into f;
 insert into public.casino_roulette_lobby(singleton,round_id) values(true,f.id) on conflict(singleton) do update set round_id=excluded.round_id;
 insert into public.casino_roulette_live(singleton,round_id,phase,betting_ends_at,spin_ends_at,result_ends_at,outcome,landing_index)
 values(true,f.id,'waiting',f.betting_ends_at,f.spin_ends_at,f.result_ends_at,null,null)
 on conflict(singleton) do update set round_id=excluded.round_id,phase='waiting',betting_ends_at=excluded.betting_ends_at,spin_ends_at=excluded.spin_ends_at,result_ends_at=excluded.result_ends_at,outcome=null,landing_index=null,revision=casino_roulette_live.revision+1;
 return f;
end $$;

create or replace function public.casino_roulette_public(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('version',1,
 'round',jsonb_build_object('id',f.id,'red_black_multiplier',case when f.payout_version=2 then 2 else 200::numeric/99 end,'phase',case when clock_timestamp()<f.betting_ends_at then 'waiting' when clock_timestamp()<f.spin_ends_at then 'spinning' else 'result' end,'betting_ends_at',f.betting_ends_at,'spin_ends_at',f.spin_ends_at,'result_ends_at',f.result_ends_at)
  ||case when clock_timestamp()>=f.betting_ends_at then jsonb_build_object('outcome',f.outcome,'landing_index',f.landing_index) else '{}'::jsonb end,
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'name',p.username,'color',r.params->>'color','stake',r.stake,'status',r.status,'payout',r.payout) order by r.created_at,r.id) from public.casino_rounds r join public.profiles p on p.id=r.user_id and not p.is_banned where r.game='roulette' and r.params->>'roulette_id'=f.id::text),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'outcome',h.outcome,'landing_index',h.landing_index,'ended_at',h.spin_ends_at) order by h.spin_ends_at) from(select * from public.casino_roulette_rounds where settled and spin_ends_at<=clock_timestamp() order by spin_ends_at desc limit 20) h),'[]'::jsonb),
 'online_count',(select count(*) from public.casino_roulette_presence s join public.profiles p on p.id=s.user_id and not p.is_banned where s.last_seen_at>clock_timestamp()-interval '15 seconds'))
 from public.casino_roulette_lobby l join public.casino_roulette_rounds f on f.id=l.round_id;
$$;

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
 values(u,p_request_id,'roulette',p_stake,jsonb_build_object('roulette_id',f.id,'color',p_color,'fair_version',1,'payout_version',f.payout_version,'rtp',case when f.payout_version=2 and p_color<>'green' then 0.99 else 1 end),jsonb_build_object('color',p_color)) returning * into r;
 update public.casino_wallets set chips=chips-p_stake,rounds=rounds+1,total_wagered=total_wagered+p_stake,tracked_wagered=tracked_wagered+p_stake,revision=revision+1 where user_id=u;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 insert into public.casino_roulette_bets_live(id,user_id,round_id,name,color,stake,status)
 select r.id,u,f.id,p.username,p_color,p_stake,'active' from public.profiles p where p.id=u;
 update public.casino_roulette_live set revision=revision+1 where singleton;
 return public.casino_snapshot(u)||jsonb_build_object('roulette',public.casino_roulette_public(u),'round',public.casino_public_round(u,r.id),'replayed',false);
end $$;

notify pgrst,'reload schema';
commit;
