import { AREAS, AREA_ORDER, PRESTIGE_CAP } from "../data/areas.js";
import { areUpgradesMaxed, resetUpgrades } from "./upgradeSystem.js";

export function getAvailableAreas(state) {
    return AREA_ORDER.filter((areaId) => state.unlockedAreas.includes(areaId));
}

export function getNextArea(state) {
    return AREA_ORDER[state.prestige + 1] || null;
}

export function getPrestigeState(state) {
    const area = AREAS[AREA_ORDER[state.prestige]];
    const nextArea = getNextArea(state);
    const capped = state.prestige >= PRESTIGE_CAP || !nextArea;
    const coinsReady = !capped && state.coins >= area.prestigeCoins;
    const upgradesReady = areUpgradesMaxed(state);

    return {
        capped,
        coinsReady,
        upgradesReady,
        nextArea,
        requiredCoins: area.prestigeCoins,
        canPrestige: !capped && coinsReady && upgradesReady,
    };
}

export function prestigeToNextArea(state) {
    const prestigeState = getPrestigeState(state);
    if (!prestigeState.canPrestige) {
        return false;
    }

    state.prestige += 1;
    state.coins = 0;
    state.inventory = {};
    state.upgrades = resetUpgrades();
    state.currentArea = prestigeState.nextArea;
    if (!state.unlockedAreas.includes(prestigeState.nextArea)) {
        state.unlockedAreas.push(prestigeState.nextArea);
    }

    return true;
}
