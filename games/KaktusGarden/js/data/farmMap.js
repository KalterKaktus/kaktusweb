/**
 * Kuratierte Farmkarte für KaktusGarden.
 *
 * Die Welt ist eine echte Tilemap aus den Super-Retro-Ranch-Sheets. Aufbau:
 *
 *   - Der Zaun umschließt ausschließlich die Anbaufläche. Innerhalb liegen nur
 *     Erde und die 16 Beete, keine Dekoration.
 *   - Laden, Verkaufskiste und Brett stehen darüber auf dem Hofplatz, ein Tor
 *     in der oberen Zaunreihe führt aufs Feld.
 *   - Alles andere — Bäume, Büsche, Blumen, Steine, Wege — liegt außerhalb.
 *
 * Alle Koordinaten sind Tiles (1 Tile = 16 Map-Pixel), Ursprung oben links.
 *
 *   Spalten 0-14, Zeilen 3-4     Zufahrtsweg zum Hof
 *   Spalten 15-31, Zeilen 2-6    Hofplatz mit Laden, Kiste, Brett
 *   Spalten 13-31, Zeilen 7-25   Zaun
 *   Spalten 14-30, Zeilen 8-24   Anbaufläche
 *     darin Spalten 15-29, Zeilen 9-23   16 Beete (4 × 4, je 3 × 3)
 */

export const TILE = 16;
export const MAP_COLS = 44;
export const MAP_ROWS = 27;
export const MAP_WIDTH = MAP_COLS * TILE;
export const MAP_HEIGHT = MAP_ROWS * TILE;

/** Grundfarbe der Wiese — identisch mit der Hintergrundzeile des Gras-Autotiles. */
export const GRASS_COLOR = "#71ab31";

export const SHEETS = Object.freeze({
  ground2: "assets/tiles/ground_02_16x16.png",
  ground3: "assets/tiles/ground_03_16x16.png",
  fence: "assets/tiles/fence_01_16x16.png",
  tree: "assets/tiles/tree_01_16x16.png",
  objects: "assets/objects/objects_01_16x16.png",
  building: "assets/buildings/building_01_16x16.png",
});

/**
 * Autotiles im 1×6-Format: Zeile 0 = freistehend, 1 = senkrechter Streifen,
 * 2 = waagerechter Streifen, 3 = Innenecken, 4 = Füllung, 5 = Hintergrund.
 * Aus den 8×8-Vierteln dieser fünf Zeilen lässt sich jeder Randfall bauen.
 *
 * Die beiden Sets sind aufeinander abgestimmt: Die Füllung von `soil`
 * (#eea160) ist exakt die Hintergrundfarbe von `bed`, und der Hintergrund von
 * `soil` (#71ab31) ist die Grasfarbe. Dadurch entstehen keine Nähte.
 */
export const AUTOTILES = Object.freeze({
  soil: "assets/autotiles/02_grass/03_grass_on_dirt_02.png",
  bed: "assets/autotiles/06_field/02_field_02.png",
});

/**
 * Der Erdboden ist bewusst kein Rechteck: Zufahrt, Hofplatz, Tordurchgang und
 * Anbaufläche sind vier überlappende Bereiche, alles andere bleibt Wiese. Der
 * Autotiler setzt die Übergänge daraus von selbst zusammen.
 */
export const SOIL_AREAS = Object.freeze([
  Object.freeze({ x: 0, y: 3, w: 15, h: 2 }),
  Object.freeze({ x: 15, y: 2, w: 17, h: 5 }),
  Object.freeze({ x: 21, y: 7, w: 2, h: 1 }),
  Object.freeze({ x: 14, y: 8, w: 17, h: 17 }),
]);

/** Zaunrechteck (Außenkante) — umschließt nur die Anbaufläche. */
export const FENCE_RECT = Object.freeze({ x: 13, y: 7, w: 19, h: 19 });

/** Toröffnung in der oberen Zaunreihe, in Spalten. */
export const FENCE_GATE = Object.freeze({ x: 21, w: 2 });

export const BED_COLS = 4;
export const BED_ROWS = 4;
export const BED_TILE_W = 3;
export const BED_TILE_H = 3;
const BED_ORIGIN_X = 15;
const BED_ORIGIN_Y = 9;
const BED_STEP = 4;

/** Die 16 Beete in Lesereihenfolge — Index = fieldId aus dem Spielstand. */
export const BEDS = Object.freeze(Array.from({ length: BED_COLS * BED_ROWS }, (_, index) => Object.freeze({
  fieldId: index,
  x: BED_ORIGIN_X + (index % BED_COLS) * BED_STEP,
  y: BED_ORIGIN_Y + Math.floor(index / BED_COLS) * BED_STEP,
  w: BED_TILE_W,
  h: BED_TILE_H,
})));

