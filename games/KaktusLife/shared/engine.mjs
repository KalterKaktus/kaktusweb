import { BOARD, CAREERS, HOUSES, EVENTS, MILESTONES, ROUTES, CHOICES, RULES } from './catalog.mjs';

/** Same pure rules in browser and server. No clocks, IO, global randomness or mutable module state. */
function fail(reason) {
  const error = new Error(`life.errors.${reason}`);
  error.code = error.message;
  throw error;
}
function random(rng) {
  if (typeof rng !== 'function') fail('invalidRandom');
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) fail('invalidRandom');
  return value;
}
function die(rng) {
  if (typeof rng !== 'function') fail('invalidRandom');
  if (typeof rng.int === 'function') {
    const value = rng.int(1, 11);
    if (!Number.isInteger(value) || value < 1 || value > 10) fail('invalidRandom');
    return value;
  }
  return 1 + Math.floor(random(rng) * 10);
}
const roundMoney = value => Math.round(value);
const careerOf = player => CAREERS.find(career => career.id === player.career);
const houseOf = player => HOUSES.find(house => house.id === player.house);
const routeOf = player => ROUTES.find(route => route.id === player.route) ?? ROUTES[0];
const cloned = value => JSON.parse(JSON.stringify(value));

function log(state, player, type, data = {}) {
  const params = { name: player?.name ?? '', ...data };
  state.log.push({ id: ++state.logSerial, actionId: state.serial, playerId: player?.id ?? null, type,
    key: `life.log.${type}`, ...params, params });
  // A compact complete-enough recent diary keeps online snapshots small.
  if (state.log.length > 180) state.log.splice(0, state.log.length - 180);
}
function addCash(state, player, amount, { event = false, insured = false } = {}) {
  let value = roundMoney(amount);
  if (insured && player.insurance && value < 0) {
    log(state, player, 'insured', { amount: -value });
    return;
  }
  if (event) {
    const route = routeOf(player);
    value = roundMoney(value * (value < 0 ? route.lossMultiplier : route.gainMultiplier));
  }
  if (!value) return;
  if (player.cash + value < 0) {
    const loan = Math.ceil(-(player.cash + value) / RULES.loanUnit) * RULES.loanUnit;
    player.cash += loan;
    player.debt += loan;
    player.stats.borrowed += loan;
    log(state, player, 'loan', { amount: loan });
  }
  player.cash += value;
  if (value > 0) player.stats.earned += value;
  else player.stats.spent -= value;
  log(state, player, 'cash', { amount: value });
}
function happy(player, amount) {
  // No upper cap: a life rich in memories is a real scoring strategy.
  player.happiness = Math.max(0, player.happiness + amount);
}
function effect(state, player, rule, rng) {
  if (!rule) return;
  if (rule.cash || rule.childCash) addCash(state, player, (rule.cash ?? 0) + (rule.childCash ?? 0) * player.children,
    { event: !rule.fixedCash, insured: rule.insured });
  if (rule.gamble) {
    const won = random(rng) < rule.gamble.chance;
    addCash(state, player, won ? rule.gamble.win : rule.gamble.lose ?? 0, { event: !rule.fixedCash });
  }
  happy(player, rule.happiness ?? 0);
  player.investments += rule.investments ?? 0;
  player.salary += rule.salary ?? 0;
}
function option(id, extra = {}) {
  if (!CHOICES[id]) fail('invalidState');
  return { ...CHOICES[id], ...extra };
}
function pending(state, type, options, meta = {}) {
  const milestone = MILESTONES.find(item => item.id === type);
  state.stage = 'choice';
  state.pending = {
    type,
    title: milestone?.title ?? `life.pending.${type}.title`,
    description: milestone?.description ?? `life.pending.${type}.description`,
    options: options.map(item => cloned(item)),
    ...meta,
  };
}
function careerChoices(state, degree) {
  pending(state, degree ? 'degreeCareer' : 'directCareer', CAREERS.filter(item => item.degree === degree).map(item => ({
    id: `career_${item.id}`, title: item.title, description: item.description, salary: item.salary, career: item.id,
  })));
}
function setCareer(state, player, id) {
  const career = CAREERS.find(item => item.id === id);
  player.career = career.id;
  player.salary = career.salary;
  if (career.freeInsurance) player.insurance = true;
  log(state, player, 'career', { career: career.title, careerId: career.id, careerKey: career.title });
}
function finances(state, player, type = 'market') {
  const options = [option('invest20')];
  if (type === 'investment') options.push(option('invest60'), option('invest120'));
  if (player.investments > 0) options.push(option('cashout', { gain: player.investments }));
  if (player.debt > 0 && player.cash > 0) options.push(option('repay', { cost: Math.min(player.cash, player.debt) }));
  options.push(option('hold'));
  pending(state, type, options);
}
function endResolution(state) {
  state.pending = null;
  state.stage = 'end';
}

