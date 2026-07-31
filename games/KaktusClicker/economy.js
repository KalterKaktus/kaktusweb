import { achievements, buildings, upgrades } from "./data.js";

export const ACHIEVEMENT_BONUS = 0.1;
export const CLICK_FRENZY_MULTIPLIER = 3;
// V3: 250 statt 1000 Klicks — bei den echten Spielern kam der Goldlauf sonst
// nur 4-7x pro MONAT vor. Lebt hier statt in game.js, weil state.js den Wert
// zum Clampen des geladenen Spielstands braucht.
export const CLICK_FRENZY_TARGET = 250;
// Klicks ernten zusätzlich diesen Anteil der Auto-Produktion (Economy V3).
// Die Klick-Sog-Upgrades multiplizieren den Satz (x2 x2 -> max 4 %).
export const CLICK_CPS_SHARE = 0.01;

export function getBuildingCost(state, building) {
  return Math.ceil(building.baseCost * Math.pow(1.15, state.buildings[building.id] || 0));
}

export function getUpgradeMultipliers(state) {
  return state.upgrades.reduce((multipliers, upgradeId) => {
    const upgrade = upgrades.find((item) => item.id === upgradeId);
    if (!upgrade) {
      return multipliers;
    }

    if (upgrade.buildingId) {
      multipliers.buildingMultipliers[upgrade.buildingId] =
        (multipliers.buildingMultipliers[upgrade.buildingId] || 1) * (upgrade.buildingMultiplier || 1);
    }

    multipliers.click *= upgrade.clickMultiplier || 1;
    multipliers.clickCps *= upgrade.clickCpsMultiplier || 1;
    multipliers.production *= upgrade.productionMultiplier || 1;
    multipliers.autoClicks += upgrade.autoClicksPerSecond || 0;
    return multipliers;
  }, { click: 1, clickCps: 1, production: 1, autoClicks: 0, buildingMultipliers: {} });
}

// Economy V3: erster Nopal bei 1 Mio. totalEarned (vorher 100k mit Exponent,
// der Nopal so verknappt hat, dass der Top-Spieler Prestige komplett ignoriert
// hat). Exponent 0,35 bleibt, die Basis wandert auf 1e6.
const PRESTIGE_BASE = 1e6;
const PRESTIGE_EXPONENT = 0.35;

export function getPrestigeAvailableTotal(state) {
  return Math.floor(Math.pow(Math.max(0, state.totalEarned) / PRESTIGE_BASE, PRESTIGE_EXPONENT));
}

export function getNewNopal(state) {
  return Math.max(0, getPrestigeAvailableTotal(state) - state.prestige.totalNopalEarned);
}

export function getNopalGap(state) {
  const nextNopalTotal = state.prestige.totalNopalEarned + getNewNopal(state) + 1;
  const nextTarget = Math.pow(nextNopalTotal, 1 / PRESTIGE_EXPONENT) * PRESTIGE_BASE;
  return Math.max(0, nextTarget - state.totalEarned);
}

// V3: 1 + 0,25·n^0,4 — gedämpfte Kurve, simuliert gegen echtes Spielerverhalten.
// Gefühl: x1,25 nach ~1 Mio., x2,7 bei 1 Bio., x13 bei 1 Trd. Ernte.
export function getPrestigeMultiplier(state) {
  return 1 + Math.pow(Math.max(0, state.prestige.nopal), 0.4) * 0.25;
}

// Auto-Klicks pro Sekunde aus den Autoklicker-Upgrades. Ob sie gerade laufen
// dürfen (Tab sichtbar, kürzliche Eingabe), entscheidet game.js.
export function getAutoClickRate(state) {
  return getUpgradeMultipliers(state).autoClicks;
}

export function getAchievementMultiplier(state) {
  const unlocked = achievements.filter((achievement) => state.achievements.includes(achievement.id)).length;
  return 1 + unlocked * ACHIEVEMENT_BONUS;
}

export function isClickFrenzyActive(state, now = Date.now()) {
  return Number(state.events.frenzyUntil) > now;
}

export function getEventMultiplier(state, now = Date.now()) {
  return isClickFrenzyActive(state, now) ? CLICK_FRENZY_MULTIPLIER : 1;
}

export function getCoreMultiplier(state, { includeEvent = true, now = Date.now() } = {}) {
  return getPrestigeMultiplier(state) *
    getAchievementMultiplier(state) *
    (includeEvent ? getEventMultiplier(state, now) : 1);
}

export function getAutomaticProduction(state, { includeEvent = true, now = Date.now() } = {}) {
  const { production, buildingMultipliers } = getUpgradeMultipliers(state);
  const buildingProduction = buildings.reduce((sum, building) => {
    const amount = state.buildings[building.id] || 0;
    const buildingMultiplier = buildingMultipliers[building.id] || 1;
    return sum + amount * building.cps * buildingMultiplier;
  }, 0);

  return buildingProduction * production * getCoreMultiplier(state, { includeEvent, now });
}

export function getClickYield(state, { includeEvent = true, now = Date.now() } = {}) {
  const { click, clickCps } = getUpgradeMultipliers(state);
  const base = click * getCoreMultiplier(state, { includeEvent, now });
  // V3: Klicks skalieren mit der Auto-Produktion und bleiben dadurch für immer
  // relevant. Die CPS trägt den Core-Multiplikator bereits in sich.
  const cpsShare = CLICK_CPS_SHARE * clickCps * getAutomaticProduction(state, { includeEvent, now });
  return base + cpsShare;
}

export function getBuildingProduction(state, building) {
  const { production, buildingMultipliers } = getUpgradeMultipliers(state);
  return building.cps *
    (buildingMultipliers[building.id] || 1) *
    production *
    getCoreMultiplier(state, { includeEvent: true });
}

export function totalBuildings(state) {
  return Object.values(state.buildings).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
}
