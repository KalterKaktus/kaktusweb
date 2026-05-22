import { achievements, buildings, upgrades } from "./data.js";

export const ACHIEVEMENT_BONUS = 0.1;
export const CLICK_FRENZY_MULTIPLIER = 2;

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
    multipliers.production *= upgrade.productionMultiplier || 1;
    return multipliers;
  }, { click: 1, production: 1, buildingMultipliers: {} });
}

export function getPrestigeAvailableTotal(state) {
  return Math.floor(Math.pow(Math.max(0, state.totalEarned) / 100000, 0.35));
}

export function getNewNopal(state) {
  return Math.max(0, getPrestigeAvailableTotal(state) - state.prestige.totalNopalEarned);
}

export function getNopalGap(state) {
  const nextNopalTotal = state.prestige.totalNopalEarned + getNewNopal(state) + 1;
  const nextTarget = Math.pow(nextNopalTotal, 1 / 0.35) * 100000;
  return Math.max(0, nextTarget - state.totalEarned);
}

export function getPrestigeMultiplier(state) {
  return 1 + Math.pow(Math.max(0, state.prestige.nopal), 0.6) * 0.15;
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
  const { click } = getUpgradeMultipliers(state);
  return click * getCoreMultiplier(state, { includeEvent, now });
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
