import { achievements, buildings, upgrades } from "./data.js";

export const SAVE_VERSION = 2;

export function createInitialState(seasonId, now = Date.now()) {
  return {
    version: SAVE_VERSION,
    season: { id: seasonId },
    cactus: 0,
    totalEarned: 0,
    totalClicks: 0,
    buildings: Object.fromEntries(buildings.map((building) => [building.id, 0])),
    upgrades: [],
    achievements: [],
    prestige: {
      nopal: 0,
      totalNopalEarned: 0,
      prestiges: 0,
    },
    events: createInitialEvents(now),
    lastOnlineTimestamp: now,
    lastSavedAt: now,
  };
}

function createInitialEvents(now) {
  return {
    clickCharge: 0,
    frenzyUntil: 0,
    frenzies: 0,
    goldenHits: 0,
    redHits: 0,
    nextGoldenAt: 0,
    nextRedAt: 0,
  };
}

export function normalizeLoadedState(loaded, seasonId, now = Date.now()) {
  const initial = createInitialState(seasonId, now);
  if (!loaded || typeof loaded !== "object") {
    return initial;
  }

  if (loaded.season?.id && loaded.season.id !== seasonId) {
    return initial;
  }

  const parsed = {
    ...initial,
    ...loaded,
    version: SAVE_VERSION,
    season: { id: seasonId },
    buildings: { ...initial.buildings, ...(loaded.buildings || {}) },
    upgrades: Array.isArray(loaded.upgrades) ? loaded.upgrades : [],
    achievements: Array.isArray(loaded.achievements) ? loaded.achievements : [],
    prestige: { ...initial.prestige, ...(loaded.prestige || {}) },
    events: { ...initial.events, ...(loaded.events || {}) },
  };

  parsed.cactus = Math.max(0, Number(parsed.cactus) || 0);
  parsed.totalEarned = Math.max(0, Number(parsed.totalEarned) || 0);
  parsed.totalClicks = Math.max(0, Math.floor(Number(parsed.totalClicks) || 0));
  parsed.lastSavedAt = Number(parsed.lastSavedAt) || now;
  parsed.lastOnlineTimestamp = Number(parsed.lastOnlineTimestamp) || parsed.lastSavedAt || now;
  parsed.prestige.nopal = Math.max(0, Number(parsed.prestige.nopal) || 0);
  parsed.prestige.totalNopalEarned = Math.max(0, Number(parsed.prestige.totalNopalEarned) || 0);
  parsed.prestige.prestiges = Math.max(0, Math.floor(Number(parsed.prestige.prestiges) || 0));
  parsed.events.clickCharge = clamp(Number(parsed.events.clickCharge) || 0, 0, 1000);
  parsed.events.frenzyUntil = Math.max(0, Number(parsed.events.frenzyUntil) || 0);
  parsed.events.frenzies = Math.max(0, Math.floor(Number(parsed.events.frenzies) || 0));
  parsed.events.goldenHits = Math.max(0, Math.floor(Number(parsed.events.goldenHits) || 0));
  parsed.events.redHits = Math.max(0, Math.floor(Number(parsed.events.redHits) || 0));
  parsed.events.nextGoldenAt = Math.max(0, Number(parsed.events.nextGoldenAt) || 0);
  parsed.events.nextRedAt = Math.max(0, Number(parsed.events.nextRedAt) || 0);

  for (const building of buildings) {
    parsed.buildings[building.id] = Math.max(0, Math.floor(Number(parsed.buildings[building.id]) || 0));
  }

  parsed.upgrades = parsed.upgrades.filter((id, index, list) => {
    return upgrades.some((upgrade) => upgrade.id === id) && list.indexOf(id) === index;
  });
  parsed.achievements = parsed.achievements.filter((id, index, list) => {
    return achievements.some((achievement) => achievement.id === id) && list.indexOf(id) === index;
  });

  return parsed;
}

export function resetRunForPrestige(state, now = Date.now()) {
  state.cactus = 0;
  state.upgrades = [];
  state.buildings = Object.fromEntries(buildings.map((building) => [building.id, 0]));
  state.events.clickCharge = 0;
  state.events.frenzyUntil = 0;
  state.events.nextGoldenAt = 0;
  state.events.nextRedAt = 0;
  state.lastOnlineTimestamp = now;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
