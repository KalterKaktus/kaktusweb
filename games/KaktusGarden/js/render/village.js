import { loadSheets } from "../engine/assets.js";
import { drawAutotileCell } from "../engine/autotile.js";
import {
  ATLAS_COLOR_KEY,
  AUTOTILES,
  GRASS_COLOR,
  MAP_COLS,
  MAP_HEIGHT,
  MAP_ROWS,
  MAP_WIDTH,
  PATHS,
  PLOTS,
  SHEETS,
  SHOPS,
  TILE,
  VILLAGE,
  isGround,
  isPlotSoil,
} from "../data/world.js";

/** Tile-Bausteine: [sheet, spalte, zeile, breite, höhe] in Tiles. */
const T = (sheet, sx, sy, w = 1, h = 1) => ({ sheet, sx, sy, w, h });

/**
 * Das Grünzeug aus ground_03 komplett verfügbar machen.
 *
 * Das Sheet enthält dieselben fünf Formen in sieben Grüntönen, von 1 (fast
 * gelbgrün) bis 7 (fast schwarzgrün) — je dunkler, desto mehr Tiefe bekommt
 * die Fläche. Statt einzelne Namen von Hand zu pflegen, werden hier alle
 * 5 × 7 Kombinationen erzeugt:
 *
 *   bush1 … bush7          großer Busch, 2 × 2
 *   bushRound1 … 7         runder Busch, 2 × 2
 *   bushSmall1 … 7         kleiner Busch, 1 × 1
 *   tuft1 … 7              Grasbüschel
 *   tuftAlt1 … 7           Grasbüschel, andere Form
 *   tuftLow1 … 7           flaches Büschel
 *
 * Die großen, mehrfarbig schattierten Büsche links im Sheet (Spalten 0-7) sind
 * unregelmäßig geschnitten und deshalb hier nicht dabei; wer sie braucht, legt
 * sie einzeln mit den passenden Maßen an.
 */
const FOLIAGE = {};
for (let shade = 1; shade <= 7; shade += 1) {
  const row = (shade - 1) * 2;
  FOLIAGE[`bush${shade}`] = T("ground3", 8, row, 2, 2);
  FOLIAGE[`bushRound${shade}`] = T("ground3", 10, row, 2, 2);
  FOLIAGE[`bushSmall${shade}`] = T("ground3", 12, row);
  FOLIAGE[`tuft${shade}`] = T("ground3", 13, row);
  FOLIAGE[`tuftAlt${shade}`] = T("ground3", 14, row);
  FOLIAGE[`tuftLow${shade}`] = T("ground3", 13, row + 1);
}

export const TILES = Object.freeze({
  ...FOLIAGE,

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
  stoneA: T("ground2", 8, 2),
  stoneB: T("ground2", 9, 2),
  stoneC: T("ground2", 10, 2),
  gravelA: T("ground2", 8, 4),
  gravelB: T("ground2", 10, 4),

  treeBig: T("tree", 2, 1, 3, 3),
  treeSmall: T("tree", 0, 2, 2, 2),

  // Grastexturen. Als Fläche besser über GRASS_PATCHES setzen, einzeln gehen
  // sie aber auch als Deko.
  grassMeadowA: T("ground2", 0, 1),
  grassMeadowB: T("ground2", 1, 1),
  grassMeadowC: T("ground2", 0, 2),
  grassMeadowD: T("ground2", 1, 2),

  // Fertige Beet-Flächen aus ground_01. Zeile 11/12 hell, 13/14 dunkel;
  // Spalte 3 ist die einzelne 1 × 1-Fläche — genau ein Beet pro Feld.
  bedLight: T("ground1", 3, 11),
  bedLightAlt: T("ground1", 3, 12),
  bedDark: T("ground1", 3, 13),
  bedDarkAlt: T("ground1", 3, 14),

  house: T("building", 0, 1, 4, 3),
  mailbox: T("objects", 1, 5, 1, 2),
  lamp: T("objects", 3, 5, 1, 2),
  signBoard: T("objects", 1, 7),
  sack: T("objects", 0, 3),
  barrel: T("objects", 1, 3),
  potBlue: T("objects", 0, 1),
  potGreen: T("objects", 1, 1),
});

const P = (tile, x, y) => ({ tile, x, y });

/* ==========================================================================
   AB HIER WIRD DIE KARTE GESTALTET
   --------------------------------------------------------------------------
   Zwei Listen, sonst nichts. Beide erwarten Tile-Koordinaten; die findest du
   im Spiel mit ?debug in der Adresszeile (Raster mit Zahlen, Klick schreibt
   die Koordinate in die Konsole).

   Namen für `tile` sind die Schlüssel aus TILES weiter oben.
   ========================================================================== */

/**
 * Grasflächen mit Textur überziehen. Die Wiese ist sonst eine ruhige Fläche —
 * hier setzt du Wiesenstücke hinein, wo es lebendiger sein soll.
 *
 *   style "meadow"  hohe Halme, 2 × 2-Muster, kräftiger
 *   style "dense"   feines gleichmäßiges Gras, ruhiger
 *
 * Tipp: einen Tile Abstand zu Wegen und Beeten lassen, sonst schneidet der
 * Erdrand hart in die Textur.
 */
