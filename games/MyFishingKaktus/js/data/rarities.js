export const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

export const RARITIES = {
    Common: {
        label: "Common",
        color: "#79d9f7",
        valuePerKg: 8,
        luckImpact: -0.4,
        difficulty: 0.92,
    },
    Uncommon: {
        label: "Uncommon",
        color: "#65e2a2",
        valuePerKg: 20,
        luckImpact: 0.2,
        difficulty: 1,
    },
    Rare: {
        label: "Rare",
        color: "#9f9dff",
        valuePerKg: 55,
        luckImpact: 0.7,
        difficulty: 1.12,
    },
    Epic: {
        label: "Epic",
        color: "#d58cff",
        valuePerKg: 150,
        luckImpact: 1.3,
        difficulty: 1.28,
    },
    Legendary: {
        label: "Legendary",
        color: "#ffc86c",
        valuePerKg: 500,
        luckImpact: 1.8,
        difficulty: 1.46,
    },
};

export const FISH_POOL_WEIGHTS = {
    1: [100],
    2: [75, 25],
    3: [60, 30, 10],
    4: [48, 27, 17, 8],
    5: [40, 25, 18, 12, 5],
    6: [32, 22, 17, 13, 10, 6],
    7: [27, 20, 16, 13, 10, 8, 6],
    8: [24, 18, 15, 12, 10, 8, 7, 6],
};

export const FISH_VALUE_MULTIPLIERS = {
    1: [1],
    2: [1, 1.35],
    3: [1, 1.18, 1.5],
    4: [1, 1.12, 1.28, 1.52],
    5: [1, 1.1, 1.22, 1.36, 1.56],
    6: [1, 1.08, 1.16, 1.28, 1.4, 1.58],
    7: [1, 1.06, 1.14, 1.22, 1.32, 1.44, 1.62],
    8: [1, 1.05, 1.12, 1.2, 1.3, 1.4, 1.52, 1.66],
};
