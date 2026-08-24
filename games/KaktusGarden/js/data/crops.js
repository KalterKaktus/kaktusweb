/**
 * Pflanzen, Wirtschaft und Sprites.
 *
 * Die 19 vorhandenen Pflanzen sind die vollständige Progression des Spiels.
 * Jede Pflanze wird genau einmal geerntet; danach wird das Feld wieder frei.
 * Der Kaufpreis steigt pro Stufe, der durchschnittliche Verkaufserlös liegt
 * ungefähr bei dem Doppelten. Seltenere Samen erscheinen seltener im Laden
 * und geben dem späten Spiel ein klares Ziel.
 */

const HOUR = 3600;
const MINUTE = 60;

function crop({
  id, assetId = id, rarity,
  seedPrice, sellPrice, growSeconds,
  baseWeight, maxWeight,
  stockChance, stockMin, stockMax,
  growthFile, frameWidth = 16, frameHeight, growthFrames, readyFrame,
  readyFile = null, readyFrames = 0, readyFps = 6,
  iconFile, iconFrames = 1, iconFrame = 0,
}) {
  return Object.freeze({
    id, assetId, rarity,
    seedPrice, sellPrice, growSeconds,
    harvest: "single", slots: 1, regrowSeconds: 0,
    baseWeight, maxWeight,
    stockChance, stockMin, stockMax,
    sprite: Object.freeze({
      growthFile, frameWidth, frameHeight, growthFrames, readyFrame,
      readyFile, readyFrames, readyFps, iconFile, iconFrames, iconFrame,
    }),
  });
}

