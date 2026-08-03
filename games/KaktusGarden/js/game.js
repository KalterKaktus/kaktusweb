import { onLanguageChange, ready as i18nReady, t } from "/js/i18n.js";
import { TILE, VILLAGE_SPAWN, isWalkable } from "./data/world.js";
import { createCamera, focusCamera, resizeCamera } from "./engine/camera.js";
import { createInput } from "./engine/input.js";
import { bakeVillage } from "./render/village.js";
import { createDebugGrid } from "./render/debugGrid.js";
import {
  actorDrawOrigin,
  drawActor,
  drawNameTag,
  loadActorSheets,
  readNameTagPalette,
  skinFor,
} from "./render/actors.js";
import { drawCrops, loadCropSheets } from "./render/crops.js";
import { contextAt, teleportTarget } from "./systems/context.js";
import { buySeed, cellState, harvestCell, plantSeed, sellHarvest } from "./systems/garden.js";
import { loadIdentity } from "./systems/identity.js";
import { createPlayer, playerWorldPosition, setPlayerTile, updatePlayer } from "./systems/player.js";
import {
  HOTBAR_SLOTS, createInitialState, createStock, inventoryStacks,
  nextRestockAt, normalizeState, restockSlot, selectedStack,
} from "./state.js";
import { createHotbar } from "./ui/hotbar.js";
import { renderPlaceholder, renderSeedShop, renderSellShop } from "./ui/shopPanel.js";
import { coins as formatCoins, duration, weight as formatWeight } from "./ui/format.js";
import { CROPS, cropIcon, cropValue } from "./data/crops.js";
import { PLOTS } from "./data/world.js";

const elements = {
  loader: document.getElementById("garden-loading"),
  stage: document.getElementById("garden-stage"),
  canvas: document.getElementById("game-canvas"),
  teleports: document.querySelector(".hud-teleports"),
  coins: document.getElementById("coin-count"),
  gems: document.getElementById("gem-count"),
  interactButton: document.getElementById("interact-button"),
  interactLabel: document.getElementById("interact-label"),
  contextTag: document.getElementById("context-tag"),
  contextIcon: document.getElementById("context-icon"),
  contextTitle: document.getElementById("context-title"),
  contextSub: document.getElementById("context-sub"),
  hotbar: document.getElementById("hotbar"),
  sheet: document.getElementById("garden-sheet"),
  scrim: document.getElementById("sheet-scrim"),
  sheetContent: document.getElementById("sheet-content"),
  sheetClose: document.getElementById("sheet-close"),
  pad: document.getElementById("touch-pad"),
  profileButton: document.getElementById("profile-button"),
  statsButton: document.getElementById("stats-button"),
  settingsButton: document.getElementById("settings-button"),
  settingsDialog: document.getElementById("settings-dialog"),
  gridSetting: document.getElementById("setting-grid"),
  toast: document.getElementById("toast"),
};

/** Anzeige-Einstellungen sind Geräte-Sache und bleiben lokal. */
const SETTINGS_KEY = "kaktus-garden-settings";
const SAVE_KEY = "kaktus-garden-save-v4";

/** Sichtbarer Weltausschnitt in Tiles — daraus ergibt sich der Zoom. */
const TARGET_VIEW_TILES = 21;
const MIN_ZOOM = 2;
const MAX_ZOOM = 5;

const ctx = elements.canvas.getContext("2d");
const camera = createCamera();
const input = createInput();
const player = createPlayer(VILLAGE_SPAWN.x, VILLAGE_SPAWN.y);

/** Kamera auf ganze Weltpixel gerundet — siehe draw(). */
const view = { x: 0, y: 0, w: 0, h: 0 };

let village = null;
let identity = { id: "local", name: "", level: 1, signedIn: false };
/** Bis das Multiplayer-Netz da ist, gehört jedem die erste Parzelle. */
let ownPlotIndex = 0;
let save = createInitialState();
let renderHotbar = null;
let saveTimer = null;
let currentContext = { kind: "none", enabled: false };
let zoom = 3;
let devicePixels = 1;
let lastFrame = 0;
let toastTimer = null;
let debugGrid = null;
let showGrid = false;
let resizeRetry = null;

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

/**
 * Zoom und Canvasgröße. Gezeichnet wird in Gerätepixeln, damit die Pixelkanten
 * scharf bleiben; der Zoom ist immer ganzzahlig.
 */
