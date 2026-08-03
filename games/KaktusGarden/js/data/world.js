/**
 * Das Dorf.
 *
 * Aufbau wie im Vorbild: ein Dorfplatz in der Mitte mit den Läden, darum
 * herum sechs gleich große Gartenparzellen. Wer den Server betritt, bekommt
 * eine freie Parzelle zugewiesen und sein Garten wird dort geladen.
 *
 * Alle Koordinaten sind Tiles (1 Tile = 16 Weltpixel), Ursprung oben links.
 * Bewegung, Kollision und Interaktion rechnen ausschließlich in Tiles — der
 * Spieler steht immer exakt auf einem Feld.
 *
 *   Zeilen  3-12    Parzellen 0, 1, 2 (oben)
 *   Zeilen 15-26    Dorfplatz mit Läden
 *   Zeilen 29-38    Parzellen 3, 4, 5 (unten)
 */

export const TILE = 16;
export const MAP_COLS = 46;
export const MAP_ROWS = 42;
export const MAP_WIDTH = MAP_COLS * TILE;
export const MAP_HEIGHT = MAP_ROWS * TILE;

export const GRASS_COLOR = "#71ab31";

export const SHEETS = Object.freeze({
  ground1: "assets/tiles/ground_01_16x16.png",
  ground2: "assets/tiles/ground_02_16x16.png",
  ground3: "assets/tiles/ground_03_16x16.png",
  fence: "assets/tiles/fence_01_16x16.png",
  tree: "assets/tiles/tree_01_16x16.png",
  objects: "assets/objects/objects_01_16x16.png",
  building: "assets/buildings/building_01_16x16.png",
  atlas: "assets/buildings/atlas_16x.png",
});

/**
 * Der Gebäude-Atlas benutzt Pink als Transparenzfarbe statt eines Alphakanals.
 * Beim Laden wird diese Farbe herausgerechnet.
 */
export const ATLAS_COLOR_KEY = Object.freeze({ r: 255, g: 153, b: 204 });

export const AUTOTILES = Object.freeze({
  soil: "assets/autotiles/02_grass/03_grass_on_dirt_02.png",
  path: "assets/autotiles/02_grass/02_grass_on_dirt_01.png",
  bed: "assets/autotiles/06_field/02_field_02.png",
});

/* --------------------------------------------------------------- Parzellen */

/** Pflanzfläche einer Parzelle in Feldern — 8 × 8 = 64 Beete. */
export const PLOT_COLS = 8;
export const PLOT_ROWS = 8;
export const PLOT_CELLS = PLOT_COLS * PLOT_ROWS;

/** Außenmaß inklusive Zaunring. */
const PLOT_OUTER_W = PLOT_COLS + 2;
const PLOT_OUTER_H = PLOT_ROWS + 2;

const PLOT_ORIGINS = [
  [4, 3], [18, 3], [32, 3],
  [4, 29], [18, 29], [32, 29],
];

/**
 * Die sechs Parzellen. `soil` ist die bepflanzbare Fläche, `fence` der Ring
 * darum, `gate` das Feld in der Zaunreihe, durch das man hineinläuft.
 */
export const PLOTS = Object.freeze(PLOT_ORIGINS.map(([x, y], index) => {
  const top = index < 3;
  const gateX = x + Math.floor(PLOT_OUTER_W / 2) - 1;
  const gateY = top ? y + PLOT_OUTER_H - 1 : y;
  return Object.freeze({
    index,
    fence: Object.freeze({ x, y, w: PLOT_OUTER_W, h: PLOT_OUTER_H }),
    soil: Object.freeze({ x: x + 1, y: y + 1, w: PLOT_COLS, h: PLOT_ROWS }),
    gate: Object.freeze({ x: gateX, y: gateY, w: 2 }),
    // Feld direkt vor dem Tor, dort erscheint man beim Betreten der Parzelle.
    spawn: Object.freeze({ x: gateX, y: top ? gateY - 1 : gateY + 1 }),
    sign: Object.freeze({ x: x + 1, y: top ? y + PLOT_OUTER_H : y - 1 }),
  });
}));

/** Feldindex innerhalb einer Parzelle, oder -1 wenn dort keine Erde ist. */
export function plotCellAt(plot, tileX, tileY) {
  const { soil } = plot;
  if (tileX < soil.x || tileX >= soil.x + soil.w) return -1;
  if (tileY < soil.y || tileY >= soil.y + soil.h) return -1;
  return (tileY - soil.y) * PLOT_COLS + (tileX - soil.x);
}

/** Welche Parzelle liegt unter diesem Feld? */
export function plotAt(tileX, tileY) {
  return PLOTS.find((plot) => plotCellAt(plot, tileX, tileY) >= 0) || null;
}

/* ------------------------------------------------------------- Dorfgelände */

/**
 * Der Marktplatz.
 *
 *   Zeilen 15-16   freier Gang, hier münden die Wege von den Parzellen
 *   Zeilen 17-20   Ladenzeile
 *   Zeile  21      Türreihe
 *   Zeilen 22-27   offener Platz
 */
export const VILLAGE = Object.freeze({ x: 6, y: 15, w: 34, h: 13 });

