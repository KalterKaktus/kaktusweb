// Focused backend checks, using local PGlite only. No production network or data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCasinoTestDb, loginTestUser, rpc, projectRoot, testUsers } from './lucky-casino-test-db.mjs';
import { checkRules } from './lucky-blackjack-math.mjs';

checkRules();
let preserved;
const db = await createCasinoTestDb({ afterExisting: async database => {
  preserved = (await database.query('select * from casino_wallets order by user_id')).rows;
} });
assert.deepEqual((await db.query('select * from casino_wallets order by user_id')).rows, preserved, 'new migrations must not change existing wallet data');
const sql = await fs.readFile(path.join(projectRoot, 'supabase/migrations/20261011030000_lucky_lounge_blackjack.sql'), 'utf8');
await db.exec(sql); // migration can safely be reapplied
assert.deepEqual((await db.query('select * from casino_wallets order by user_id')).rows, preserved);

const action = (requestId, operation, round = null, payload = {}) => rpc(db, 'casino_blackjack_action($1,$2,$3,$4::jsonb)', [requestId, operation, round, JSON.stringify(payload)]);
const wallet = () => rpc(db, 'casino_get_wallet()');
const expectError = async (operation, message) => assert.rejects(operation, error => error.message.includes(message));
let initial = await wallet();
assert.equal(initial.wallet.chips, 1000);
assert.equal(initial.wallet.rounds, 7);
const privateTables = ['casino_wallets', 'casino_rounds', 'casino_game_requests'];
for (const table of privateTables) assert.equal(await rpc(db, `has_table_privilege('authenticated','public.${table}','SELECT')`), false);
assert.equal(await rpc(db, "has_function_privilege('authenticated','casino_blackjack_finish(uuid,uuid,jsonb,text,numeric,boolean)','EXECUTE')"), false);
assert.equal(await rpc(db, "has_function_privilege('anon','casino_blackjack_action(uuid,text,uuid,jsonb)','EXECUTE')"), false);
assert.equal(await rpc(db, "has_table_privilege('authenticated','casino_blackjack_results','INSERT')"), false);

// Seed only the LOCAL private RNG to test specific cards with the unchanged
// production shuffle, dealing, decision, settlement and ledger functions.
await db.exec(`create table test_rng_queue(seq integer primary key,p_max integer,p_value integer);
 create or replace function public.casino_random(p_max integer) returns integer language plpgsql volatile set search_path='' as $$
 declare q record; begin
  select * into q from public.test_rng_queue order by seq limit 1;
  if found and q.p_max=p_max then delete from public.test_rng_queue where seq=q.seq; return q.p_value; end if;
  return 0;
 end $$;`);
async function cardsInOrder(cards) {
  const unused = Array.from({ length: 312 }, (_, i) => i);
  const target = [];
  for (const card of cards) {
    const index = unused.findIndex(i => i % 52 === card);
    assert.notEqual(index, -1);
    target.push(unused.splice(index, 1)[0]);
  }
  target.push(...unused);
  const source = Array.from({ length: 312 }, (_, i) => i);
  const rows = [];
  for (let i = 312; i >= 2; i--) {
    const index = source.indexOf(target[i - 1]);
    assert.ok(index < i);
    [source[i - 1], source[index]] = [source[index], source[i - 1]];
    rows.push(`(${313 - i},${i},${index})`);
  }
  assert.deepEqual(source, target);
  await db.exec(`truncate test_rng_queue; insert into test_rng_queue values${rows.join(',')};`);
}
async function deal(cards, stake = 1) {
  await cardsInOrder(cards);
  const request = randomUUID();
  const result = await action(request, 'start', null, { stake });
  assert.equal(await rpc(db, '(select count(*) from test_rng_queue)'), 0);
  return { result, request };
}

await expectError(() => action(randomUUID(), 'start', null, { stake: 0.99 }), 'casino_invalid_bet');
await expectError(() => action(randomUUID(), 'start', null, { stake: 100001 }), 'casino_invalid_bet');
await expectError(() => action(randomUUID(), 'start', null, { stake: 1, payout: 999 }), 'casino_invalid_request');
await expectError(() => action(randomUUID(), 'split', null, {}), 'casino_invalid_action');

