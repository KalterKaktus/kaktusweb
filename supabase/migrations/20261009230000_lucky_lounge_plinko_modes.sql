-- Apply manually AFTER 20261009220000_lucky_lounge_decimal_chips.sql.
-- No balance conversions or historical re-settlement. Legacy RPCs remain for
-- recovery of already submitted requests; new clients use the mode endpoint.
begin;
-- Widen only the old eight-row field constraint; retain all existing records.
do $$ declare v_constraint text; begin
 for v_constraint in select conname from pg_constraint
  where conrelid='public.casino_transactions'::regclass and contype='c'
   and pg_get_constraintdef(oid) ~ '\mslot\M'
 loop execute format('alter table public.casino_transactions drop constraint %I',v_constraint); end loop;
end $$;
alter table public.casino_transactions add constraint casino_transactions_slot_check
 check(slot is null or slot between 0 and 16);
create or replace function public.casino_play_plinko_mode(
 p_request_id uuid, p_stake numeric, p_difficulty text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid; v_wallet public.casino_wallets; v_tx public.casino_transactions;
 v_rows integer; v_risk text; v_mult numeric[]; v_random bytea;
 v_slot integer := 0; v_bits jsonb := '[]'; v_bit integer; v_payout numeric;
begin
 if p_request_id is null or p_stake is null or p_stake<1 or p_stake>100000
    or p_stake<>trunc(p_stake,2) then raise exception 'casino_invalid_bet'; end if;
 -- Fixed, symmetric OpenStake payout tables. Browser cannot submit a factor,
 -- result, row count, RNG seed, probability, or payout.
 case p_difficulty
 when 'easy' then
  v_rows:=8; v_risk:='low';
  v_mult:=array[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6];
 when 'normal' then
  v_rows:=12; v_risk:='medium';
  v_mult:=array[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33];
 when 'hard' then
  v_rows:=16; v_risk:='high';
  v_mult:=array[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000];
 else raise exception 'casino_invalid_bet';
 end case;
 v_uid:=public.casino_require_user();
 select * into strict v_wallet from public.casino_wallets where user_id=v_uid for update;
 select * into v_tx from public.casino_transactions where user_id=v_uid and request_id=p_request_id;
 if found then
  if v_tx.kind<>'plinko' or v_tx.stake<>p_stake
     or (v_tx.path->>'difficulty') is distinct from p_difficulty then
   raise exception 'casino_request_conflict';
  end if;
  return public.casino_snapshot(v_uid)||jsonb_build_object('round',to_jsonb(v_tx)-'user_id','replayed',true);
 end if;
 if exists(select 1 from public.casino_game_requests where user_id=v_uid and request_id=p_request_id) then
  raise exception 'casino_request_conflict';
 end if;
 if v_wallet.chips<p_stake then raise exception 'casino_insufficient_chips'; end if;
 -- Permit quick bursts. The wallet lock makes this rolling abuse limit atomic;
 -- no per-ball 180 ms cooldown. Idempotent retries above never consume it.
 if (select count(*) from public.casino_transactions where user_id=v_uid and kind='plinko'
     and created_at>clock_timestamp()-interval '1 second')>=60 then
  raise exception 'casino_rate_limit';
 end if;
 -- UUID bytes 0 and 1 are independent cryptographic random bits, unaffected
 -- by UUID version/variant bits. Bin k has probability C(rows,k)/2^rows.
 v_random:=decode(replace(gen_random_uuid()::text,'-',''),'hex');
 for i in 0..v_rows-1 loop
  v_bit:=(get_byte(v_random,i/8)>>(i%8))&1;
  v_slot:=v_slot+v_bit; v_bits:=v_bits||jsonb_build_array(v_bit);
 end loop;
 v_payout:=trunc(p_stake*v_mult[v_slot+1],2);
 if v_wallet.chips-p_stake+v_payout>9007199254740991 then raise exception 'casino_balance_limit'; end if;
 insert into public.casino_transactions(user_id,request_id,kind,stake,payout,slot,path)
 values(v_uid,p_request_id,'plinko',p_stake,v_payout,v_slot,
  jsonb_build_object('bits',v_bits,'difficulty',p_difficulty,'rows',v_rows,'risk',v_risk,'multiplier',v_mult[v_slot+1]))
 returning * into v_tx;
 update public.casino_wallets set chips=chips-p_stake+v_payout,
  rounds=rounds+1,biggest_win=greatest(biggest_win,v_payout),
  total_wagered=total_wagered+p_stake,total_won=total_won+v_payout,
  tracked_wagered=tracked_wagered+p_stake,tracked_won=tracked_won+v_payout,
  revision=revision+1 where user_id=v_uid;
 return public.casino_snapshot(v_uid)||jsonb_build_object('round',to_jsonb(v_tx)-'user_id','replayed',false);
end $$;
revoke all on function public.casino_play_plinko_mode(uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.casino_play_plinko_mode(uuid,numeric,text) to authenticated;
notify pgrst,'reload schema';
commit;
