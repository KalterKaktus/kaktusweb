/** Reproducible integration simulation: node games/KaktusLife/tests/balance.mjs [games=10000]. */
import assert from 'node:assert/strict';
import { createGame, applyAction, scorePlayer } from '../shared/engine.mjs';
import { CAREERS, HOUSES, RULES } from '../shared/catalog.mjs';

function seeded(seed) {
  let word = seed >>> 0 || 1;
  return () => { word ^= word << 13; word ^= word >>> 17; word ^= word << 5; return (word >>> 0) / 4294967296; };
}
const count = Number(process.argv[2] ?? 10000);
assert.ok(Number.isSafeInteger(count) && count >= 100 && count <= 100000);
const summaries = new Map();
function summary(id) {
  if (!summaries.has(id)) summaries.set(id, { samples: 0, wins: 0, total: 0, sumSq: 0, rolls: 0, happiness: 0, debt: 0 });
  return summaries.get(id);
}
function collect(id, player, won) {
  const item = summary(id), score = scorePlayer(player).total;
  item.samples++; item.wins += won; item.total += score; item.sumSq += score ** 2;
  item.rolls += player.turns; item.happiness += player.happiness; item.debt += player.debt;
}
function expectedEvent(effect, player, remaining) {
  const multiplier = amount => amount * (amount < 0 ? player.route === 'safe' ? 0.8 : 1.4 : player.route === 'safe' ? 1 : 1.5);
  const cash = (effect.cash ?? 0) + (effect.childCash ?? 0) * player.children;
  let value = effect.insured && player.insurance && cash < 0 ? 0 : effect.fixedCash ? cash : multiplier(cash);
  if (effect.gamble) {
    const gamble = effect.gamble;
    value += gamble.chance * multiplier(gamble.win) + (1 - gamble.chance) * multiplier(gamble.lose ?? 0);
  }
  const investmentRate = 0.023 + (CAREERS.find(c => c.id === player.career)?.investmentBonus ?? 0);
  value += (effect.investments ?? 0) * (1 + investmentRate) ** remaining;
  value += (effect.happiness ?? 0) * RULES.happinessValue;
  value += (effect.salary ?? 0) * remaining;
  return value;
}
function pick(state, policy) {
  const player = state.players[state.turn], pending = state.pending;
  const options = pending.options;
  const has = id => options.some(option => option.id === id);
  const remaining = 16 - Math.floor(player.position / 5);
  const neededLoan = amount => Math.max(0, amount - player.cash);
  const interestCost = amount => neededLoan(amount) * (1.1 ** (4 - Math.floor(player.position / 20)) - 1);
  if (pending.type === 'path') return policy.career.degree ? 'study' : 'career';
  if (pending.type === 'directCareer' || pending.type === 'degreeCareer') return `career_${policy.career.id}`;
  if (pending.type === 'firstRoute' || pending.type === 'secondRoute') return policy.route;
  if (pending.type === 'insurance') return player.position === 16 ? 'insure' : 'uninsured';
  if (pending.type === 'qualification') return policy.style === 'memories' ? 'mentor' : 'training';
  if (pending.type === 'partner') return policy.style === 'memories' ? 'partner' : 'solo';
  if (pending.type === 'family') return policy.style === 'memories' ? 'children2' : 'children0';
  if (pending.type === 'careerChange') return policy.style === 'memories' ? 'sabbatical' : 'promotion';
  if (pending.type === 'legacy') return has('repay') ? 'repay' : policy.style === 'memories' ? 'memories' : 'community';
  if (pending.type === 'retirement') return 'retire';
  if (pending.type === 'event') {
    return options.map(option => ({ id: option.id, value: expectedEvent(option.effect, player, remaining)
      + (policy.style === 'memories' ? (option.effect.happiness ?? 0) * 1500 : 0) }))
      .sort((a, b) => b.value - a.value)[0].id;
  }
  if (pending.type === 'home') {
    const rentValue = 11 * RULES.happinessValue;
    const values = [{ id: 'rent', value: rentValue }, ...HOUSES.map(house => {
      const price = house.cost - (policy.career.houseDiscount ?? 0);
      return { id: `house_${house.id}`, value: house.value - price + house.happiness * RULES.happinessValue
        + (RULES.rent - house.upkeep) * remaining - interestCost(price) };
    })];
    return values.sort((a, b) => b.value - a.value)[0].id;
  }
  if (pending.type === 'market' || pending.type === 'investment') {
    if (has('repay')) return 'repay';
    if (remaining > 0) {
      for (const [id, amount] of [['invest120', 120000], ['invest60', 60000], ['invest20', 20000]]) {
        if (has(id) && player.cash > amount + 30000) return id;
      }
    }
    return 'hold';
  }
  throw new Error(`Unhandled decision ${pending.type}`);
}

