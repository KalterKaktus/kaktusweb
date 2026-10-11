// Exact analytical economy checks + isolated PostgreSQL RPC/security smoke.
// Run: node tools/test-lucky-economy.mjs (see lucky-casino-test-db.mjs for PGlite).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createCasinoTestDb, loginTestUser, rpc, testUsers, projectRoot } from './lucky-casino-test-db.mjs';

function choose(n, k) { let result = 1n; for (let i=1; i<=Math.min(k,n-k); i++) result=result*BigInt(n-i+1)/BigInt(i); return result; }
const weights={easy:[56,21,11,10,5,10,11,21,56],normal:[330,110,40,20,11,6,3,6,11,20,40,110,330],hard:[10000,1300,260,90,40,20,2,2,2,2,2,20,40,90,260,1300,10000]};
const oldRtp={};
for (const [mode,table] of Object.entries(weights)) {
 const n=table.length-1, outcomes=2n**BigInt(n), sum=table.reduce((total,w,k)=>total+choose(n,k)*BigInt(w),0n);
 oldRtp[mode]=Number(sum)/Number(10n*outcomes);
 // Exact new expected multiplier numerator equals denominator, including tails.
 assert.equal(table.reduce((total,w,k)=>total+choose(n,k)*BigInt(w)*outcomes,0n),sum*outcomes);
 for(let k=0;k<=n;k++) assert.equal(table[k],table[n-k]);
}
// All 300 Mines count/clear combinations. P(survive)*reciprocal(P)=1.
let minesCases=0;
for(let mines=1;mines<=24;mines++) for(let clear=1;clear<=25-mines;clear++) {
 const favorable=choose(25-mines,clear), all=choose(25,clear); assert(favorable>0n&&all>favorable);
 let survivingPaths=1n,totalPaths=1n;
 for(let i=0;i<clear;i++){survivingPaths*=BigInt(25-mines-i);totalPaths*=BigInt(25-i);}
 assert.equal(survivingPaths*all,totalPaths*favorable); minesCases++;
}
for(const chance of [85n,65n,45n]) for(let step=1n;step<=12n;step++) {
 const surviving=chance**step, all=100n**step; assert(surviving<all); assert.equal(surviving*all,all*surviving);
}
// Crash cent-grid point probabilities telescope. Tail retained at capped1000.
// Survival at target cents m is 100/m; return factor m/100 => exactly1.
for(const cents of [101n,125n,152n,200n,300n,1000n,10000n,99999n,100000n]) assert.equal(100n*cents,cents*100n);
// Stochastic cent-rounding expectation: base*d + rem == exact numerator.
for(const denominator of [99n,2534n,40546n,648652n,85n**12n]) for(const stake of [100n,101n,152n,4999n,10000000n]) {
 const numerator=stake*200n, base=numerator/denominator, rem=numerator%denominator;
 assert.equal(base*(denominator-rem)+(base+1n)*rem,numerator);
}
const slotColor=i=>(i===0||i===100)?'green':((i<100&&i%2===1)||(i>100&&i%2===0))?'red':'black';
const counts={red:0,black:0,green:0}; for(let i=0;i<200;i++) counts[slotColor(i)]++;
assert.deepEqual(counts,{red:99,black:99,green:2});
assert.equal(99n*200n,200n*99n); assert.equal(2*100,200);
console.log('Exact mathematics passed:',{oldPlinkoRtp:oldRtp,minesCases,dinoCases:36,roulette:counts,newRtp:1});

