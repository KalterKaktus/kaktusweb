import { AREAS, AREA_ORDER } from "../data/areas.js";
import { UPGRADES, UPGRADE_ORDER } from "../data/upgrades.js";

export function getUpgradeLevel(state, upgradeId) {
    return Math.max(0, Number(state.upgrades[upgradeId]) || 0);
}

export function getUpgradeCost(state, upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    const level = getUpgradeLevel(state, upgradeId);
    if (!upgrade || level >= upgrade.maxLevel) {
        return null;
    }

    const area = AREAS[AREA_ORDER[state.prestige]];
    return Math.round(upgrade.baseCost * area.upgradeMultiplier * Math.pow(upgrade.costGrowth, level));
}

export function buyUpgrade(state, upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    const cost = getUpgradeCost(state, upgradeId);
    if (!upgrade || cost === null || state.coins < cost) {
        return false;
    }

    state.coins -= cost;
    state.upgrades[upgradeId] = getUpgradeLevel(state, upgradeId) + 1;
    return true;
}

export function areUpgradesMaxed(state) {
    return UPGRADE_ORDER.every((upgradeId) => getUpgradeLevel(state, upgradeId) >= UPGRADES[upgradeId].maxLevel);
}

export function resetUpgrades() {
    return Object.fromEntries(UPGRADE_ORDER.map((upgradeId) => [upgradeId, 0]));
}

export function getMinigameBonuses(state) {
    return {
        rod: getUpgradeLevel(state, "rod"),
        line: getUpgradeLevel(state, "line"),
        hook: getUpgradeLevel(state, "hook"),
        luck: getUpgradeLevel(state, "luck"),
        sonar: getUpgradeLevel(state, "sonar"),
    };
}
