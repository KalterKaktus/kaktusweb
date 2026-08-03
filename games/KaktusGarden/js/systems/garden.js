import { CROPS, cropValue, rollWeight } from "../data/crops.js";
import { addSeed, canAddInventoryStack, takeSeed } from "../state.js";

/**
 * Pflanzen, Wachsen, Ernten, Kaufen, Verkaufen — die Spielregeln.
 */

export function cellState(cell, now = Date.now()) {
  if (!cell) return "empty";
  return now >= cell.readyAt ? "ready" : "growing";
}

export function growthProgress(cell, now = Date.now()) {
  if (!cell) return 0;
  const duration = Math.max(1, cell.readyAt - cell.plantedAt);
  return Math.max(0, Math.min(1, (now - cell.plantedAt) / duration));
}

export function plantSeed(state, cellIndex, cropId, now = Date.now()) {
  const crop = CROPS[cropId];
  if (!crop || state.cells[cellIndex]) return false;
  if (!takeSeed(state, cropId)) return false;
  state.cells[cellIndex] = {
    cropId,
    plantedAt: now,
    readyAt: now + crop.growSeconds * 1000,
    harvested: 0,
  };
  return true;
}

/**
 * Ernten. Einmal-Ernte-Pflanzen verschwinden danach; nachwachsende bleiben
 * stehen und tragen nach ihrer Nachwachszeit erneut.
 *
 * Eine Ernte liefert **alle Slots auf einmal** — unsere Sprites können keine
 * einzeln abpflückbaren Früchte darstellen. Jede Frucht bekommt trotzdem ihr
 * eigenes gewürfeltes Gewicht.
 */
export function harvestCell(state, cellIndex, now = Date.now()) {
  const cell = state.cells[cellIndex];
  if (!cell || cellState(cell, now) !== "ready") return null;
  const crop = CROPS[cell.cropId];
  if (!canAddInventoryStack(state, "crop", cell.cropId)) {
    return { ok: false, reason: "inventoryFull" };
  }

  const picked = [];
  for (let index = 0; index < crop.slots; index += 1) {
    const weight = rollWeight(cell.cropId);
    picked.push({ cropId: cell.cropId, weight });
    state.harvest.push({ cropId: cell.cropId, weight });
  }

  if (crop.harvest === "multi") {
    cell.harvested += 1;
    cell.plantedAt = now;
    cell.readyAt = now + crop.regrowSeconds * 1000;
  } else {
    state.cells[cellIndex] = null;
  }

  return {
    ok: true,
    cropId: cell.cropId,
    items: picked,
    value: picked.reduce((sum, item) => sum + cropValue(item.cropId, item.weight), 0),
  };
}

/* ------------------------------------------------------------------ Laden */

export function buySeed(state, cropId) {
  const crop = CROPS[cropId];
  if (!crop) return false;
  if ((state.shop.stock[cropId] || 0) < 1) return false;
  if (state.coins < crop.seedPrice) return false;
  if (!canAddInventoryStack(state, "seed", cropId)) {
    return { ok: false, reason: "inventoryFull" };
  }
  state.coins -= crop.seedPrice;
  state.shop.stock[cropId] -= 1;
  // Durch die Vorprüfung kann addSeed hier nicht mehr an der Kapazität
  // scheitern; Geld und Bestand werden daher atomar zusammen verändert.
  addSeed(state, cropId);
  return true;
}

/** Verkauft alle Früchte einer Sorte, oder ohne Angabe die ganze Ernte. */
export function sellHarvest(state, cropId = null) {
  const keep = [];
  let value = 0;
  let count = 0;
  for (const item of state.harvest) {
    if (cropId && item.cropId !== cropId) {
      keep.push(item);
      continue;
    }
    value += cropValue(item.cropId, item.weight);
    count += 1;
  }
  if (!count) return null;
  state.harvest = keep;
  state.coins += value;
  return { count, value };
}

export function harvestValue(state, cropId = null) {
  return state.harvest
    .filter((item) => !cropId || item.cropId === cropId)
    .reduce((sum, item) => sum + cropValue(item.cropId, item.weight), 0);
}
