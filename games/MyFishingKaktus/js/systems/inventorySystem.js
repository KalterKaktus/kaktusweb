import { FISH_BY_ID } from "../data/fish.js";

export function addCatch(state, candidate) {
    const fish = FISH_BY_ID[candidate.fishId];
    if (!fish) {
        return;
    }

    const inventoryEntry = state.inventory[fish.id] || {
        count: 0,
        totalKg: 0,
        totalValue: 0,
        bestKg: 0,
    };
    inventoryEntry.count += 1;
    inventoryEntry.totalKg += candidate.kg;
    inventoryEntry.totalValue += candidate.value;
    inventoryEntry.bestKg = Math.max(inventoryEntry.bestKg, candidate.kg);
    state.inventory[fish.id] = inventoryEntry;

    const indexEntry = state.index[fish.id] || { count: 0, bestKg: 0 };
    indexEntry.count += 1;
    indexEntry.bestKg = Math.max(indexEntry.bestKg, candidate.kg);
    state.index[fish.id] = indexEntry;

    state.stats.totalCaught += 1;
    state.stats.bestCatchValue = Math.max(state.stats.bestCatchValue, candidate.value);
    state.stats.bestWeightKg = Math.max(state.stats.bestWeightKg, candidate.kg);
}

export function getInventoryEntries(state) {
    return Object.entries(state.inventory)
        .map(([fishId, entry]) => ({ fish: FISH_BY_ID[fishId], ...entry }))
        .filter((entry) => entry.fish && entry.count > 0)
        .sort((left, right) => right.totalValue - left.totalValue);
}

export function getInventoryValue(state) {
    return getInventoryEntries(state).reduce((sum, entry) => sum + entry.totalValue, 0);
}

export function sellAll(state) {
    const soldEntries = getInventoryEntries(state);
    const value = soldEntries.reduce((sum, entry) => sum + entry.totalValue, 0);
    const count = soldEntries.reduce((sum, entry) => sum + entry.count, 0);

    if (!value) {
        return { value: 0, count: 0 };
    }

    state.coins += value;
    state.stats.totalSold += count;
    state.stats.totalCoinsEarned += value;
    state.inventory = {};
    return { value, count };
}