const bedCells = new Set();
for (const bed of BEDS) {
  for (let dy = 0; dy < bed.h; dy += 1) {
    for (let dx = 0; dx < bed.w; dx += 1) bedCells.add(`${bed.x + dx},${bed.y + dy}`);
  }
}

export function isSoil(x, y) {
  return SOIL_AREAS.some((area) => x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h);
}

export function isBed(x, y) {
  return bedCells.has(`${x},${y}`);
}

/**
 * Pflichtausschnitt: Zaun, Anbaufläche und Gebäude. Dieser Bereich muss auf
 * jedem Gerät vollständig sichtbar sein; wie viel Waldrand daneben noch passt,
 * entscheidet der Bildschirm.
 */
export const FOCUS_VIEW = Object.freeze({ x: 12, y: 2, w: 21, h: 25 });

/** Tile-Bausteine: [sheet, spaltenIndex, zeilenIndex, breite, höhe] in Tiles. */
const T = (sheet, sx, sy, w = 1, h = 1) => Object.freeze({ sheet, sx, sy, w, h });

export const TILES = Object.freeze({
  fenceTopLeft: T("fence", 0, 1),
  fenceTop: T("fence", 1, 1),
  fenceTopPost: T("fence", 1, 2),
  fenceTopRight: T("fence", 2, 1),
  fenceLeft: T("fence", 0, 2),
  fenceRight: T("fence", 2, 2),
  fenceBottomLeft: T("fence", 0, 3),
  fenceBottomRight: T("fence", 2, 3),
  fenceRunStart: T("fence", 2, 6),
  fenceRunEnd: T("fence", 3, 6),

  flowerWhite: T("ground2", 8, 0),
  flowerRed: T("ground2", 9, 0),
  flowerPink: T("ground2", 10, 0),
  stump: T("ground2", 11, 0),
  shroomOrange: T("ground2", 8, 1),
  shroomRed: T("ground2", 9, 1),
  shroomPurple: T("ground2", 11, 1),
  stoneA: T("ground2", 8, 2),
  stoneB: T("ground2", 9, 2),
  stoneC: T("ground2", 10, 2),
  stoneD: T("ground2", 11, 2),
  gravelA: T("ground2", 8, 4),
  gravelB: T("ground2", 10, 4),
  gravelC: T("ground2", 9, 5),

  bushLarge: T("ground3", 8, 6, 2, 2),
  bushLargeDark: T("ground3", 8, 8, 2, 2),
  bushRound: T("ground3", 10, 6, 2, 2),
  bushRoundDark: T("ground3", 10, 8, 2, 2),
  bushTiny: T("ground3", 12, 6),
  tuft: T("ground3", 13, 4),
  tuftSmall: T("ground3", 14, 4),
  tuftDark: T("ground3", 13, 8),

  treeBig: T("tree", 2, 1, 3, 3),
  treeSmall: T("tree", 0, 2, 2, 2),

  shopHouse: T("building", 0, 1, 4, 3),
  mailbox: T("objects", 1, 5, 1, 2),
  lamp: T("objects", 3, 5, 1, 2),
  signBoard: T("objects", 1, 7),
  sack: T("objects", 0, 3),
  barrel: T("objects", 1, 3),
  potBlue: T("objects", 0, 1),
  potGreen: T("objects", 1, 1),
});

const P = (tile, x, y) => Object.freeze({ tile, x, y });

/**
 * Flache Deko direkt auf dem Boden. Nichts davon liegt innerhalb des Zauns —
 * die Anbaufläche bleibt frei.
 */
export const GROUND_DECOR = Object.freeze([
  // Steine auf der Zufahrt und dem Hofplatz
  P("stoneA", 1, 3), P("stoneC", 3, 4), P("stoneB", 5, 3), P("stoneD", 7, 4),
  P("stoneC", 9, 3), P("stoneA", 11, 4), P("stoneB", 13, 3), P("stoneD", 2, 4),
  P("stoneA", 6, 4), P("stoneC", 10, 3), P("stoneD", 14, 4), P("stoneB", 4, 3),
  P("gravelA", 17, 6), P("gravelB", 26, 6), P("gravelC", 30, 3),
  P("gravelB", 21, 6), P("gravelA", 22, 7), P("gravelC", 15, 6),

  // Wiese außerhalb des Zauns
  P("tuft", 12, 8), P("flowerWhite", 12, 12), P("tuftSmall", 12, 17), P("tuftDark", 12, 22),
  P("tuft", 32, 9), P("flowerRed", 32, 14), P("tuftSmall", 32, 19), P("tuftDark", 32, 24),
  P("flowerPink", 16, 26), P("tuft", 21, 26), P("flowerWhite", 26, 26), P("tuftSmall", 30, 26),
  P("shroomOrange", 9, 8), P("shroomRed", 35, 5), P("shroomPurple", 8, 20),
  P("flowerRed", 3, 8), P("flowerWhite", 6, 16), P("flowerPink", 38, 12), P("tuft", 41, 20),
  P("tuftDark", 2, 24), P("tuftSmall", 37, 25), P("tuft", 17, 1), P("flowerPink", 28, 1),
]);

