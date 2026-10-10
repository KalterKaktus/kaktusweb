-- Manual, AFTER V2 and the Originals migration. Never rescales or resets balances.
-- Exact decimal arithmetic, two fractional chip digits. Existing request IDs,
-- results and settled payouts stay unchanged; only new settlements use cents.
begin;
alter table public.casino_wallets
 alter column chips type numeric(22,2), alter column biggest_win type numeric(22,2),
 alter column total_wagered type numeric(22,2), alter column total_won type numeric(22,2),
 alter column tracked_wagered type numeric(22,2), alter column tracked_won type numeric(22,2);
alter table public.casino_transactions alter column stake type numeric(22,2),alter column payout type numeric(22,2);
alter table public.casino_rounds alter column stake type numeric(22,2),alter column payout type numeric(22,2);
-- Avoid a PostgREST overload with the same named arguments. Keep the old
-- implementation privately for provenance; browsers cannot call it.
do $$ begin
 if to_regprocedure('public.casino_play_plinko(uuid,bigint)') is not null then
  alter function public.casino_play_plinko(uuid,bigint) rename to casino_play_plinko_integer_legacy;
 end if;
end $$;
revoke all on function public.casino_play_plinko_integer_legacy(uuid,bigint) from public,anon,authenticated;
create or replace function public.casino_finish_decimal(p_uid uuid,p_id uuid,p_payout numeric) returns void
language plpgsql security definer set search_path='' as $$
declare r public.casino_rounds; balance numeric;
begin
 select * into strict r from public.casino_rounds where user_id=p_uid and id=p_id for update;
 if r.status<>'active' then return; end if;
 select chips into balance from public.casino_wallets where user_id=p_uid for update;
 if p_payout<>trunc(p_payout,2) or p_payout<0 or p_payout>9007199254740991-balance then raise exception 'casino_balance_limit'; end if;
 update public.casino_rounds set status=case when p_payout>0 then 'won' else 'lost' end,payout=p_payout,version=version+1 where user_id=p_uid and id=p_id;
 update public.casino_wallets set chips=chips+p_payout,total_won=total_won+p_payout,tracked_won=tracked_won+p_payout,
  biggest_win=greatest(biggest_win,p_payout),revision=revision+1 where user_id=p_uid;
 insert into public.casino_transactions(user_id,request_id,kind,stake,payout,path)
  values(p_uid,p_id,r.game,r.stake,p_payout,r.state);
end $$;
create or replace function public.casino_sweep_crash(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.casino_rounds; elapsed double precision; point numeric; target numeric;
begin
 select * into r from public.casino_rounds where user_id=p_uid and game='crash' and status='active' for update;
 if not found then return; end if;
 elapsed:=greatest(0,extract(epoch from(clock_timestamp()-(r.state->>'starts_at')::timestamptz)));
 point:=(r.secret->>'point')::numeric; target:=(r.params->>'auto')::numeric;
 -- A precommitted auto-cashout at a tied crash point wins; manual requests at/after crash lose.
 if target is not null and target<=point and elapsed>=ln(target::double precision)/0.1 then
  update public.casino_rounds set state=state||jsonb_build_object('cashout',target) where user_id=p_uid and id=r.id;
  perform public.casino_finish_decimal(p_uid,r.id,trunc(r.stake*target,2));
 elsif elapsed>=ln(point::double precision)/0.1 and clock_timestamp()>=(r.state->>'starts_at')::timestamptz then
  perform public.casino_finish_decimal(p_uid,r.id,0);
 end if;
end $$;
create or replace function public.casino_snapshot(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'currency_decimals',2,'wallet',to_jsonb(w)-'legacy_snapshot'-'user_id','server_now',clock_timestamp(),
 'daily_available',w.last_claim_day is distinct from(clock_timestamp() at time zone 'Europe/Berlin')::date,
 'next_daily_at',(((clock_timestamp() at time zone 'Europe/Berlin')::date+1)::timestamp at time zone 'Europe/Berlin'),
 'active_rounds',coalesce((select jsonb_agg(public.casino_public_round(p_uid,r.id)) from public.casino_rounds r where r.user_id=p_uid and r.status='active'),'[]'::jsonb),
 'latest_rounds',coalesce((select jsonb_agg(public.casino_public_round(p_uid,r.id)) from (select distinct on(game) * from public.casino_rounds where user_id=p_uid order by game,created_at desc) r),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
 select request_id,kind as game,stake,payout,slot,path,created_at from public.casino_transactions where user_id=p_uid and kind<>'daily' order by created_at desc limit 12
 )r),'[]'::jsonb)) from public.casino_wallets w where w.user_id=p_uid;
