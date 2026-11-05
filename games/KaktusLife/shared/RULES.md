# KaktusLife rules and balance

An original, two-person life board game with fictional Kaktus-Taler. There are no AI players in the product. Online and local practice import the same dependency-free ES-module rules engine.

## Public API and deterministic state

`createGame([{id,name},{id,name}], rng)` creates a two-seat game. `applyAction(state, actorId, action, rng)` returns a fresh, JSON-serializable state; it never changes its input. `scorePlayer(player)` returns `{cash,house,investments,family,happiness,debt,total}`. All money uses integer Taler. All visible copy is a `life.*` translation key, with complete German/Russian catalogue dictionaries.

Actions are `roll`, `choose` with a pending option ID, and `end`. The engine checks the current actor, stage and option. An optional `action.serial` must equal `state.serial`; online play additionally uses database revision comparison and UUID receipts. A roll cannot be repeated while its decision/end stage is unresolved. Chained setup, career and insurance choices use distinct option IDs. A failed action throws an error with a `life.errors.*` code and leaves the input intact.

RNG is explicitly injected; the engine never uses a clock or `Math.random`. Ordinary draws require a number in `[0,1)`. The server attaches `rng.int(1,11)`, backed by `crypto.randomInt`, for an exactly uniform 1–10 die. Seeded practice/test RNGs use the equivalent interval mapping. Dice outcomes are rolled independently of player finances or progress.

## Turn and movement rules

The board has 81 cells, numbered 0–80. Milestones at 0, 8, 16, 24, 32, 40, 48, 56, 64, 72 and 80 stop movement even after an overshoot; unused movement is discarded. Every player receives all 16 crossed paydays exactly once. Salary is attached to board progress, never to the number of turns, so a low die does not farm salary. Non-milestone landings produce events, tax, investment opportunities or a payday. There are 40 original two-option event cards; the shared event pool draws without replacement and renews only when exhausted.

The first turn begins with a career/study decision. Direct entrants select a profession and receive 20,000. Students retain their 40,000 starting cash, acquire 60,000 actual debt, miss the first salary and select a degree profession at cell 8. The second player makes their setup decisions on their first turn. Retired players are skipped. Everyone reaches cell 80 before scores are compared; there is no arrival-order bonus. Exact ties share a rank.

## Choices and economy

- Careers have persistent, different benefits: property discount, free insurance, variable commission, improved investment returns or research grants. Qualification can buy a permanent raise, provide ready cash or award happiness. The cell-48 promotion changes all remaining salaries.
- Safe/adventure routes are selected at cells 16 and 56. Safe reduces event/tax losses to 80% and leaves gains unchanged; adventure multiplies losses by 1.4 and gains by 1.5. Safe immediately gives 10,000; adventure gives two happiness points. Routes also change the risk distribution of investments. Essential purchases, salaries, debt and grants do not receive route multipliers.
- Partnership costs 15,000 and gives two happiness points plus a final 25,000 family value. A solo life gives four happiness points. Either choice can form a family later.
- Houses cost money immediately, carry per-payday upkeep and contribute their listed resale value at the end. The workshop career receives a 15,000 purchase discount. Renting gives 11 happiness points for flexibility and continues the 3,000 rent payment each payday. Cash scarcity and future loan interest matter when comparing homes.
- At cell 40, children cost 12,000 each initially and 2,500 each on every later payday; each contributes 35,000 final family value. Zero, one and two children each give two happiness points. Some later events also have per-child costs.
- Insurance costs 18,000 once and lasts to retirement. It covers the whole cash loss only for explicitly marked insured event options. Other event choices and normal expenses remain payable. Already insured players are never asked to repurchase it.
- If a payment would make cash negative, the engine automatically finances the shortage in 10,000 loan units. Residual loan cash stays available. Debt is real: it accrues 10% at crossed cells 20, 40, 60 and 80 and is subtracted in the final score. Financial opportunities permit repayment from actual available cash, without borrowing to repay.
- Buying investments exchanges cash for the same current asset value. At each later payday, the safe route has 20%/50%/30% chances of −5%/+3%/+6%; adventure has the same probabilities of −10%/+4%/+8%. Engineering adds two percentage points. Values are rounded to whole Taler. Investments can be sold at current value without a fee. Cell 64 offers 20,000, 60,000 and 120,000 purchase sizes.
- Happiness has no upper cap and is worth 5,000 per point. At cell 72 the community garden offers a higher expected return with a possible matching grant; the final trip offers a certain happiness return. Debt repayment remains available. Final score is cash + house + investments + family + happiness value − debt.

The log keeps the latest 180 entries to bound room snapshot size. Monotonic log IDs and action serials are not reset when older entries are dropped.

## Verification

Run:

```sh
node --test games/KaktusLife/tests/engine.test.mjs games/KaktusLife/tests/server.test.mjs
node games/KaktusLife/tests/balance.mjs 10000
```

The final engine/server run passed all **27 tests** (16 engine, 11 server). Engine tests cover bilingual catalogue completeness, frozen-input purity, illegal and stale actions, every die interval, mandatory stops and crossed salaries, degree gating, loan/interest accounting, route/insurance effects, career perks, family upkeep, investment/repayment conservation, deck renewal, every event option and both-player retirement with ties.

The final seeded simulation on 2026-11-05 completed **10,000 full games and 1,149,397 legal actions** in 188.6 seconds. It alternates seats and checks game termination, integer nonnegative balances, all milestones and all 16 salaries for every player. Seed for game `g` is `0x9e3779b9 XOR imul(g+1,2654435761)`, using xorshift32. It includes 6,000 direct-career versus degree games, 2,000 matched-career route games, and 2,000 matched-career lifestyle games. Policies are documented in `tests/balance.mjs`; they use visible expected values, not hidden future draws.

| Comparison | Win share | Mean final score |
| --- | ---: | ---: |
| First seat, all 10,000 games | 49.53% | 696,794 |
| Second seat | 50.47% | 696,687 |
| Direct career, 6,000 games | 47.53% | 695,849 |
| Study | 52.47% | 698,924 |
| Safe route, 2,000 games | 45.80% | 697,806 |
| Adventure route | 54.20% | 704,152 |
| Financial lifestyle, 2,000 games | 59.95% | 696,665 |
| Memories/family lifestyle | 40.05% | 684,465 |

Individual career win shares were 46.36% workshop, 49.70% ranger, 46.55% creator, 52.99% engineer, 54.60% doctor and 49.80% scientist. Mean scores ranged from 693,796 to 700,441, a spread below 1% of the overall mean. Adventure had the intended greater dispersion: score SD 43,922 versus safe 36,009. These figures are evidence for the specified policies and seed set, not proof of optimal play or equal outcomes for every strategy.

Rolls per player averaged **19.47**, with median **19**, 10th/90th percentiles **16/23**, and observed range **11–33**. At roughly 30 seconds per person's turn, two people spend about 19.5 minutes on turns before setup and extra reading. A 20–30 minute session is plausible; real human session timing has not been measured.
