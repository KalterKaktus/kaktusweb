// Dependency-free rules check and reproducible, bounded RTP estimate.
// `node tools/lucky-blackjack-math.mjs [hands]` (default: 2,000,000).
// Dynamic programming gives optimal total-dependent decisions in the infinite-
// deck model; the same strategy is then measured with the real six-deck rules.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export function hand(cards) {
  const hard = cards.reduce((sum, card) => sum + card, 0);
  const soft = cards.includes(1) && hard <= 11;
  return { hard, ace: cards.includes(1), soft, total: hard + (soft ? 10 : 0) };
}
const ranks = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, p: (i === 9 ? 4 : 1) / 13 }));
const totalOf = (hard, ace) => hard + (ace && hard <= 11 ? 10 : 0);

export function optimalInfiniteStrategy() {
  const dealerMemo = new Map();
  function dealer(hard, ace) {
    const key = `${hard}/${ace}`;
    if (dealerMemo.has(key)) return dealerMemo.get(key);
    const total = totalOf(hard, ace);
    const result = [0, 0, 0, 0, 0, 0]; // 17..21, bust
    if (total > 21) result[5] = 1;
    else if (total >= 17) result[total - 17] = 1;
    else for (const card of ranks) {
      const next = dealer(hard + card.value, ace || card.value === 1);
      for (let i = 0; i < result.length; i++) result[i] += card.p * next[i];
    }
    dealerMemo.set(key, result);
    return result;
  }
  const distributions = new Map();
  for (const up of ranks) {
    const result = [0, 0, 0, 0, 0, 0];
    const bj = up.value === 1 ? 4 / 13 : up.value === 10 ? 1 / 13 : 0;
    for (const hole of ranks) {
      if ((up.value === 1 && hole.value === 10) || (up.value === 10 && hole.value === 1)) continue;
      const next = dealer(up.value + hole.value, up.value === 1 || hole.value === 1);
      for (let i = 0; i < result.length; i++) result[i] += hole.p / (1 - bj) * next[i];
    }
    assert.ok(Math.abs(result.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    distributions.set(up.value, result);
  }
  const memo = new Map();
  function stand(total, up) {
    if (total > 21) return -1;
    const dist = distributions.get(up);
    return dist[5] + dist.slice(0, 5).reduce((ev, p, i) => ev + p * Math.sign(total - (i + 17)), 0);
  }
  function choose(hard, ace, up, canDouble = false) {
    const key = `${hard}/${ace}/${up}/${canDouble}`;
    if (memo.has(key)) return memo.get(key);
    const total = totalOf(hard, ace);
    if (total > 21) return { action: 'stand', ev: -1 };
    const values = { stand: stand(total, up) };
    if (total < 21) {
      values.hit = ranks.reduce((ev, c) => ev + c.p * choose(hard + c.value, ace || c.value === 1, up, false).ev, 0);
      if (canDouble) values.double = 2 * ranks.reduce((ev, c) => ev + c.p * stand(totalOf(hard + c.value, ace || c.value === 1), up), 0);
    }
    const best = Object.entries(values).sort((a, b) => b[1] - a[1])[0];
    const answer = { action: best[0], ev: best[1] };
    memo.set(key, answer);
    return answer;
  }
  let profit = 0, doubles = 0;
  for (const first of ranks) for (const second of ranks) for (const up of ranks) {
    const weight = first.p * second.p * up.p;
    const h = hand([first.value, second.value]);
    const dealerNatural = up.value === 1 ? 4 / 13 : up.value === 10 ? 1 / 13 : 0;
    if (h.total === 21) profit += weight * (1 - dealerNatural) * 1.5;
    else {
      const strategy = choose(h.hard, h.ace, up.value, true);
      profit += weight * ((1 - dealerNatural) * strategy.ev - dealerNatural);
      if (strategy.action === 'double') doubles += weight * (1 - dealerNatural);
    }
  }
  return { choose, profit, wager: 1 + doubles, rtp: 1 + profit / (1 + doubles), initialReturn: 1 + profit };
}

export function simulateSixDecks(count = 2_000_000, seed = 0x4b414b54) {
  const strategy = optimalInfiniteStrategy();
  const deck = new Uint8Array(312);
  let rng = seed >>> 0;
  const random = () => { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng >>> 0) / 4294967296; };
  let cursor;
  const draw = () => {
    const index = cursor + Math.floor(random() * (312 - cursor));
    const card = deck[index]; deck[index] = deck[cursor]; deck[cursor++] = card;
    return card;
  };
  let sumProfit = 0, sumWager = 0, sumProfit2 = 0, sumWager2 = 0, sumCross = 0;
  const outcomes = { natural: 0, win: 0, push: 0, loss: 0, bust: 0, double: 0 };
  for (let round = 0; round < count; round++) {
    for (let i = 0; i < 312; i++) deck[i] = Math.min(i % 13 + 1, 10);
    cursor = 0;
    const player = [draw()]; const dealer = [draw()]; player.push(draw()); dealer.push(draw());
    let ph = hand(player), dh = hand(dealer), wager = 1, profit = 0;
    if (ph.total === 21 || dh.total === 21) {
      if (ph.total === 21 && dh.total === 21) outcomes.push++;
      else if (ph.total === 21) { profit = 1.5; outcomes.natural++; }
      else { profit = -1; outcomes.loss++; }
    } else {
      let canDouble = true;
      while (ph.total < 21) {
        const { action } = strategy.choose(ph.hard, ph.ace, dealer[0], canDouble);
        if (action === 'stand') break;
        player.push(draw()); ph = hand(player);
        if (action === 'double') { wager = 2; outcomes.double++; break; }
        canDouble = false;
      }
      if (ph.total > 21) { profit = -wager; outcomes.bust++; }
      else {
        while (dh.total < 17) { dealer.push(draw()); dh = hand(dealer); }
        if (dh.total > 21 || ph.total > dh.total) { profit = wager; outcomes.win++; }
        else if (ph.total === dh.total) outcomes.push++;
        else { profit = -wager; outcomes.loss++; }
      }
    }
    sumProfit += profit; sumWager += wager;
    sumProfit2 += profit * profit; sumWager2 += wager * wager; sumCross += profit * wager;
  }
  const ratio = sumProfit / sumWager;
  const variance = (sumProfit2 - 2 * ratio * sumCross + ratio * ratio * sumWager2) / (count - 1);
  const se = Math.sqrt(variance / count) / (sumWager / count);
  return { hands: count, seed, rtp: 1 + ratio, confidence95: [1 + ratio - 1.96 * se, 1 + ratio + 1.96 * se], netPerInitialStake: sumProfit / count, meanWager: sumWager / count, outcomes,
    infiniteDeck: { rtp: strategy.rtp, netPerInitialStake: strategy.profit, meanWager: strategy.wager } };
}

export function checkRules() {
  assert.deepEqual(hand([1, 1, 9]), { hard: 11, ace: true, soft: true, total: 21 });
  assert.equal(hand([1, 1, 10]).total, 12);
  assert.equal(hand([1, 6]).total, 17);
  assert.equal(hand([1, 6]).soft, true);
  assert.equal(hand([10, 1]).total, 21);
  const { choose } = optimalInfiniteStrategy();
  assert.equal(choose(11, false, 6, true).action, 'double');
  assert.equal(choose(16, false, 6, true).action, 'stand');
  assert.equal(choose(16, false, 10, true).action, 'hit');
  assert.equal(choose(7, true, 10, true).action, 'hit'); // soft 17
  assert.equal(choose(10, true, 6, true).action, 'stand'); // soft 20
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkRules();
  const hands = Number(process.argv[2] || 2_000_000);
  assert.ok(Number.isInteger(hands) && hands >= 1000 && hands <= 10_000_000);
  console.log(JSON.stringify(simulateSixDecks(hands), null, 2));
}
