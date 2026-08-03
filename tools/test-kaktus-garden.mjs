import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CROPS, CROP_ORDER, cropIcon, growthFrame, growthSheet,
} from "../games/KaktusGarden/js/data/crops.js";
import { PLOT_CELLS, PLOTS, plotAt } from "../games/KaktusGarden/js/data/world.js";
import {
  HOTBAR_SLOTS, SAVE_VERSION, bumpRevision, canAddInventoryStack,
  createInitialState, createStock, inventoryCapacity, normalizeState,
  restockSlot,
} from "../games/KaktusGarden/js/state.js";
import { buySeed, harvestCell } from "../games/KaktusGarden/js/systems/garden.js";
import { contextAt } from "../games/KaktusGarden/js/systems/context.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = resolve(root, "games", "KaktusGarden");
const dictionaries = ["de", "ru"].map((language) => JSON.parse(
  readFileSync(resolve(root, "js", "i18n", `${language}.json`), "utf8"),
));

function moduleDataUrl(file, replacements) {
  let source = readFileSync(file, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const supabaseStubUrl = `data:text/javascript,${encodeURIComponent(`
  export function getSupabase() { return null; }
  export function isConfigReady() { return false; }
`)}`;
const cloudModule = await import(moduleDataUrl(resolve(gameRoot, "js", "cloud.js"), [
  ['"/js/supabase-client.js"', JSON.stringify(supabaseStubUrl)],
  ['"./data/crops.js"', JSON.stringify(pathToFileURL(resolve(gameRoot, "js", "data", "crops.js")).href)],
  ['"./data/world.js"', JSON.stringify(pathToFileURL(resolve(gameRoot, "js", "data", "world.js")).href)],
  ['"./state.js"', JSON.stringify(pathToFileURL(resolve(gameRoot, "js", "state.js")).href)],
]));
const multiplayerModule = await import(moduleDataUrl(resolve(gameRoot, "js", "multiplayer.js"), [
  ['"/js/supabase-client.js"', JSON.stringify(supabaseStubUrl)],
  ['"./data/world.js"', JSON.stringify(pathToFileURL(resolve(gameRoot, "js", "data", "world.js")).href)],
]));

assert.equal(SAVE_VERSION, 4);
assert.equal(HOTBAR_SLOTS, 9);
assert.equal(PLOT_CELLS, 64);
assert.equal(PLOTS.length, 6);
assert.equal(CROP_ORDER.length, 19);

for (const cropId of CROP_ORDER) {
  const icon = cropIcon(cropId);
  const growth = growthSheet(cropId);
  assert.ok(icon && existsSync(resolve(gameRoot, icon.src)), `missing icon: ${cropId}`);
  assert.ok(growth && existsSync(resolve(gameRoot, growth)), `missing growth sheet: ${cropId}`);
  const frame = growthFrame(cropId, 0.5, false, 0);
  assert.ok(frame.frame >= 0 && frame.frame < frame.frames, `growth frame out of bounds: ${cropId}`);
  for (const dictionary of dictionaries) {
    assert.ok(dictionary.garden?.plants?.[cropId]?.name, `missing crop translation: ${cropId}`);
  }
}

for (const [index, plot] of PLOTS.entries()) {
  assert.equal(plot.index, index);
  assert.equal(plotAt(plot.soil.x, plot.soil.y)?.index, index);
}
const firstPlotTile = PLOTS[0].soil;
assert.equal(contextAt(firstPlotTile.x, firstPlotTile.y).kind, "foreignPlot", "no server slot must own no plot");
assert.equal(contextAt(firstPlotTile.x, firstPlotTile.y, { ownPlotIndex: 0 }).kind, "plot");
assert.equal(contextAt(firstPlotTile.x, firstPlotTile.y, { ownPlotIndex: 1 }).kind, "foreignPlot");

const slotTime = 1_800_000;
const slot = restockSlot(slotTime);
assert.deepEqual(createStock(slot), createStock(slot), "same global restock slot must be deterministic");

const boughtState = createInitialState(slotTime);
boughtState.shop.stock.carrot = 3;
boughtState.coins = CROPS.carrot.seedPrice * 2;
assert.equal(buySeed(boughtState, "carrot"), true);
assert.equal(boughtState.shop.stock.carrot, 2);
const reloaded = normalizeState(JSON.parse(JSON.stringify(boughtState)), slotTime + 1_000);
assert.equal(reloaded.shop.stock.carrot, 2, "reload must preserve personal remaining stock");

const nextSlotState = normalizeState(boughtState, slotTime + 300_001);
assert.equal(nextSlotState.shop.slot, slot + 1, "new global slot must restock");
assert.deepEqual(nextSlotState.shop, createStock(slot + 1));

const largeHarvest = createInitialState(slotTime);
largeHarvest.harvest = Array.from({ length: 725 }, () => ({ cropId: "carrot", weight: 0.2 }));
assert.equal(normalizeState(largeHarvest, slotTime).harvest.length, 725, "harvest must not be truncated");

const full = createInitialState(slotTime);
full.seeds = Object.fromEntries(CROP_ORDER.slice(0, HOTBAR_SLOTS).map((id) => [id, 1]));
assert.deepEqual(inventoryCapacity(full), { used: 9, total: 9, full: true });
assert.equal(canAddInventoryStack(full, "seed", CROP_ORDER[0]), true, "existing stack may grow");
assert.equal(canAddInventoryStack(full, "seed", CROP_ORDER[10]), false, "new tenth stack must be blocked");
full.shop.stock[CROP_ORDER[10]] = 1;
full.coins = 1_000_000;
const coinsBefore = full.coins;
const buyBlocked = buySeed(full, CROP_ORDER[10]);
assert.equal(buyBlocked.reason, "inventoryFull");
assert.equal(full.coins, coinsBefore, "blocked purchase must not spend coins");
assert.equal(full.shop.stock[CROP_ORDER[10]], 1, "blocked purchase must not consume personal stock");

const harvestBlocked = createInitialState(slotTime);
harvestBlocked.seeds = Object.fromEntries(CROP_ORDER.slice(0, HOTBAR_SLOTS).map((id) => [id, 1]));
harvestBlocked.cells[0] = {
  cropId: CROP_ORDER[10], plantedAt: slotTime - 10_000, readyAt: slotTime - 1, harvested: 0,
};
const blockedCell = JSON.stringify(harvestBlocked.cells[0]);
const harvestResult = harvestCell(harvestBlocked, 0, slotTime);
assert.equal(harvestResult.reason, "inventoryFull");
assert.equal(JSON.stringify(harvestBlocked.cells[0]), blockedCell, "blocked harvest must leave crop untouched");
assert.equal(harvestBlocked.harvest.length, 0);

assert.equal(bumpRevision(harvestBlocked), 1);
assert.equal(normalizeState(harvestBlocked, slotTime).revision, 1);

const validPayload = createInitialState(slotTime);
assert.equal(cloudModule.validateGardenPayload(validPayload).ok, true);
assert.equal(cloudModule.validateGardenPayload({ ...validPayload, coins: "50" }).ok, false);
assert.equal(cloudModule.validateGardenPayload({
  ...validPayload,
  seeds: Object.fromEntries(CROP_ORDER.slice(0, 9).map((id) => [id, 1])),
  harvest: [{ cropId: CROP_ORDER[10], weight: 1 }],
}).code, "invalid_inventory");
assert.equal(cloudModule.validateGardenPayload({
  ...validPayload,
  revision: Number.MAX_SAFE_INTEGER,
}).code, "invalid_revision");

const storageData = new Map();
const storage = {
  getItem: (key) => storageData.get(key) ?? null,
  setItem: (key, value) => storageData.set(key, String(value)),
  removeItem: (key) => storageData.delete(key),
};
const user = { id: "00000000-0000-4000-8000-000000000001" };
const storeA = new cloudModule.GardenCloudStore({ client: {}, user, storage });
const storeB = new cloudModule.GardenCloudStore({ client: {}, user, storage });
const revisionTwo = { ...createInitialState(slotTime), revision: 2 };
const revisionOne = { ...createInitialState(slotTime), revision: 1 };
const entryTwo = { sequence: 2, payload: revisionTwo, totalEarned: 0, queuedAt: 2, reason: "new", attempts: 0 };
const entryOne = { sequence: 1, payload: revisionOne, totalEarned: 0, queuedAt: 1, reason: "old", attempts: 0 };
assert.equal(storeA.persistOutbox(entryTwo), true);
assert.equal(storeB.persistOutbox(entryOne), false, "older tab must not overwrite newer checkpoint");
storeA.persistOutbox(null);
assert.equal(JSON.parse(storage.getItem(storeA.outboxKey)).payload.revision, 2, "successful save keeps durable checkpoint");

const invalidCloudPayload = {
  ...createInitialState(slotTime),
  revision: 12,
  seeds: Object.fromEntries(CROP_ORDER.slice(0, HOTBAR_SLOTS).map((id) => [id, 1])),
  harvest: [{ cropId: CROP_ORDER[10], weight: 1 }],
};
const resetClient = {
  from() {
    return {
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({
        data: { payload: invalidCloudPayload, total_earned: 42, updated_at: new Date(slotTime).toISOString() },
        error: null,
      }),
      upsert: async () => ({ error: null }),
    };
  },
};
const hadWindow = Object.hasOwn(globalThis, "window");
const previousWindow = globalThis.window;
globalThis.window = globalThis;
const resetStore = new cloudModule.GardenCloudStore({
  client: resetClient,
  user: { id: "00000000-0000-4000-8000-000000000002" },
  storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});
const resetLoad = await resetStore.load();
assert.equal(resetLoad.source, "legacy-reset");
assert.equal(resetLoad.state.revision, 13, "invalid v4 reset must supersede the old revision");
await resetStore.close({ flush: false });
if (hadWindow) globalThis.window = previousWindow;
else delete globalThis.window;

const remoteMovements = [];
const multiplayer = new multiplayerModule.GardenMultiplayer({
  client: {},
  user,
  connectionId: "00000000-0000-4000-8000-000000000010",
  onMovement: (movement) => remoteMovements.push(movement),
});
const remoteId = "00000000-0000-4000-8000-000000000020";
const remoteConnection = "00000000-0000-4000-8000-000000000030";
multiplayer.rosterByUser.set(remoteId, {
  userId: remoteId, connectionId: remoteConnection, movementEpoch: "page-a", slotIndex: 1,
});
multiplayer.receiveMovement({
  userId: remoteId, connectionId: remoteConnection, movementEpoch: "page-a", slotIndex: 1,
  tileX: 22, tileY: 22, fromX: 22, fromY: 22, facing: "down", sequence: 99,
});
multiplayer.rosterByUser.set(remoteId, {
  userId: remoteId, connectionId: remoteConnection, movementEpoch: "page-b", slotIndex: 1,
});
multiplayer.receiveMovement({
  userId: remoteId, connectionId: remoteConnection, movementEpoch: "page-b", slotIndex: 1,
  tileX: 22, tileY: 22, fromX: 22, fromY: 22, facing: "down", sequence: 1,
});
assert.equal(remoteMovements.length, 2, "reload epoch must reset movement sequence safely");

multiplayer.authoritativeMembers.set(remoteId, {
  userId: remoteId, connectionId: remoteConnection, slotIndex: 1, displayName: "Servername", level: 7,
});
multiplayer.channel = { presenceState: () => ({ room: [
  { userId: remoteId, connectionId: "00000000-0000-4000-8000-000000000099", movementEpoch: "spoof", slotIndex: 5 },
  { userId: remoteId, connectionId: remoteConnection, movementEpoch: "real", slotIndex: 1, displayName: "Fake" },
] }) };
multiplayer.syncRoster();
assert.equal(multiplayer.roster.length, 1);
assert.equal(multiplayer.roster[0].displayName, "Servername", "presence identity must come from DB snapshot");
assert.equal(multiplayer.roster[0].slotIndex, 1);

if (typeof BroadcastChannel === "function") {
  const duplicateId = "00000000-0000-4000-8000-000000000040";
  const [firstClaim, secondClaim] = await Promise.all([
    multiplayerModule.claimGardenTabConnection({ connectionId: duplicateId, storage: null, lockManager: null, retryMs: 150 }),
    multiplayerModule.claimGardenTabConnection({ connectionId: duplicateId, storage: null, lockManager: null, retryMs: 150 }),
  ]);
  assert.notEqual(firstClaim.connectionId, secondClaim.connectionId, "duplicate tabs need distinct server connection IDs");
  firstClaim.release?.();
  secondClaim.release?.();
}

for (const dictionary of dictionaries) {
  for (const key of [
    "inventory_full", "server_name", "server_players", "already_connected_title",
    "room_full_title", "connection_failed_title", "copy_room_link",
  ]) {
    assert.ok(dictionary.garden?.[key], `missing garden translation: ${key}`);
  }
}

const gameHtml = readFileSync(resolve(gameRoot, "index.html"), "utf8");
assert.ok(gameHtml.includes('id="server-status"'));
assert.ok(!gameHtml.includes('id="setting-grid"'));

const migration = readFileSync(
  resolve(root, "supabase", "migrations", "20260803120000_kaktus_garden_multiplayer.sql"),
  "utf8",
);
for (const rpc of ["garden_join_room", "garden_room_heartbeat", "garden_leave_room", "garden_room_snapshot"]) {
  assert.ok(migration.includes(rpc), `missing multiplayer RPC: ${rpc}`);
}
assert.ok(migration.includes("jsonb_array_length(save.payload -> 'cells') = 64"));
assert.ok(migration.includes("garden_save_inventory_full"));
assert.ok(migration.includes("server_now timestamptz"));
assert.ok(migration.includes("extract(epoch from clock_timestamp()) / 300"));
assert.ok(!migration.includes("/ 300) - 1"), "past offline shop slots must remain saveable");
assert.ok(migration.includes("9007199254740990"));
assert.ok(migration.includes("'connectionId', member.connection_id::text"));

console.log(`KaktusGarden checks passed: ${CROP_ORDER.length} crops, 6 plots, inventory, restock, i18n and multiplayer schema.`);