let actionCount = 0, minRolls = Infinity, maxRolls = 0;
const rollCounts = [], firstScores = [];
const started = performance.now();
for (let game = 0; game < count; game++) {
  const random = seeded(0x9e3779b9 ^ Math.imul(game + 1, 2654435761));
  let group, profiles;
  const segment = game % 10;
  if (segment < 6) {
    group = 'education';
    profiles = [
      { career: CAREERS[Math.floor(game / 10) % 3], route: 'safe', style: 'balanced' },
      { career: CAREERS[3 + Math.floor(game / 30) % 3], route: 'safe', style: 'balanced' },
    ];
  } else if (segment < 8) {
    group = 'risk';
    const career = CAREERS[Math.floor(game / 10) % 6];
    profiles = [{ career, route: 'safe', style: 'balanced' }, { career, route: 'adventure', style: 'balanced' }];
  } else {
    group = 'lifestyle';
    const career = CAREERS[Math.floor(game / 10) % 6];
    profiles = [{ career, route: 'safe', style: 'balanced' }, { career, route: 'safe', style: 'memories' }];
  }
  // Every matchup appears in both seating orders; profile and starter advantages are separate observations.
  if (Math.floor(game / 10) % 2) profiles.reverse();
  let state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], random);
  let moves = 0;
  while (state.status !== 'finished') {
    assert.ok(++moves < 300, `Nontermination at seed ${game}`);
    const player = state.players[state.turn];
    const action = state.stage === 'roll' ? { type: 'roll' } : state.stage === 'end' ? { type: 'end' }
      : { type: 'choose', choice: pick(state, profiles[state.turn]) };
    state = applyAction(state, player.id, action, random);
    actionCount++;
  }
  assert.equal(state.results.length, 2);
  const scores = state.players.map(player => scorePlayer(player).total);
  firstScores.push(scores[0] - scores[1]);
  for (let seat = 0; seat < 2; seat++) {
    const player = state.players[seat], profile = profiles[seat];
    const won = scores[seat] === scores[1 - seat] ? 0.5 : Number(scores[seat] > scores[1 - seat]);
    assert.equal(player.position, 80);
    assert.equal(player.stats.paydays, 16);
    assert.equal(player.milestones.length, 11);
    for (const key of ['cash', 'debt', 'investments', 'happiness']) assert.ok(Number.isSafeInteger(player[key]) && player[key] >= 0);
    minRolls = Math.min(minRolls, player.turns); maxRolls = Math.max(maxRolls, player.turns);
    rollCounts.push(player.turns);
    collect('all', player, won);
    collect(`seat:${seat}`, player, won);
    if (group === 'education') {
      collect(`career:${profile.career.id}`, player, won);
      collect(`path:${profile.career.degree ? 'study' : 'career'}`, player, won);
    }
    if (group === 'risk') collect(`route:${profile.route}`, player, won);
    if (group === 'lifestyle') collect(`style:${profile.style}`, player, won);
  }
  if ((game + 1) % 1000 === 0) console.error(`Simulated ${game + 1}/${count} games (${Math.round((performance.now() - started) / 1000)}s)`);
}
const rows = Object.fromEntries([...summaries].map(([key, value]) => [key, {
  games: value.samples, winShare: +(100 * value.wins / value.samples).toFixed(2),
  averageScore: Math.round(value.total / value.samples),
  scoreSD: Math.round(Math.sqrt(value.sumSq / value.samples - (value.total / value.samples) ** 2)),
  averageRolls: +(value.rolls / value.samples).toFixed(2), averageHappiness: +(value.happiness / value.samples).toFixed(1),
  averageDebt: Math.round(value.debt / value.samples),
}]));
rollCounts.sort((a, b) => a - b);
const report = {
  games: count, actions: actionCount, seconds: +((performance.now() - started) / 1000).toFixed(1),
  rollCounts: { min: minRolls, p10: rollCounts[Math.floor(rollCounts.length * 0.1)], median: rollCounts[Math.floor(rollCounts.length * 0.5)], p90: rollCounts[Math.floor(rollCounts.length * 0.9)], max: maxRolls },
  assumedMinutesAt30SecondsPerTurn: +(rows.all.averageRolls).toFixed(1),
  groups: rows,
};
console.log(JSON.stringify(report, null, 2));
if (count >= 1000) {
  assert.ok(rows['seat:0'].winShare >= 42 && rows['seat:0'].winShare <= 58, 'Starter bias must remain small');
  assert.ok(rows['path:study'].winShare >= 28 && rows['path:study'].winShare <= 72, 'Both education paths must remain viable');
  assert.ok(rows['route:safe'].winShare >= 25 && rows['route:safe'].winShare <= 75, 'Both risk routes must remain viable');
  assert.ok(rows['style:memories'].winShare >= 25 && rows['style:memories'].winShare <= 75, 'Both lifestyles must remain viable');
}
