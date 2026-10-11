import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createCasinoTestDb,rpc,projectRoot} from './lucky-casino-test-db.mjs';
const db=await createCasinoTestDb({through:'20261011030000'});
try {
 const oldDino=randomUUID();
 await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[oldDino,'dino','start',null,{stake:10,difficulty:'easy'}]);
 const oldRoulette=await rpc(db,'public.casino_roulette_state()');
 const blackjackBefore=(await db.query("select pg_get_functiondef('public.casino_blackjack_action(uuid,text,uuid,jsonb)'::regprocedure) as definition")).rows[0].definition;
 const migration=await fs.readFile(`${projectRoot}/supabase/migrations/20261011040000_lucky_lounge_game_returns.sql`,'utf8');
 await db.exec(migration);
 assert.equal((await db.query('select params from public.casino_rounds where id=$1',[oldDino])).rows[0].params.rtp,1);
 assert.equal((await rpc(db,'public.casino_roulette_state()')).roulette.round.red_black_multiplier,oldRoulette.roulette.round.red_black_multiplier??200/99);
 assert.equal((await db.query("select pg_get_functiondef('public.casino_blackjack_action(uuid,text,uuid,jsonb)'::regprocedure) as definition")).rows[0].definition,blackjackBefore);
 for(const mode of ['easy','normal','hard']) {
  const result=(await db.query("select sum(public.casino_choose((r->>'rows')::int,k)*(r->'weights'->>k)::numeric*power(2::numeric,(r->>'rows')::int)/(r->>'denominator')::numeric/power(2::numeric,(r->>'rows')::int)) as expectation from (select public.casino_plinko_rules($1) r) rules cross join lateral generate_series(0,(r->>'rows')::int) k",[mode])).rows[0];
  assert(Math.abs(Number(result.expectation)-1.01)<1e-12);
 }
 await db.exec("update public.casino_rounds set status='cancelled' where id='"+oldDino+"'; update public.casino_game_requests set created_at=clock_timestamp()-interval '2 seconds';");
 let result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'dino','start',null,{stake:10,difficulty:'easy'}]);
 assert.equal(result.round.params.rtp,1.01);
 const dinoId=result.round.id;
 await db.exec('create or replace function public.casino_random(p_max integer) returns integer language sql volatile as $$select 0$$');
 result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'dino','jump',dinoId,{version:0}]);
 assert(Math.abs(result.round.state.multiplier-1.01/.85)<1e-12);
 result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'dino','cashout',dinoId,{version:1}]);
 assert.equal(result.round.payout,11.89);
 let crash=await rpc(db,'public.casino_crash_state()');
 assert.equal(crash.crash.flight.payout_factor,1.01);
 const crashId=randomUUID();
 await db.exec("update public.casino_game_requests set created_at=clock_timestamp()-interval '2 seconds'");
 await rpc(db,'public.casino_crash_action($1,$2,$3,$4)',[crashId,'start',crash.crash.flight.id,{stake:10,auto:2}]);
 await db.query("update public.casino_crash_flights set starts_at=clock_timestamp()-interval '8 seconds',point=2,ends_at=clock_timestamp()-interval '1 second' where id=$1",[crash.crash.flight.id]);
 await db.query("update public.casino_rounds set secret=jsonb_build_object('point',2),state=state||jsonb_build_object('starts_at',clock_timestamp()-interval '8 seconds') where id=$1",[crashId]);
 crash=await rpc(db,'public.casino_crash_state()');
 assert.equal(crash.crash.own_round.payout,20.20);
 const oldId=oldRoulette.roulette.round.id;
 await db.query("update public.casino_roulette_rounds set betting_ends_at=clock_timestamp()-interval '20 seconds',spin_ends_at=clock_timestamp()-interval '12 seconds',result_ends_at=clock_timestamp()-interval '7 seconds' where id=$1",[oldId]);
 const roulette=await rpc(db,'public.casino_roulette_state()');assert.equal(roulette.roulette.round.red_black_multiplier,2);
 const red=randomUUID(),green=randomUUID();
 await rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[red,roulette.roulette.round.id,'red',1.01]);
 await rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[green,roulette.roulette.round.id,'green',1]);
 await db.query("update public.casino_roulette_rounds set outcome='red',landing_index=1,betting_ends_at=clock_timestamp()-interval '10 seconds',spin_ends_at=clock_timestamp()-interval '2 seconds',result_ends_at=clock_timestamp()+interval '3 seconds' where id=$1",[roulette.roulette.round.id]);
 result=await rpc(db,'public.casino_roulette_state()');assert.equal(result.roulette.players.find(p=>p.id===red).payout,2.02);assert.equal(result.roulette.players.find(p=>p.id===green).payout,0);
 const ledger=(await db.query('select * from public.casino_transactions order by request_id')).rows;
 await db.exec(migration);assert.deepEqual((await db.query('select * from public.casino_transactions order by request_id')).rows,ledger);
 console.log('Returns: exact Plinko expectations; Dino/Crash payouts; Roulette 2x; old rounds and Blackjack preserved; idempotent migration passed.');
} finally {await db.close();}