/** Hohe Objekte mit Fußpunkt — Bäume, Büsche, Fässer, Laterne. */
export const PROP_DECOR = Object.freeze([
  // Waldsaum oben
  P("treeSmall", 0, 0), P("bushLarge", 3, 0), P("treeSmall", 6, 0), P("bushRoundDark", 9, 0),
  P("treeSmall", 12, 0), P("bushLarge", 20, 0), P("treeSmall", 24, 0), P("bushRound", 31, 0),
  P("treeSmall", 34, 0), P("bushLargeDark", 38, 0), P("treeSmall", 41, 0),
  // Waldsaum links
  P("treeBig", 0, 6), P("treeSmall", 4, 6), P("bushLarge", 7, 6), P("treeBig", 10, 6),
  P("treeSmall", 1, 10), P("bushRoundDark", 4, 10), P("treeBig", 7, 10), P("bushLarge", 10, 11),
  P("treeBig", 0, 14), P("treeSmall", 5, 14), P("bushLargeDark", 8, 14), P("treeSmall", 10, 16),
  P("bushRound", 1, 18), P("treeBig", 4, 18), P("treeSmall", 8, 18), P("bushLarge", 10, 20),
  P("treeSmall", 0, 22), P("bushRoundDark", 3, 22), P("treeBig", 6, 22), P("treeSmall", 10, 23),
  // Waldsaum rechts
  P("treeBig", 33, 2), P("treeSmall", 37, 2), P("bushLarge", 40, 2),
  P("treeSmall", 33, 6), P("bushRoundDark", 36, 6), P("treeBig", 39, 6), P("treeSmall", 42, 7),
  P("bushLarge", 33, 10), P("treeBig", 36, 10), P("treeSmall", 40, 11), P("bushRound", 42, 14),
  P("treeSmall", 34, 14), P("bushLargeDark", 37, 15), P("treeBig", 40, 16),
  P("treeBig", 33, 18), P("treeSmall", 37, 19), P("bushRound", 40, 20), P("treeSmall", 42, 22),
  P("bushLarge", 34, 22), P("treeBig", 37, 23),
  // Waldsaum unten
  P("bushLarge", 14, 26), P("bushRoundDark", 18, 26), P("bushLarge", 23, 26),
  P("bushRoundDark", 28, 26), P("bushLarge", 31, 26), P("treeSmall", 2, 26), P("treeSmall", 8, 26),
  P("treeSmall", 35, 26), P("bushRound", 41, 26),
  // Hofplatz
  P("lamp", 15, 2), P("barrel", 22, 3), P("sack", 16, 6), P("potGreen", 27, 5),
  P("potBlue", 31, 3), P("stump", 31, 6),
]);

/**
 * Die drei anklickbaren Gebäude. `hit` ist die Trefferfläche in Tiles und darf
 * größer als das Sprite sein, damit sie auf dem Handy sicher zu treffen ist.
 */
export const BUILDINGS = Object.freeze([
  Object.freeze({
    id: "shop",
    labelKey: "garden.nav_shop",
    sprites: Object.freeze([P("shopHouse", 17, 3)]),
    hit: Object.freeze({ x: 17, y: 3, w: 4, h: 3.4 }),
  }),
  Object.freeze({
    id: "sell",
    labelKey: "garden.nav_sell",
    sprites: Object.freeze([P("shopHouse", 23, 3)]),
    hit: Object.freeze({ x: 23, y: 3, w: 4, h: 3.4 }),
  }),
  Object.freeze({
    id: "players",
    labelKey: "garden.nav_players",
    sprites: Object.freeze([P("mailbox", 29, 4), P("signBoard", 30, 5)]),
    hit: Object.freeze({ x: 28.5, y: 3.6, w: 3, h: 2.8 }),
  }),
]);