export const CROPS = Object.freeze({
  carrot: crop({
    id: "carrot", rarity: "common",
    seedPrice: 10, sellPrice: 8, growSeconds: 10,
    baseWeight: 0.1, maxWeight: 0.3, stockChance: 1, stockMin: 12, stockMax: 30,
    growthFile: "carrot_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "carrot_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
  radish: crop({
    id: "radish", rarity: "common",
    seedPrice: 30, sellPrice: 24, growSeconds: 30,
    baseWeight: 0.08, maxWeight: 0.24, stockChance: 1, stockMin: 8, stockMax: 20,
    growthFile: "radish_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "radish_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 0,
  }),
  strawberry: crop({
    id: "strawberry", assetId: "berry", rarity: "common",
    seedPrice: 80, sellPrice: 70, growSeconds: 60,
    baseWeight: 0.05, maxWeight: 0.1, stockChance: 1, stockMin: 6, stockMax: 15,
    growthFile: "berry_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "berry_icon_16x16.png",
  }),
  lettuce: crop({
    id: "lettuce", rarity: "uncommon",
    seedPrice: 200, sellPrice: 170, growSeconds: 2 * MINUTE,
    baseWeight: 0.4, maxWeight: 1, stockChance: 1, stockMin: 5, stockMax: 12,
    growthFile: "lettuce_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "lettuce_icon_16x16.png",
  }),
  beetroot: crop({
    id: "beetroot", rarity: "uncommon",
    seedPrice: 550, sellPrice: 450, growSeconds: 3 * MINUTE,
    baseWeight: 0.3, maxWeight: 0.9, stockChance: 0.9, stockMin: 4, stockMax: 10,
    growthFile: "beetroot_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "beetroot_icon_16x16.png",
  }),
  onion: crop({
    id: "onion", rarity: "uncommon",
    seedPrice: 1500, sellPrice: 1250, growSeconds: 5 * MINUTE,
    baseWeight: 0.1, maxWeight: 0.3, stockChance: 0.8, stockMin: 3, stockMax: 8,
    growthFile: "onion_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "onion_icon_16x16.png",
  }),
  potato: crop({
    id: "potato", rarity: "uncommon",
    seedPrice: 4000, sellPrice: 3300, growSeconds: 8 * MINUTE,
    baseWeight: 0.1, maxWeight: 0.2, stockChance: 0.75, stockMin: 3, stockMax: 7,
    growthFile: "potato_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "potato_icon_16x16.png",
  }),
  cauliflower: crop({
    id: "cauliflower", rarity: "uncommon",
    seedPrice: 10000, sellPrice: 8500, growSeconds: 12 * MINUTE,
    baseWeight: 0.18, maxWeight: 0.36, stockChance: 0.7, stockMin: 2, stockMax: 6,
    growthFile: "cauliflower_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "cauliflower_icon_16x16.png",
  }),
  celery: crop({
    id: "celery", rarity: "rare",
    seedPrice: 25000, sellPrice: 21000, growSeconds: 18 * MINUTE,
    baseWeight: 0.8, maxWeight: 2.2, stockChance: 0.6, stockMin: 2, stockMax: 5,
    growthFile: "celery_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "celery_icon_16x16.png",
  }),
  tomato: crop({
    id: "tomato", rarity: "rare",
    seedPrice: 60000, sellPrice: 50000, growSeconds: 30 * MINUTE,
    baseWeight: 0.3, maxWeight: 0.6, stockChance: 0.55, stockMin: 2, stockMax: 5,
    growthFile: "tomato_16x32_23frames.png", frameHeight: 32, growthFrames: 23, readyFrame: 19,
    iconFile: "tomato_icon_16x16_4frames.png", iconFrames: 4, iconFrame: 3,
  }),
  broccoli: crop({
    id: "broccoli", rarity: "rare",
    seedPrice: 150000, sellPrice: 125000, growSeconds: 45 * MINUTE,
    baseWeight: 0.2, maxWeight: 0.6, stockChance: 0.5, stockMin: 1, stockMax: 4,
    growthFile: "broccoli_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "broccoli_icon_16x16.png",
  }),
  corn: crop({
    id: "corn", rarity: "rare",
    seedPrice: 350000, sellPrice: 290000, growSeconds: 75 * MINUTE,
    baseWeight: 1.2, maxWeight: 2.4, stockChance: 0.45, stockMin: 1, stockMax: 4,
    growthFile: "corn_16x32_8frames.png", frameHeight: 32, growthFrames: 8, readyFrame: 5,
    readyFile: "corn_shake_16x32_8frames.png", readyFrames: 8, readyFps: 5,
    iconFile: "corn_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
  pumpkin: crop({
    id: "pumpkin", rarity: "rare",
    seedPrice: 800000, sellPrice: 680000, growSeconds: 2 * HOUR,
    baseWeight: 6, maxWeight: 18, stockChance: 0.4, stockMin: 1, stockMax: 3,
    growthFile: "pumpkin_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "pumpkin_icon_16x16_3frames.png", iconFrames: 3, iconFrame: 1,
  }),
  leek: crop({
    id: "leek", rarity: "epic",
    seedPrice: 2000000, sellPrice: 1700000, growSeconds: 3 * HOUR,
    baseWeight: 0.4, maxWeight: 1.2, stockChance: 0.35, stockMin: 1, stockMax: 3,
    growthFile: "leek_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "leek_icon_16x16.png",
  }),
  wheat: crop({
    id: "wheat", rarity: "epic",
    seedPrice: 5000000, sellPrice: 4200000, growSeconds: 5 * HOUR,
    baseWeight: 1.5, maxWeight: 2.7, stockChance: 0.3, stockMin: 1, stockMax: 3,
    growthFile: "wheat_18x32_8frames.png", frameWidth: 18, frameHeight: 32, growthFrames: 8, readyFrame: 5,
    iconFile: "wheat_icon_16x16_9frames.png", iconFrames: 9, iconFrame: 4,
  }),
  bamboo: crop({
    id: "bamboo", rarity: "epic",
    seedPrice: 12000000, sellPrice: 10000000, growSeconds: 8 * HOUR,
    baseWeight: 1, maxWeight: 2, stockChance: 0.25, stockMin: 1, stockMax: 2,
    growthFile: "bamboo_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "bamboo_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 0,
  }),
  eggplant: crop({
    id: "eggplant", rarity: "epic",
    seedPrice: 30000000, sellPrice: 25000000, growSeconds: 12 * HOUR,
    baseWeight: 0.5, maxWeight: 1.25, stockChance: 0.2, stockMin: 1, stockMax: 2,
    growthFile: "eggplant_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "eggplant_icon_16x16.png",
  }),
  grape: crop({
    id: "grape", rarity: "legendary",
    seedPrice: 75000000, sellPrice: 63000000, growSeconds: 18 * HOUR,
    baseWeight: 3, maxWeight: 6, stockChance: 0.15, stockMin: 1, stockMax: 2,
    growthFile: "grape_18x32_7frames.png", frameWidth: 18, frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "grape_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
  pepper: crop({
    id: "pepper", rarity: "legendary",
    seedPrice: 180000000, sellPrice: 150000000, growSeconds: 24 * HOUR,
    baseWeight: 0.5, maxWeight: 1, stockChance: 0.1, stockMin: 1, stockMax: 1,
    growthFile: "pepper_16x32_11frames.png", frameHeight: 32, growthFrames: 11, readyFrame: 9,
    iconFile: "pepper_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
});

/** Reihenfolge nach Saatgutpreis — so sortiert auch der Laden. */
export const CROP_ORDER = Object.freeze(
  Object.keys(CROPS).sort((a, b) => CROPS[a].seedPrice - CROPS[b].seedPrice),
);

export const RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);

/**
 * Zentrale Render-Regeln.
 *
 * `scale: 1` heißt native Auflösung: die Sprites sind 16 px breit, ein Feld ist
 * 16 px groß — eine 16 × 16-Pflanze füllt ihr Feld also exakt. Hohe Sprites
 * (16 × 32) ragen dadurch genau ein Feld nach oben hinaus, wie gezeichnet.
 * Alles darüber lässt die Pflanzen über ihr Beet quellen.
 */
export const PLANT_RENDER = Object.freeze({ scale: 1, baseline: 0 });

function spritePath(crop, folder, file) {
  return `assets/crops/${crop.assetId}/${folder}/${file}`;
}

export function cropIcon(cropId) {
  const crop = CROPS[cropId];
  if (!crop) return null;
  return {
    src: spritePath(crop, "icon", crop.sprite.iconFile),
    frame: crop.sprite.iconFrame,
    frames: crop.sprite.iconFrames,
  };
}

export function growthSheet(cropId) {
  const crop = CROPS[cropId];
  return spritePath(crop, "growth_basic", crop.sprite.growthFile);
}

export function readySheet(cropId) {
  const crop = CROPS[cropId];
  return crop.sprite.readyFile ? spritePath(crop, "shake", crop.sprite.readyFile) : null;
}

/**
 * Welcher Frame gehört zu diesem Wachstumsstand? Reife Pflanzen stehen still;
 * nur wo das Asset ein eigenes Ready-Sheet mitbringt (Mais), läuft dort eine
 * echte Sprite-Animation.
 */
export function growthFrame(cropId, progress, ready, now = Date.now()) {
  const { sprite } = CROPS[cropId];
  if (ready && sprite.readyFile && sprite.readyFrames > 1) {
    return {
      src: readySheet(cropId),
      frame: Math.floor(now / (1000 / sprite.readyFps)) % sprite.readyFrames,
      frames: sprite.readyFrames,
    };
  }
  const stages = Math.max(1, sprite.readyFrame);
  return {
    src: growthSheet(cropId),
    frame: ready ? sprite.readyFrame : Math.min(stages - 1, Math.floor(progress * stages)),
    frames: sprite.growthFrames,
  };
}

/**
 * Gewicht einer geernteten Pflanze. Eine Größe von 50 bis 100 bestimmt den
 * Verkaufspreis zwischen einfachem und dreifachem Grundwert.
 */
export function rollWeight(cropId) {
  const crop = CROPS[cropId];
  const size = 50 + Math.random() * 50;
  const weight = crop.baseWeight + ((size - 50) / 50) * (crop.maxWeight - crop.baseWeight);
  return Math.round(weight * 10000) / 10000;
}

export function cropValue(cropId, weight) {
  const crop = CROPS[cropId];
  const scale = weight / crop.baseWeight;
  return Math.max(1, Math.round(crop.sellPrice * scale));
}
