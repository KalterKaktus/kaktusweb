import { AREA_ORDER } from "../data/areas.js";
import { getAreaFish } from "../data/fish.js";
import { RARITY_ORDER } from "../data/rarities.js";

export function getAreaIndexProgress(state, areaId) {
    const fish = getAreaFish(areaId);
    const caught = fish.filter((entry) => state.index[entry.id]?.count).length;
    return {
        caught,
        total: fish.length,
    };
}

export function getGroupedFishIndex(state) {
    return AREA_ORDER.map((areaId) => ({
        areaId,
        progress: getAreaIndexProgress(state, areaId),
        groups: RARITY_ORDER
            .map((rarity) => ({
                rarity,
                fish: getAreaFish(areaId).filter((entry) => entry.rarity === rarity),
            }))
            .filter((group) => group.fish.length),
    }));
}
