import {
  AUTOTILES,
  BEDS,
  BUILDINGS,
  FENCE_GATE,
  FENCE_RECT,
  GRASS_COLOR,
  GROUND_DECOR,
  MAP_COLS,
  MAP_HEIGHT,
  MAP_ROWS,
  MAP_WIDTH,
  PROP_DECOR,
  SHEETS,
  TILE,
  TILES,
  isBed,
  isSoil,
} from "../data/farmMap.js";

const imageCache = new Map();

function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Tile-Sheet fehlt: ${src}`));
      image.src = src;
    }));
  }
  return imageCache.get(src);
}

export async function loadWorldAssets() {
  const entries = [...Object.entries(SHEETS), ...Object.entries(AUTOTILES)];
  const images = await Promise.all(entries.map(([, src]) => loadImage(src)));
  return Object.fromEntries(entries.map(([key], index) => [key, images[index]]));
}

/**
 * Zeichnet ein Quellrechteck an eine Map-Pixel-Position. Ziel-Kanten werden
 * gerundet und aus den gerundeten Rändern berechnet — so stoßen benachbarte
 * Tiles auch bei krummer Skalierung lückenlos aneinander.
 */
function blit(ctx, image, sx, sy, sw, sh, x, y, w, h, scale) {
  const dx = Math.round(x * scale);
  const dy = Math.round(y * scale);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, Math.round((x + w) * scale) - dx, Math.round((y + h) * scale) - dy);
}

function drawTile(ctx, images, tileId, tileX, tileY, scale) {
  const tile = TILES[tileId];
  if (!tile) return;
  const image = images[tile.sheet];
  if (!image) return;
  blit(
    ctx, image,
    tile.sx * TILE, tile.sy * TILE, tile.w * TILE, tile.h * TILE,
    tileX * TILE, tileY * TILE, tile.w * TILE, tile.h * TILE,
    scale,
  );
}

/**
 * Setzt eine Autotile-Zelle aus vier 8×8-Vierteln zusammen. Welche Zeile des
 * Strips ein Viertel liefert, hängt nur davon ab, ob der waagerechte, der
 * senkrechte und der diagonale Nachbar zum selben Terrain gehören.
 */
function drawAutotileCell(ctx, strip, inside, cx, cy, scale) {
  const half = TILE / 2;
  for (let qy = 0; qy < 2; qy += 1) {
    for (let qx = 0; qx < 2; qx += 1) {
      const nx = cx + (qx === 0 ? -1 : 1);
      const ny = cy + (qy === 0 ? -1 : 1);
      const horizontal = inside(nx, cy);
      const vertical = inside(cx, ny);
      let row;
      if (!horizontal && !vertical) row = 0;
      else if (!horizontal && vertical) row = 1;
      else if (horizontal && !vertical) row = 2;
      else row = inside(nx, ny) ? 4 : 3;
      blit(
        ctx, strip,
        qx * half, row * TILE + qy * half, half, half,
        cx * TILE + qx * half, cy * TILE + qy * half, half, half,
        scale,
      );
    }
  }
}

function drawFence(ctx, images, scale) {
  const { x, y, w, h } = FENCE_RECT;
  const right = x + w - 1;
  const bottom = y + h - 1;
  const gateStart = FENCE_GATE.x;
  const gateEnd = FENCE_GATE.x + FENCE_GATE.w - 1;
  for (let column = x + 1; column < right; column += 1) {
    const post = (column - x) % 4 === 0 ? "fenceTopPost" : "fenceTop";
    drawTile(ctx, images, post, column, bottom, scale);
    // Die obere Reihe hat eine Toröffnung; links und rechts davon endet der
    // Zaunlauf mit einem Pfosten statt mit einer abgeschnittenen Latte.
    if (column >= gateStart && column <= gateEnd) continue;
    if (column === gateStart - 1) drawTile(ctx, images, "fenceRunEnd", column, y, scale);
    else if (column === gateEnd + 1) drawTile(ctx, images, "fenceRunStart", column, y, scale);
    else drawTile(ctx, images, post, column, y, scale);
  }
  for (let row = y + 1; row < bottom; row += 1) {
    drawTile(ctx, images, "fenceLeft", x, row, scale);
    drawTile(ctx, images, "fenceRight", right, row, scale);
  }
  drawTile(ctx, images, "fenceTopLeft", x, y, scale);
  drawTile(ctx, images, "fenceTopRight", right, y, scale);
  drawTile(ctx, images, "fenceBottomLeft", x, bottom, scale);
  drawTile(ctx, images, "fenceBottomRight", right, bottom, scale);
}

/**
 * Zeichnet die komplette statische Welt. Wird nur bei Größenänderung neu
 * aufgerufen — Pflanzen, Timer und Auswahl liegen als DOM-Ebene darüber.
 */
export function drawWorld(canvas, images, scale) {
  canvas.width = MAP_WIDTH * scale;
  canvas.height = MAP_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let column = 0; column < MAP_COLS; column += 1) {
      if (isSoil(column, row)) drawAutotileCell(ctx, images.soil, isSoil, column, row, scale);
    }
  }

  for (const bed of BEDS) {
    for (let dy = 0; dy < bed.h; dy += 1) {
      for (let dx = 0; dx < bed.w; dx += 1) {
        drawAutotileCell(ctx, images.bed, isBed, bed.x + dx, bed.y + dy, scale);
      }
    }
  }

  for (const decor of GROUND_DECOR) drawTile(ctx, images, decor.tile, decor.x, decor.y, scale);
  for (const decor of PROP_DECOR) drawTile(ctx, images, decor.tile, decor.x, decor.y, scale);
  for (const building of BUILDINGS) {
    for (const sprite of building.sprites) drawTile(ctx, images, sprite.tile, sprite.x, sprite.y, scale);
  }

  drawFence(ctx, images, scale);
}

/**
 * Ganzzahlige Zeichenauflösung: mindestens die Gerätepixel der Anzeigegröße,
 * damit nichts weichgezeichnet wird, aber gedeckelt, damit die Bitmap nicht
 * unnötig groß wird.
 */
export function pickRenderScale(px) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const target = px * dpr;
  // Muss die Karte verkleinert werden (schmale Geräte), wird sie doppelt so
  // groß gezeichnet — sonst fielen beim Herunterrechnen ganze Pixelreihen weg.
  return Math.max(1, Math.min(4, Math.ceil(target < 1 ? target * 2 : target)));
}
