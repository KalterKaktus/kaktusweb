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
        copy: "Verpasste Fische verlieren weniger Fortschritt und die Schnur reisst langsamer aus.",
        maxLevel: 5,
        baseCost: 110,
        costGrowth: 1.64,
    },
    hook: {
        id: "hook",
        name: "Better Hook",
        copy: "Treffer füllen den Fangbalken schneller und reparieren die Schnur-Spannung deutlich schneller.",
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
        name: "Köder",
        copy: "Pro Level: +1 Fischstelle gleichzeitig (1 → 6) und +1.5 s Verweildauer (4 s → 11.5 s). Spawn-Rate skaliert so mit, dass die Cap immer ausgeschöpft ist.",
        maxLevel: 5,
        baseCost: 180,
        costGrowth: 1.65,
    },
};

export const UPGRADE_ORDER = Object.keys(UPGRADES);
