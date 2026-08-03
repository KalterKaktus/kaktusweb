/**
 * Pflanzen, Wirtschaft und Sprites.
 *
 * Die Wirtschaft ist von Magic Garden übernommen (magicgarden.wiki/Crops und
 * /Seed_Shop). Elf unserer Pflanzen gibt es dort ebenfalls — die tragen deren
 * Werte unverändert. Für die acht übrigen ist jeweils ein freier Platz
 * derselben Preisleiter eingesetzt; die Vorlage steht in der Spalte `template`,
 * damit nachvollziehbar bleibt, woher die Zahlen stammen.
 *
 * Erntearten:
 *   single  einmal ernten, danach ist das Feld frei
 *   multi   Pflanze bleibt stehen und wächst nach
 *
 * Bei `multi` liefert eine Ernte **alle Slots auf einmal** (z. B. 5 Erdbeeren),
 * weil unsere Sprites keine einzeln abpflückbaren Früchte darstellen können.
 * Jede Frucht bekommt trotzdem ihr eigenes gewürfeltes Gewicht.
 */

const HOUR = 3600;
const MINUTE = 60;

/**
 * Wie lange eine ausgeerntete Pflanze braucht, bis wieder alle Slots tragen.
 * Formel aus dem Wiki: (m + 2) / 3 × Wachstumszeit einer Frucht.
 */
function regrowTime(cropSeconds, slots) {
  return Math.round(((slots + 2) / 3) * cropSeconds);
}

