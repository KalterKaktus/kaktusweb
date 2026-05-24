import { AREAS } from "./areas.js";
import { FISH_POOL_WEIGHTS, FISH_VALUE_MULTIPLIERS, RARITY_ORDER } from "./rarities.js";

const COLOR_POOLS = {
    pond: ["#72d8f2", "#65e2a2", "#87c8ff", "#9ee383", "#70efd7"],
    lake: ["#8aa7ff", "#a38eff", "#5ee0dd", "#a7d8ff", "#73c8ed"],
    ocean: ["#ffb36c", "#ff7ea8", "#65d6ff", "#c08bff", "#ffd166"],
};

const FISH_GROUPS = {
    pond: {
        Common: [
            ["Reed Bit", "dart", "plain", 0.72],
            ["Puddle Sprat", "wedge", "plain", 0.82],
            ["Pebble Gill", "deep", "gills", 0.95],
            ["Dew Fin", "dart", "long-fin", 0.88],
            ["Mosscap", "block", "crest", 1.05],
            ["Tadpole Pike", "needle", "plain", 1.1],
            ["Tiny Tangle", "kite", "fork-tail", 0.8],
            ["Algae Loop", "orb", "leaf-fin", 0.78],
            ["Lotus Wisp", "kite", "crest", 0.85],
            ["Marsh Moth", "ribbon", "bubble-fin", 0.92],
            ["Reed Singer", "needle", "barbel", 0.74],
            ["Bog Twirl", "wedge", "fork-tail", 0.98],
            ["Spring Glimmer", "dart", "gills", 0.86],
            ["Frogling", "block", "long-fin", 1.02],
        ],
        Uncommon: [
            ["Bubblefin", "orb", "bubble-fin", 0.94],
            ["Lily Nibbler", "wedge", "leaf-fin", 1.06],
            ["Glass Darter", "needle", "gills", 1.22],
            ["Mud Lantern", "angler", "lure", 1.15],
            ["Twintail Fry", "dart", "fork-tail", 1.1],
            ["Heron Bait", "ribbon", "plain", 1.04],
            ["Brook Crest", "kite", "crest", 1.18],
            ["Dawn Spectre", "deep", "extra-eyes", 1.24],
            ["Knotted Toe", "block", "horn", 1.12],
            ["Cattail Splitter", "blade", "barbel", 1.28],
        ],
        Rare: [
            ["Spikeperch", "orb", "puffer-spikes", 1.24],
            ["Clover Gar", "ribbon", "horn", 1.45],
            ["Threeblink", "kite", "extra-eyes", 1.3],
            ["Stone Fan", "deep", "sail", 1.38],
            ["Diving Bell", "orb", "bubble-fin", 1.32],
            ["Frostmint", "needle", "spikes", 1.42],
            ["Lichen Lord", "crown", "leaf-fin", 1.48],
            ["Cave Echo", "angler", "barbel", 1.36],
        ],
        Epic: [
            ["Pond Crown", "crown", "horn-gills", 1.62],
            ["Willow Razor", "ribbon", "teeth", 1.8],
            ["Briar Diadem", "monarch", "crest", 1.74],
            ["Pond Sovereign", "crown", "sail", 1.88],
        ],
    },
    lake: {
        Common: [
            ["Blue Longfin", "needle", "long-fin", 0.86],
            ["Shore Chub", "wedge", "plain", 0.98],
            ["Cattail Carp", "deep", "gills", 1.08],
            ["Ripple Jack", "block", "fork-tail", 1.16],
            ["Dock Dart", "dart", "plain", 0.92],
            ["Driftwood Chub", "block", "crest", 1.04],
            ["Pillar Perch", "deep", "long-fin", 1.12],
            ["Slate Smelt", "needle", "gills", 0.9],
            ["Wake Whisker", "ribbon", "barbel", 1.02],
            ["Tide Yearling", "dart", "leaf-fin", 0.95],
        ],
        Uncommon: [
            ["Lantern Loach", "angler", "lure", 1.18],
            ["Mirror Mullet", "kite", "gills", 1.05],
            ["Loopfin", "orb", "bubble-fin", 1.14],
            ["Velvet Pike", "blade", "plain", 1.32],
            ["Oar Tail", "block", "leaf-fin", 1.2],
            ["Comet Carp", "dart", "long-fin", 1.28],
            ["Algae Glider", "ribbon", "plain", 1.16],
            ["Echo Bream", "deep", "extra-eyes", 1.22],
            ["Halo Trout", "wedge", "crest", 1.26],
            ["Pier Pike", "needle", "fork-tail", 1.3],
            ["Spire Snipe", "kite", "barbel", 1.1],
            ["Velvet Cape", "ribbon", "bubble-fin", 1.34],
        ],
        Rare: [
            ["Moon Bream", "deep", "sail", 1.35],
            ["Needle Antler", "blade", "horn", 1.5],
            ["Gravel Gazer", "orb", "extra-eyes", 1.24],
            ["Ridge Runner", "ribbon", "spikes", 1.62],
            ["Kelp Knight", "crown", "gills", 1.48],
            ["Splitfin Snipe", "dart", "fork-tail", 1.43],
            ["Brass Diver", "block", "lure", 1.4],
            ["Frostgill", "wedge", "gills", 1.38],
            ["Glacier Tip", "needle", "horn", 1.52],
            ["Iron Vow", "crown", "teeth", 1.56],
            ["Pearl Currier", "orb", "crest", 1.46],
            ["Stormwake", "sail", "long-fin", 1.6],
        ],
        Epic: [
            ["Horncarp", "crown", "horn-gills", 1.7],
            ["Thunder Sail", "sail", "sail", 1.94],
            ["Violet Saw", "blade", "teeth", 1.86],
            ["Warden Wisp", "angler", "barbel", 1.72],
            ["Aurora Coast", "monarch", "crest", 1.88],
            ["Crystal Diadem", "crown", "spikes", 1.78],
            ["Eclipse Carp", "deep", "extra-eyes", 1.82],
            ["Mistward Drake", "ribbon", "horn", 1.96],
        ],
        Legendary: [
            ["Lake Monarch", "monarch", "horn-gills", 2.25],
            ["Tidal Empress", "crown", "sail", 2.18],
        ],
    },
    ocean: {
        Common: [
            ["Salt Skip", "dart", "plain", 0.92],
            ["Surf Grouper", "deep", "gills", 1.12],
            ["Wave Needle", "needle", "long-fin", 1.24],
            ["Saltsting", "wedge", "spikes", 1.06],
            ["Tideglide", "block", "fork-tail", 1.18],
            ["Surf Needle", "needle", "crest", 1.02],
        ],
        Uncommon: [
            ["Coral Wedge", "wedge", "crest", 1.2],
            ["Sun Kite", "kite", "fork-tail", 1.08],
            ["Foam Saber", "blade", "plain", 1.42],
            ["Current Drum", "orb", "gills", 1.34],
            ["Sail Snapper", "sail", "sail", 1.48],
            ["Glow Rudder", "angler", "lure", 1.28],
            ["Tidemarcher", "block", "long-fin", 1.32],
            ["Bonespike", "needle", "spikes", 1.44],
            ["Wreckpike", "blade", "teeth", 1.4],
            ["Galleon Glider", "ribbon", "crest", 1.36],
            ["Brinejoy", "dart", "bubble-fin", 1.22],
            ["Atoll Scout", "kite", "barbel", 1.18],
        ],
        Rare: [
            ["Sailfin", "sail", "sail", 1.64],
            ["Brine Horn", "crown", "horn", 1.58],
            ["Reef Ripper", "blade", "teeth", 1.8],
            ["Trench Eyes", "angler", "extra-eyes", 1.52],
            ["Anchor Gill", "ribbon", "gills", 1.72],
            ["Glass Torpedo", "needle", "long-fin", 1.9],
            ["Crescent Tail", "dart", "fork-tail", 1.6],
            ["Storm Fan", "monarch", "sail", 2.02],
            ["Pearl Captain", "crown", "lure", 1.74],
            ["Reef Comet", "dart", "spikes", 1.68],
            ["Squallrider", "kite", "horn", 1.76],
            ["Stormhalo", "orb", "crest", 1.82],
            ["Tidewatcher", "deep", "extra-eyes", 1.66],
            ["Veilfin", "ribbon", "bubble-fin", 1.7],
            ["Wavehunter", "blade", "barbel", 1.84],
            ["Wraithfin", "angler", "plain", 1.78],
        ],
        Epic: [
            ["Opal Harpoon", "blade", "horn", 2.14],
            ["Crown Rayfish", "monarch", "crest", 2.2],
            ["Rift Saw", "sail", "teeth", 2.28],
            ["Prism Gazer", "orb", "extra-eyes", 1.92],
            ["Tide Regent", "crown", "horn-gills", 2.08],
            ["Longwake", "ribbon", "barbel", 2.34],
            ["Storm Sovereign", "monarch", "sail", 2.24],
            ["Tidal Drake", "crown", "horn", 2.16],
            ["Reef Empress", "monarch", "crest", 2.18],
            ["Frost Trident", "blade", "spikes", 2.06],
            ["Eclipse Saber", "sail", "teeth", 2.3],
            ["Voidwake", "deep", "extra-eyes", 2.12],
        ],
        Legendary: [
            ["Sun Levi", "monarch", "sail", 2.75],
            ["Ruby Trident", "angler", "lure", 2.68],
            ["Deep Crown", "angler", "extra-eyes", 2.54],
            ["Abyss Emperor", "monarch", "horn-gills", 2.82],
            ["Tide Triumvirate", "crown", "sail", 2.6],
            ["Polar Goliath", "deep", "spikes", 2.7],
        ],
    },
};