function resize() {
  const width = elements.stage.clientWidth;
  const height = elements.stage.clientHeight;
  if (!width || !height) {
    // In einem Hintergrund-Tab geöffnet meldet die Bühne 0. Ohne erneuten
    // Versuch bliebe die Zeichenfläche für immer auf ihrer Standardgröße —
    // beim Wechseln auf den Tab wäre das Bild dann winzig.
    window.clearTimeout(resizeRetry);
    resizeRetry = window.setTimeout(resize, 200);
    return;
  }

  devicePixels = Math.min(window.devicePixelRatio || 1, 2);
  const fitting = Math.min(width, height) / (TARGET_VIEW_TILES * TILE);
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fitting * devicePixels)));

  elements.canvas.width = Math.floor(width * devicePixels);
  elements.canvas.height = Math.floor(height * devicePixels);
  elements.canvas.style.width = `${width}px`;
  elements.canvas.style.height = `${height}px`;
  ctx.imageSmoothingEnabled = false;

  resizeCamera(camera, elements.canvas.width / zoom, elements.canvas.height / zoom);
  const spot = playerWorldPosition(player);
  focusCamera(camera, spot.x, spot.y, 1);
}

function step(delta) {
  updatePlayer(player, input.state.direction, delta, isWalkable);
  if (input.consumeInteract()) interact();

  const spot = playerWorldPosition(player);
  // Hart mitziehen statt weich nachlaufen: Kamera und Figur werden beide auf
  // ganze Pixel gerundet, und nur wenn sie exakt im Gleichschritt sind, bleibt
  // die Figur relativ zur Welt ruhig stehen.
  focusCamera(camera, spot.x, spot.y, 1);
  renderContext();
}

function frame(timestamp) {
  const delta = Math.min(64, timestamp - lastFrame || 16);
  lastFrame = timestamp;
  step(delta);
  draw();
  window.requestAnimationFrame(frame);
}

function draw() {
  if (!village) return;
  view.x = Math.round(camera.x);
  view.y = Math.round(camera.y);
  view.w = camera.w;
  view.h = camera.h;

  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);

  // Kameraausschnitt aus der vorgebackenen Welt.
  ctx.drawImage(
    village.canvas,
    view.x, view.y, view.w, view.h,
    0, 0, view.w, view.h,
  );

  drawCrops(ctx, save.cells, PLOTS[ownPlotIndex], view);
  drawActor(ctx, player, skinFor(identity.id), view);
  if (showGrid && debugGrid) debugGrid(ctx, view);

  // Namensschild in Gerätepixeln, nicht im Weltzoom — sonst wäre die Schrift
  // ein hochskalierter Klotz.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const origin = actorDrawOrigin(player);
  drawNameTag(
    ctx,
    identity.name,
    (origin.centerX - view.x) * zoom,
    (origin.y - view.y) * zoom - 2 * devicePixels,
    devicePixels,
  );
}

/* --------------------------------------------------------- Aktionskontext */

function iconStyle(cropId) {
  const icon = cropIcon(cropId);
  const position = icon.frames > 1 ? (icon.frame / (icon.frames - 1)) * 100 : 0;
  return `background-image:url('${icon.src}');background-size:${icon.frames * 100}% 100%;background-position:${position}% 0`;
}

function cropName(cropId) {
  return t(`garden.plants.${cropId}.name`);
}

/**
 * Was gerade möglich ist, hängt an drei Dingen: dem Feld unter den Füßen, dem
 * Zustand der Pflanze darauf und dem gewählten Fach in der Leiste. Aktionsknopf
 * und Infoschild lesen beide nur dieses eine Ergebnis.
 */
function resolveAction(now = Date.now()) {
  const base = contextAt(player.tileX, player.tileY, { ownPlotIndex });
  if (base.kind === "shop") return { ...base, action: "shop", label: t(base.labelKey) };
  if (base.kind === "closedShop") return { ...base, action: null, tag: { title: t("garden.shop_closed") } };
  if (base.kind !== "plot") return { ...base, action: null };

  const cell = save.cells[base.cell];
  const state = cellState(cell, now);

  if (state === "ready") {
    const crop = CROPS[cell.cropId];
    const sub = crop.harvest === "multi"
      ? t("garden.yields", { value: crop.slots })
      : t("garden.worth", { value: formatCoins(crop.sellPrice) });
    return {
      ...base, action: "harvest", label: t("garden.action_harvest"),
      tag: { cropId: cell.cropId, title: cropName(cell.cropId), sub },
    };
  }
  if (state === "growing") {
    return {
      ...base, action: null,
      tag: { cropId: cell.cropId, title: cropName(cell.cropId), sub: duration(cell.readyAt - now) },
    };
  }

  const stack = selectedStack(save);
  if (stack?.kind === "seed") {
    return {
      ...base, action: "plant", seedId: stack.id, label: t("garden.action_plant"),
      tag: { cropId: stack.id, title: cropName(stack.id), sub: t("garden.grows_in", { value: duration(CROPS[stack.id].growSeconds * 1000) }) },
    };
  }
  return { ...base, action: null };
}