function crop({
  id, assetId = id, template, rarity,
  seedPrice, sellPrice, growSeconds, cropSeconds = growSeconds,
  harvest = "single", slots = 1,
  baseWeight, maxWeight,
  stockChance, stockMin, stockMax,
  growthFile, frameWidth = 16, frameHeight, growthFrames, readyFrame,
  readyFile = null, readyFrames = 0, readyFps = 6,
  iconFile, iconFrames = 1, iconFrame = 0,
}) {
  return Object.freeze({
    id, assetId, template, rarity,
    seedPrice, sellPrice, growSeconds,
    harvest, slots: harvest === "multi" ? slots : 1,
    regrowSeconds: harvest === "multi" ? regrowTime(cropSeconds, slots) : 0,
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
    id: "carrot", template: "Carrot", rarity: "common",
    seedPrice: 10, sellPrice: 20, growSeconds: 4,
    baseWeight: 0.1, maxWeight: 0.3, stockChance: 1, stockMin: 6, stockMax: 25,
    growthFile: "carrot_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "carrot_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
  radish: crop({
    id: "radish", template: "Cabbage", rarity: "common",
    seedPrice: 30, sellPrice: 42, growSeconds: 53,
    baseWeight: 0.08, maxWeight: 0.24, stockChance: 1, stockMin: 3, stockMax: 3,
    growthFile: "radish_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "radish_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 0,
  }),
  strawberry: crop({
    id: "strawberry", assetId: "berry", template: "Strawberry", rarity: "common",
    seedPrice: 50, sellPrice: 14, growSeconds: 70, cropSeconds: 15,
    harvest: "multi", slots: 5,
    baseWeight: 0.05, maxWeight: 0.1, stockChance: 1, stockMin: 1, stockMax: 6,
    growthFile: "berry_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "berry_icon_16x16.png",
  }),
  lettuce: crop({
    id: "lettuce", template: "Aloe", rarity: "uncommon",
    seedPrice: 135, sellPrice: 310, growSeconds: 45,
    baseWeight: 0.4, maxWeight: 1, stockChance: 0.75, stockMin: 3, stockMax: 10,
    growthFile: "lettuce_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "lettuce_icon_16x16.png",
  }),
  beetroot: crop({
    id: "beetroot", template: "Beet", rarity: "uncommon",
    seedPrice: 210, sellPrice: 350, growSeconds: 60,
    baseWeight: 0.3, maxWeight: 0.9, stockChance: 1, stockMin: 3, stockMax: 10,
    growthFile: "beetroot_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "beetroot_icon_16x16.png",
  }),
  onion: crop({
    id: "onion", template: "Fava Bean", rarity: "uncommon",
    seedPrice: 250, sellPrice: 30, growSeconds: 15 * MINUTE, cropSeconds: 6 * MINUTE,
    harvest: "multi", slots: 8,
    baseWeight: 0.1, maxWeight: 0.3, stockChance: 0.6, stockMin: 2, stockMax: 5,
    growthFile: "onion_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "onion_icon_16x16.png",
  }),
  potato: crop({
    id: "potato", template: "Blueberry", rarity: "uncommon",
    seedPrice: 400, sellPrice: 23, growSeconds: 105, cropSeconds: 33,
    harvest: "multi", slots: 5,
    baseWeight: 0.1, maxWeight: 0.2, stockChance: 0.75, stockMin: 1, stockMax: 5,
    growthFile: "potato_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "potato_icon_16x16.png",
  }),
  cauliflower: crop({
    id: "cauliflower", template: "Apple", rarity: "uncommon",
    seedPrice: 500, sellPrice: 800, growSeconds: 22 * HOUR, cropSeconds: 30 * MINUTE,
    harvest: "multi", slots: 7,
    baseWeight: 0.18, maxWeight: 0.36, stockChance: 0.5, stockMin: 1, stockMax: 2,
    growthFile: "cauliflower_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "cauliflower_icon_16x16.png",
  }),
  celery: crop({
    // Vorher auf der Tulpe — deren 8 Sekunden bei 767 Verkaufswert und bis zu
    // 25 Samen je Lieferung waren mit unseren 64 Feldern eine Gelddruckmaschine.
    // Bei Magic Garden bremst dort der anfangs winzige Garten; den haben wir
    // nicht, also sitzt Sellerie jetzt auf einer trägeren Vorlage.
    id: "celery", template: "Echeveria", rarity: "rare",
    seedPrice: 2500, sellPrice: 3200, growSeconds: 20 * MINUTE,
    baseWeight: 0.8, maxWeight: 2.2, stockChance: 0.14, stockMin: 1, stockMax: 2,
    growthFile: "celery_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "celery_icon_16x16.png",
  }),
  tomato: crop({
    id: "tomato", template: "Tomato", rarity: "uncommon",
    seedPrice: 800, sellPrice: 27, growSeconds: 1100, cropSeconds: 60,
    harvest: "multi", slots: 2,
    baseWeight: 0.3, maxWeight: 0.6, stockChance: 0.75, stockMin: 1, stockMax: 3,
    growthFile: "tomato_16x32_23frames.png", frameHeight: 32, growthFrames: 23, readyFrame: 19,
    iconFile: "tomato_icon_16x16_4frames.png", iconFrames: 4, iconFrame: 3,
  }),
  broccoli: crop({
    id: "broccoli", template: "Daffodil", rarity: "rare",
    seedPrice: 1000, sellPrice: 1090, growSeconds: 50,
    baseWeight: 0.2, maxWeight: 0.6, stockChance: 0.15, stockMin: 1, stockMax: 4,
    growthFile: "broccoli_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "broccoli_icon_16x16.png",
  }),
  corn: crop({
    id: "corn", template: "Corn", rarity: "rare",
    seedPrice: 1300, sellPrice: 36, growSeconds: 130, cropSeconds: 45,
    harvest: "multi", slots: 1,
    baseWeight: 1.2, maxWeight: 2.4, stockChance: 0.175, stockMin: 1, stockMax: 5,
    growthFile: "corn_16x32_8frames.png", frameHeight: 32, growthFrames: 8, readyFrame: 5,
    readyFile: "corn_shake_16x32_8frames.png", readyFrames: 8, readyFps: 5,
    iconFile: "corn_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
  pumpkin: crop({
    id: "pumpkin", template: "Pumpkin", rarity: "rare",
    seedPrice: 3000, sellPrice: 3700, growSeconds: 35 * MINUTE,
    baseWeight: 6, maxWeight: 18, stockChance: 0.1, stockMin: 1, stockMax: 4,
    growthFile: "pumpkin_16x16_7frames.png", frameHeight: 16, growthFrames: 7, readyFrame: 5,
    iconFile: "pumpkin_icon_16x16_3frames.png", iconFrames: 3, iconFrame: 1,
  }),
  leek: crop({
    // Bei Magic Garden gibt es Lauch nur im Snow-Shop während eines
    // Wetter-Events, nicht im normalen Samenladen. Mit 90 Sekunden Wachstum bei
    // 35.000 Verkaufswert war er hier der mit Abstand größte Ausreißer.
    // Wetter-Shops kommen später; bis dahin nicht kaufbar.
    id: "leek", template: "Leek (Snow Shop)", rarity: "rare",
    seedPrice: 15000, sellPrice: 35000, growSeconds: 90,
    baseWeight: 0.4, maxWeight: 1.2, stockChance: 0, stockMin: 1, stockMax: 3,
    growthFile: "leek_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "leek_icon_16x16.png",
  }),
  wheat: crop({
    id: "wheat", template: "Cactus", rarity: "epic",
    seedPrice: 200000, sellPrice: 220000, growSeconds: 3 * HOUR,
    baseWeight: 1.5, maxWeight: 2.7, stockChance: 0.1, stockMin: 5, stockMax: 15,
    growthFile: "wheat_18x32_8frames.png", frameWidth: 18, frameHeight: 32, growthFrames: 8, readyFrame: 5,
    iconFile: "wheat_icon_16x16_9frames.png", iconFrames: 9, iconFrame: 4,
  }),
  bamboo: crop({
    id: "bamboo", template: "Bamboo", rarity: "epic",
    seedPrice: 400000, sellPrice: 500000, growSeconds: 22 * HOUR,
    baseWeight: 1, maxWeight: 2, stockChance: 0.05, stockMin: 5, stockMax: 10,
    growthFile: "bamboo_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "bamboo_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 0,
  }),
  eggplant: crop({
    // Ebenfalls kein regulärer Ladeninhalt — bei Magic Garden nur im Dawn-Shop.
    id: "eggplant", template: "Eggplant (Dawn Shop)", rarity: "epic",
    seedPrice: 500000, sellPrice: 100000, growSeconds: 22 * HOUR, cropSeconds: 3 * HOUR,
    harvest: "multi", slots: 3,
    baseWeight: 0.5, maxWeight: 1.25, stockChance: 0, stockMin: 1, stockMax: 1,
    growthFile: "eggplant_16x32_7frames.png", frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "eggplant_icon_16x16.png",
  }),
  grape: crop({
    id: "grape", template: "Grape", rarity: "legendary",
    seedPrice: 850000, sellPrice: 50000, growSeconds: 22 * HOUR, cropSeconds: 1350,
    harvest: "multi", slots: 1,
    baseWeight: 3, maxWeight: 6, stockChance: 0.01, stockMin: 1, stockMax: 1,
    growthFile: "grape_18x32_7frames.png", frameWidth: 18, frameHeight: 32, growthFrames: 7, readyFrame: 5,
    iconFile: "grape_icon_16x16_2frames.png", iconFrames: 2, iconFrame: 1,
  }),
  pepper: crop({
    id: "pepper", template: "Pepper", rarity: "legendary",
    seedPrice: 1000000, sellPrice: 7000, growSeconds: 22 * HOUR, cropSeconds: 270,
    harvest: "multi", slots: 9,
    baseWeight: 0.5, maxWeight: 1, stockChance: 0.01, stockMin: 1, stockMax: 1,
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
 * Gewicht einer geernteten Frucht. Magic Garden würfelt eine Größe von 50 bis
 * 100; 50 entspricht dem Grundgewicht, 100 dem Höchstgewicht. Der
 * Verkaufspreis skaliert mit dem Verhältnis zum Grundgewicht.
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
