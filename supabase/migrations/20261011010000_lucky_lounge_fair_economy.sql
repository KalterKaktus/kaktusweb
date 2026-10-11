-- Apply manually after 20261010050000_lucky_lounge_admin_chips.sql.
-- Only new rounds use fair payouts. Wallets, completed results and active old
-- rounds retain their amounts and original rules. All helpers remain private.
begin;

alter table public.casino_transactions drop constraint if exists casino_transactions_kind_check;
alter table public.casino_transactions add constraint casino_transactions_kind_check
 check(kind in('daily','bonus','plinko','mines','crash','dino','roulette','blackjack'));
alter table public.casino_rounds drop constraint if exists casino_rounds_game_check;
alter table public.casino_rounds add constraint casino_rounds_game_check
 check(game in('mines','crash','dino','roulette','blackjack'));

-- Uniform integer rejection sampling, including denominators larger than int64.
-- Independent unbiased 9-digit blocks come from the existing UUID RNG helper.
create or replace function public.casino_random_numeric(p_max numeric) returns numeric
language plpgsql volatile security definer set search_path='' as $$
declare domain_size numeric:=1; candidate numeric; cutoff numeric; blocks integer:=0;
begin
 if p_max is null or p_max<1 or p_max<>trunc(p_max) or p_max>1e81 then raise exception 'casino_invalid_random'; end if;
 if p_max=1 then return 0; end if;
 while domain_size<p_max loop domain_size:=domain_size*1000000000; blocks:=blocks+1; end loop;
 cutoff:=domain_size-mod(domain_size,p_max);
 loop
  candidate:=0;
  for i in 1..blocks loop candidate:=candidate*1000000000+public.casino_random(1000000000); end loop;
  if candidate<cutoff then return mod(candidate,p_max); end if;
 end loop;
end $$;

-- Input is an EXACT integer fraction in cents; output is chips with 2 digits.
-- Remainder/d rounded UP with precisely that probability, otherwise DOWN.
-- The random choice is made once inside settlement and persisted in the ledger.
create or replace function public.casino_round_ratio(p_cents_numerator numeric,p_denominator numeric) returns numeric
language plpgsql volatile security definer set search_path='' as $$
declare base numeric; remainder numeric;
begin
 if p_cents_numerator is null or p_denominator is null or p_cents_numerator<0 or p_denominator<1
  or p_cents_numerator<>trunc(p_cents_numerator) or p_denominator<>trunc(p_denominator) then raise exception 'casino_invalid_payout'; end if;
 base:=div(p_cents_numerator,p_denominator); remainder:=mod(p_cents_numerator,p_denominator);
 if remainder>0 and public.casino_random_numeric(p_denominator)<remainder then base:=base+1; end if;
 return base/100;
end $$;

create or replace function public.casino_choose(p_n integer,p_k integer) returns numeric
language plpgsql immutable set search_path='' as $$
declare answer numeric:=1;
begin
 if p_k<0 or p_k>p_n then return 0; end if;
 if p_k=0 then return 1; end if;
 for i in 1..least(p_k,p_n-p_k) loop answer:=div(answer*(p_n-i+1),i); end loop;
 return answer;
end $$;

-- Preserve the original symmetric table shapes, normalize their true binomial
-- expectation. Rational payout is weight[k]*2^rows/sum(C(rows,k)*weight[k]).
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
 for k in 0..n loop multipliers:=multipliers||jsonb_build_array(weights[k+1]*power(2::numeric,n)/denominator); end loop;
 return jsonb_build_object('rows',n,'risk',risk,'weights',to_jsonb(weights),'denominator',denominator,'multipliers',multipliers);
end $$;

-- Exact inverse CDF using successively refined random intervals. No finite
-- random-integer approximation to 1/x: cent-grid auto targets have P(X>=m)=1/m.
-- Capping at 1000 retains all tail mass at 1000 and therefore remains fair there.
create or replace function public.casino_crash_point_fair() returns numeric
language plpgsql volatile security definer set search_path='' as $$
declare digits numeric:=0; domain_size numeric:=1; lo numeric; hi numeric;
begin
 loop
  digits:=digits*1000000000+public.casino_random(1000000000); domain_size:=domain_size*1000000000;
  lo:=least(100000,div(100*domain_size,digits+1));
  hi:=case when digits=0 then 100000 else least(100000,div(100*domain_size,digits)) end;
  if lo=hi then return greatest(100,lo)/100; end if;
 end loop;