function enterMilestone(state, player, milestone) {
  if (player.milestones.includes(milestone.id)) fail('invalidState');
  player.milestones.push(milestone.id);
  if (careerOf(player)?.researchGrant && [48, 64].includes(milestone.index)) {
    addCash(state, player, careerOf(player).researchGrant);
    log(state, player, 'grant', { amount: careerOf(player).researchGrant });
  }
  switch (milestone.id) {
    case 'qualification':
      if (player.education === 'studying') { player.education = 'degree'; careerChoices(state, true); }
      else pending(state, milestone.id, ['training', 'bonus', 'mentor'].map(id => option(id)));
      break;
    case 'firstRoute': case 'secondRoute':
      pending(state, milestone.id, ROUTES.map(route => ({ ...route })));
      break;
    case 'partner': pending(state, milestone.id, ['partner', 'solo'].map(id => option(id))); break;
    case 'home':
      pending(state, milestone.id, [...HOUSES.map(house => ({
        id: `house_${house.id}`, title: house.title, description: house.description,
        cost: house.cost - (careerOf(player)?.houseDiscount ?? 0), value: house.value,
        upkeep: house.upkeep, happiness: house.happiness,
      })), option('rent')]);
      break;
    case 'family': pending(state, milestone.id, ['children0', 'children1', 'children2'].map(id => option(id))); break;
    case 'careerChange': pending(state, milestone.id, ['promotion', 'sabbatical', 'venture'].map(id => option(id))); break;
    case 'investment': finances(state, player, milestone.id); break;
    case 'legacy': pending(state, milestone.id, ['community', 'memories', ...(player.debt && player.cash ? ['repay'] : [])].map(id => option(id))); break;
    case 'retirement': pending(state, milestone.id, [option('retire')]); break;
    default: fail('invalidState');
  }
}
function payday(state, player, rng) {
  const career = careerOf(player);
  let gross = player.salary;
  if (career?.variableBonus) gross += Math.floor(random(rng) * (career.variableBonus / 1000 + 1)) * 1000;
  const upkeep = (houseOf(player)?.upkeep ?? RULES.rent) + player.children * RULES.childUpkeep;
  addCash(state, player, gross - upkeep);
  player.stats.paydays += 1;
  player.stats.salaryEarned += gross;
  log(state, player, 'payday', { amount: gross, upkeep });
  if (player.investments > 0) {
    const roll = random(rng);
    const rates = player.route === 'adventure' ? [-0.10, 0.04, 0.08] : [-0.05, 0.03, 0.06];
    const rate = rates[roll < 0.2 ? 0 : roll < 0.7 ? 1 : 2] + (career?.investmentBonus ?? 0);
    const amount = roundMoney(player.investments * rate);
    player.investments += amount;
    log(state, player, 'investment', { amount, rate });
  }
}
function travel(state, player, destination, rng) {
  const from = player.position;
  // Crossed salaries and debt checkpoints resolve in board order, including a milestone's own cell.
  for (let position = from + 1; position <= destination; position++) {
    if (position % 5 === 0) payday(state, player, rng);
    if (position % 20 === 0 && player.debt > 0) {
      const amount = roundMoney(player.debt * RULES.loanInterest);
      player.debt += amount;
      player.stats.interest += amount;
      log(state, player, 'interest', { amount });
    }
  }
  player.position = destination;
}
function land(state, player, rng) {
  const tile = BOARD[player.position];
  const milestone = MILESTONES.find(item => item.index === player.position);
  if (milestone) return enterMilestone(state, player, milestone);
  if (tile.type === 'tax') { addCash(state, player, -8000, { event: true }); return endResolution(state); }
  if (tile.type === 'market') return finances(state, player);
  if (tile.type === 'payday') return endResolution(state);
  let available = EVENTS.filter(item => !state.usedEvents.includes(item.id));
  if (!available.length) { state.usedEvents = []; available = EVENTS; }
  const event = available[Math.floor(random(rng) * available.length)];
  state.usedEvents.push(event.id);
  player.stats.events += 1;
  pending(state, 'event', event.options.map(item => ({ ...item })), {
    eventId: event.id, title: event.title, description: event.description,
  });
}
function retire(state, player) {
  player.retired = true;
  log(state, player, 'retire');
  if (state.players.every(item => item.retired)) {
    state.status = 'finished';
    state.stage = 'end';
    state.pending = null;
    state.results = state.players.map(item => ({ playerId: item.id, ...scorePlayer(item) }))
      .sort((a, b) => b.total - a.total);
    // Shared rank for exact ties. Turn order never breaks a tie.
    state.results.forEach((item, i, all) => { item.rank = i && item.total === all[i - 1].total ? all[i - 1].rank : i + 1; });
    log(state, null, 'finished');
  } else endResolution(state);
}

