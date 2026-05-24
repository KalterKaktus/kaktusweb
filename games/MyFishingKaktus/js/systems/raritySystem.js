import { AREA_ORDER, AREAS } from "../data/areas.js";
import { FISH_BY_ID, getAreaRarityFish } from "../data/fish.js";
import { RARITIES } from "../data/rarities.js";

function weightedPick(entries, getWeight) {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, getWeight(entry)), 0);
    let roll = Math.random() * total;

    for (const entry of entries) {
        roll -= Math.max(0, getWeight(entry));
        if (roll <= 0) {
            return entry;
        }
    }

    return entries.at(-1);
}

export function getLuckPower(luckLevel = 0) {
    return 1 + Math.max(0, Number(luckLevel) || 0) * 0.26;
}

export function getRarityChances(areaId, luckLevel = 0) {
    const area = AREAS[areaId];
    if (!area) {
        return {};
    }

    const luckPower = getLuckPower(luckLevel);
    const weighted = Object.entries(area.rarityWeights).map(([rarity, weight]) => ({
        rarity,
        weight: weight * Math.pow(luckPower, RARITIES[rarity].luckImpact),
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0) || 1;

    return Object.fromEntries(weighted.map((entry) => [entry.rarity, entry.weight / total]));
}

export function rollRarity(areaId, luckLevel = 0, rarityMults = null) {
    const area = AREAS[areaId];
    const luckPower = getLuckPower(luckLevel);
    const choices = Object.entries(area.rarityWeights).map(([rarity, weight]) => {
        let w = weight * Math.pow(luckPower, RARITIES[rarity].luckImpact);
        // Direkte Rarity-Boosts (z.B. Abyss-Event: Epic+ × 2).
        if (rarityMults && rarityMults[rarity]) w *= rarityMults[rarity];
        return { rarity, weight: w };
    });

    return weightedPick(choices, (choice) => choice.weight).rarity;
}

export function rollFish(areaId, rarity) {
    const fish = getAreaRarityFish(areaId, rarity);
    return weightedPick(fish, (entry) => entry.spawnWeight);
}

// Findet einen Fish-Pool für (area, rarity). Wenn die aktuelle Area diese Rarity nicht hat
// (z.B. Pond hat kein Legendary), wird in den Nachbar-Areas gesucht. So funktioniert ein
// Force-Legendary auch wenn der Spieler noch im Pond ist.
export function getRarestFishInArea(areaId, rarity) {
    const pool = findFishPoolForRarity(areaId, rarity);
    if (!pool.length) return null;
    // Niedrigster spawnWeight = seltenster Fisch im Pool. Bei Gleichstand: erster Treffer.
    return pool.slice().sort((a, b) => a.spawnWeight - b.spawnWeight)[0];
}

function findFishPoolForRarity(areaId, rarity) {
    const own = getAreaRarityFish(areaId, rarity);
    if (own.length) return own;
    for (const otherArea of AREA_ORDER) {
        if (otherArea === areaId) continue;
        const candidate = getAreaRarityFish(otherArea, rarity);
        if (candidate.length) return candidate;
    }
    return [];
}

export function rollWeight(fish) {
    const trophyRoll = Math.random() < 0.04;
    const rangeRoll = trophyRoll
        ? 0.75 + Math.random() * 0.25
        : Math.pow(Math.random(), 1.45);
    const kg = fish.minKg + (fish.maxKg - fish.minKg) * rangeRoll;
    return Number(kg.toFixed(3));
}

export function getFishValue(fish, kg) {
    const rarity = RARITIES[fish.rarity];
    const area = AREAS[fish.area];
    return Math.max(1, Math.round(kg * rarity.valuePerKg * fish.valueMultiplier * area.valueMultiplier));
}

export function rollCatch(areaId, luckLevel, forcedRarity = null, rarityMults = null) {
    const rarity = forcedRarity || rollRarity(areaId, luckLevel, rarityMults);
    const pool = findFishPoolForRarity(areaId, rarity);
    // Fallback: wenn weder lokale Area noch andere Areas diese Rarity haben → normaler Roll.
    if (!pool.length) {
        return rollCatch(areaId, luckLevel, null, rarityMults);
    }
    const fish = weightedPick(pool, (entry) => entry.spawnWeight);
    const kg = rollWeight(fish);

    return {
        fishId: fish.id,
        fish,
        kg,
        value: getFishValue(fish, kg),
    };
}

export function normalizeCatch(candidate) {
    const fish = FISH_BY_ID[candidate?.fishId];
    if (!fish) {
        return null;
    }

    const kg = Number(candidate.kg);
    return {
        fishId: fish.id,
        fish,
        kg: Number.isFinite(kg) ? kg : fish.minKg,
        value: Math.max(1, Number(candidate.value) || getFishValue(fish, kg)),
    };
}
