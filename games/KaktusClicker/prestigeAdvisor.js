// Wann lohnt sich Prestige? — reine Rechenlogik, kein DOM.
//
// ---------------------------------------------------------------------------
// Warum der Prestige-Tab die Frage bisher nicht beantworten konnte
// ---------------------------------------------------------------------------
// Er zeigt den Ist-Stand: verfügbarer Nopal, Bonus danach, Lücke zum nächsten.
// Alle drei wachsen monoton mit der Spielzeit, weil `totalEarned` beim Prestige
// NIE zurückgesetzt wird. „Länger spielen bringt mehr" ist damit immer wahr und
// als Entscheidungshilfe wertlos.
//
// ---------------------------------------------------------------------------
// Was hier stattdessen gerechnet wird
// ---------------------------------------------------------------------------
// Ein Run stockt, weil die Kostenkurve 1,15^Besitz jeden weiteren Kauf teurer
// macht: die Produktion verdoppelt sich anfangs mehrmals pro Stunde, später
// kaum noch. Prestige setzt die Gebäude zurück, wirft dich also in die schnelle
// Wachstumszone zurück — dafür mit einem größeren Multiplikator.
//
// Die Schwelle ist der Schnittpunkt:
//   Prestige lohnt, sobald der RÜCKBAU auf das aktuelle Produktionsniveau
//   kürzer ist als die Zeit, die dasselbe Niveau durch Weiterspielen kostet.
//
// Deshalb sind die drei ausgegebenen Kennzahlen:
//   * Wachstum in Verdopplungen pro Stunde  → wie stark stockt der Run?
//   * Multiplikator-Faktor M_neu / M_alt    → was bringt der Reset überhaupt?
//   * Rückbauzeit                           → was kostet er?
//
// ---------------------------------------------------------------------------
// Warum ein eigenes Rechenmodell statt Aufrufen von economy.js im Loop
// ---------------------------------------------------------------------------
// getUpgradeMultipliers() läuft über alle gekauften Upgrades und sucht jedes per
// find() in einer 158er-Liste — das ist pro Aufruf O(n²) und in einer Schleife
// mit Zehntausenden Schritten zu langsam. Das Modell hier führt die
// Multiplikatoren inkrementell mit. `assertModelMatchesEconomy()` prüft gegen
// economy.js, dass beide dasselbe rechnen.

import { buildings, upgrades } from "./data.js";
import {
  CLICK_CPS_SHARE,
  getAchievementMultiplier,
  getAutomaticProduction,
  getEventIncomeFactor,
  getNewNopal,
  getPrestigeMultiplier,
} from "./economy.js";

const COST_GROWTH = 1.15;
// Obergrenze gegen Endlosschleifen bei absurden Spielständen.
const MAX_STEPS = 20000;

// ---------------------------------------------------------------------------
// Internes Modell
// ---------------------------------------------------------------------------

function createModel(state, { nopalOverride = null, eventCaptureRate } = {}) {
  const owned = buildings.map((b) => Math.max(0, Math.floor(Number(state.buildings?.[b.id]) || 0)));
  const boughtUpgrades = new Set(state.upgrades || []);
  const buildingMultiplier = buildings.map(() => 1);
  let clickMultiplier = 1;
  let clickCpsMultiplier = 1;
  let productionMultiplier = 1;

  const byBuildingIndex = new Map(buildings.map((b, i) => [b.id, i]));
  for (const id of boughtUpgrades) {
    const upgrade = upgrades.find((u) => u.id === id);
    if (!upgrade) continue;
    const index = byBuildingIndex.get(upgrade.buildingId);
    if (index !== undefined) buildingMultiplier[index] *= upgrade.buildingMultiplier || 1;
    clickMultiplier *= upgrade.clickMultiplier || 1;
    clickCpsMultiplier *= upgrade.clickCpsMultiplier || 1;
    productionMultiplier *= upgrade.productionMultiplier || 1;
  }

  const nopal = nopalOverride === null ? (state.prestige?.nopal || 0) : nopalOverride;

  return {
    owned,
    boughtUpgrades,
    buildingMultiplier,
    clickMultiplier,
    clickCpsMultiplier,
    productionMultiplier,
    byBuildingIndex,
    cactus: Math.max(0, Number(state.cactus) || 0),
    totalEarned: Math.max(0, Number(state.totalEarned) || 0),
    nopal,
    // Abzeichen wirken global. Sie im Lauf der Simulation weiter freizuschalten
    // würde das Ergebnis nur um wenige Prozent verschieben, aber die Rechnung
    // deutlich verkomplizieren — deshalb als Konstante des Startzustands.
    //
    // Bewusst über economy.js statt `achievements.length`: dort zählen nur IDs,
    // die es wirklich gibt. Ein Save mit unbekannten Einträgen (alte Version,
    // manipuliert) hätte sonst hier einen höheren Multiplikator als im Spiel.
    achievementMultiplier: getAchievementMultiplier({ achievements: state.achievements || [] }),
    // 0 = niemand sammelt Events ein (offline), 1 = jedes Event getroffen.
    eventCaptureRate,
  };
}