function renderContext(now = Date.now()) {
  currentContext = resolveAction(now);
  const { action, tag } = currentContext;

  elements.interactButton.hidden = !action;
  if (action) {
    elements.interactLabel.textContent = currentContext.label;
    elements.interactButton.classList.toggle("is-harvest", action === "harvest");
  }

  elements.contextTag.hidden = !tag;
  if (tag) {
    elements.contextTitle.textContent = tag.title;
    elements.contextSub.textContent = tag.sub || "";
    elements.contextSub.hidden = !tag.sub;
    if (tag.cropId) elements.contextIcon.setAttribute("style", iconStyle(tag.cropId));
    elements.contextIcon.hidden = !tag.cropId;
  }
}

function interact() {
  const now = Date.now();
  const { action } = currentContext;
  if (!action) return;

  if (action === "shop") {
    openSheet(currentContext.id);
    return;
  }
  if (action === "plant") {
    if (plantSeed(save, currentContext.cell, currentContext.seedId, now)) {
      clampSelection();
      persist();
    }
    return;
  }
  if (action === "harvest") {
    const result = harvestCell(save, currentContext.cell, now);
    if (!result) return;
    const heaviest = result.items.reduce((best, item) => Math.max(best, item.weight), 0);
    showToast(t("garden.harvested", {
      amount: result.items.length,
      product: cropName(result.cropId),
      weight: formatWeight(heaviest),
    }));
    persist();
  }
}

/* -------------------------------------------------------------- Ladenmenü */

let openShop = null;

function openSheet(shopId) {
  openShop = shopId;
  renderSheet();
  elements.sheet.hidden = false;
  elements.scrim.hidden = false;
}

function closeSheet() {
  openShop = null;
  elements.sheet.hidden = true;
  elements.scrim.hidden = true;
}

function renderSheet() {
  if (!openShop) return;
  // Ausdrücklich pro Laden, nicht „alles außer Samen ist Verkaufen" — sonst
  // zeigt jeder noch nicht gebaute Laden versehentlich den Verkaufsstand.
  if (openShop === "seeds") elements.sheetContent.innerHTML = renderSeedShop(save);
  else if (openShop === "crops") elements.sheetContent.innerHTML = renderSellShop(save);
  else elements.sheetContent.innerHTML = renderPlaceholder(openShop);
}

function onSheetClick(event) {
  const buy = event.target.closest("[data-buy]");
  if (buy) {
    if (buySeed(save, buy.dataset.buy)) {
      showToast(t("garden.bought", { crop: cropName(buy.dataset.buy) }));
      persist();
      renderSheet();
    }
    return;
  }
  const sell = event.target.closest("[data-sell]");
  if (sell) {
    const result = sellHarvest(save, sell.dataset.sell);
    if (result) {
      showToast(t("garden.sold", { amount: result.count, value: formatCoins(result.value) }));
      persist();
      renderSheet();
    }
    return;
  }
  if (event.target.closest("[data-sell-all]")) {
    const result = sellHarvest(save);
    if (result) {
      showToast(t("garden.sold", { amount: result.count, value: formatCoins(result.value) }));
      persist();
      renderSheet();
    }
  }
}

/** Nach jedem Kauf oder Verbrauch darf die Auswahl nicht ins Leere zeigen. */
function clampSelection() {
  const stacks = inventoryStacks(save);
  if (stacks.length && save.selectedSlot >= stacks.length) save.selectedSlot = stacks.length - 1;
  renderHotbar?.(save);
}

function selectSlot(index) {
  if (index < 0 || index >= HOTBAR_SLOTS) return;
  save.selectedSlot = index;
  renderHotbar?.(save);
  persist();
}

function persist() {
  renderHotbar?.(save);
  elements.coins.textContent = formatCoins(save.coins);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      save.lastSavedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // Ohne Speicher läuft die Sitzung trotzdem weiter.
    }
  }, 300);
}