$$;
create or replace function public.casino_game_action(p_request_id uuid,p_game text,p_action text,p_round_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid; w public.casino_wallets; r public.casino_rounds; prior public.casino_game_requests;
 intent jsonb; stake numeric; count integer; tile integer; cleared integer; chance integer; mult numeric;
 mines integer[]:='{}'; pool integer[]:=array(select generate_series(0,24)); pick integer; tmp integer;
 point numeric; target numeric; elapsed double precision; rid uuid;
begin
 if p_request_id is null or p_game is null or p_action is null or p_game not in ('mines','crash','dino') or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'casino_invalid_request'; end if;
 u:=public.casino_require_user();
 select * into strict w from public.casino_wallets where user_id=u for update;
 perform public.casino_sweep_crash(u);
 select * into strict w from public.casino_wallets where user_id=u;
 intent:=jsonb_build_object('game',p_game,'action',p_action,'round',p_round_id,'payload',p_payload);
 select * into prior from public.casino_game_requests where user_id=u and request_id=p_request_id;
 if found then
  if prior.intent<>intent then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,prior.round_id),'replayed',true);
 end if;
 if exists(select 1 from public.casino_transactions where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 if p_action='start' then
  if exists(select 1 from public.casino_rounds where user_id=u and game=p_game and status='active') then raise exception 'casino_invalid_active_round'; end if;
  if (p_payload->>'stake') is null or (p_payload->>'stake') !~ '^[0-9]{1,6}([.][0-9]{1,2})?$' then raise exception 'casino_invalid_bet'; end if;
  stake:=(p_payload->>'stake')::numeric;
  if stake<1 or stake>100000 then raise exception 'casino_invalid_bet'; end if;
  if w.chips<stake then raise exception 'casino_insufficient_chips'; end if;
  if exists(select 1 from public.casino_game_requests where user_id=u and created_at>clock_timestamp()-interval '180 milliseconds') then raise exception 'casino_rate_limit'; end if;
  rid:=p_request_id;
  if p_game='mines' then
   if coalesce(p_payload->>'mines','') !~ '^([1-9]|1[0-9]|2[0-4])$' then raise exception 'casino_invalid_bet'; end if;
   count:=(p_payload->>'mines')::integer;
   for i in reverse 25..2 loop
    pick:=public.casino_random(i)+1; tmp:=pool[i]; pool[i]:=pool[pick]; pool[pick]:=tmp;
   end loop;
   mines:=pool[1:count];
   insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values(u,rid,p_game,stake,jsonb_build_object('mines',count),jsonb_build_object('mines',to_jsonb(mines)),jsonb_build_object('revealed','[]'::jsonb,'cleared',0,'multiplier',1,'potential',stake));
  elsif p_game='dino' then
   chance:=case p_payload->>'difficulty' when 'easy' then 85 when 'medium' then 65 when 'hard' then 45 else 0 end;
   if chance=0 then raise exception 'casino_invalid_bet'; end if;
   insert into public.casino_rounds(user_id,id,game,stake,params,state) values(u,rid,p_game,stake,jsonb_build_object('difficulty',p_payload->>'difficulty','chance',chance,'max_steps',12),jsonb_build_object('cleared',0,'multiplier',1,'potential',stake,'next_action_at',clock_timestamp()));
  else
   target:=nullif(p_payload->>'auto','')::numeric;
   if target is not null and (target<1.01 or target>1000 or target<>trunc(target,2)) then raise exception 'casino_invalid_bet'; end if;
   point:=greatest(1,least(1000,floor(0.99/(1-public.casino_random(1000000000)::numeric/1000000000)*100)/100));
   insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values(u,rid,p_game,stake,jsonb_build_object('auto',target),jsonb_build_object('point',point),jsonb_build_object('starts_at',clock_timestamp()+interval '2 seconds'));
  end if;
  update public.casino_wallets set chips=chips-stake,rounds=rounds+1,total_wagered=total_wagered+stake,tracked_wagered=tracked_wagered+stake,revision=revision+1 where user_id=u;
 else
  rid:=p_round_id;
  select * into r from public.casino_rounds where user_id=u and id=rid and game=p_game for update;
  if not found then raise exception 'casino_invalid_round'; end if;
  if r.status<>'active' then
   if p_game='crash' and p_action='cashout' then
    insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,rid,intent);
    return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,rid),'replayed',false);
   end if;
   raise exception 'casino_invalid_round';
  end if;
  if (p_payload->>'version') is distinct from r.version::text then raise exception 'casino_invalid_state'; end if;
  cleared:=coalesce((r.state->>'cleared')::integer,0);
  if p_action='cancel' and cleared=0 and (p_game<>'crash' or clock_timestamp()<(r.state->>'starts_at')::timestamptz) then
   update public.casino_rounds set status='cancelled',payout=r.stake,version=version+1 where user_id=u and id=rid;
   update public.casino_wallets set chips=chips+r.stake,rounds=rounds-1,total_wagered=total_wagered-r.stake,tracked_wagered=tracked_wagered-r.stake,revision=revision+1 where user_id=u;
  elsif p_action='cashout' then
   if p_game='crash' then
    elapsed:=extract(epoch from(clock_timestamp()-(r.state->>'starts_at')::timestamptz));
    if elapsed<0 then raise exception 'casino_invalid_state'; end if;
    -- Recheck the same fresh timestamp used for manual payout: the crash/auto
    -- threshold can be crossed between the sweep and this branch.
    point:=(r.secret->>'point')::numeric;target:=(r.params->>'auto')::numeric;
    if target is not null and target<=point and elapsed>=ln(target::double precision)/0.1 then mult:=target;
    elsif elapsed>=ln(point::double precision)/0.1 then mult:=0;
    else mult:=floor(exp(least(elapsed,70)*0.1)*100)/100; end if;
   else
    if cleared=0 then raise exception 'casino_invalid_state'; end if;
    mult:=(r.state->>'multiplier')::numeric;
   end if;
   update public.casino_rounds set state=state||jsonb_build_object('cashout',mult) where user_id=u and id=rid;
   perform public.casino_finish_decimal(u,rid,trunc(r.stake*mult,2));
  elsif p_action='reveal' and p_game='mines' then
   if coalesce(p_payload->>'tile','') !~ '^([0-9]|1[0-9]|2[0-4])$' then raise exception 'casino_invalid_request'; end if;
   tile:=(p_payload->>'tile')::integer;
   if r.state->'revealed' @> jsonb_build_array(tile) then raise exception 'casino_invalid_state'; end if;
   update public.casino_rounds set state=state||jsonb_build_object('revealed',(state->'revealed')||jsonb_build_array(tile),'last_tile',tile),version=version+1 where user_id=u and id=rid;
   if r.secret->'mines' @> jsonb_build_array(tile) then perform public.casino_finish_decimal(u,rid,0);
   else
    mult:=0.99; count:=(r.params->>'mines')::integer;
    for i in 0..cleared loop mult:=mult*(25-i)/(25-count-i); end loop;
    update public.casino_rounds set state=state||jsonb_build_object('cleared',cleared+1,'multiplier',mult,'potential',trunc(r.stake*mult,2)) where user_id=u and id=rid;
    if cleared+1=25-count then perform public.casino_finish_decimal(u,rid,trunc(r.stake*mult,2)); end if;
   end if;
   update public.casino_wallets set revision=revision+1 where user_id=u;
  elsif p_action='jump' and p_game='dino' then
   if clock_timestamp()<(r.state->>'next_action_at')::timestamptz then raise exception 'casino_rate_limit'; end if;
   if public.casino_random(100)<(r.params->>'chance')::integer then
    mult:=floor(0.99/power((r.params->>'chance')::numeric/100,cleared+1)*100)/100;
    update public.casino_rounds set state=state||jsonb_build_object('cleared',cleared+1,'multiplier',mult,'potential',trunc(r.stake*mult,2),'next_action_at',clock_timestamp()+interval '500 milliseconds'),version=version+1 where user_id=u and id=rid;
    if cleared+1=12 then perform public.casino_finish_decimal(u,rid,trunc(r.stake*mult,2)); end if;
   else perform public.casino_finish_decimal(u,rid,0); end if;
   update public.casino_wallets set revision=revision+1 where user_id=u;
  else raise exception 'casino_invalid_action'; end if;
 end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,rid,intent);
 return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,rid),'replayed',false);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'casino_invalid_bet';
