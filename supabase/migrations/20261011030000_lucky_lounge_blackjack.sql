-- Apply manually AFTER 20261011020000_lucky_lounge_color_roulette.sql.
-- Classic six-deck Blackjack. Existing balances, rounds and payouts stay intact.
-- No card weighting, bonus, insurance, surrender or split. Dealer stands on soft 17.
begin;

-- A double uses another initial stake; other games keep their original limit.
do $$ declare c record; begin
 for c in select conname from pg_catalog.pg_constraint where conrelid='public.casino_rounds'::regclass and contype='c' and pg_catalog.pg_get_constraintdef(oid) ~ '\mstake\M' loop
  execute format('alter table public.casino_rounds drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.casino_rounds add constraint casino_rounds_stake_check
 check(stake>=1 and (stake<=100000 or (game='blackjack' and stake<=200000)));

-- Only deliberately public completed results go into Realtime. No user UUID,
-- wallet, cards, deck, seed or active-round state is ever replicated here.
create table if not exists public.casino_blackjack_results (
 id uuid primary key default gen_random_uuid(),
 player_name text not null,
 stake numeric(22,2) not null check(stake between 1 and 200000),
 payout numeric(22,2) not null check(payout>=0),
 outcome text not null check(outcome in('blackjack','win','push','loss','bust')),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists casino_blackjack_results_recent on public.casino_blackjack_results(created_at desc);
alter table public.casino_blackjack_results enable row level security;
revoke all on public.casino_blackjack_results from public,anon,authenticated;
grant select on public.casino_blackjack_results to authenticated;
drop policy if exists casino_blackjack_results_read on public.casino_blackjack_results;
create policy casino_blackjack_results_read on public.casino_blackjack_results for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=auth.uid() and not p.is_banned));
alter table public.casino_blackjack_results replica identity full;
do $$ begin
 if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='casino_blackjack_results'
 ) then alter publication supabase_realtime add table public.casino_blackjack_results; end if;
end $$;