// Multiple aces, reload, hidden dealer hole, no deck/cursor leak, no duplicate hit.
let { result, request } = await deal([0, 9, 5, 6, 0]); // player A+6; dealer 10+7; hit A
assert.equal(result.round.state.player_total, 17);
assert.equal(result.round.state.player_soft, true);
assert.deepEqual(result.round.state.dealer_cards[1], { hidden: true });
assert.equal(result.round.state.dealer_total, 10);
assert.equal(JSON.stringify(result).includes('"deck"'), false);
assert.equal(JSON.stringify(result).includes('"cursor"'), false);
assert.deepEqual((await wallet()).active_rounds.find(r => r.id === request), result.round);
const replay = await action(request, 'start', null, { stake: 1 });
assert.equal(replay.replayed, true);
assert.equal(replay.wallet.chips, result.wallet.chips);
await expectError(() => action(request, 'start', null, { stake: 2 }), 'casino_request_conflict');
await expectError(() => action(randomUUID(), 'start', null, { stake: 1 }), 'casino_invalid_active_round');
const hitRequest = randomUUID();
let hit = await action(hitRequest, 'hit', request, { version: 0 });
assert.equal(hit.round.state.player_total, 18);
assert.equal(hit.round.state.player_soft, true);
assert.equal(hit.round.state.can_double, false);
assert.deepEqual((await action(hitRequest, 'hit', request, { version: 0 })).round, hit.round);
await expectError(() => action(randomUUID(), 'hit', request, { version: 0 }), 'casino_invalid_state');
await expectError(() => action(randomUUID(), 'double', request, { version: hit.round.version }), 'casino_invalid_state');
let completed = await action(randomUUID(), 'stand', request, { version: hit.round.version });
assert.equal(completed.round.state.outcome, 'win');
assert.equal(completed.round.state.dealer_total, 17);
assert.equal(completed.round.payout, 2);
await expectError(() => action(randomUUID(), 'stand', request, { version: completed.round.version }), 'casino_invalid_round');

// Dealer S17 must not draw to A+6. A three-card 21 is an ordinary win, not 3:2.
({ result, request } = await deal([9, 0, 7, 5, 9])); // player 18; dealer soft17
completed = await action(randomUUID(), 'stand', request, { version: 0 });
assert.equal(completed.round.state.dealer_total, 17);
assert.equal(completed.round.state.dealer_soft, true);
assert.equal(completed.round.state.dealer_cards.length, 2);
({ result, request } = await deal([4, 9, 5, 6, 9])); // 5+6, hit 10 = 21
completed = await action(randomUUID(), 'hit', request, { version: 0 });
assert.equal(completed.round.state.outcome, 'win');
assert.equal(completed.round.payout, 2);

// Naturals, including dealer peek before the player can double, and push.
({ result, request } = await deal([0, 8, 9, 6], 1.01));
assert.equal(result.round.state.outcome, 'blackjack');
assert.ok(result.round.payout === 2.52 || result.round.payout === 2.53);
assert.equal(result.round.state.can_double, false);
const naturalBalance = result.wallet.chips;
assert.equal((await action(request, 'start', null, { stake: 1.01 })).wallet.chips, naturalBalance);
({ result } = await deal([0, 0, 9, 9]));
assert.equal(result.round.state.outcome, 'push');
assert.equal(result.round.payout, 1);
({ result } = await deal([9, 0, 7, 9]));
assert.equal(result.round.state.outcome, 'loss');
assert.equal(result.round.payout, 0);

// Double debits precisely one additional initial stake, then one card and stand.
({ result, request } = await deal([4, 8, 5, 7, 9], 5)); // player11 double21, dealer17
let before = result.wallet;
const doubleRequest = randomUUID();
const simultaneousDouble = await Promise.all([
  action(doubleRequest, 'double', request, { version: 0 }),
  action(doubleRequest, 'double', request, { version: 0 })
]);
completed = simultaneousDouble[0];
assert.equal(simultaneousDouble[1].replayed, true);
assert.equal(simultaneousDouble[1].wallet.chips, completed.wallet.chips);
assert.equal(completed.round.stake, 10);
assert.equal(completed.round.state.doubled, true);
assert.equal(completed.round.state.player_cards.length, 3);
assert.equal(completed.round.payout, 20);
assert.equal(Math.round(completed.wallet.chips * 100), Math.round(before.chips * 100) - 500 + 2000);
assert.equal(Math.round(completed.wallet.tracked_wagered * 100), Math.round(before.tracked_wagered * 100) + 500);
assert.equal(completed.wallet.rounds, before.rounds);
assert.equal((await action(doubleRequest, 'double', request, { version: 0 })).wallet.chips, completed.wallet.chips);
assert.equal(await rpc(db, '(select count(*) from casino_transactions where request_id=$1)', [request]), 1);