function coreMultiplier(model) {
  return (1 + Math.pow(Math.max(0, model.nopal), 0.4) * 0.25) * model.achievementMultiplier;
}

function production(model) {
  let sum = 0;
  for (let i = 0; i < buildings.length; i += 1) {
    if (model.owned[i] > 0) sum += model.owned[i] * buildings[i].cps * model.buildingMultiplier[i];
  }
  return sum * model.productionMultiplier * coreMultiplier(model);
}

function clickYield(model) {
  return model.clickMultiplier * coreMultiplier(model)
    + CLICK_CPS_SHARE * model.clickCpsMultiplier * production(model);
}

function buildingCost(model, index) {
  return Math.ceil(buildings[index].baseCost * Math.pow(COST_GROWTH, model.owned[index]));
}

// Bester Kauf nach Amortisation (Kosten je zusätzlicher CPS) — dieselbe Regel,
// nach der auch der Kauf-Optimizer im Wiki plant.
function bestPurchase(model) {
  const core = model.productionMultiplier * coreMultiplier(model);
  let best = null;

  for (let i = 0; i < buildings.length; i += 1) {
    const gain = buildings[i].cps * model.buildingMultiplier[i] * core;
    if (gain <= 0) continue;
    const cost = buildingCost(model, i);
    const payback = cost / gain;
    if (!best || payback < best.payback) best = { kind: "building", index: i, cost, payback };
  }

  for (const upgrade of upgrades) {
    if (model.boughtUpgrades.has(upgrade.id)) continue;
    const index = model.byBuildingIndex.get(upgrade.buildingId);
    if (index === undefined) continue;
    if (upgrade.unlockOwned && model.owned[index] < upgrade.unlockOwned) continue;
    const gain = model.owned[index] * buildings[index].cps * model.buildingMultiplier[index]
      * core * ((upgrade.buildingMultiplier || 1) - 1);
    if (gain <= 0) continue;
    const payback = upgrade.cost / gain;
    if (!best || payback < best.payback) {
      best = { kind: "upgrade", upgrade, index, cost: upgrade.cost, payback };
    }
  }

  return best;
}

function applyPurchase(model, purchase) {
  model.cactus -= purchase.cost;
  if (purchase.kind === "building") {
    model.owned[purchase.index] += 1;
  } else {
    model.boughtUpgrades.add(purchase.upgrade.id);
    model.buildingMultiplier[purchase.index] *= purchase.upgrade.buildingMultiplier || 1;
  }
}

/**
 * Simuliert einen Run vorwärts.
 *
 * @param {object} model      Zustand (wird mutiert)
 * @param {number} seconds    Zeithorizont
 * @param {number} clicksPerSecond  angenommene Klickrate
 * @param {function} [stopWhen] optionaler Abbruch, bekommt (model, elapsed)
 * @returns {{elapsed:number, reachedStop:boolean}}
 */
function simulate(model, seconds, clicksPerSecond, stopWhen) {
  let elapsed = 0;
  // Gold- und Rubinkaktus schütten ein Vielfaches der laufenden Produktion aus.
  // Weil die Belohnung proportional zur CPS ist, wirken sie wie ein konstanter
  // Faktor auf das Einkommen — genau so werden sie hier abgebildet, statt
  // einzelne Spawns zu würfeln. Ohne das rechnet der Rechner rund 19-fach
  // daneben, denn bei aktivem Spielen kommen ~95 % des Einkommens aus Events.
  const eventFactor = model.eventCaptureRate === undefined
    ? 1
    : getEventIncomeFactor(model.eventCaptureRate);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (stopWhen && stopWhen(model, elapsed)) return { elapsed, reachedStop: true };
    if (elapsed >= seconds) return { elapsed, reachedStop: false };

    const rate = production(model) * eventFactor + clickYield(model) * clicksPerSecond;
    const purchase = bestPurchase(model);

    // Ohne Einkommen und ohne bezahlbaren Kauf passiert nichts mehr.
    if (rate <= 0) {
      if (!purchase || model.cactus < purchase.cost) return { elapsed: seconds, reachedStop: false };
      applyPurchase(model, purchase);
      continue;
    }

    if (!purchase) {
      const rest = seconds - elapsed;
      model.cactus += rate * rest;
      model.totalEarned += rate * rest;
      return { elapsed: seconds, reachedStop: false };
    }

    const wait = Math.max(0, (purchase.cost - model.cactus) / rate);
    const stepSeconds = Math.min(wait, seconds - elapsed);
    model.cactus += rate * stepSeconds;
    model.totalEarned += rate * stepSeconds;
    elapsed += stepSeconds;

    if (stepSeconds >= wait) applyPurchase(model, purchase);
  }
  return { elapsed, reachedStop: false };
}

