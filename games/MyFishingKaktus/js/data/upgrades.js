export const UPGRADES = {
    rod: {
        id: "rod",
        name: "Better Rod",
        copy: "Die Fangzone wird breiter und leichter zu halten.",
        maxLevel: 5,
        baseCost: 80,
        costGrowth: 1.62,
    },
    line: {
        id: "line",
        name: "Better Line",
        copy: "Verpasste Fische verlieren weniger Fortschritt.",
        maxLevel: 5,
        baseCost: 110,
        costGrowth: 1.64,
    },
    hook: {
        id: "hook",
        name: "Better Hook",
        copy: "Treffer füllen den Fangbalken schneller.",
        maxLevel: 5,
        baseCost: 150,
        costGrowth: 1.66,
    },
    luck: {
        id: "luck",
        name: "Luck",
        copy: "Seltenere Rarities bekommen etwas mehr Raum.",
        maxLevel: 5,
        baseCost: 240,
        costGrowth: 1.72,
    },
    sonar: {
        id: "sonar",
        name: "Sonar",
        copy: "Bubble-Spots tauchen früher wieder auf.",
        maxLevel: 5,
        baseCost: 180,
        costGrowth: 1.65,
    },
};

export const UPGRADE_ORDER = Object.keys(UPGRADES);
