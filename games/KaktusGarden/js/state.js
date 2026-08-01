import { GUARANTEED_SEED, PLANTS, PLANT_ORDER, PRODUCTS, RESTOCK_MS, TOOLS } from "./data/plants.js";

export const SAVE_VERSION = 2;
export const GRID_SIZE = 16;

const FIELD_STATES = new Set(["empty", "growing", "ready"]);

function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function countMap(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([id]) => allowed.has(id))
    .map(([id, count]) => [id, Math.max(0, Math.floor(number(count)))]));
}

export function emptyField(fieldId) {
  return {
    fieldId,
    state: "empty",
    plantId: null,
    plantedAt: null,
    readyAt: null,
    lastHarvestAt: null,
    nextHarvestAt: null,
  };
}

function normalizeField(raw, fieldId) {
  if (!raw || !FIELD_STATES.has(raw.state) || (raw.plantId && !PLANTS[raw.plantId])) {
    return emptyField(fieldId);
  }
  if (raw.state !== "empty" && !PLANTS[raw.plantId]) return emptyField(fieldId);
  return {
    fieldId,
    state: raw.state,
    plantId: raw.state === "empty" ? null : raw.plantId,
    plantedAt: raw.state === "empty" ? null : Math.max(0, number(raw.plantedAt, Date.now())),
    readyAt: raw.state === "empty" ? null : Math.max(0, number(raw.readyAt, Date.now())),
    lastHarvestAt: raw.lastHarvestAt == null ? null : Math.max(0, number(raw.lastHarvestAt)),
    nextHarvestAt: raw.nextHarvestAt == null ? null : Math.max(0, number(raw.nextHarvestAt)),
  };
}

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

/**
 * Würfelt das Angebot für die nächsten fünf Minuten aus. Jede Pflanze hat ihre
 * eigene Erscheinungschance (siehe RESTOCK_RULES in data/plants.js) — bei einem
 * Restock fehlen deshalb absichtlich viele Einträge, und epische oder legendäre
 * Samen sind echte Glücksfunde. Nur GUARANTEED_SEED liegt immer aus, sonst
 * könnten Spieler ohne Samen und ohne Münzen nicht weiterspielen.
 */
export function createRestock(now = Date.now(), identity = "local") {
  const nextRestockAt = now + RESTOCK_MS;
  const random = randomFactory(hashSeed(`${identity}:${Math.floor(now / 1000)}`));
  const stock = {};
  for (const plantId of PLANT_ORDER) {
    const plant = PLANTS[plantId];
    const available = plantId === GUARANTEED_SEED || random() < plant.restockChance;
    stock[plantId] = available
      ? plant.restockMin + Math.floor(random() * (plant.restockMax - plant.restockMin + 1))
      : 0;
  }
  return { stock, nextRestockAt, generatedAt: now };
}

export function createInitialState(playerId = "local-player", now = Date.now()) {
  return {
    version: SAVE_VERSION,
    playerId,
    coins: 100,
    gems: 0,
    level: 1,
    xp: 0,
    inventories: {
      seeds: { carrot: 3 },
      harvests: {},
      tools: {},
    },
    fields: Array.from({ length: GRID_SIZE }, (_, fieldId) => emptyField(fieldId)),
    shop: createRestock(now, playerId),
    stats: { totalHarvested: 0, totalSold: 0, totalCoinsEarned: 0 },
    settings: { reducedMotion: false },
    lastSavedAt: now,
  };
}

export function normalizeState(raw, playerId = "local-player") {
  const initial = createInitialState(playerId);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return initial;
  const fields = Array.from({ length: GRID_SIZE }, (_, fieldId) => normalizeField(raw.fields?.[fieldId], fieldId));
  const shopStock = countMap(raw.shop?.stock, new Set(PLANT_ORDER));
  const hasCompleteStock = PLANT_ORDER.every((plantId) => Object.hasOwn(raw.shop?.stock || {}, plantId));
  const normalizedShop = hasCompleteStock ? {
    stock: Object.fromEntries(PLANT_ORDER.map((id) => [id, shopStock[id] || 0])),
    nextRestockAt: Math.max(0, number(raw.shop?.nextRestockAt, Date.now())),
    generatedAt: Math.max(0, number(raw.shop?.generatedAt, Date.now())),
  } : createRestock(Date.now(), playerId);
  const state = {
    ...initial,
    version: SAVE_VERSION,
    playerId: String(raw.playerId || playerId),
    coins: Math.max(0, Math.floor(number(raw.coins, 100))),
    gems: Math.max(0, Math.floor(number(raw.gems))),
    level: Math.max(1, Math.floor(number(raw.level, 1))),
    xp: Math.max(0, Math.floor(number(raw.xp))),
    inventories: {
      seeds: countMap(raw.inventories?.seeds, new Set(PLANT_ORDER)),
      harvests: countMap(raw.inventories?.harvests, new Set(Object.keys(PRODUCTS))),
      tools: countMap(raw.inventories?.tools, new Set(Object.keys(TOOLS))),
    },
    fields,
    shop: normalizedShop,
    stats: {
      totalHarvested: Math.max(0, Math.floor(number(raw.stats?.totalHarvested))),
      totalSold: Math.max(0, Math.floor(number(raw.stats?.totalSold))),
      totalCoinsEarned: Math.max(0, Math.floor(number(raw.stats?.totalCoinsEarned))),
    },
    settings: { reducedMotion: Boolean(raw.settings?.reducedMotion) },
    lastSavedAt: Math.max(0, number(raw.lastSavedAt, Date.now())),
  };
  return advanceState(state).state;
}

export function advanceState(state, now = Date.now()) {
  let changed = false;
  for (const field of state.fields) {
    if (field.state === "growing" && now >= field.readyAt) {
      field.state = "ready";
      changed = true;
    }
  }
  if (now >= state.shop.nextRestockAt) {
    state.shop = createRestock(now, state.playerId);
    changed = true;
  }
  return { state, changed };
}

export function addExperience(state, amount) {
  state.xp += Math.max(0, Math.floor(amount));
  while (state.xp >= state.level * state.level * 20) state.level += 1;
}

export function farmSnapshot(state, playerId = state.playerId) {
  return {
    playerId,
    gridSize: { columns: 4, rows: 4 },
    fields: state.fields.map((field) => ({ ...field })),
    capturedAt: Date.now(),
  };
}