// Bust must settle without making the dealer draw; no second payout.
({ result, request } = await deal([9, 3, 5, 4, 9])); // 16 hits10, dealer4+5 unchanged
completed = await action(randomUUID(), 'hit', request, { version: 0 });
assert.equal(completed.round.state.outcome, 'bust');
assert.equal(completed.round.payout, 0);
assert.equal(completed.round.state.dealer_cards.length, 2);
({ result, request } = await deal([9, 9, 6, 6])); // ordinary 17 vs17
completed = await action(randomUUID(), 'stand', request, { version: 0 });
assert.equal(completed.round.state.outcome, 'push');
assert.equal(completed.round.payout, 1);

// The server's initial limit stays 100k; legal Double can raise total stake to200k.
await db.query('update casino_wallets set chips=250000 where user_id=$1', [testUsers[0]]);
({ result, request } = await deal([4, 8, 5, 7, 9], 100000));
completed = await action(randomUUID(), 'double', request, { version: 0 });
assert.equal(completed.round.stake, 200000);
assert.equal(completed.round.payout, 400000);
assert.equal(completed.wallet.chips, 450000);

// Another account cannot use the private round ID; low balance blocks a double
// atomically, leaving the cards, round, ledger and already paid stake unchanged.
await loginTestUser(db, testUsers[1]);
await wallet();
await db.query('update casino_wallets set chips=1 where user_id=$1', [testUsers[1]]);
({ result, request } = await deal([4, 8, 5, 7, 9]));
before = await wallet();
await expectError(() => action(randomUUID(), 'double', request, { version: 0 }), 'casino_insufficient_chips');
assert.deepEqual((await wallet()).active_rounds, before.active_rounds);
assert.equal((await wallet()).wallet.chips, 0);
await loginTestUser(db, testUsers[0]);
await expectError(() => action(randomUUID(), 'hit', request, { version: 0 }), 'casino_invalid_round');

const feed = await rpc(db, 'casino_blackjack_feed()');
assert.ok(feed.length > 0 && feed.length <= 30);
assert.equal(feed.length, Number(await rpc(db, "(select count(*) from casino_rounds where game='blackjack' and status<>'active')")));
for (const item of feed) assert.deepEqual(Object.keys(item).sort(), ['id','player_name','stake','payout','outcome','created_at'].sort());
assert.equal(feed.some(item => item.id === request), false, 'ongoing round is absent from public results');
assert.equal(await rpc(db, "exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='casino_blackjack_results')"), true);
const walletsAfterPlay = (await db.query('select * from casino_wallets order by user_id')).rows;
await db.exec(sql);
assert.deepEqual((await db.query('select * from casino_wallets order by user_id')).rows, walletsAfterPlay);
assert.deepEqual(await rpc(db, 'casino_blackjack_feed()'), feed);
await db.exec('set role authenticated;');
assert.equal((await db.query('select * from casino_blackjack_results')).rows.length, feed.length);
await expectError(() => db.exec("insert into casino_blackjack_results values(gen_random_uuid(),'Fake',1,999,'win',now())"), 'permission denied');
await db.exec('reset role;');
await loginTestUser(db, null);
await expectError(() => rpc(db, 'casino_blackjack_feed()'), 'casino_login_required');
await loginTestUser(db, testUsers[0]);
await db.query('update profiles set is_banned=true where id=$1', [testUsers[0]]);
await expectError(() => action(randomUUID(), 'start', null, { stake: 1 }), 'casino_account_banned');
await expectError(() => rpc(db, 'casino_blackjack_feed()'), 'casino_account_banned');
await db.exec('set role authenticated;');
assert.equal((await db.query('select * from casino_blackjack_results')).rows.length, 0);
await db.exec('reset role;');
await db.close();
console.log('Blackjack SQL: migration/reapply preservation, aces, naturals, push, Hit/Stand/Double, S17, hidden cards, reload/replay/version, ownership, limits, atomic insufficient funds, safe Realtime feed and RLS passed.');