function loadSave() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {
    return createInitialState();
  }
}

function teleport(id) {
  const target = teleportTarget(id, { ownPlotIndex: ownPlotIndex ?? 0 });
  if (!target) return;
  setPlayerTile(player, target.x, target.y);
  const spot = playerWorldPosition(player);
  focusCamera(camera, spot.x, spot.y, 1);
  renderContext();
}

/* ------------------------------------------------------------ Einstellungen */

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function setGridVisible(visible) {
  showGrid = Boolean(visible);
  elements.gridSetting.checked = showGrid;
  elements.canvas.classList.toggle("is-editing", showGrid);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSettings(), showGrid }));
  } catch {
    // Speichern ist Komfort, kein Muss.
  }
}

/* ------------------------------------------------------ Bildschirmsteuerung */

function bindTouchControls() {
  let pointerId = null;

  const setFromPoint = (event) => {
    const rect = elements.pad.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    if (Math.hypot(dx, dy) < rect.width * 0.18) {
      input.setDirection(null);
      return;
    }
    input.setDirection(Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up"));
  };

  elements.pad.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    elements.pad.setPointerCapture(pointerId);
    setFromPoint(event);
    event.preventDefault();
  });
  elements.pad.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    setFromPoint(event);
  });
  const stop = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    input.setDirection(null);
  };
  elements.pad.addEventListener("pointerup", stop);
  elements.pad.addEventListener("pointercancel", stop);
}

/* ------------------------------------------------------------------- Start */

async function boot() {
  await i18nReady;
  const [baked] = await Promise.all([bakeVillage(), loadActorSheets(), loadCropSheets()]);
  village = baked;
  readNameTagPalette(document.body);
  save = loadSave();

  renderHotbar = createHotbar(elements.hotbar, { onSelect: selectSlot });
  renderHotbar(save);
  elements.coins.textContent = formatCoins(save.coins);
  elements.sheetContent.addEventListener("click", onSheetClick);
  elements.sheetClose.addEventListener("click", closeSheet);
  elements.scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openShop) closeSheet();
  });

  // Der Laden füllt an festen Zeitfenstern auf — alle im Dorf sehen dasselbe.
  window.setInterval(() => {
    const slot = restockSlot();
    if (slot !== save.shop.slot) {
      save.shop = createStock(slot);
      renderSheet();
      persist();
    }
    const timer = document.getElementById("restock-timer");
    if (timer) timer.textContent = duration(nextRestockAt(save.shop.slot) - Date.now());
  }, 1000);
  // Fächer lassen sich auch mit den Zifferntasten wählen.
  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= HOTBAR_SLOTS) selectSlot(digit - 1);
  });

  bindTouchControls();
  elements.teleports.addEventListener("click", (event) => {
    const button = event.target.closest("[data-teleport]");
    if (button) teleport(button.dataset.teleport);
  });
  elements.interactButton.addEventListener("click", () => input.triggerInteract());
  elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
  elements.profileButton.addEventListener("click", () => showToast(t("garden.menu_soon")));
  elements.statsButton.addEventListener("click", () => showToast(t("garden.menu_soon")));
  elements.gridSetting.addEventListener("change", () => setGridVisible(elements.gridSetting.checked));
  setGridVisible(readSettings().showGrid);

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resize();
  });
  new ResizeObserver(resize).observe(elements.stage);
  resize();

  onLanguageChange(() => renderContext());
  renderContext();

  // ?debug erlaubt es, die Schleife von außen schrittweise zu treiben —
  // automatisierte Tests laufen ohne requestAnimationFrame.
  if (new URLSearchParams(location.search).has("debug")) {
    window.__garden = {
      player, camera, input, step, draw, teleport, setGridVisible, interact,
      get save() { return save; },
      get context() { return currentContext; },
      get identity() { return identity; },
      get zoom() { return zoom; },
    };
  }

  elements.loader.classList.add("is-done");
  window.requestAnimationFrame((timestamp) => {
    lastFrame = timestamp;
    window.requestAnimationFrame(frame);
  });

  // Das Profil darf das Spiel nicht aufhalten — es wird nachgereicht.
  identity = await loadIdentity();
}

boot().catch((error) => {
  console.error("KaktusGarden boot failed:", error);
  elements.loader.classList.add("is-done");
  showToast(t("garden.errors.load"));
});
