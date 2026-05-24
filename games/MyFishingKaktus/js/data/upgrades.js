export const UPGRADES = {
    rod: {
        id: "rod",
        name: "Rute",
        copy: "Breitere Fangzone — leichter zu treffen.",
        maxLevel: 5,
        baseCost: 80,
        costGrowth: 1.62,
    },
    line: {
        id: "line",
        name: "Schnur",
        copy: "Reisst langsamer wenn der Fisch ausserhalb der Zone ist.",
        maxLevel: 5,
        baseCost: 110,
        costGrowth: 1.64,
    },
    hook: {
        id: "hook",
        name: "Haken",
        copy: "Fang-Balken füllt sich schneller und die Schnur erholt sich besser.",
        maxLevel: 5,
        baseCost: 150,
        costGrowth: 1.66,
    },
    luck: {
        id: "luck",
        name: "Glück",
        copy: "Höhere Chance auf seltene Fische.",
        maxLevel: 5,
        baseCost: 240,
        costGrowth: 1.72,
    },
    sonar: {
        id: "sonar",
        name: "Köder",
        copy: "Mehr Fischstellen gleichzeitig, sie bleiben länger und tauchen öfter auf.",
        maxLevel: 5,
        baseCost: 180,
        costGrowth: 1.65,
    },
};

export const UPGRADE_ORDER = Object.keys(UPGRADES);