function slug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function buildFish(areaId, rarity, entries) {
    const area = AREAS[areaId];
    const poolSize = entries.length;
    const poolWeights = FISH_POOL_WEIGHTS[poolSize];
    const valueMultipliers = FISH_VALUE_MULTIPLIERS[poolSize];
    const [rarityMinKg, rarityMaxKg] = area.weightRanges[rarity];

    return entries.map(([name, shape, feature, size], index) => {
        const sizeLift = Math.max(0.64, Number(size) || 1);
        const minKg = rarityMinKg * Math.max(0.78, sizeLift * 0.82);
        const maxKg = rarityMaxKg * sizeLift;

        return {
            id: `${areaId}_${rarity.toLowerCase()}_${slug(name).replace(/-/g, "_")}`,
            name,
            area: areaId,
            rarity,
            spawnWeight: poolWeights[index],
            minKg: Number(minKg.toFixed(3)),
            maxKg: Number(maxKg.toFixed(3)),
            valueMultiplier: valueMultipliers[index],
            art: {
                color: COLOR_POOLS[areaId][index % COLOR_POOLS[areaId].length],
                outline: areaId === "pond" ? "#123c42" : areaId === "lake" ? "#222c61" : "#43203f",
                feature,
                shape,
            },
        };
    });
}

export const FISH = Object.entries(FISH_GROUPS).flatMap(([areaId, groups]) => (
    RARITY_ORDER.flatMap((rarity) => groups[rarity] ? buildFish(areaId, rarity, groups[rarity]) : [])
));

export const FISH_BY_ID = Object.fromEntries(FISH.map((fish) => [fish.id, fish]));

export function getAreaFish(areaId) {
    return FISH.filter((fish) => fish.area === areaId);
}

export function getAreaRarityFish(areaId, rarity) {
    return FISH.filter((fish) => fish.area === areaId && fish.rarity === rarity);
}
