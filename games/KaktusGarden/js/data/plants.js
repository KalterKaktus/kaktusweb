export const RESTOCK_MS = 5 * 60 * 1000;

/**
 * Zentrale Render-Regeln für alle Pflanzen. Der Renderer liest ausschließlich
 * hier — es stehen keine Größen im UI-Code.
 *
 * Alle Werte sind Map-Pixel (1 Tile = 16 px). Ein Beet ist 3 × 3 Tiles groß;
 * darauf steht `slots` Pflanze unten mittig, `baseline` Pixel über der
 * Beetunterkante.
 *
 * `scale` ist ein ganzzahliger Vergrößerungsfaktor auf die native Framegröße —
 * ganzzahlig, damit die Pixel scharf bleiben. Bei 2 füllt eine 16 × 16-Pflanze
 * zwei Drittel des Beetes und eine 16 × 32-Pflanze ragt oben darüber hinaus.
 */
export const PLANT_RENDER = Object.freeze({
  slots: 1,
  slotStep: 16,
  baseline: 8,
  scale: 2,
});

function crop({
  id,
  assetId = id,
  rarity,
  seedPrice,
  sellPrice,
  growthSeconds,
  restockChance,
  restockMin,
  restockMax,
  yieldMin,
  yieldMax,
  growthFile,
  frameWidth = 16,
  frameHeight,
  growthFrames,
  readyFrame,
  readyFile = null,
  readyFrames = 0,
  readyFps = 6,
  iconFile,
  iconFrames = 1,
  iconFrame = 0,
  render = null,
}) {
  return Object.freeze({
    id,
    assetId,
    rarity,
    seedPrice,
    sellPrice,
    growthSeconds,
    restockChance,
    restockMin,
    restockMax,
    yieldMin,
    yieldMax,
    productId: id,
    sprite: Object.freeze({
      growthFile,
      frameWidth,
      frameHeight,
      growthFrames,
      readyFrame,
      readyFile,
      readyFrames,
      readyFps,
      iconFile,
      iconFrames,
      iconFrame,
    }),
    render: Object.freeze({ ...PLANT_RENDER, ...(render || {}) }),
  });
}

/**
 * Economy V2 (August 2026) — bewusst langsamer als die Startversion.
 *
 * Jedes Beet liefert genau eine Frucht, deshalb ist der Gewinn pro Zyklus
 * einfach sellPrice − seedPrice. Der Gewinn pro Minute steigt mit der
 * Seltenheit (gewöhnlich ≈ 9/min bis legendär ≈ 95/min), der Samen kostet immer
 * rund 40 % des Ernteerlöses. Der eigentliche Fortschrittsbremser ist der Shop:
 * seltene Samen erscheinen kaum und dann höchstens ein- bis zweimal.
 *
 * Restock-Bänder je Seltenheit siehe RESTOCK_RULES. Karotten sind mit 100 %
 * bewusst garantiert, sonst könnten Spieler ohne Samen und ohne Münzen
 * dauerhaft feststecken.
 */
