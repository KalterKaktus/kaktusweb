export const AREAS = {
    pond: {
        id: "pond",
        name: "Pond",
        prestige: 0,
        valueMultiplier: 1.05,
        upgradeMultiplier: 1,
        bubbleSeconds: [16, 28],
        prestigeCoins: 24000,
        rarityWeights: {
            Common: 80,
            Uncommon: 15,
            Rare: 4.5,
            Epic: 0.5,
        },
        weightRanges: {
            Common: [0.05, 0.5],
            Uncommon: [0.12, 0.9],
            Rare: [0.25, 1.8],
            Epic: [0.6, 3.5],
        },
    },
    lake: {
        id: "lake",
        name: "Lake",
        prestige: 1,
        valueMultiplier: 0.46,
        upgradeMultiplier: 6,
        bubbleSeconds: [14, 25],
        prestigeCoins: 750000,
        rarityWeights: {
            Common: 68,
            Uncommon: 22,
            Rare: 8,
            Epic: 1.8,
            Legendary: 0.2,
        },
        weightRanges: {
            Common: [0.2, 1.5],
            Uncommon: [0.5, 3.2],
            Rare: [1, 7],
            Epic: [2.5, 16],
            Legendary: [6, 38],
        },
    },
    ocean: {
        id: "ocean",
        name: "Ocean",
        prestige: 2,
        valueMultiplier: 0.6,
        upgradeMultiplier: 10,
        bubbleSeconds: [13, 23],
        prestigeCoins: null,
        rarityWeights: {
            Common: 55,
            Uncommon: 26,
            Rare: 14,
            Epic: 4.3,
            Legendary: 0.7,
        },
        weightRanges: {
            Common: [0.8, 4.5],
            Uncommon: [2, 11],
            Rare: [5, 32],
            Epic: [12, 85],
            Legendary: [30, 220],
        },
    },
};

export const AREA_ORDER = Object.keys(AREAS);
export const PRESTIGE_CAP = AREA_ORDER.length - 1;