end $$;
create or replace function public.casino_play_plinko(p_request_id uuid, p_stake numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; v_wallet public.casino_wallets; v_tx public.casino_transactions;
  v_random integer; v_slot integer := 0; v_path jsonb := '[]'; v_bit integer;
  v_mult numeric[] := array[0.2,0.4,0.7,1,1.2,1,0.7,0.4,0.2]; v_payout numeric;
begin
  if p_request_id is null or p_stake is null or p_stake < 1 or p_stake > 100000 or p_stake<>trunc(p_stake,2) then
    raise exception 'casino_invalid_bet';
  end if;
  v_uid := public.casino_require_user();
  select * into strict v_wallet from public.casino_wallets where user_id = v_uid for update;
  select * into v_tx from public.casino_transactions where user_id = v_uid and request_id = p_request_id;
  if found then
    if v_tx.kind <> 'plinko' or v_tx.stake <> p_stake then raise exception 'casino_request_conflict'; end if;
    return public.casino_snapshot(v_uid) || jsonb_build_object('round', to_jsonb(v_tx) - 'user_id', 'replayed', true);
  end if;
  if exists(select 1 from public.casino_game_requests where user_id=v_uid and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
  if v_wallet.chips < p_stake then raise exception 'casino_insufficient_chips'; end if;
  if exists (select 1 from public.casino_transactions where user_id = v_uid and kind = 'plinko'
    and created_at > clock_timestamp() - interval '180 milliseconds') then
    raise exception 'casino_rate_limit';
  end if;
  -- First byte of a cryptographic v4 UUID: eight independent, unbiased bits.
  -- Neither the request ID nor any browser-provided seed determines the outcome.
  v_random := get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0);
  for i in 0..7 loop
    v_bit := (v_random >> i) & 1;
    v_slot := v_slot + v_bit;
    v_path := v_path || jsonb_build_array(v_bit);
  end loop;
  v_payout := trunc(p_stake * v_mult[v_slot + 1],2);
  if v_wallet.chips - p_stake + v_payout > 9007199254740991 then raise exception 'casino_balance_limit'; end if;
  insert into public.casino_transactions(user_id, request_id, kind, stake, payout, slot, path)
    values (v_uid, p_request_id, 'plinko', p_stake, v_payout, v_slot, v_path) returning * into v_tx;
  -- Stake + full payout + history in ONE transaction. Closing a tab cannot lose
  -- an unsettled win; the animation never participates in financial settlement.
  update public.casino_wallets set chips = chips - p_stake + v_payout,
    rounds = rounds + 1, biggest_win = greatest(biggest_win, v_payout),
    total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
    tracked_wagered = tracked_wagered + p_stake, tracked_won = tracked_won + v_payout,
    revision = revision + 1 where user_id = v_uid;
  return public.casino_snapshot(v_uid) || jsonb_build_object('round', to_jsonb(v_tx) - 'user_id', 'replayed', false);
end $$;
revoke all on function public.casino_finish_decimal(uuid,uuid,numeric),public.casino_play_plinko(uuid,numeric) from public,anon,authenticated;
grant execute on function public.casino_play_plinko(uuid,numeric) to authenticated;
notify pgrst,'reload schema';
commit;