export const GRASS_PATCHES = [];

/**
 * Bäume, Büsche, Steine, Töpfe … — bewusst leer. Erst steht das Grundgerüst
 * aus Häusern und Gärten, die Ausgestaltung kommt danach.
 */
export const DECOR = [];

/** Bodenfläche der Beete. Siehe TILES für die hellen Varianten. */
const BED_TILE = "bedLightAlt";

/* --------------------------------------------------------- Marktplatz-Läden */

/**
 * Der Gebäude-Atlas ist ein **modularer Bausatz auf dem 16er-Raster**, keine
 * Sammlung fertiger Häuser. Jedes Tile ist ein eigenes Bauteil:
 *
 *   Zeile 1-2   Dach, mit eigenen Tiles für linke Kante, Mitte, rechte Kante
 *   Zeile 3-12  Wandzeilen: Randpfosten links/rechts, dazwischen Fenster,
 *               Läden, Markisen, Blumenkästen
 *   Spalte 20-23, Zeile 9-12   die beiden Marktstände, ebenfalls mit
 *               Rand- und Mitteltiles
 *
 * ⚠️ Es gibt im ganzen Atlas **genau eine Tür**: Tile (17,4). Wer ein Haus
 * baut, muss dieses Tile setzen — sonst steht das Gebäude ohne Eingang da.
 * Deshalb wird hier Zeile für Zeile aus einzelnen Tiles zusammengebaut statt
 * fertige Blöcke zu kopieren.
 */
/**
 * Wichtigste Regel: die Zeilen werden **so übernommen, wie sie im Atlas
 * gezeichnet sind** — vier nebeneinanderliegende Spalten, unverändert. Wer
 * Rand- und Mitteltiles selbst zusammensetzt, zerreißt die Fenster, weil sie
 * über mehrere Tiles hinweg gemalt sind.
 */
const band = (x0, y) => [[x0, y], [x0 + 1, y], [x0 + 2, y], [x0 + 3, y]];

/** Dächer in drei Farben, je zwei Zeilen hoch. */
const ROOFS = Object.freeze({
  wood: [band(16, 1), band(16, 2)],
  red: [band(20, 9), band(20, 10)],
  blue: [band(20, 11), band(20, 12)],
});

/**
 * Wandzeilen. Zeile 3 ist das Obergeschoss, Zeile 4 das Erdgeschoss **mit der
 * einzigen Tür des Atlas** (Tile 17,4 — zweite Spalte). Ein Gebäude ohne diese
 * Zeile hat keinen Eingang.
 */
const WALL_UPPER = band(16, 3);
const WALL_GROUND = band(16, 4);

/** Spalte, in der die Tür sitzt — muss zum Türfeld in `world.js` passen. */
export const DOOR_COLUMN = 1;

/**
 * Fünf Gebäude: drei Häuser mit unterschiedlicher Dachfarbe, zwei Zelte.
 * Zelte sind flacher (Dach plus Erdgeschoss) und dadurch klar unterscheidbar.
 */
const SHOP_LAYOUTS = Object.freeze({
  seeds: { kind: "house", roof: "wood" },
  tools: { kind: "house", roof: "red" },
  eggs: { kind: "house", roof: "blue" },
  crops: { kind: "tent", roof: "red" },
  pets: { kind: "tent", roof: "blue" },
});

/** Liefert alle Tile-Platzierungen eines Ladens, relativ zu seiner Ecke. */
function shopTiles(shop) {
  const layout = SHOP_LAYOUTS[shop.id];
  if (!layout) return [];
  const roof = ROOFS[layout.roof];
  const plan = layout.kind === "tent"
    ? [...roof, WALL_GROUND]
    : [...roof, WALL_UPPER, WALL_GROUND];
  return plan.flatMap((tiles, row) => tiles.map((tile, column) => ({ tile, column, row })));
}

/**
 * Rechnet die Transparenzfarbe des Atlas heraus. Das Original benutzt Pink
 * statt eines Alphakanals, das würde sonst als rosa Klotz im Dorf stehen.
 */