/**
 * Wege: senkrecht von jeder Parzelle zum Platz, waagerecht als Verbindung.
 * Die Autotile-Übergänge entstehen daraus von selbst.
 */
export const PATHS = Object.freeze([
  Object.freeze({ x: 8, y: 13, w: 2, h: 2 }),
  Object.freeze({ x: 22, y: 13, w: 2, h: 2 }),
  Object.freeze({ x: 36, y: 13, w: 2, h: 2 }),
  Object.freeze({ x: 8, y: 27, w: 2, h: 2 }),
  Object.freeze({ x: 22, y: 27, w: 2, h: 2 }),
  Object.freeze({ x: 36, y: 27, w: 2, h: 2 }),
]);

/**
 * Läden. Kaufen steht links, Verkaufen rechts — wie im Vorbild, damit man sich
 * die Seite merken kann. `door` ist das Feld, auf dem der Spieler stehen muss,
 * `hint` die Beschriftung darüber.
 */
/**
 * Die Läden. Wie im Vorbild steht links, was verkauft, und rechts, was ankauft.
 *
 * `sprite` ist die obere linke Ecke, `size` das Maß in Tiles (danach richtet
 * sich auch die Kollision), `door` das Feld davor, auf dem der Spieler stehen
 * muss. `closed` markiert Läden, deren Inhalt noch nicht im Spiel ist.
 */
export const SHOPS = Object.freeze([
  Object.freeze({
    id: "seeds", labelKey: "garden.shop_seeds", side: "buy", closed: false,
    sprite: Object.freeze({ x: 10, y: 17 }), size: Object.freeze({ w: 4, h: 4 }), door: Object.freeze({ x: 11, y: 21 }),
  }),
  Object.freeze({
    id: "tools", labelKey: "garden.shop_tools", side: "buy", closed: false,
    sprite: Object.freeze({ x: 15, y: 17 }), size: Object.freeze({ w: 4, h: 4 }), door: Object.freeze({ x: 16, y: 21 }),
  }),
  Object.freeze({
    id: "eggs", labelKey: "garden.shop_eggs", side: "buy", closed: true,
    sprite: Object.freeze({ x: 20, y: 17 }), size: Object.freeze({ w: 4, h: 4 }), door: Object.freeze({ x: 21, y: 21 }),
  }),
  Object.freeze({
    id: "crops", labelKey: "garden.shop_crops", side: "sell", closed: false,
    sprite: Object.freeze({ x: 27, y: 18 }), size: Object.freeze({ w: 4, h: 3 }), door: Object.freeze({ x: 28, y: 21 }),
  }),
  Object.freeze({
    id: "pets", labelKey: "garden.shop_pets", side: "sell", closed: true,
    sprite: Object.freeze({ x: 32, y: 18 }), size: Object.freeze({ w: 4, h: 3 }), door: Object.freeze({ x: 33, y: 21 }),
  }),
]);

/** Startfeld beim Betreten des Dorfes, falls keine Parzelle zugewiesen wurde. */
export const VILLAGE_SPAWN = Object.freeze({ x: 22, y: 22 });

/* ----------------------------------------------------------- Geländeabfrage */

function inside(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/**
 * Erde: Dorfplatz, Wege und Parzellen.
 *
 * Bei den Parzellen zählt bewusst der ganze Zaunring mit, nicht nur die
 * Pflanzfläche. Dadurch liegt der Übergang von Gras zu Erde **unter** dem
 * Zaun statt einen Tile innerhalb davon — der Zaun steht dann sauber auf der
 * Kante und die Parzelle wirkt als geschlossenes Grundstück.
 */
export function isGround(x, y) {
  if (inside(VILLAGE, x, y)) return true;
  if (PATHS.some((path) => inside(path, x, y))) return true;
  return PLOTS.some((plot) => inside(plot.fence, x, y));
}

/** Nur die bepflanzbare Erde der Parzellen. */
export function isPlotSoil(x, y) {
  return PLOTS.some((plot) => inside(plot.soil, x, y));
}

const blocked = new Set();

function block(x, y) {
  blocked.add(`${x},${y}`);
}

// Zaunringe der Parzellen blockieren, bis auf das Tor.
for (const plot of PLOTS) {
  const { fence, gate } = plot;
  for (let x = fence.x; x < fence.x + fence.w; x += 1) {
    for (let y = fence.y; y < fence.y + fence.h; y += 1) {
      const onRing = x === fence.x || x === fence.x + fence.w - 1
        || y === fence.y || y === fence.y + fence.h - 1;
      if (!onRing) continue;
      const isGate = y === gate.y && x >= gate.x && x < gate.x + gate.w;
      if (!isGate) block(x, y);
    }
  }
}

// Läden sind massiv; begehbar ist nur das Türfeld davor.
for (const shop of SHOPS) {
  for (let dx = 0; dx < shop.size.w; dx += 1) {
    for (let dy = 0; dy < shop.size.h; dy += 1) block(shop.sprite.x + dx, shop.sprite.y + dy);
  }
}

/** Kann der Spieler dieses Feld betreten? */
export function isWalkable(x, y) {
  if (x < 1 || y < 1 || x >= MAP_COLS - 1 || y >= MAP_ROWS - 1) return false;
  return !blocked.has(`${x},${y}`);
}
