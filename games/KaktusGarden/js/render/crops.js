import { loadImage } from "../engine/assets.js";
import { CROPS, CROP_ORDER, PLANT_RENDER, growthFrame, growthSheet, readySheet } from "../data/crops.js";
import { PLOT_COLS, TILE } from "../data/world.js";
import { cellState, growthProgress } from "../systems/garden.js";

const sheets = new Map();

/** Alle Wachstums-Sheets vorladen — kleine Streifen, das lohnt vorab. */
export async function loadCropSheets() {
  const sources = new Set();
  for (const id of CROP_ORDER) {
    sources.add(growthSheet(id));
    const ready = readySheet(id);
    if (ready) sources.add(ready);
  }
  await Promise.all([...sources].map(async (src) => {
    sheets.set(src, await loadImage(src));
  }));
}

/**
 * Zeichnet die Pflanzen einer Parzelle in doppelter nativer Auflösung —
 * pixelscharf, unverzerrt, und hohe Pflanzen ragen von selbst über ihr Feld.
 */
export function drawCrops(ctx, cells, plot, camera, now = Date.now()) {
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (!cell) continue;
    const crop = CROPS[cell.cropId];
    if (!crop) continue;

    const ready = cellState(cell, now) === "ready";
    const frame = growthFrame(cell.cropId, growthProgress(cell, now), ready, now);
    const image = sheets.get(frame.src);
    if (!image) continue;

    const { frameWidth, frameHeight } = crop.sprite;
    const { scale, baseline } = PLANT_RENDER;
    const width = frameWidth * scale;
    const height = frameHeight * scale;
    const tileX = plot.soil.x + (index % PLOT_COLS);
    const tileY = plot.soil.y + Math.floor(index / PLOT_COLS);
    const centerX = tileX * TILE + TILE / 2;
    const bottomY = (tileY + 1) * TILE - baseline;

    ctx.drawImage(
      image,
      frame.frame * frameWidth, 0, frameWidth, frameHeight,
      Math.round(centerX - width / 2 - camera.x),
      Math.round(bottomY - height - camera.y),
      width, height,
    );
  }
}
