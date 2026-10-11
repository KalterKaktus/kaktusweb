-- Apply manually AFTER 20261011040000_lucky_lounge_game_returns.sql.
-- Free virtual chips only. Signed slider chooses side and 1..95% chance.
-- Existing wallets, rounds and transaction history are retained.
begin;
alter table public.casino_transactions drop constraint if exists casino_transactions_kind_check;
alter table public.casino_transactions add constraint casino_transactions_kind_check
 check(kind in('daily','bonus','plinko','mines','crash','dino','roulette','blackjack','coinflip'));
alter table public.casino_rounds drop constraint if exists casino_rounds_game_check;
alter table public.casino_rounds add constraint casino_rounds_game_check
 check(game in('mines','crash','dino','roulette','blackjack','coinflip'));

create or replace function public.casino_coinflip_rules(p_position integer) returns jsonb
language plpgsql immutable set search_path='' as $$
declare chance integer;
begin
 if p_position is null or p_position not between -95 and 95 then raise exception 'casino_invalid_bet'; end if;
 chance:=greatest(1,abs(p_position));
 return jsonb_build_object('side',case when p_position<=0 then 'heads' else 'tails' end,
  'chance',chance,'multiplier',100::numeric/chance,'rtp',1);
end $$;

create or replace function public.casino_play_coinflip(p_request_id uuid,p_stake numeric,p_position integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; w public.casino_wallets; prior public.casino_game_requests;
 rules jsonb; intent jsonb; side text; result text; chance integer; draw integer; amount numeric;
begin
 if p_request_id is null or p_stake is null or p_stake<1 or p_stake>100000 or p_stake<>trunc(p_stake,2) then raise exception 'casino_invalid_bet'; end if;
 rules:=public.casino_coinflip_rules(p_position);
 side:=rules->>'side';chance:=(rules->>'chance')::integer;
 u:=public.casino_require_user();select * into strict w from public.casino_wallets where user_id=u for update;
 intent:=jsonb_build_object('game','coinflip','action','flip','stake',p_stake,'position',p_position);
 select * into prior from public.casino_game_requests where user_id=u and request_id=p_request_id;
 if found then
  if prior.intent<>intent then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,prior.round_id),'replayed',true);
 end if;
 if exists(select 1 from public.casino_transactions where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 if w.chips<p_stake then raise exception 'casino_insufficient_chips'; end if;
 if(select count(*) from public.casino_game_requests req where req.user_id=u and req.intent->>'game'='coinflip' and req.created_at>clock_timestamp()-interval '1 second')>=10 then raise exception 'casino_rate_limit'; end if;
 draw:=public.casino_random(100);
 result:=case when draw<case when side='heads' then chance else 100-chance end then 'heads' else 'tails' end;
 amount:=case when result=side then public.casino_round_ratio(p_stake*100*100,chance) else 0 end;
 insert into public.casino_rounds(user_id,id,game,stake,params,state)
 values(u,p_request_id,'coinflip',p_stake,rules||jsonb_build_object('position',p_position,'fair_version',1),
  jsonb_build_object('outcome',result,'side',side,'chance',chance,'multiplier',(rules->>'multiplier')::numeric));
 update public.casino_wallets set chips=chips-p_stake,rounds=rounds+1,total_wagered=total_wagered+p_stake,
  tracked_wagered=tracked_wagered+p_stake,revision=revision+1 where user_id=u;
 perform public.casino_finish_decimal(u,p_request_id,amount);
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,p_request_id,intent);
 return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,p_request_id),'replayed',false);
end $$;

revoke all on function public.casino_coinflip_rules(integer),public.casino_play_coinflip(uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.casino_play_coinflip(uuid,numeric,integer) to authenticated;
notify pgrst,'reload schema';
commit;