-- IDs 0..51: rank = id % 13, suit = id / 13. Deck copies carry identical IDs.
create or replace function public.casino_blackjack_hand(p_cards jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare hard integer:=0; aces integer:=0; rank integer; c jsonb; total integer;
begin
 for c in select value from jsonb_array_elements(p_cards) loop
  rank:=(c#>>'{}')::integer%13+1;
  if rank=1 then aces:=aces+1; hard:=hard+1; else hard:=hard+least(rank,10); end if;
 end loop;
 total:=hard+case when aces>0 and hard<=11 then 10 else 0 end;
 return jsonb_build_object('total',total,'soft',aces>0 and hard<=11,'blackjack',jsonb_array_length(p_cards)=2 and total=21);
end $$;
create or replace function public.casino_blackjack_cards(p_cards jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'rank',(array['A','2','3','4','5','6','7','8','9','10','J','Q','K'])[(c.value#>>'{}')::integer%13+1],
  'suit',(array['clubs','diamonds','hearts','spades'])[(c.value#>>'{}')::integer/13+1]
 ) order by c.ordinality),'[]'::jsonb) from jsonb_array_elements(p_cards) with ordinality c;
$$;
create or replace function public.casino_blackjack_visible_state(p_secret jsonb,p_active boolean,p_base_stake numeric,p_doubled boolean,p_outcome text default null) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb:=p_secret->'player'; d jsonb:=p_secret->'dealer'; ph jsonb; dh jsonb;
begin
 ph:=public.casino_blackjack_hand(p);
 if p_active then d:=jsonb_build_array(d->0); end if;
 dh:=public.casino_blackjack_hand(d);
 return jsonb_build_object(
  'player_cards',public.casino_blackjack_cards(p),
  'dealer_cards',public.casino_blackjack_cards(d)||case when p_active then '[{"hidden":true}]'::jsonb else '[]'::jsonb end,
  'player_total',ph->'total','player_soft',ph->'soft','dealer_total',dh->'total','dealer_soft',dh->'soft',
  'can_double',p_active and jsonb_array_length(p)=2 and not p_doubled and (ph->>'total')::integer<21,
  'base_stake',p_base_stake,'doubled',p_doubled,'outcome',p_outcome
 );
end $$;

-- Preserve the existing Mines reveal and shared Crash embargo. Blackjack state
-- was already sanitized before storage; all remaining cards live only in secret.
create or replace function public.casino_public_round(p_uid uuid,p_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select (to_jsonb(r)-'user_id'-'secret')||case
  when r.status<>'active' and r.game='mines' then jsonb_build_object('mines',r.secret->'mines')
  when r.status<>'active' and r.game='crash' and
   (not(r.params ? 'shared_id') or exists(select 1 from public.casino_crash_flights f where f.id::text=r.params->>'shared_id' and clock_timestamp()>=f.ends_at))
   then jsonb_build_object('crash_point',r.secret->'point')
  else '{}'::jsonb end from public.casino_rounds r where r.user_id=p_uid and r.id=p_id;
$$;

-- Finish once under the user's wallet lock. Public feed and wallet ledger commit
-- in the same transaction, so a failed request can never create a phantom result.
create or replace function public.casino_blackjack_finish(p_uid uuid,p_id uuid,p_secret jsonb,p_outcome text,p_payout numeric,p_doubled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.casino_rounds;
begin
 select * into strict r from public.casino_rounds where user_id=p_uid and id=p_id and game='blackjack' for update;
 if r.status<>'active' then return; end if;
 update public.casino_rounds set secret=p_secret,state=public.casino_blackjack_visible_state(p_secret,false,(r.params->>'base_stake')::numeric,p_doubled,p_outcome)
  where user_id=p_uid and id=p_id;
 perform public.casino_finish_decimal(p_uid,p_id,p_payout);
 insert into public.casino_blackjack_results(player_name,stake,payout,outcome)
  select p.username,r.stake,p_payout,p_outcome from public.profiles p where p.id=p_uid;
end $$;

create or replace function public.casino_blackjack_action(p_request_id uuid,p_action text,p_round_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid; w public.casino_wallets; r public.casino_rounds; prior public.casino_game_requests; intent jsonb;
 v_stake numeric; base_stake numeric; v_secret jsonb; deck integer[]; cursor_pos integer; pick integer; tmp integer;
 player jsonb; dealer jsonb; ph jsonb; dh jsonb; doubled boolean:=false; finish boolean:=false;
 rid uuid; outcome text; payout numeric:=0;
begin
 if p_request_id is null or p_action is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'casino_invalid_request'; end if;
 if p_action not in('start','hit','stand','double') then raise exception 'casino_invalid_action'; end if;
 if (p_action='start' and p_round_id is not null) or exists(select 1 from jsonb_object_keys(p_payload) k where k not in(case when p_action='start' then 'stake' else 'version' end)) then raise exception 'casino_invalid_request'; end if;
 u:=public.casino_require_user();
 select * into strict w from public.casino_wallets where user_id=u for update;
 perform public.casino_sweep_crash(u);
 select * into strict w from public.casino_wallets where user_id=u;
 intent:=jsonb_build_object('game','blackjack','action',p_action,'round',p_round_id,'payload',p_payload);
 select * into prior from public.casino_game_requests where user_id=u and request_id=p_request_id;
 if found then
  if prior.intent<>intent then raise exception 'casino_request_conflict'; end if;
  return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,prior.round_id),'replayed',true);
 end if;
 if exists(select 1 from public.casino_transactions where user_id=u and request_id=p_request_id) then raise exception 'casino_request_conflict'; end if;
 if p_action='start' then
  if exists(select 1 from public.casino_rounds where user_id=u and game='blackjack' and status='active') then raise exception 'casino_invalid_active_round'; end if;
  if coalesce(p_payload->>'stake','') !~ '^[0-9]{1,6}([.][0-9]{1,2})?$' then raise exception 'casino_invalid_bet'; end if;
  v_stake:=(p_payload->>'stake')::numeric; base_stake:=v_stake;
  if v_stake<1 or v_stake>100000 then raise exception 'casino_invalid_bet'; end if;
  if w.chips<v_stake then raise exception 'casino_insufficient_chips'; end if;
  if (select count(*) from public.casino_rounds where user_id=u and game='blackjack' and created_at>clock_timestamp()-interval '10 seconds')>=15 then raise exception 'casino_rate_limit'; end if;
  rid:=p_request_id;
  deck:=array(select i%52 from generate_series(0,311) i);
  for i in reverse 312..2 loop
   pick:=public.casino_random(i)+1; tmp:=deck[i]; deck[i]:=deck[pick]; deck[pick]:=tmp;
  end loop;
  player:=jsonb_build_array(deck[1],deck[3]); dealer:=jsonb_build_array(deck[2],deck[4]); cursor_pos:=5;
  v_secret:=jsonb_build_object('deck',to_jsonb(deck),'cursor',cursor_pos,'player',player,'dealer',dealer);
  ph:=public.casino_blackjack_hand(player); dh:=public.casino_blackjack_hand(dealer);
  insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values(u,rid,'blackjack',v_stake,
   jsonb_build_object('decks',6,'dealer_soft17','stand','natural_payout','3:2','double','initial_two','base_stake',v_stake),v_secret,
   public.casino_blackjack_visible_state(v_secret,true,base_stake,false));
  update public.casino_wallets set chips=chips-v_stake,rounds=rounds+1,total_wagered=total_wagered+v_stake,tracked_wagered=tracked_wagered+v_stake,revision=revision+1 where user_id=u;
  if (ph->>'blackjack')::boolean or (dh->>'blackjack')::boolean then
   finish:=true;
   if (ph->>'blackjack')::boolean and (dh->>'blackjack')::boolean then outcome:='push'; payout:=v_stake;
   elsif (ph->>'blackjack')::boolean then outcome:='blackjack'; payout:=public.casino_round_ratio(v_stake*100*5,2);
   else outcome:='loss'; payout:=0; end if;
  end if;
 else
  rid:=p_round_id;
  select * into r from public.casino_rounds where user_id=u and id=rid and game='blackjack' for update;
  if not found or r.status<>'active' then raise exception 'casino_invalid_round'; end if;
  if (p_payload->>'version') is distinct from r.version::text then raise exception 'casino_invalid_state'; end if;
  v_secret:=r.secret; deck:=array(select value::integer from jsonb_array_elements_text(v_secret->'deck'));
  cursor_pos:=(v_secret->>'cursor')::integer; player:=v_secret->'player'; dealer:=v_secret->'dealer';
  base_stake:=(r.params->>'base_stake')::numeric; v_stake:=r.stake; doubled:=(r.state->>'doubled')::boolean;
  if p_action='double' then
   if not (r.state->>'can_double')::boolean then raise exception 'casino_invalid_state'; end if;
   if w.chips<base_stake then raise exception 'casino_insufficient_chips'; end if;
   doubled:=true; v_stake:=v_stake+base_stake;
   update public.casino_rounds set stake=v_stake where user_id=u and id=rid;
   update public.casino_wallets set chips=chips-base_stake,total_wagered=total_wagered+base_stake,tracked_wagered=tracked_wagered+base_stake,revision=revision+1 where user_id=u;
  end if;
  if p_action in('hit','double') then
   if cursor_pos>array_length(deck,1) then raise exception 'casino_invalid_state'; end if;
   player:=player||jsonb_build_array(deck[cursor_pos]); cursor_pos:=cursor_pos+1;
  end if;
  ph:=public.casino_blackjack_hand(player);
  if (ph->>'total')::integer>21 then finish:=true; outcome:='bust'; payout:=0;
  elsif p_action in('stand','double') or (ph->>'total')::integer=21 then
   finish:=true; dh:=public.casino_blackjack_hand(dealer);
   while (dh->>'total')::integer<17 loop
    if cursor_pos>array_length(deck,1) then raise exception 'casino_invalid_state'; end if;
    dealer:=dealer||jsonb_build_array(deck[cursor_pos]); cursor_pos:=cursor_pos+1;
    dh:=public.casino_blackjack_hand(dealer);
   end loop;
   if (dh->>'total')::integer>21 or (ph->>'total')::integer>(dh->>'total')::integer then outcome:='win'; payout:=v_stake*2;
   elsif (ph->>'total')::integer=(dh->>'total')::integer then outcome:='push'; payout:=v_stake;
   else outcome:='loss'; payout:=0; end if;
  end if;
  v_secret:=jsonb_build_object('deck',to_jsonb(deck),'cursor',cursor_pos,'player',player,'dealer',dealer);
  if not finish then
   update public.casino_rounds set secret=v_secret,state=public.casino_blackjack_visible_state(v_secret,true,base_stake,doubled),version=version+1 where user_id=u and id=rid;
   update public.casino_wallets set revision=revision+1 where user_id=u;
  end if;
 end if;
 if finish then perform public.casino_blackjack_finish(u,rid,v_secret,outcome,payout,doubled); end if;
 insert into public.casino_game_requests(user_id,request_id,round_id,intent) values(u,p_request_id,rid,intent);
 return public.casino_snapshot(u)||jsonb_build_object('round',public.casino_public_round(u,rid),'replayed',false);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'casino_invalid_bet';
end $$;

create or replace function public.casino_blackjack_feed() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); results jsonb;
begin
 if u is null then raise exception 'casino_login_required'; end if;
 if not exists(select 1 from public.profiles where id=u and not is_banned) then raise exception 'casino_account_banned'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into results
 from(select id,player_name,stake,payout,outcome,created_at from public.casino_blackjack_results order by created_at desc limit 30) r;
 return results;
end $$;
revoke all on function public.casino_blackjack_hand(jsonb),public.casino_blackjack_cards(jsonb),public.casino_blackjack_visible_state(jsonb,boolean,numeric,boolean,text),public.casino_public_round(uuid,uuid),public.casino_blackjack_finish(uuid,uuid,jsonb,text,numeric,boolean),public.casino_blackjack_action(uuid,text,uuid,jsonb),public.casino_blackjack_feed() from public,anon,authenticated;
grant execute on function public.casino_blackjack_action(uuid,text,uuid,jsonb),public.casino_blackjack_feed() to authenticated;
notify pgrst,'reload schema';
commit;
