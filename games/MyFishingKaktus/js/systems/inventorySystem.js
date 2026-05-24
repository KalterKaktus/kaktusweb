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
        mutations: {},
    };
    inventoryEntry.count += 1;
    inventoryEntry.totalKg += candidate.kg;
    inventoryEntry.totalValue += candidate.value;
    inventoryEntry.bestKg = Math.max(inventoryEntry.bestKg, candidate.kg);
    // Mutationen pro Fisch zählen (z.B. {shiny: 3, haunted: 1}). Wird im Inventar
    // als farbige Multiplier-Chip angezeigt und überlebt Sell-All nicht (Mutationen
    // sind an die einzelnen Fänge gebunden — Sell wirft alles inkl. Mutation-Counts weg).
    if (!inventoryEntry.mutations) inventoryEntry.mutations = {};
    for (const mutId of (candidate.mutations || [])) {
        inventoryEntry.mutations[mutId] = (inventoryEntry.mutations[mutId] || 0) + 1;
    }
    state.inventory[fish.id] = inventoryEntry;

    const indexEntry = state.index[fish.id] || { count: 0, bestKg: 0, mutations: {} };
    indexEntry.count += 1;
    indexEntry.bestKg = Math.max(indexEntry.bestKg, candidate.kg);
    // Index: Lifetime-Tracking aller jemals gesehenen Mutationen pro Fisch — bleibt
    // auch nach Sell-All / Prestige erhalten (Sammler-Stat).
    if (!indexEntry.mutations) indexEntry.mutations = {};
    for (const mutId of (candidate.mutations || [])) {
        indexEntry.mutations[mutId] = (indexEntry.mutations[mutId] || 0) + 1;
    }
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