export function createGame(players, rng) {
  if (!Array.isArray(players) || players.length !== 2 || players.some(player =>
    !player || typeof player.id !== 'string' || !player.id.trim() || player.id.length > 128 ||
    typeof player.name !== 'string' || !player.name.trim() || player.name.length > 80) || players[0].id === players[1].id) fail('invalidPlayers');
  // Signature deliberately accepts rng for parity with authoritative creation. Setup needs no random draw.
  if (typeof rng !== 'function') fail('invalidRandom');
  const state = {
    version: 1, status: 'playing', turn: 0, round: 1, stage: 'choice', serial: 0, logSerial: 0,
    players: players.map(({ id, name }, seat) => ({
      id, name: name.trim(), seat, position: 0, cash: RULES.startCash, debt: 0,
      career: null, salary: 0, education: 'none', partner: false, children: 0,
      house: null, insurance: false, investments: 0, happiness: 5, retired: false,
      route: 'safe', routeHistory: [], milestones: ['departure'], turns: 0, started: false,
      stats: { earned: 0, spent: 0, borrowed: 0, interest: 0, paydays: 0, salaryEarned: 0, events: 0 },
    })),
    pending: null, lastRoll: null, log: [], usedEvents: [],
  };
  pending(state, 'path', ['career', 'study'].map(id => option(id)));
  log(state, null, 'start');
  return state;
}