function keyOutColor(image, key) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data: pixels } = data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === key.r && pixels[i + 1] === key.g && pixels[i + 2] === key.b) pixels[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function drawAtlasTile(ctx, atlas, [sx, sy], tileX, tileY) {
  ctx.drawImage(atlas, sx * TILE, sy * TILE, TILE, TILE, tileX * TILE, tileY * TILE, TILE, TILE);
}

function drawShop(ctx, atlas, shop) {
  for (const piece of shopTiles(shop)) {
    drawAtlasTile(ctx, atlas, piece.tile, shop.sprite.x + piece.column, shop.sprite.y + piece.row);
  }
}

/* ========================= ab hier nur noch Maschinerie ================== */

const MEADOW_BLOCK = ["grassMeadowA", "grassMeadowB", "grassMeadowC", "grassMeadowD"];

function drawGrassPatch(ctx, images, patch) {
  for (let y = patch.y; y < patch.y + patch.h; y += 1) {
    for (let x = patch.x; x < patch.x + patch.w; x += 1) {
      // "meadow" ist ein nahtloser 2 × 2-Block, "dense" ein einzelnes Tile.
      const tile = patch.style === "dense"
        ? "grassMeadowA"
        : MEADOW_BLOCK[(y % 2) * 2 + (x % 2)];
      drawTile(ctx, images, tile, x, y);
    }
  }
}

const warnedTiles = new Set();

function drawTile(ctx, images, tileId, tileX, tileY) {
  const tile = TILES[tileId];
  if (!tile) {
    // Beim Bearbeiten der Karte passiert ein Tippfehler schnell — dann fehlt
    // nur dieses eine Objekt, statt dass die ganze Welt nicht mehr lädt.
    if (!warnedTiles.has(tileId)) {
      warnedTiles.add(tileId);
      console.warn(`Unbekanntes Tile "${tileId}" bei ${tileX},${tileY} — bekannte Namen stehen in TILES.`);
    }
    return;
  }
  const image = images[tile.sheet];
  if (!image) return;
  ctx.drawImage(
    image,
    tile.sx * TILE, tile.sy * TILE, tile.w * TILE, tile.h * TILE,
    tileX * TILE, tileY * TILE, tile.w * TILE, tile.h * TILE,
  );
}

function drawPlotFence(ctx, images, plot) {
  const { fence, gate } = plot;
  const right = fence.x + fence.w - 1;
  const bottom = fence.y + fence.h - 1;
  const gateEnd = gate.x + gate.w - 1;

  for (let column = fence.x + 1; column < right; column += 1) {
    const post = (column - fence.x) % 4 === 0 ? "fenceTopPost" : "fenceTop";
    for (const row of [fence.y, bottom]) {
      // Das Tor bleibt offen; links und rechts davon endet der Lauf mit Pfosten.
      if (row === gate.y) {
        if (column >= gate.x && column <= gateEnd) continue;
        if (column === gate.x - 1) { drawTile(ctx, images, "fenceRunEnd", column, row); continue; }
        if (column === gateEnd + 1) { drawTile(ctx, images, "fenceRunStart", column, row); continue; }
      }
      drawTile(ctx, images, post, column, row);
    }
  }
  for (let row = fence.y + 1; row < bottom; row += 1) {
    drawTile(ctx, images, "fenceLeft", fence.x, row);
    drawTile(ctx, images, "fenceRight", right, row);
  }
  drawTile(ctx, images, "fenceTopLeft", fence.x, fence.y);
  drawTile(ctx, images, "fenceTopRight", right, fence.y);
  drawTile(ctx, images, "fenceBottomLeft", fence.x, bottom);
  drawTile(ctx, images, "fenceBottomRight", right, bottom);
}

/**
 * Backt die unveränderliche Welt einmalig in 1:1-Weltpixel. Jeder Frame
 * kopiert daraus nur noch den Kameraausschnitt — das ist um Größenordnungen
 * billiger, als die Tilemap jedes Bild neu zu zeichnen.
 */
export async function bakeVillage() {
  const images = await loadSheets({ ...SHEETS, ...AUTOTILES });
  const atlas = keyOutColor(images.atlas, ATLAS_COLOR_KEY);
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Wiesenstücke liegen unter dem Erdboden: wo Erde angrenzt, malt deren
  // Übergangskachel ihren eigenen Grasrand darüber und schneidet die Textur
  // sauber ab.
  for (const patch of GRASS_PATCHES) drawGrassPatch(ctx, images, patch);

  // Erdboden: Dorfplatz, Wege und Parzellenböden hängen zusammen und bekommen
  // dadurch einen einzigen sauberen Grasrand.
  for (let y = 0; y < MAP_ROWS; y += 1) {
    for (let x = 0; x < MAP_COLS; x += 1) {
      if (isGround(x, y)) drawAutotileCell(ctx, images.soil, isGround, x, y);
    }
  }

  // Pflanzflächen: ein Beet je Feld, damit auf den ersten Blick klar ist, wo
  // gepflanzt wird und wie viele Felder eine Parzelle hat.
  for (const plot of PLOTS) {
    for (let y = plot.soil.y; y < plot.soil.y + plot.soil.h; y += 1) {
      for (let x = plot.soil.x; x < plot.soil.x + plot.soil.w; x += 1) {
        drawTile(ctx, images, BED_TILE, x, y);
      }
    }
  }

  for (const plot of PLOTS) drawPlotFence(ctx, images, plot);
  for (const decor of DECOR) drawTile(ctx, images, decor.tile, decor.x, decor.y);

  // Läden zuletzt: Dächer und Schilder dürfen über den Boden hinausragen.
  for (const shop of SHOPS) drawShop(ctx, atlas, shop);

  return { canvas, images, atlas };
}

/** Nur für die Anzeige der Parzellen-Beete gebraucht. */
export { isPlotSoil, PATHS, VILLAGE };
