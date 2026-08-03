import { CROPS, CROP_ORDER } from "./data/crops.js";
import { PLOT_CELLS } from "./data/world.js";

/** Save-Version 4 — Inventar mit Gewichten und Ladenbestand. */
export const SAVE_VERSION = 4;

/** So viele Fächer zeigt die Leiste unten. Der Rest wandert in die Tasche. */
export const HOTBAR_SLOTS = 9;

/** Der Laden füllt alle fünf Minuten auf, ausgerichtet an der vollen Stunde. */
export const RESTOCK_MS = 5 * 60 * 1000;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* ------------------------------------------------------------ Ladenbestand */

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFactory(seed) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function restockSlot(now = Date.now()) {
  return Math.floor(now / RESTOCK_MS);
}

/**
 * Der Bestand hängt allein am Zeitfenster, nicht am Spieler — dadurch sehen
 * alle im Dorf dasselbe Angebot, so wie im Vorbild.
 */
export function createStock(slot = restockSlot()) {
  const random = randomFactory(hashSeed(`seedshop:${slot}`));
  const stock = {};
  for (const id of CROP_ORDER) {
    const crop = CROPS[id];
    const available = random() < crop.stockChance;
    stock[id] = available
      ? crop.stockMin + Math.floor(random() * (crop.stockMax - crop.stockMin + 1))
      : 0;
  }
  return { slot, stock };
}

export function nextRestockAt(slot) {
  return (slot + 1) * RESTOCK_MS;
}

/* ---------------------------------------------------------------- Zustand */

export function createInitialState() {
  return {
    version: SAVE_VERSION,
    coins: 50,
    seeds: { carrot: 5 },
    // Geerntete Früchte einzeln, weil jede ihr eigenes Gewicht hat.
    harvest: [],
    cells: Array.from({ length: PLOT_CELLS }, () => null),
    shop: createStock(),
    selectedSlot: 0,
    lastSavedAt: Date.now(),
  };
}

function normalizeCell(raw) {
  if (!raw || !CROPS[raw.cropId]) return null;
  return {
    cropId: raw.cropId,
    plantedAt: Math.max(0, number(raw.plantedAt, Date.now())),
    readyAt: Math.max(0, number(raw.readyAt, Date.now())),
    harvested: Math.max(0, Math.floor(number(raw.harvested))),
  };
}

export function normalizeState(raw) {
  const initial = createInitialState();
  if (!raw || typeof raw !== "object" || number(raw.version) !== SAVE_VERSION) return initial;
  const known = new Set(CROP_ORDER);
  return {
    version: SAVE_VERSION,
    coins: Math.max(0, Math.floor(number(raw.coins))),
    seeds: Object.fromEntries(Object.entries(raw.seeds || {})
      .filter(([id, count]) => known.has(id) && number(count) > 0)
      .map(([id, count]) => [id, Math.max(0, Math.floor(number(count)))])),
    harvest: Array.isArray(raw.harvest)
      ? raw.harvest
        .filter((item) => known.has(item?.cropId) && number(item?.weight) > 0)
        .map((item) => ({ cropId: item.cropId, weight: number(item.weight) }))
        .slice(0, 500)
      : [],
    cells: Array.from({ length: PLOT_CELLS }, (_, index) => normalizeCell(raw.cells?.[index])),
    shop: createStock(),
    selectedSlot: Math.max(0, Math.min(HOTBAR_SLOTS - 1, Math.floor(number(raw.selectedSlot)))),
    lastSavedAt: Math.max(0, number(raw.lastSavedAt, Date.now())),
  };
}

/* --------------------------------------------------------------- Inventar */

/**
 * Die Leiste zeigt erst Samen, dann Ernte — beides nach Pflanze gruppiert und
 * in fester Reihenfolge, damit ein Fach nicht bei jedem Kauf springt.
 */
export function inventoryStacks(state) {
  const stacks = [];
  for (const id of CROP_ORDER) {
    if (state.seeds[id] > 0) stacks.push({ kind: "seed", id, count: state.seeds[id] });
  }
  for (const id of CROP_ORDER) {
    const items = state.harvest.filter((item) => item.cropId === id);
    if (items.length) stacks.push({ kind: "crop", id, count: items.length, items });
  }
  return stacks;
}

export function selectedStack(state) {
  return inventoryStacks(state)[state.selectedSlot] || null;
}

export function takeSeed(state, cropId) {
  if (!state.seeds[cropId]) return false;
  state.seeds[cropId] -= 1;
  if (state.seeds[cropId] <= 0) delete state.seeds[cropId];
  return true;
}

export function addSeed(state, cropId, amount = 1) {
  state.seeds[cropId] = (state.seeds[cropId] || 0) + amount;
}