/** Optional action.serial checks protect local consumers against stale UI handlers. Online also uses room revision. */
export function applyAction(input, actorId, action, rng) {
  if (!input || input.version !== 1 || !Array.isArray(input.players) || input.players.length !== 2 ||
      ![0, 1].includes(input.turn) || !Number.isSafeInteger(input.serial)) fail('invalidState');
  if (input.status === 'finished') fail('finished');
  if (input.status !== 'playing') fail('invalidState');
  if (input.players[input.turn].id !== actorId) fail('notYourTurn');
  if (!action || typeof action !== 'object' || !['roll', 'choose', 'end'].includes(action.type)) fail('invalidAction');
  if (action.serial !== undefined && action.serial !== input.serial) fail('staleAction');
  if (action.type === 'roll' && (input.stage !== 'roll' || input.pending || input.players[input.turn].retired)) fail('invalidAction');
  if (action.type === 'choose' && (input.stage !== 'choice' || !input.pending)) fail('invalidAction');
  if (action.type === 'end' && (input.stage !== 'end' || input.pending)) fail('invalidAction');
  if (action.type === 'choose' && !input.pending.options.some(item => item.id === action.choice && !item.disabled)) fail('invalidChoice');
  const state = cloned(input);
  const player = state.players[state.turn];
  state.serial += 1;

  if (action.type === 'roll') {
    const value = die(rng);
    const from = player.position;
    const nextStop = MILESTONES.find(item => item.index > from)?.index ?? RULES.retirement;
    const to = Math.min(from + value, nextStop, RULES.retirement);
    player.turns += 1;
    state.lastRoll = { value, playerId: player.id, from, to, id: state.serial };
    log(state, player, 'roll', { value, from, to });
    travel(state, player, to, rng);
    land(state, player, rng);
    return state;
  }

  if (action.type === 'end') {
    let nextTurn = 1 - state.turn;
    if (state.players[nextTurn].retired) nextTurn = state.turn;
    if (nextTurn <= state.turn) state.round += 1;
    state.turn = nextTurn;
    const next = state.players[nextTurn];
    if (!next.started) pending(state, 'path', ['career', 'study'].map(id => option(id)));
    else { state.pending = null; state.stage = 'roll'; }
    return state;
  }

  const choice = state.pending.options.find(item => item.id === action.choice);
  const type = state.pending.type;
  log(state, player, 'choice', { choice: choice.title, choiceKey: choice.title, choiceId: choice.id });
  if (type === 'path') {
    if (choice.id === 'study') {
      player.education = 'studying';
      player.debt = RULES.tuition;
      player.stats.borrowed += RULES.tuition;
      log(state, player, 'tuition', { amount: RULES.tuition });
      player.started = true;
      state.pending = null;
      state.stage = 'roll';
    } else careerChoices(state, false);
    return state;
  }
  if (type === 'directCareer' || type === 'degreeCareer') {
    setCareer(state, player, choice.career);
    if (type === 'directCareer') {
      addCash(state, player, RULES.careerBonus);
      player.started = true;
      state.pending = null;
      state.stage = 'roll';
    } else endResolution(state);
    return state;
  }

  switch (type) {
    case 'qualification':
      if (choice.id === 'training') { addCash(state, player, -20000); player.salary += 3000; }
      if (choice.id === 'bonus') addCash(state, player, 20000);
      if (choice.id === 'mentor') happy(player, 4);
      break;
    case 'firstRoute': case 'secondRoute':
      player.route = choice.id;
      player.routeHistory.push({ index: player.position, route: choice.id });
      if (choice.id === 'safe') addCash(state, player, 10000);
      else happy(player, 2);
      if (!player.insurance) {
        pending(state, 'insurance', ['insure', 'uninsured'].map(id => option(id)));
        return state;
      }
      break;
    case 'insurance':
      if (choice.id === 'insure') { addCash(state, player, -RULES.insuranceCost); player.insurance = true; }
      break;
    case 'partner':
      player.partner = choice.id === 'partner';
      if (player.partner) { addCash(state, player, -15000); happy(player, 2); }
      else happy(player, 4);
      break;
    case 'home':
      if (choice.id === 'rent') happy(player, 11);
      else {
        const house = HOUSES.find(item => `house_${item.id}` === choice.id);
        addCash(state, player, -(house.cost - (careerOf(player)?.houseDiscount ?? 0)));
        player.house = house.id;
        happy(player, house.happiness);
      }
      break;
    case 'family': {
      const count = Number(choice.id.at(-1));
      player.children = count;
      addCash(state, player, -12000 * count);
      happy(player, 2);
      break;
    }
    case 'careerChange':
      if (choice.id === 'promotion') { addCash(state, player, -25000); player.salary += 7000; happy(player, -1); }
      if (choice.id === 'sabbatical') { addCash(state, player, -5000); happy(player, 4); }
      if (choice.id === 'venture') {
        addCash(state, player, -20000);
        if (random(rng) < 0.6) addCash(state, player, 60000);
      }
      break;
    case 'market': case 'investment': case 'legacy':
      if (choice.id.startsWith('invest')) {
        const amount = { invest20: 20000, invest60: 60000, invest120: 120000 }[choice.id];
        addCash(state, player, -amount);
        player.investments += amount;
      }
      if (choice.id === 'cashout') { addCash(state, player, player.investments); player.investments = 0; }
      if (choice.id === 'repay') {
        const amount = Math.min(player.cash, player.debt);
        player.cash -= amount;
        player.debt -= amount;
        log(state, player, 'repayment', { amount });
      }
      if (choice.id === 'community') {
        addCash(state, player, -20000); happy(player, 6);
        if (random(rng) < 0.5) addCash(state, player, 12000);
      }
      if (choice.id === 'memories') { addCash(state, player, -10000); happy(player, 4); }
      break;
    case 'event': effect(state, player, choice.effect, rng); break;
    case 'retirement': retire(state, player); return state;
    default: fail('invalidState');
  }
  endResolution(state);
  return state;
}

/** Scores are meaningful during play too; investments already contain their current mark-to-market value. */
export function scorePlayer(player) {
  const result = {
    cash: player.cash,
    house: houseOf(player)?.value ?? 0,
    investments: player.investments,
    family: (player.partner ? RULES.partnerValue : 0) + player.children * RULES.childValue,
    happiness: player.happiness * RULES.happinessValue,
    debt: player.debt,
  };
  result.total = result.cash + result.house + result.investments + result.family + result.happiness - result.debt;
  return result;
}
