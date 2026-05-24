export const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

// Welche Rarities per Force-Spawn ausgelöst werden können (Admin-Live-Event + Test-Menü).
// Upgrade-sicher: neue Rarities wie "Mythic" einfach hier ergänzen + in RARITIES + in admin-panel.mjs Whitelist.
export const FORCEABLE_RARITIES = ["Epic", "Legendary"];

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
    9: [22, 17, 14, 11, 10, 8, 7, 6, 5],
    10: [20, 15, 13, 11, 10, 8, 7, 6, 5, 5],
    11: [19, 14, 12, 11, 9, 8, 7, 6, 5, 5, 4],
    12: [18, 14, 12, 10, 9, 8, 7, 6, 5, 4, 4, 3],
    13: [17, 13, 11, 10, 9, 8, 7, 6, 5, 4, 4, 3, 3],
    14: [16, 13, 11, 9, 8, 8, 7, 6, 5, 5, 4, 3, 3, 2],
    15: [15, 12, 10, 9, 8, 8, 7, 6, 5, 5, 4, 4, 3, 2, 2],
    16: [14, 12, 10, 9, 8, 7, 7, 6, 5, 5, 4, 4, 3, 3, 2, 1],
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
    9: [1, 1.05, 1.11, 1.18, 1.26, 1.35, 1.45, 1.56, 1.70],
    10: [1, 1.04, 1.09, 1.15, 1.22, 1.30, 1.39, 1.49, 1.60, 1.74],
    11: [1, 1.04, 1.08, 1.13, 1.19, 1.26, 1.34, 1.43, 1.53, 1.64, 1.78],
    12: [1, 1.03, 1.07, 1.12, 1.17, 1.23, 1.30, 1.38, 1.47, 1.57, 1.68, 1.82],
    13: [1, 1.03, 1.06, 1.10, 1.15, 1.21, 1.27, 1.34, 1.42, 1.51, 1.61, 1.72, 1.86],
    14: [1, 1.03, 1.06, 1.10, 1.14, 1.19, 1.25, 1.31, 1.38, 1.46, 1.55, 1.65, 1.76, 1.90],
    15: [1, 1.02, 1.05, 1.09, 1.13, 1.18, 1.23, 1.29, 1.36, 1.43, 1.51, 1.60, 1.70, 1.81, 1.94],
    16: [1, 1.02, 1.05, 1.08, 1.12, 1.16, 1.21, 1.27, 1.33, 1.40, 1.47, 1.55, 1.64, 1.74, 1.85, 1.98],
};