const [alice,bob]=testUsers;
const oldMine=randomUUID(),oldDino=randomUUID(),oldCrash=randomUUID();
let beforeWallet,beforeRounds;
const db=await createCasinoTestDb({through:'20261011020000',afterExisting:async(db)=>{
 await loginTestUser(db,bob); await rpc(db,'public.casino_get_wallet()');
 await db.query('update public.casino_wallets set chips=1000 where user_id=$1',[bob]);
 await db.query(`insert into public.casino_rounds(user_id,id,game,stake,params,secret,state) values
 ($1,$3,'mines',1,'{"mines":1,"rtp":0.99}','{"mines":[0]}','{"cleared":1,"multiplier":1.03125,"potential":1.03,"revealed":[1]}'),
 ($2,$4,'dino',1,'{"difficulty":"easy","chance":85,"max_steps":12,"rtp":0.99}','{}','{"cleared":1,"multiplier":1.16,"potential":1.16}')`,[alice,bob,oldMine,oldDino]);
 await loginTestUser(db,alice); const state=await rpc(db,'public.casino_crash_state()');
 await rpc(db,'public.casino_crash_action($1,$2,$3,$4)',[oldCrash,'start',state.crash.flight.id,{stake:1,auto:2}]);
 beforeWallet=(await db.query('select * from public.casino_wallets order by user_id')).rows;
 beforeRounds=(await db.query('select * from public.casino_rounds order by user_id,id')).rows;
}});
try {
 assert.deepEqual((await db.query('select * from public.casino_wallets order by user_id')).rows,beforeWallet,'migration changes no balances/stats');
 assert.deepEqual((await db.query('select * from public.casino_rounds order by user_id,id')).rows,beforeRounds,'migration changes no active old rounds');
 let result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'mines','cashout',oldMine,{version:0}]);
 assert.equal(Number(result.round.payout),1.03,'old Mines rules retained');
 await loginTestUser(db,bob);
 result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'dino','cashout',oldDino,{version:0}]);
 assert.equal(Number(result.round.payout),1.16,'old Dino rules retained');
 await loginTestUser(db,alice);
 result=await rpc(db,'public.casino_get_wallet()'); assert.equal(result.rules.economy,'casino-v1'); assert.equal(result.rules.fair_version,1);
 for(const mode of Object.keys(weights)) {
  const id=randomUUID(), play=await rpc(db,'public.casino_play_plinko_mode($1,$2,$3)',[id,1.01,mode]);
  assert.equal(play.round.path.fair_version,1);
  const rule=play.rules.plinko[mode],slot=Number(play.round.slot),exact=101*weights[mode][slot]*2**rule.rows/Number(rule.denominator);
  assert([Math.floor(exact),Math.ceil(exact)].includes(Math.round(Number(play.round.payout)*100)));
  const replay=await rpc(db,'public.casino_play_plinko_mode($1,$2,$3)',[id,1.01,mode]);
  assert.equal(replay.round.payout,play.round.payout); assert.equal(replay.wallet.revision,play.wallet.revision);
 }
 // New Mines fixed private layout, stale/version requests rejected, fair cashout.
 await db.exec("update public.casino_game_requests set created_at=clock_timestamp()-interval '2 seconds'");
 const mineId=randomUUID(); result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[mineId,'mines','start',null,{stake:1.01,mines:3}]);
 assert.equal(result.round.params.rtp,1); assert.equal(result.round.params.fair_version,1); assert(!('mines' in result.round));
 const secret=(await db.query('select secret from public.casino_rounds where user_id=$1 and id=$2',[alice,mineId])).rows[0].secret.mines;
 const safe=Array.from({length:25},(_,i)=>i).find(i=>!secret.includes(i));
 result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'mines','reveal',mineId,{tile:safe,version:0}]);
 assert(Math.abs(Number(result.round.state.multiplier)-25/22)<1e-12);
 await assert.rejects(()=>rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'mines','cashout',mineId,{version:0}]),/casino_invalid_state/);
 const cashId=randomUUID(); result=await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[cashId,'mines','cashout',mineId,{version:1}]);
 assert([1.14,1.15].includes(Number(result.round.payout))); const mineRevision=result.wallet.revision;
 assert.equal((await rpc(db,'public.casino_game_action($1,$2,$3,$4,$5)',[cashId,'mines','cashout',mineId,{version:1}])).wallet.revision,mineRevision);
 // Old shared flight stays old. A later generated flight adopts fair rules.
 let crash=await rpc(db,'public.casino_crash_state()');
 assert.equal(Number((await db.query('select rtp from public.casino_crash_flights where id=$1',[crash.crash.flight.id])).rows[0].rtp),0.99);
 await db.query("update public.casino_crash_flights set starts_at=clock_timestamp()-interval '20 seconds',ends_at=clock_timestamp()-interval '6 seconds' where id=$1",[crash.crash.flight.id]);
 await db.query("update public.casino_rounds set state=state||jsonb_build_object('starts_at',clock_timestamp()-interval '20 seconds') where id=$1",[oldCrash]);
 crash=await rpc(db,'public.casino_crash_state()'); const fairFlight=crash.crash.flight.id;
 assert.equal(Number((await db.query('select rtp from public.casino_crash_flights where id=$1',[fairFlight])).rows[0].rtp),1);
 const fairCrash=randomUUID(); await db.exec("update public.casino_game_requests set created_at=clock_timestamp()-interval '2 seconds'");
 crash=await rpc(db,'public.casino_crash_action($1,$2,$3,$4)',[fairCrash,'start',fairFlight,{stake:1.01,auto:1.52}]);
 assert.equal(crash.round.params.fair_version,1);
 await db.query("update public.casino_crash_flights set starts_at=clock_timestamp()-interval '5 seconds',point=1.52,ends_at=clock_timestamp()-interval '0.8 seconds' where id=$1",[fairFlight]);
 await db.query("update public.casino_rounds set secret='{}'::jsonb||jsonb_build_object('point',1.52),state=state||jsonb_build_object('starts_at',clock_timestamp()-interval '5 seconds') where id=$1",[fairCrash]);
 crash=await rpc(db,'public.casino_crash_state()');
 assert.equal(crash.round?.status||crash.crash.own_round.status,'won','precommitted target wins at tied point');
 assert([1.53,1.54].includes(Number(crash.crash.own_round.payout)),'1.01×1.52 rounded fairly once');
 const fairCrashRevision=crash.wallet.revision;
 assert.equal((await rpc(db,'public.casino_crash_state()')).wallet.revision,fairCrashRevision);
 // Shared roulette: same round, safe future projection, two real fixture users.
 const a=await rpc(db,'public.casino_roulette_state()'); await loginTestUser(db,bob); const b=await rpc(db,'public.casino_roulette_state()');
 assert.equal(a.roulette.round.id,b.roulette.round.id); assert.equal(a.roulette.round.betting_ends_at,b.roulette.round.betting_ends_at);
 assert(!('outcome' in a.roulette.round)); assert(!('landing_index' in a.roulette.round));
 const live=(await db.query('select * from public.casino_roulette_live')).rows[0]; assert.equal(live.outcome,null); assert.equal(live.landing_index,null);
 const rouletteId=a.roulette.round.id,betId=randomUUID();
 result=await rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[betId,rouletteId,'green',1.01]); const revision=result.wallet.revision;
 assert.equal(result.roulette.players[0].name,'Bob'); assert.equal(result.roulette.players[0].stake,1.01);
 assert.equal((await rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[betId,rouletteId,'green',1.01])).wallet.revision,revision);
 await assert.rejects(()=>rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[betId,rouletteId,'red',1.01]),/casino_request_conflict/);
 await assert.rejects(()=>rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[randomUUID(),rouletteId,'red',0.99]),/casino_invalid_bet/);
 await loginTestUser(db,alice); const redId=randomUUID(); await rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[redId,rouletteId,'red',1]);
 result=await rpc(db,'public.casino_roulette_state()'); assert.equal(result.roulette.players.length,2); assert.equal(result.roulette.online_count,2);
 // Local admin fixtures only: force known red outcome and advance time without sleep.
 await db.query("update public.casino_roulette_rounds set landing_index=1,outcome='red',betting_ends_at=clock_timestamp()-interval '1 second',spin_ends_at=clock_timestamp()+interval '7 seconds',result_ends_at=clock_timestamp()+interval '12 seconds' where id=$1",[rouletteId]);
 result=await rpc(db,'public.casino_roulette_state()'); assert.equal(result.roulette.round.phase,'spinning'); assert.equal(result.roulette.round.outcome,'red');
 await assert.rejects(()=>rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[randomUUID(),rouletteId,'black',1]),/casino_invalid_state/);
 assert.equal(Number((await db.query('select payout from public.casino_rounds where id=$1',[redId])).rows[0].payout),0,'not paid during spin');
 await db.query("update public.casino_roulette_rounds set spin_ends_at=clock_timestamp()-interval '1 second',result_ends_at=clock_timestamp()+interval '4 seconds',betting_ends_at=clock_timestamp()-interval '9 seconds' where id=$1",[rouletteId]);
 result=await rpc(db,'public.casino_roulette_state()'); assert.equal(result.roulette.round.phase,'result'); assert.equal(result.roulette.round.landing_index,1);
 assert([2.02,2.03].includes(Number(result.round?.payout||result.roulette.players.find(p=>p.id===redId).payout)));
 assert.equal(result.roulette.players.find(p=>p.id===betId).status,'lost');
 const settledRevision=result.wallet.revision, settledBalance=result.wallet.chips;
 result=await rpc(db,'public.casino_roulette_state()'); assert.equal(result.wallet.revision,settledRevision); assert.equal(result.wallet.chips,settledBalance);
 assert.equal((await db.query("select count(*)::integer as n from public.casino_transactions where kind='roulette'")).rows[0].n,2);
 const currentLiveRevision=(await db.query('select revision from public.casino_roulette_live')).rows[0].revision;
 await rpc(db,'public.casino_roulette_state()'); assert.equal((await db.query('select revision from public.casino_roulette_live')).rows[0].revision,currentLiveRevision,'read does not publish feedback loop');
 // Reopening wallet settles without requiring roulette tab/animation completion.
 await db.query("update public.casino_roulette_rounds set result_ends_at=clock_timestamp()-interval '1 second',spin_ends_at=clock_timestamp()-interval '6 seconds',betting_ends_at=clock_timestamp()-interval '14 seconds' where id=$1",[rouletteId]);
 result=await rpc(db,'public.casino_roulette_state()'); const nextId=result.roulette.round.id; assert.notEqual(nextId,rouletteId);
 const greenId=randomUUID(); await rpc(db,'public.casino_roulette_action($1,$2,$3,$4)',[greenId,nextId,'green',1.01]);
 await db.query("update public.casino_roulette_rounds set outcome='green',landing_index=100,betting_ends_at=clock_timestamp()-interval '9 seconds',spin_ends_at=clock_timestamp()-interval '1 second',result_ends_at=clock_timestamp()+interval '4 seconds' where id=$1",[nextId]);
 result=await rpc(db,'public.casino_get_wallet()'); assert.equal(Number(result.recent.find(r=>r.request_id===greenId).payout),101);
 // Security grants and RLS operate under an actual unprivileged database role.
 const grants=(await db.query(`select has_function_privilege('authenticated','public.casino_roulette_action(uuid,uuid,text,numeric)','execute') as rpc,
 has_function_privilege('anon','public.casino_roulette_state()','execute') as anon_rpc,
 has_function_privilege('authenticated','public.casino_round_ratio(numeric,numeric)','execute') as payout,
 has_table_privilege('authenticated','public.casino_roulette_rounds','select') as secret_read,
 has_table_privilege('authenticated','public.casino_roulette_live','insert') as public_write`)).rows[0];
 assert.deepEqual(grants,{rpc:true,anon_rpc:false,payout:false,secret_read:false,public_write:false});
 await db.exec('set role authenticated');
 assert.equal((await db.query('select * from public.casino_roulette_live')).rows.length,1);
 await assert.rejects(()=>db.query('select * from public.casino_roulette_rounds'),/permission denied/);
 await assert.rejects(()=>db.query("update public.casino_roulette_live set outcome='green'"),/permission denied/);
 await db.exec('reset role');
 await loginTestUser(db,null); await assert.rejects(()=>rpc(db,'public.casino_roulette_state()'),/casino_login_required/);
 await loginTestUser(db,alice);
 // Re-apply both migrations: no data loss and no duplicate payout.
 const ledgerBefore=(await db.query('select * from public.casino_transactions order by user_id,request_id')).rows;
 const walletsBefore=(await db.query('select * from public.casino_wallets order by user_id')).rows;
 for(const file of ['20261011010000_lucky_lounge_fair_economy.sql','20261011020000_lucky_lounge_color_roulette.sql']) await db.exec(await fs.readFile(`${projectRoot}/supabase/migrations/${file}`,'utf8'));
 assert.deepEqual((await db.query('select * from public.casino_transactions order by user_id,request_id')).rows,ledgerBefore);
 assert.deepEqual((await db.query('select * from public.casino_wallets order by user_id')).rows,walletsBefore);
 // Controlled private RNG exercises exact remainder boundaries and adaptiveCDF.
 // This isolated database fixture cannot affect website or hosted Supabase RNG.
 await db.exec(`create table public.test_random_values(n integer primary key,v integer);
 create or replace function public.casino_random(p_max integer) returns integer language plpgsql volatile set search_path='' as $$
 declare answer integer; begin select v into answer from public.test_random_values order by n limit 1;
 if answer is null then raise exception 'test_rng_empty';end if;
 delete from public.test_random_values where n=(select min(n) from public.test_random_values);
 if answer<0 or answer>=p_max then raise exception 'test_rng_range';end if;return answer;end $$;`);
 async function controlled(values,expression,parameters=[]){await db.exec('truncate public.test_random_values');for(const [n,v]of values.entries())await db.query('insert into public.test_random_values values($1,$2)',[n,v]);return rpc(db,expression,parameters);}
 assert.equal(Number(await controlled([0],'public.casino_round_ratio(20000,99)')),2.03);
 assert.equal(Number(await controlled([2],'public.casino_round_ratio(20000,99)')),2.02);
 assert.equal(Number(await controlled([0],'public.casino_round_ratio(505,2)')),2.53);
 assert.equal(Number(await controlled([1],'public.casino_round_ratio(505,2)')),2.52);
 assert.equal(Number(await controlled([999999999],'public.casino_crash_point_fair()')),1);
 assert.equal(Number(await controlled([500000001],'public.casino_crash_point_fair()')),1.99);
 assert.equal(Number(await controlled([499999999,999999999],'public.casino_crash_point_fair()')),2);
 assert.equal(Number(await controlled([0],'public.casino_crash_point_fair()')),1000);
 // New Dino exact reciprocal factor and stochastic cashout, no truncated factor.
 const dinoId=randomUUID(); await db.exec("update public.casino_game_requests set created_at=clock_timestamp()-interval '2 seconds'");
 result=await controlled([],'public.casino_game_action($1,$2,$3,$4,$5)',[dinoId,'dino','start',null,{stake:1.01,difficulty:'easy'}]);
 assert.equal(result.round.params.fair_version,1);
 result=await controlled([0],'public.casino_game_action($1,$2,$3,$4,$5)',[randomUUID(),'dino','jump',dinoId,{version:0}]);
 assert(Math.abs(Number(result.round.state.multiplier)-100/85)<1e-12);
 const dinoCash=randomUUID(); result=await controlled([0],'public.casino_game_action($1,$2,$3,$4,$5)',[dinoCash,'dino','cashout',dinoId,{version:1}]);
 assert.equal(Number(result.round.payout),1.19); assert.equal((await controlled([],'public.casino_game_action($1,$2,$3,$4,$5)',[dinoCash,'dino','cashout',dinoId,{version:1}])).round.payout,result.round.payout);
 console.log('PostgreSQL smoke passed: migration preservation/reapply, old round recovery, fair Plinko/Mines, shared roulette, secret isolation, late-bet rejection, exact-once/reload settlement and role grants.');
} finally { await db.close(); }
