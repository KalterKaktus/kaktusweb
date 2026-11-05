import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, scorePlayer } from '../shared/engine.mjs';
import { BOARD, CAREERS, HOUSES, MILESTONES, EVENTS, TRANSLATIONS, RULES } from '../shared/catalog.mjs';

const people = [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Boris' }];
const rng = value => () => value;
const initial = () => createGame(people, rng(0.5));
const act = (state, action, random = rng(0.5)) => applyAction(state, state.players[state.turn].id, action, random);
const choose = (state, choice, random) => act(state, { type: 'choose', choice }, random);
function ready() { return choose(choose(initial(), 'career'), 'career_maker'); }
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function at(position, opts = {}) {
  const state = ready();
  Object.assign(state.players[0], { position, ...opts });
  state.players[0].milestones = MILESTONES.filter(m => m.index <= position).map(m => m.id);
  return state;
}
function lookup(dictionary, key) { return key.replace(/^life\./, '').split('.').reduce((value, part) => value?.[part], dictionary); }

test('catalogue contains 81 ordered cells, required milestones, unique choices and complete bilingual copy', () => {
  assert.equal(BOARD.length, 81);
  assert.deepEqual(BOARD.map(tile => tile.index), Array.from({ length: 81 }, (_, i) => i));
  assert.deepEqual(MILESTONES.map(item => item.index), [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80]);
  assert.equal(CAREERS.length, 6);
  assert.equal(HOUSES.length, 3);
  assert.ok(EVENTS.length >= 40);
  const keys = [];
  function scan(value) { for (const [key, item] of Object.entries(value)) {
    if (['title', 'description'].includes(key)) keys.push(item);
    else if (item && typeof item === 'object') scan(item);
  } }
  [BOARD, CAREERS, HOUSES, EVENTS].forEach(scan);
  for (const key of keys) for (const lang of ['de', 'ru']) {
    assert.equal(typeof lookup(TRANSLATIONS[lang], key), 'string', `${lang}: ${key}`);
    assert.ok(lookup(TRANSLATIONS[lang], key).length > 2);
  }
  assert.equal(new Set(EVENTS.map(e => e.id)).size, EVENTS.length);
  assert.equal(new Set(EVENTS.flatMap(e => e.options.map(o => o.id))).size, EVENTS.length * 2);
});

test('exactly two valid identities are required and creation does not mutate identities', () => {
  assert.throws(() => createGame([], rng(0)), /invalidPlayers/);
  assert.throws(() => createGame([people[0], people[0]], rng(0)), /invalidPlayers/);
  assert.throws(() => createGame([{ id: 'a', name: '' }, people[1]], rng(0)), /invalidPlayers/);
  assert.throws(() => createGame(people), /invalidRandom/);
  const players = freeze(people.map(p => ({ ...p })));
  const state = createGame(players, rng(0));
  assert.equal(state.pending.type, 'path');
  assert.equal(state.players[0].cash, 40000);
  assert.equal(state.status, 'playing');
  assert.notEqual(state.players[0], players[0]);
});

test('setup, chained choices, stage guards, wrong-turn guards and duplicate actions', () => {
  let state = initial();
  const snapshot = JSON.stringify(state);
  freeze(state);
  assert.throws(() => applyAction(state, 'b', { type: 'choose', choice: 'study' }, rng(0)), /notYourTurn/);
  assert.throws(() => act(state, { type: 'roll' }), /invalidAction/);
  assert.throws(() => choose(state, 'no-such-option'), /invalidChoice/);
  state = choose(state, 'career');
  assert.equal(snapshot, JSON.stringify(initial()));
  assert.equal(state.pending.type, 'directCareer');
  assert.throws(() => choose(state, 'career'), /invalidChoice/);
  state = choose(state, 'career_maker');
  assert.equal(state.stage, 'roll');
  assert.equal(state.players[0].cash, 60000);
  assert.throws(() => choose(state, 'career_maker'), /invalidAction/);
  state = act(state, { type: 'roll' }, rng(0.99));
  assert.equal(state.players[0].position, 8);
  assert.equal(state.pending.type, 'qualification');
  assert.throws(() => act(state, { type: 'roll' }), /invalidAction/);
  state = choose(state, 'bonus');
  assert.equal(state.stage, 'end');
  state = act(state, { type: 'end' });
  assert.equal(state.turn, 1);
  assert.equal(state.pending.type, 'path');
  assert.throws(() => applyAction(state, 'a', { type: 'end' }, rng(0)), /notYourTurn/);
});

test('roll boundaries cover all 1–10 values and optional exact uniform RNG hook', () => {
  for (let value = 1; value <= 10; value++) {
    const state = act(ready(), { type: 'roll' }, rng((value - 0.5) / 10));
    assert.equal(state.lastRoll.value, value);
    assert.equal(state.lastRoll.to, Math.min(value, 8));
    assert.equal(state.lastRoll.id, state.serial);
  }
  const secure = () => 0.5;
  secure.int = (min, max) => { assert.equal(min, 1); assert.equal(max, 11); return 10; };
  assert.equal(act(ready(), { type: 'roll' }, secure).lastRoll.value, 10);
  for (const value of [-1, 1, NaN, Infinity, undefined]) {
    assert.throws(() => act(ready(), { type: 'roll' }, rng(value)), /invalidRandom/);
  }
  secure.int = () => 11;
  assert.throws(() => act(ready(), { type: 'roll' }, secure), /invalidRandom/);
});

test('every mandatory stop catches overshoots and awards each crossing payday once', () => {
  for (const stop of MILESTONES.slice(1)) {
    const previous = stop.index - 1;
    const state = act(at(previous), { type: 'roll' }, rng(0.99));
    assert.equal(state.players[0].position, stop.index);
    assert.equal(state.pending.type, stop.id);
    assert.equal(state.players[0].stats.paydays, stop.index % 5 === 0 ? 1 : 0);
  }
  const state = act(at(8), { type: 'roll' }, rng(0.99));
  assert.equal(state.players[0].position, 16);
  assert.equal(state.players[0].stats.paydays, 2);
  assert.equal(state.players[0].cash, 104000); // 2 × (25.000 − 3.000)
});

test('study debt is actual debt and graduation unlocks degree-only careers', () => {
  let state = choose(initial(), 'study');
  assert.equal(state.players[0].debt, 60000);
  assert.equal(state.players[0].cash, 40000);
  state = act(state, { type: 'roll' }, rng(0.99));
  assert.equal(state.players[0].cash, 37000);
  assert.equal(state.pending.type, 'degreeCareer');
  assert.deepEqual(state.pending.options.map(o => o.career), ['engineer', 'doctor', 'scientist']);
  assert.throws(() => choose(state, 'career_maker'), /invalidChoice/);
  state = choose(state, 'career_doctor');
  assert.equal(state.players[0].education, 'degree');
  assert.equal(state.players[0].salary, 35000);
  assert.equal(state.players[0].insurance, true);
});

test('automatic loans preserve nonnegative cash, use 10.000 units and interest is charged once per checkpoint', () => {
  let state = at(31, { cash: 1000, debt: 0 });
  state = act(state, { type: 'roll' }, rng(0));
  state = choose(state, 'house_villa');
  assert.equal(state.players[0].debt, 190000);
  assert.equal(state.players[0].cash, 6000);
  assert.equal(state.players[0].house, 'villa');
  state = act(at(39, { debt: 100000, children: 0 }), { type: 'roll' }, rng(0));
  assert.equal(state.players[0].debt, 110000);
  assert.equal(state.players[0].stats.interest, 10000);
  assert.equal(state.players[0].stats.paydays, 1);
  assert.ok(state.log.some(item => item.type === 'interest'));
});

test('route choices change actual event outcomes and insurance covers marked damage only', () => {
  function forcedEvent(id, route, insurance = false) {
    const state = at(1, { route, insurance });
    const event = EVENTS.find(e => e.id === id);
    state.stage = 'choice';
    state.pending = { type: 'event', title: event.title, description: event.description, options: structuredClone(event.options), eventId: event.id };
    return state;
  }
  const safe = choose(forcedEvent('roof', 'safe'), 'roof_repair');
  const wild = choose(forcedEvent('roof', 'adventure'), 'roof_repair');
  assert.equal(safe.players[0].cash, 60000 - 14400);
  assert.equal(wild.players[0].cash, 60000 - 25200);
  const covered = choose(forcedEvent('roof', 'adventure', true), 'roof_repair');
  assert.equal(covered.players[0].cash, 60000);
  const uncovered = choose(forcedEvent('roof', 'adventure', true), 'roof_patch');
  assert.equal(uncovered.players[0].cash, 51600);
  const win = choose(forcedEvent('grant', 'adventure'), 'grant_cash');
  assert.equal(win.players[0].cash, 84000);
});

test('house upkeep and children affect all remaining salaries; cash investments conserve current net worth', () => {
  const state = act(at(34, { house: 'villa', children: 2 }), { type: 'roll' }, rng(0));
  assert.equal(state.players[0].cash, 76000); // 25k − 4k − 5k
  let portfolio = at(63, { cash: 150000 });
  portfolio = act(portfolio, { type: 'roll' }, rng(0));
  const before = scorePlayer(portfolio.players[0]).total;
  portfolio = choose(portfolio, 'invest120');
  assert.equal(scorePlayer(portfolio.players[0]).total, before);
  assert.equal(portfolio.players[0].investments, 120000);
  portfolio.stage = 'roll';
  portfolio = act(portfolio, { type: 'roll' }, rng(0));
  assert.equal(portfolio.players[0].investments, 114000); // safe down market −5 %
});

test('repayment cannot borrow, exactly conserves net worth, and prevents subsequent interest', () => {
  let state = at(63, { cash: 30000, debt: 50000 });
  state = act(state, { type: 'roll' }, rng(0));
  const before = scorePlayer(state.players[0]).total;
  state = choose(state, 'repay');
  assert.equal(state.players[0].cash, 0);
  assert.equal(state.players[0].debt, 20000);
  assert.equal(scorePlayer(state.players[0]).total, before);
  assert.equal(state.players[0].stats.borrowed, 0);
});

test('input is immutable on successful and rejected random outcomes; stale action serial is rejected', () => {
  const state = freeze(ready());
  const before = JSON.stringify(state);
  const after = act(state, { type: 'roll', serial: state.serial }, rng(0.1));
  assert.equal(JSON.stringify(state), before);
  assert.notEqual(after, state);
  assert.notEqual(after.players[0], state.players[0]);
  assert.throws(() => act(state, { type: 'roll', serial: state.serial - 1 }, rng(0)), /staleAction/);
  assert.throws(() => act(state, { type: 'roll' }, rng(1)), /invalidRandom/);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(JSON.parse(JSON.stringify(after)), after);
});

test('finished players are skipped, equal scores share rank, and retirement yields no arrival bonus', () => {
  let state = at(79);
  Object.assign(state.players[1], structuredClone(state.players[0]), { id: 'b', name: 'Boris', seat: 1, started: true });
  state = act(state, { type: 'roll' }, rng(0));
  state = choose(state, 'retire');
  assert.equal(state.status, 'playing');
  assert.equal(state.players[0].retired, true);
  state = act(state, { type: 'end' });
  assert.equal(state.turn, 1);
  state = act(state, { type: 'roll' }, rng(0));
  state = choose(state, 'retire');
  assert.equal(state.status, 'finished');
  assert.equal(state.pending, null);
  assert.equal(state.results[0].total, state.results[1].total);
  assert.deepEqual(state.results.map(item => item.rank), [1, 1]);
  assert.deepEqual(scorePlayer(state.players[0]), Object.fromEntries(Object.entries(state.results[0]).filter(([key]) => !['rank', 'playerId'].includes(key))));
  assert.throws(() => act(state, { type: 'end' }), /finished/);
});

test('complete deterministic games terminate with 16 paydays and exactly one visit to each milestone', () => {
  function run() {
    let state = initial();
    let seed = 123456;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let moves = 0; state.status !== 'finished'; moves++) {
      assert.ok(moves < 300, 'every game terminates');
      const action = state.stage === 'roll' ? { type: 'roll' } : state.stage === 'end' ? { type: 'end' }
        : { type: 'choose', choice: state.pending.options[Math.floor(random() * state.pending.options.length)].id };
      state = act(state, action, random);
      for (const player of state.players) {
        for (const key of ['cash', 'debt', 'investments', 'salary', 'happiness']) assert.ok(Number.isSafeInteger(player[key]) && player[key] >= 0, key);
        assert.ok(player.position >= 0 && player.position <= 80);
      }
    }
    for (const player of state.players) {
      assert.equal(player.stats.paydays, 16);
      assert.equal(player.milestones.length, 11);
      assert.equal(new Set(player.milestones).size, 11);
      assert.ok(player.turns >= 10 && player.turns <= 80);
    }
    return state;
  }
  assert.deepEqual(run(), run());
});

