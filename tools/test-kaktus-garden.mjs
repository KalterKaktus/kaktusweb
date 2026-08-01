import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PLANTS, PLANT_ORDER, growthSprite, plantIcon } from "../games/KaktusGarden/js/data/plants.js";
import { SAVE_VERSION, createInitialState, normalizeState } from "../games/KaktusGarden/js/state.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gameRoot = resolve(root, "games", "KaktusGarden");
const dictionaries = ["de", "ru"].map((language) => JSON.parse(readFileSync(resolve(root, "js", "i18n", `${language}.json`), "utf8")));

assert.equal(SAVE_VERSION, 2);
assert.equal(PLANT_ORDER.length, 19);
assert.equal(Object.hasOwn(PLANTS, "apple_tree"), false);
assert.equal(Object.hasOwn(PLANTS, "orange_tree"), false);

for (const plantId of PLANT_ORDER) {
  const icon = plantIcon(plantId);
  assert.ok(icon && existsSync(resolve(gameRoot, icon.src)), `missing icon: ${plantId}`);

  const growing = growthSprite(plantId, { state: "growing", plantedAt: 0, readyAt: 1000 }, 500);
  const ready = growthSprite(plantId, { state: "ready", plantedAt: 0, readyAt: 1000 }, 1000);
  assert.ok(growing && existsSync(resolve(gameRoot, growing.src)), `missing growth sheet: ${plantId}`);
  assert.ok(growing.frame < ready.frame, `growth frame must precede ready frame: ${plantId}`);
  assert.ok(ready.frame < ready.frames, `ready frame out of bounds: ${plantId}`);
  for (const dictionary of dictionaries) {
    assert.ok(dictionary.garden?.plants?.[plantId]?.name, `missing plant translation: ${plantId}`);
    assert.ok(dictionary.garden?.products?.[plantId], `missing product translation: ${plantId}`);
  }
}

const initial = createInitialState("test-player", 1000);
assert.equal(initial.fields.length, 16);
assert.equal(Object.keys(initial.shop.stock).length, PLANT_ORDER.length);

const migrated = normalizeState({
  version: 1,
  fields: [{ fieldId: 0, state: "permanent_ready", plantId: "apple_tree", plantedAt: 1, readyAt: 1 }],
  shop: { stock: { carrot: 1 }, nextRestockAt: 999999 },
}, "test-player");
assert.equal(migrated.fields[0].state, "empty");
assert.equal(Object.keys(migrated.shop.stock).length, PLANT_ORDER.length);

console.log(`KaktusGarden checks passed: ${PLANT_ORDER.length} crops, assets, migration and restock.`);
