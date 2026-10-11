import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {createCasinoTestDb,rpc,projectRoot,loginTestUser} from './lucky-casino-test-db.mjs';
import {coinflipRules} from '../games/LuckyLounge/app/src/components/CoinflipGame/coinflipRules.js';
const db=await createCasinoTestDb();
try {
 for(let position=-95;position<=95;position++){
  const expected=coinflipRules(position),rules=await rpc(db,'public.casino_coinflip_rules($1)',[position]);
  assert.equal(rules.chance,expected.chance);assert.equal(rules.side,expected.side);
  assert(Math.abs(Number(rules.multiplier)-expected.multiplier)<1e-12);
  assert(Math.abs(rules.chance/100*Number(rules.multiplier)-1)<1e-12);
 }
 await assert.rejects(()=>rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),.99,-50]),/casino_invalid_bet/);
 await assert.rejects(()=>rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),1,96]),/casino_invalid_bet/);
 await assert.rejects(()=>rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),100000,-50]),/casino_insufficient_chips/);
 await db.exec('create or replace function public.casino_random(p_max integer) returns integer language sql volatile as $$select 0$$');
 const id=randomUUID(),before=await rpc(db,'public.casino_get_wallet()');
 let result=await rpc(db,'public.casino_play_coinflip($1,$2,$3)',[id,1.01,-50]);
 assert.equal(result.round.game,'coinflip');assert.equal(result.round.state.outcome,'heads');assert.equal(result.round.status,'won');assert.equal(result.round.payout,2.02);
 assert.equal(result.wallet.chips,before.wallet.chips+1.01);assert.equal(result.wallet.rounds,before.wallet.rounds+1);assert(!('secret' in result.round));
 const replay=await rpc(db,'public.casino_play_coinflip($1,$2,$3)',[id,1.01,-50]);assert.equal(replay.replayed,true);assert.equal(replay.wallet.revision,result.wallet.revision);
 await assert.rejects(()=>rpc(db,'public.casino_play_coinflip($1,$2,$3)',[id,1.01,50]),/casino_request_conflict/);
 result=await rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),1,50]);assert.equal(result.round.status,'lost');assert.equal(result.round.state.outcome,'heads');assert.equal(result.round.payout,0);
 await db.exec('create or replace function public.casino_random(p_max integer) returns integer language sql volatile as $$select p_max-1$$');
 result=await rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),1,1]);assert.equal(result.round.status,'won');assert.equal(result.round.state.outcome,'tails');assert.equal(result.round.payout,100);
 result=await rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),1,-95]);assert.equal(result.round.status,'lost');
 assert.equal((await db.query("select count(*)::integer n from public.casino_transactions where kind='coinflip'")).rows[0].n,4);
 const privileges=(await db.query("select has_function_privilege('authenticated','public.casino_play_coinflip(uuid,numeric,integer)','execute') as play,has_function_privilege('anon','public.casino_play_coinflip(uuid,numeric,integer)','execute') as anon,has_function_privilege('authenticated','public.casino_coinflip_rules(integer)','execute') as rules")).rows[0];assert.deepEqual(privileges,{play:true,anon:false,rules:false});
 const ledger=(await db.query('select * from public.casino_transactions order by request_id')).rows;
 await db.exec(await fs.readFile(`${projectRoot}/supabase/migrations/20261011050000_lucky_lounge_coinflip.sql`,'utf8'));
 assert.deepEqual((await db.query('select * from public.casino_transactions order by request_id')).rows,ledger);
 await loginTestUser(db,null);await assert.rejects(()=>rpc(db,'public.casino_play_coinflip($1,$2,$3)',[randomUUID(),1,-50]),/casino_login_required/);
 console.log('Coinflip: all slider rules, exact chances/payouts, win/loss boundaries, minimum stake, insufficient funds, replay/conflicts, grants and migration preservation passed.');
}finally{await db.close();}