test('career perks are applied to salaries, property prices, investments and research grants', () => {
  const minimum = act(at(4, { career: 'creator', salary: 22000 }), { type: 'roll' }, rng(0));
  const maximum = act(at(4, { career: 'creator', salary: 22000 }), { type: 'roll' }, rng(0.99));
  assert.equal(minimum.players[0].cash, 79000); // 22k − 3k
  assert.equal(maximum.players[0].cash, 87000); // 22k + 8k − 3k
  const engineer = act(at(34, { career: 'engineer', salary: 36000, investments: 100000 }), { type: 'roll' }, rng(0));
  assert.equal(engineer.players[0].investments, 97000); // safe loss −5 % +2 % perk
  let scientist = act(at(47, { career: 'scientist', salary: 34000 }), { type: 'roll' }, rng(0));
  assert.equal(scientist.players[0].cash, 77000);
  assert.equal(scientist.log.filter(item => item.type === 'grant').length, 1);
  let maker = act(at(31), { type: 'roll' }, rng(0));
  assert.equal(maker.pending.options.find(option => option.id === 'house_cottage').cost, 55000);
  maker = choose(maker, 'house_cottage');
  assert.equal(maker.players[0].cash, 5000);
});

test('event deck is sampled without replacement, then renews; outputs do not alias frozen catalogue effects', () => {
  let state = ready();
  const seen = new Set();
  for (let i = 0; i < EVENTS.length; i++) {
    state.stage = 'roll'; state.pending = null; state.players[0].position = 0;
    state = act(state, { type: 'roll' }, rng(0));
    const id = state.pending.eventId;
    assert.ok(!seen.has(id), `Repeated card ${id}`);
    seen.add(id);
    const source = EVENTS.find(event => event.id === id);
    assert.notEqual(state.pending.options[0].effect, source.options[0].effect);
    assert.equal(Object.isFrozen(state.pending.options[0].effect), false);
    state = choose(state, state.pending.options[0].id, rng(0.5));
  }
  assert.equal(seen.size, EVENTS.length);
  state.stage = 'roll'; state.pending = null; state.players[0].position = 0;
  state = act(state, { type: 'roll' }, rng(0));
  assert.equal(state.usedEvents.length, 1);
});

test('every event option resolves with an inspectable bilingual description and valid integer economy', () => {
  for (const event of EVENTS) for (const option of event.options) for (const route of ['safe', 'adventure']) {
    const state = ready();
    Object.assign(state.players[0], { route, cash: 0, children: 2 });
    state.stage = 'choice';
    state.pending = { type: 'event', title: event.title, description: event.description, options: structuredClone(event.options), eventId: event.id };
    const resolved = choose(state, option.id, rng(0.51));
    assert.equal(resolved.stage, 'end');
    assert.equal(resolved.pending, null);
    for (const key of ['cash', 'debt', 'salary', 'investments', 'happiness']) {
      assert.ok(Number.isSafeInteger(resolved.players[0][key]) && resolved.players[0][key] >= 0, `${event.id}: ${key}`);
    }
  }
});