export const PLANTS = Object.freeze({
  carrot: crop({ id: "carrot", rarity: "common", seedPrice: 8, sellPrice: 15, growthSeconds: 45, restockChance: 1, restockMin: 1, restockMax: 3, yieldMin: 1, yieldMax: 1, growthFile: "carrot_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "carrot_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1 }),
  radish: crop({ id: "radish", rarity: "common", seedPrice: 14, sellPrice: 28, growthSeconds: 75, restockChance: 0.88, restockMin: 1, restockMax: 3, yieldMin: 1, yieldMax: 1, growthFile: "radish_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "radish_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 0 }),
  beetroot: crop({ id: "beetroot", rarity: "common", seedPrice: 20, sellPrice: 46, growthSeconds: 120, restockChance: 0.8, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "beetroot_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "beetroot_icon_16x16.png" }),
  lettuce: crop({ id: "lettuce", rarity: "common", seedPrice: 32, sellPrice: 78, growthSeconds: 180, restockChance: 0.75, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "lettuce_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "lettuce_icon_16x16.png" }),

  onion: crop({ id: "onion", rarity: "uncommon", seedPrice: 50, sellPrice: 123, growthSeconds: 240, restockChance: 0.55, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "onion_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "onion_icon_16x16.png" }),
  strawberry: crop({ id: "strawberry", assetId: "berry", rarity: "uncommon", seedPrice: 75, sellPrice: 180, growthSeconds: 300, restockChance: 0.48, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "berry_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "berry_icon_16x16.png" }),
  potato: crop({ id: "potato", rarity: "uncommon", seedPrice: 110, sellPrice: 267, growthSeconds: 390, restockChance: 0.43, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "potato_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "potato_icon_16x16.png" }),
  leek: crop({ id: "leek", rarity: "uncommon", seedPrice: 150, sellPrice: 366, growthSeconds: 480, restockChance: 0.39, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "leek_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "leek_icon_16x16.png" }),
  cauliflower: crop({ id: "cauliflower", rarity: "uncommon", seedPrice: 210, sellPrice: 510, growthSeconds: 600, restockChance: 0.35, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "cauliflower_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "cauliflower_icon_16x16.png" }),

  celery: crop({ id: "celery", rarity: "rare", seedPrice: 290, sellPrice: 700, growthSeconds: 720, restockChance: 0.24, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "celery_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "celery_icon_16x16.png" }),
  tomato: crop({ id: "tomato", rarity: "rare", seedPrice: 370, sellPrice: 900, growthSeconds: 840, restockChance: 0.2, restockMin: 1, restockMax: 2, yieldMin: 1, yieldMax: 1, growthFile: "tomato_16x32_23frames.png", frameHeight: 32, growthFrames: 23, readyFrame: 19, iconFile: "tomato_icon_16x16_4frames.png", iconFrames: 4, iconFrame: 3 }),
  broccoli: crop({ id: "broccoli", rarity: "rare", seedPrice: 500, sellPrice: 1220, growthSeconds: 1020, restockChance: 0.16, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "broccoli_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "broccoli_icon_16x16.png" }),
  eggplant: crop({ id: "eggplant", rarity: "rare", seedPrice: 640, sellPrice: 1560, growthSeconds: 1200, restockChance: 0.13, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "eggplant_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "eggplant_icon_16x16.png" }),
  pepper: crop({ id: "pepper", rarity: "rare", seedPrice: 840, sellPrice: 2040, growthSeconds: 1440, restockChance: 0.1, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "pepper_16x32_11frames.png", frameHeight: 32, growthFrames: 11, readyFrame: 9, iconFile: "pepper_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1 }),

  corn: crop({ id: "corn", rarity: "epic", seedPrice: 1200, sellPrice: 2960, growthSeconds: 1800, restockChance: 0.07, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "corn_16x32_8frames.png", frameHeight: 32, growthFrames: 8, readyFrame: 5, readyFile: "corn_shake_16x32_8frames.png", readyFrames: 8, readyFps: 5, iconFile: "corn_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1 }),
  pumpkin: crop({ id: "pumpkin", rarity: "epic", seedPrice: 1750, sellPrice: 4260, growthSeconds: 2280, restockChance: 0.045, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "pumpkin_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5, iconFile: "pumpkin_icon_16x16_3frames.png", iconFrames: 3, iconFrame: 1 }),
  grape: crop({ id: "grape", rarity: "epic", seedPrice: 2350, sellPrice: 5720, growthSeconds: 2700, restockChance: 0.02, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "grape_18x32_7frames.png", frameWidth: 18, frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "grape_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1 }),

  wheat: crop({ id: "wheat", rarity: "legendary", seedPrice: 3250, sellPrice: 7930, growthSeconds: 3300, restockChance: 0.015, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "wheat_18x32_8frames.png", frameWidth: 18, frameHeight: 32, growthFrames: 8, readyFrame: 5, iconFile: "wheat_icon_16x16_9frames.png", iconFrames: 9, iconFrame: 4 }),
  bamboo: crop({ id: "bamboo", rarity: "legendary", seedPrice: 4650, sellPrice: 11320, growthSeconds: 4200, restockChance: 0.008, restockMin: 1, restockMax: 1, yieldMin: 1, yieldMax: 1, growthFile: "bamboo_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5, iconFile: "bamboo_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 0 }),
});

/**
 * Erlaubte Bänder je Seltenheit. Die Einzelwerte oben halten sich daran; wer
 * neu balanciert, sollte hier zuerst nachsehen.
 */
export const RESTOCK_RULES = Object.freeze({
  common: Object.freeze({ chance: [0.75, 1], stock: [1, 3] }),
  uncommon: Object.freeze({ chance: [0.35, 0.6], stock: [1, 2] }),
  rare: Object.freeze({ chance: [0.1, 0.25], stock: [1, 2] }),
  epic: Object.freeze({ chance: [0.02, 0.08], stock: [1, 1] }),
  legendary: Object.freeze({ chance: [0, 0.02], stock: [1, 1] }),
});

/** Ohne diesen Samen könnte ein Spieler ohne Münzen dauerhaft feststecken. */
export const GUARANTEED_SEED = "carrot";

export const PLANT_ORDER = Object.freeze(Object.keys(PLANTS));

export const PRODUCTS = Object.freeze(Object.fromEntries(
  PLANT_ORDER.map((plantId) => [plantId, Object.freeze({ id: plantId, plantId, sellPrice: PLANTS[plantId].sellPrice })]),
));

export const TOOLS = Object.freeze({
  shovel: { id: "shovel", price: 400 },
});

export const RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);

function spritePath(plant, folder, file) {
  return `assets/crops/${plant.assetId}/${folder}/${file}`;
}

export function plantIcon(plantId) {
  const plant = PLANTS[plantId];
  if (!plant) return null;
  return {
    src: spritePath(plant, "icon", plant.sprite.iconFile),
    frame: plant.sprite.iconFrame,
    frames: plant.sprite.iconFrames,
    frameWidth: 16,
    frameHeight: 16,
  };
}

/**
 * Liefert den Sprite-Zustand eines Beetes. Während des Wachstums läuft die
 * Pflanze durch die Frames des Original-Sheets (0 … readyFrame-1); ist sie
 * reif, wird readyFrame gezeigt. Nur wenn das Asset ein eigenes Ready-Sheet
 * mitbringt (Mais: shake), läuft dort eine echte Sprite-Animation — es gibt
 * bewusst keine CSS-Animation mehr auf reifen Pflanzen.
 */
export function growthSprite(plantId, field, now = Date.now()) {
  const plant = PLANTS[plantId];
  if (!plant) return null;
  const { sprite } = plant;
  const ready = field.state === "ready";

  if (ready && sprite.readyFile && sprite.readyFrames > 1) {
    return {
      src: spritePath(plant, "shake", sprite.readyFile),
      frame: Math.floor(now / (1000 / sprite.readyFps)) % sprite.readyFrames,
      frames: sprite.readyFrames,
      frameWidth: sprite.frameWidth,
      frameHeight: sprite.frameHeight,
      animated: true,
    };
  }

  const stages = Math.max(1, sprite.readyFrame);
  const duration = Math.max(1, field.readyAt - field.plantedAt);
  const progress = Math.max(0, Math.min(1, (now - field.plantedAt) / duration));
  return {
    src: spritePath(plant, "growth_basic", sprite.growthFile),
    frame: ready ? sprite.readyFrame : Math.min(stages - 1, Math.floor(progress * stages)),
    frames: sprite.growthFrames,
    frameWidth: sprite.frameWidth,
    frameHeight: sprite.frameHeight,
    animated: false,
  };
}