end $$;

alter table public.casino_crash_flights add column if not exists rtp numeric not null default 0.99;
create or replace function public.casino_snapshot(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'rules',jsonb_build_object('economy','casino-v1','fair_version',1,'target_rtp',1,'min_stake',1,
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

create or replace function public.casino_play_plinko_mode(p_request_id uuid,p_stake numeric,p_difficulty text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; w public.casino_wallets; tx public.casino_transactions; rules jsonb; n integer; bit integer;
 slot integer:=0; bits jsonb:='[]'; bytes bytea; payout numeric; numerator numeric; denominator numeric;
begin
 if p_request_id is null or p_stake is null or p_stake<1 or p_stake>100000 or p_stake<>trunc(p_stake,2) then raise exception 'casino_invalid_bet'; end if;
 rules:=public.casino_plinko_rules(p_difficulty); n:=(rules->>'rows')::integer;
 u:=public.casino_require_user(); select * into strict w from public.casino_wallets where user_id=u for update;
 select * into tx from public.casino_transactions where user_id=u and request_id=p_request_id;
 if found then
  if tx.kind<>'plinko' or tx.stake<>p_stake or (tx.path->>'difficulty') is distinct from p_difficulty then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('round',to_jsonb(tx)-'user_id','replayed',true);
 end if;
 if exists(select 1 from public.casino_game_requests where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 if w.chips<p_stake then raise exception 'casino_insufficient_chips'; end if;
 if (select count(*) from public.casino_transactions where user_id=u and kind='plinko' and created_at>clock_timestamp()-interval '1 second')>=60 then raise exception 'casino_rate_limit'; end if;
 bytes:=decode(replace(gen_random_uuid()::text,'-',''),'hex');
 for i in 0..n-1 loop bit:=(get_byte(bytes,i/8)>>(i%8))&1; slot:=slot+bit; bits:=bits||jsonb_build_array(bit); end loop;
 numerator:=p_stake*100*(rules->'weights'->>slot)::numeric*power(2::numeric,n); denominator:=(rules->>'denominator')::numeric;
 payout:=public.casino_round_ratio(numerator,denominator);
 if w.chips-p_stake+payout>9007199254740991 then raise exception 'casino_balance_limit'; end if;
 insert into public.casino_transactions(user_id,request_id,kind,stake,payout,slot,path)
 values(u,p_request_id,'plinko',p_stake,payout,slot,jsonb_build_object('bits',bits,'difficulty',p_difficulty,'rows',n,'risk',rules->>'risk','multiplier',rules->'multipliers'->slot,'fair_version',1)) returning * into tx;
 update public.casino_wallets set chips=chips-p_stake+payout,rounds=rounds+1,biggest_win=greatest(biggest_win,payout),total_wagered=total_wagered+p_stake,total_won=total_won+payout,tracked_wagered=tracked_wagered+p_stake,tracked_won=tracked_won+payout,revision=revision+1 where user_id=u;
 return public.casino_snapshot(u)||jsonb_build_object('round',to_jsonb(tx)-'user_id','replayed',false);
end $$;

-- Old eight-row endpoint cannot offer a second, unnormalized economy. Previously
-- recorded requests replay their original ledger entry; new calls use Easy.
create or replace function public.casino_play_plinko(p_request_id uuid,p_stake numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; tx public.casino_transactions;
begin
 u:=public.casino_require_user(); perform 1 from public.casino_wallets where user_id=u for update;
 select * into tx from public.casino_transactions where user_id=u and request_id=p_request_id;
 if found then
  if tx.kind<>'plinko' or tx.stake is distinct from p_stake then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('round',to_jsonb(tx)-'user_id','replayed',true);
 end if;
 return public.casino_play_plinko_mode(p_request_id,p_stake,'easy');
end $$;

-- Shared and old personal Crash rounds preserve their individual payout rules.
create or replace function public.casino_sweep_crash(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.casino_rounds; elapsed double precision; point numeric; target numeric; amount numeric;
begin
 select * into r from public.casino_rounds where user_id=p_uid and game='crash' and status='active' for update;
 if not found then return; end if;
 elapsed:=greatest(0,extract(epoch from(clock_timestamp()-(r.state->>'starts_at')::timestamptz)));
 point:=(r.secret->>'point')::numeric; target:=(r.params->>'auto')::numeric;
 if target is not null and target<=point and elapsed>=ln(target::double precision)/0.1 then
  amount:=case when r.params->>'fair_version'='1' then public.casino_round_ratio(r.stake*100*target*100,100) else trunc(r.stake*target,2) end;
  update public.casino_rounds set state=state||jsonb_build_object('cashout',target) where user_id=p_uid and id=r.id;
  perform public.casino_finish_decimal(p_uid,r.id,amount);
 elsif elapsed>=ln(point::double precision)/0.1 and clock_timestamp()>=(r.state->>'starts_at')::timestamptz then perform public.casino_finish_decimal(p_uid,r.id,0);
 end if;
end $$;

-- New Mines and Dino use exact reciprocal survival probability. Old rounds are
-- routed to their preserved implementation, including pending outbox retries.
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
  update public.casino_rounds set params=params||jsonb_build_object('rtp',1,'fair_version',1) where user_id=u and id=p_request_id;
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
  else numerator:=r.stake*100*power(100::numeric,cleared); denominator:=power((r.params->>'chance')::numeric,cleared); end if;
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
   numerator:=power(100::numeric,cleared+1); denominator:=power((r.params->>'chance')::numeric,cleared+1); mult:=numerator/denominator;
   update public.casino_rounds set state=state||jsonb_build_object('cleared',cleared+1,'multiplier',mult,'potential',trunc(r.stake*mult,2),'next_action_at',clock_timestamp()+interval '500 milliseconds'),version=version+1 where user_id=u and id=r.id;
   if cleared+1=12 then perform public.casino_finish_decimal(u,r.id,public.casino_round_ratio(r.stake*100*numerator,denominator)); end if;
  else perform public.casino_finish_decimal(u,r.id,0); end if;
  update public.casino_wallets set revision=revision+1 where user_id=u;
 else raise exception 'casino_invalid_action'; end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,r.id),'replayed',false);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'casino_invalid_bet';
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
 values(next_start,v_point,next_start+(ln(v_point::double precision)/0.1)*interval '1 second',1) returning * into f;
 insert into public.casino_crash_lobby(singleton,flight_id) values(true,f.id) on conflict(singleton) do update set flight_id=excluded.flight_id;
 return f;
end $$;

-- Manual cashouts pay the next cent multiplier, matching their surviving grid
-- threshold. Existing flights retain floor/manual and truncated-cent rules.
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
  insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values(u,p_request_id,'crash',v_stake,jsonb_build_object('shared_id',f.id,'auto',target,'rtp',f.rtp,'fair_version',case when f.rtp=1 then 1 else 0 end),jsonb_build_object('point',f.point),jsonb_build_object('starts_at',f.starts_at)) returning * into r;
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
    perform public.casino_finish_decimal(u,r.id,case when r.params->>'fair_version'='1' then public.casino_round_ratio(r.stake*100*mult*100,100) else trunc(r.stake*mult,2) end);
   end if;
  end if;
 end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,r.id,intent);
 return public.casino_snapshot(u)||jsonb_build_object('crash',public.casino_crash_public(u),'round',public.casino_public_round(u,r.id),'replayed',false);
end $$;


revoke all on function public.casino_crash_advance(),public.casino_crash_action(uuid,text,uuid,jsonb),public.casino_random_numeric(numeric),public.casino_round_ratio(numeric,numeric),public.casino_choose(integer,integer),public.casino_plinko_rules(text),public.casino_crash_point_fair(),public.casino_snapshot(uuid),public.casino_sweep_crash(uuid) from public,anon,authenticated;
revoke all on function public.casino_play_plinko_mode(uuid,numeric,text),public.casino_play_plinko(uuid,numeric),public.casino_game_action(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.casino_crash_action(uuid,text,uuid,jsonb),public.casino_play_plinko_mode(uuid,numeric,text),public.casino_play_plinko(uuid,numeric),public.casino_game_action(uuid,text,text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