// ---------------------------------------------------------------------------
// Kennzahlen
// ---------------------------------------------------------------------------

/**
 * Wachstum in Verdopplungen pro Stunde.
 *
 * Achtung bei der Deutung: In diesem Spiel bleibt der Wert auch spät im Run
 * hoch (gemessen ~10/h), weil die Gebäudeleiter 30 Stufen hat — wird ein
 * Gebäude durch 1,15^Besitz teuer, steigt man einfach ins nächste um. Ein Run
 * „stockt" hier also nicht so, wie man es aus Spielen mit kurzer Leiter kennt.
 * Die Zahl ist deshalb Kontext für die Anzeige, nicht das Entscheidungskriterium.
 */
function growthDoublingsPerHour(state, clicksPerSecond, eventCaptureRate, windowSeconds = 3600) {
  const model = createModel(state, { eventCaptureRate });
  const before = production(model);
  if (before <= 0) return Infinity; // ganz am Anfang: Wachstum ist praktisch unendlich
  const result = simulate(model, windowSeconds, clicksPerSecond);
  const after = production(model);
  if (after <= before) return 0;
  // Auf die TATSÄCHLICH simulierte Zeit normieren. Bricht die Schleife am
  // Schrittlimit vorzeitig ab, wäre die Rate sonst massiv überschätzt.
  const seconds = Math.max(1, result.elapsed);
  return Math.log2(after / before) * (3600 / seconds);
}

/**
 * Wie lange dauert es nach einem Prestige, wieder das Produktionsniveau
 * `target` zu erreichen?
 */
function rebuildSeconds(state, nopalAfter, target, clicksPerSecond, limitSeconds, eventCaptureRate) {
  const fresh = createModel({
    buildings: {},
    upgrades: [],
    achievements: state.achievements || [],
    cactus: 0,
    totalEarned: state.totalEarned,
    prestige: { nopal: nopalAfter },
  }, { nopalOverride: nopalAfter, eventCaptureRate });

  const result = simulate(fresh, limitSeconds, clicksPerSecond, (m) => production(m) >= target);
  return result.reachedStop ? result.elapsed : Infinity;
}

// ---------------------------------------------------------------------------
// Öffentliche Analyse
// ---------------------------------------------------------------------------

/**
 * @param {object} state           aktueller Spielstand
 * @param {object} [options]
 * @param {number} [options.clicksPerSecond]  angenommene Klickrate (0 = reines Idle)
 * @param {number[]} [options.waitOptions]    zu prüfende Wartezeiten in Sekunden
 * @param {number} [options.horizonSeconds]   Zeit bis Saisonende
 */
const DEFAULT_THRESHOLDS = [1.02, 1.05, 1.1, 1.2, 1.35, 1.6, 2, 3, 5, Infinity];

export function analysePrestige(state, options = {}) {
  const clicksPerSecond = Math.max(0, Number(options.clicksPerSecond) || 0);
  const horizonSeconds = Math.max(60, Number(options.horizonSeconds) || 7 * 86400);
  // Über sehr lange Horizonte wird die Simulation teuer und ungenau (die Zahlen
  // laufen ins Astronomische). Für die Entscheidung reichen ein paar Tage.
  const simHorizon = Math.min(horizonSeconds, 3 * 86400);

  const currentProduction = getAutomaticProduction(state, { includeEvent: false });
  const currentMultiplier = getPrestigeMultiplier(state);
  const newNopal = getNewNopal(state);
  const nopalAfter = (state.prestige?.nopal || 0) + newNopal;
  const multiplierAfter = getPrestigeMultiplier({ prestige: { nopal: nopalAfter } });
  const gainFactor = currentMultiplier > 0 ? multiplierAfter / currentMultiplier : 1;

  // Wie viel Anteil der Events sammelst du ein? Der Wert entscheidet über den
  // Zeitmaßstab: bei 1 läuft alles rund 19-mal schneller als rein passiv.
  const eventCaptureRate = options.eventCaptureRate === undefined ? 0.5 : options.eventCaptureRate;

  const growth = growthDoublingsPerHour(state, clicksPerSecond, eventCaptureRate);
  const rebuild = currentProduction > 0 && newNopal > 0
    ? rebuildSeconds(state, nopalAfter, currentProduction, clicksPerSecond, simHorizon, eventCaptureRate)
    : Infinity;

  // Die eigentliche Antwort: welche Schwellen-Regel bringt am Saisonende am meisten?
  const policies = (options.thresholds || DEFAULT_THRESHOLDS)
    .map((factor) => simulateWithThreshold(state, factor, clicksPerSecond, simHorizon, eventCaptureRate))
    .filter((p) => Number.isFinite(p.finalTotalEarned));
  policies.sort((a, b) => b.finalTotalEarned - a.finalTotalEarned);
  const bestPolicy = policies[0];

  // Was folgt daraus für JETZT? Erreicht der aktuelle Sprung die beste Schwelle,
  // ist Prestige fällig — sonst muss noch Nopal wachsen.
  const thresholdMet = bestPolicy
    && Number.isFinite(bestPolicy.thresholdFactor)
    && newNopal > 0
    && gainFactor >= bestPolicy.thresholdFactor;

  return {
    growthDoublingsPerHour: growth,
    newNopal,
    gainFactor,
    multiplierNow: currentMultiplier,
    multiplierAfter,
    rebuildSeconds: rebuild,
    bestThreshold: bestPolicy ? bestPolicy.thresholdFactor : Infinity,
    prestigeNow: Boolean(thresholdMet),
    // Wann die Regel das nächste Mal zuschlägt, wenn nicht jetzt.
    nextPrestigeInSeconds: bestPolicy ? bestPolicy.firstPrestigeAt : null,
    expectedPrestiges: bestPolicy ? bestPolicy.prestiges : 0,
    policies,
    horizonSeconds,
    clicksPerSecond,
    eventCaptureRate,
    eventIncomeFactor: getEventIncomeFactor(eventCaptureRate),
  };
}

// ---------------------------------------------------------------------------
// Schwellen-Politik
// ---------------------------------------------------------------------------
// „Wann einmal prestigen?" ist die falsche Frage, wenn bis Saisonende noch Tage
// übrig sind — man prestiged dann viele Male. Gesucht ist eine REGEL:
//
//     Prestige immer dann, wenn der Multiplikator-Sprung Faktor X übersteigt.
//
// Diese Politik wird über die Restsaison durchsimuliert; gewertet wird
// `totalEarned` am Ende, der Ranglistenwert. Das X mit dem höchsten Endstand ist
// die gesuchte Schwelle — und aus ihr folgt direkt, ob JETZT prestigt werden
// sollte oder erst in einer Weile.

const PRESTIGE_CHECK_INTERVAL = 300; // alle 5 Minuten prüfen

function simulateWithThreshold(state, thresholdFactor, clicksPerSecond, horizonSeconds, eventCaptureRate) {
  let model = createModel(state, { eventCaptureRate });
  let nopalTotalEarned = state.prestige?.totalNopalEarned || 0;
  let nopal = state.prestige?.nopal || 0;
  let elapsed = 0;
  let prestiges = 0;
  let firstPrestigeAt = null;

  while (elapsed < horizonSeconds) {
    const slice = Math.min(PRESTIGE_CHECK_INTERVAL, horizonSeconds - elapsed);
    simulate(model, slice, clicksPerSecond);
    elapsed += slice;

    if (!Number.isFinite(thresholdFactor)) continue; // Politik „nie prestigen"

    const available = Math.floor(Math.pow(Math.max(0, model.totalEarned) / 1e6, 0.35));
    const gained = Math.max(0, available - nopalTotalEarned);
    if (gained <= 0) continue;

    const before = 1 + Math.pow(Math.max(0, nopal), 0.4) * 0.25;
    const after = 1 + Math.pow(Math.max(0, nopal + gained), 0.4) * 0.25;
    if (after / before < thresholdFactor) continue;

    nopal += gained;
    nopalTotalEarned += gained;
    prestiges += 1;
    if (firstPrestigeAt === null) firstPrestigeAt = elapsed;

    const carriedTotalEarned = model.totalEarned;
    model = createModel({
      buildings: {},
      upgrades: [],
      achievements: state.achievements || [],
      cactus: 0,
      totalEarned: carriedTotalEarned,
      prestige: { nopal },
    }, { nopalOverride: nopal, eventCaptureRate });
  }

  return {
    thresholdFactor,
    finalTotalEarned: model.totalEarned,
    prestiges,
    firstPrestigeAt,
    finalNopal: nopal,
  };
}

/**
 * Prüft, dass das interne Modell dasselbe rechnet wie economy.js. Wird von den
 * Tests und beim ersten Aufruf im Spiel benutzt — driftet eine der beiden
 * Formeln, fällt es sofort auf statt still falsche Empfehlungen zu geben.
 */
export function assertModelMatchesEconomy(state) {
  const model = createModel(state);
  const mine = production(model);
  const theirs = getAutomaticProduction(state, { includeEvent: false });
  if (theirs === 0) return mine === 0;
  return Math.abs(mine - theirs) / theirs < 1e-9;
}

export const __test__ = { createModel, production, clickYield, simulate, bestPurchase };
