import { onLanguageChange, ready as i18nReady, t } from "/js/i18n.js";
import { PLOTS, SHOPS, TILE, VILLAGE_SPAWN, isWalkable } from "./data/world.js";
import { CROPS, cropIcon } from "./data/crops.js";
import { createCamera, focusCamera, resizeCamera } from "./engine/camera.js";
import { createInput } from "./engine/input.js";
import { bakeVillage } from "./render/village.js";
import {
  actorDrawOrigin,
  drawActor,
  drawNameTag,
  loadActorSheets,
  NAMETAG_PALETTE,
  readNameTagPalette,
  skinFor,
} from "./render/actors.js";
import { drawCrops, loadCropSheets } from "./render/crops.js";
import { contextAt, teleportTarget } from "./systems/context.js";
import { buySeed, cellState, harvestCell, plantSeed, sellHarvest } from "./systems/garden.js";
import { loadIdentity } from "./systems/identity.js";
import {
  STEP_MS,
  createPlayer,
  isMoving,
  playerWorldPosition,
  setPlayerTile,
  updatePlayer,
} from "./systems/player.js";
import {
  HOTBAR_SLOTS,
  bumpRevision,
  canAddInventoryStack,
  createInitialState,
  createStock,
  inventoryStacks,
  nextRestockAt,
  normalizeState,
  restockSlot,
  selectedStack,
} from "./state.js";
import { createHotbar } from "./ui/hotbar.js";
import { renderPlaceholder, renderSeedShop, renderSellShop } from "./ui/shopPanel.js";
import { coins as formatCoins, duration, weight as formatWeight } from "./ui/format.js";
import { createGardenCloudStore, requireGardenSession } from "./cloud.js";
import {
  createGardenMultiplayer,
  gardenRoomCodeFromUrl,
} from "./multiplayer.js";

const elements = {
  loader: document.getElementById("garden-loading"),
  stage: document.getElementById("garden-stage"),
  canvas: document.getElementById("game-canvas"),
  teleports: document.querySelector(".hud-teleports"),
  coins: document.getElementById("coin-count"),
  gems: document.getElementById("gem-count"),
  serverStatus: document.getElementById("server-status"),
  serverName: document.getElementById("server-name"),
  serverCount: document.getElementById("server-count"),
  serverBoost: document.getElementById("server-boost"),
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
  access: document.getElementById("garden-access"),
  accessTitle: document.getElementById("access-title"),
  accessMessage: document.getElementById("access-message"),
  accessAction: document.getElementById("access-action"),
  toast: document.getElementById("toast"),
};

const TARGET_VIEW_TILES = 21;
const MIN_ZOOM = 2;
const MAX_ZOOM = 5;
const RESETTABLE_SAVE_ERRORS = new Set([
  "invalid_payload",
  "unsupported_version",
  "invalid_revision",
  "invalid_cells",
  "invalid_coins",
  "invalid_seeds",
  "invalid_harvest",
  "invalid_shop",
  "invalid_inventory",
  "invalid_selection",
  "invalid_saved_at",
]);

const ctx = elements.canvas.getContext("2d");
const camera = createCamera();
const input = createInput();
const player = createPlayer(VILLAGE_SPAWN.x, VILLAGE_SPAWN.y);
const view = { x: 0, y: 0, w: 0, h: 0 };

let village = null;
let identity = { id: "", name: "", level: 1, signedIn: false };
let ownPlotIndex = null;
let save = createInitialState();
let cloudStore = null;
let multiplayer = null;
let remoteFarms = new Map();
const remotePlayers = new Map();
let roomPlayerCount = 0;
let renderHotbar = null;
let currentContext = { kind: "none", enabled: false };
let openShop = null;
let currentAccessIssue = null;
let zoom = 3;
let devicePixels = 1;
let lastFrame = 0;
let toastTimer = null;
let resizeRetry = null;
let lastMovementSignature = "";
let lastMultiplayerStatus = "idle";

function gardenNow() {
  return multiplayer?.now?.() ?? Date.now();
}

function roomMoneyBoostPercent() {
  const players = Math.max(1, Math.min(6, roomPlayerCount || multiplayer?.assignment?.occupancy || 1));
  return players * 10;
}

function roomMoneyMultiplier() {
  return 1 + roomMoneyBoostPercent() / 100;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login.html?next=${encodeURIComponent(next)}`);
}

function accessCopy(code) {
  if (code === "session_replaced") {
    return {
      title: t("garden.session_replaced_title"),
      message: t("garden.session_replaced_message"),
      action: t("garden.retry_connection"),
      href: window.location.href,
    };
  }
  if (code === "already_connected") {
    return {
      title: t("garden.already_connected_title"),
      message: t("garden.already_connected_message"),
      action: t("garden.back_to_games"),
      href: "/games/",
    };
  }
  if (code === "room_full") {
    return {
      title: t("garden.room_full_title"),
      message: t("garden.room_full_message"),
      action: t("garden.join_best_server"),
      href: window.location.pathname,
    };
  }
  return {
    title: t("garden.connection_failed_title"),
    message: t("garden.connection_failed_message"),
    action: t("garden.retry_connection"),
    href: window.location.href,
  };
}

function showAccessIssue(code = "connection_failed") {
  currentAccessIssue = code;
  input.clear();
  const copy = accessCopy(code);
  elements.accessTitle.textContent = copy.title;
  elements.accessMessage.textContent = copy.message;
  elements.accessAction.textContent = copy.action;
  elements.accessAction.href = copy.href;
  elements.accessAction.hidden = false;
  elements.access.hidden = false;
  elements.loader.classList.add("is-done");
}

function handleRequiredConnectionError(error) {
  if (error?.code === "login_required") {
    redirectToLogin();
    return;
  }
  if (error?.code === "account_banned") {
    window.location.replace("/login.html?banned=1");
    return;
  }
  showAccessIssue(error?.code);
}

function resize() {
  const width = elements.stage.clientWidth;
  const height = elements.stage.clientHeight;
  if (!width || !height) {
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

function uiBlocksMovement() {
  return Boolean(
    openShop
    || elements.settingsDialog.open
    || !elements.access.hidden
    || (multiplayer && multiplayer.status !== "connected"),
  );
}

function applyMultiplayerStatus({ status, error = null }) {
  const previous = lastMultiplayerStatus;
  lastMultiplayerStatus = status;

  if (status === "connected") {
    input.clear();
    renderRoomStatus();
    return;
  }

  input.clear();
  if (["degraded", "reconnecting"].includes(status)) {
    if (!["degraded", "reconnecting"].includes(previous)) {
      showToast(t("garden.connection_reconnecting"));
    }
    return;
  }

  if (["expired", "error", "disconnected"].includes(status)) {
    showAccessIssue(error?.code || "connection_failed");
    renderRoomStatus();
  }
}

function updateRemotePlayers(delta) {
  for (const remote of remotePlayers.values()) {
    if (!isMoving(remote.player)) {
      remote.player.walkTime = 0;
      continue;
    }
    remote.player.stepProgress = Math.min(1, remote.player.stepProgress + delta / remote.stepMs);
    remote.player.walkTime += delta;
    if (!isMoving(remote.player)) {
      remote.player.fromX = remote.player.tileX;
      remote.player.fromY = remote.player.tileY;
    }
  }
}

function movementSignature() {
  return [
    player.fromX,
    player.fromY,
    player.tileX,
    player.tileY,
    player.facing,
    isMoving(player) ? 1 : 0,
  ].join(":");
}

function broadcastLocalMovement(force = false) {
  if (!multiplayer || multiplayer.status !== "connected") return;
  const signature = movementSignature();
  if (!force && signature === lastMovementSignature) return;
  lastMovementSignature = signature;
  multiplayer.sendMovement({
    tileX: player.tileX,
    tileY: player.tileY,
    fromX: player.fromX,
    fromY: player.fromY,
    facing: player.facing,
    stepMs: STEP_MS,
  });
}

function step(delta) {
  const blocked = uiBlocksMovement();
  // Ein Dialog kann mitten in einem 180-ms-Schritt geöffnet werden. In diesem
  // Fall sofort sauber auf dem bereits gewählten Zielfeld einrasten, damit die
  // Figur hinter dem Menü nicht noch sichtbar weiterläuft.
  if (blocked && isMoving(player)) {
    setPlayerTile(player, player.tileX, player.tileY);
    lastMovementSignature = "";
  }
  updatePlayer(player, blocked ? null : input.state.direction, delta, isWalkable);
  updateRemotePlayers(delta);

  const wantsInteraction = input.consumeInteract();
  if (!blocked && wantsInteraction && !isMoving(player)) interact();

  broadcastLocalMovement();
  const spot = playerWorldPosition(player);
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

function drawActorWithName(entry) {
  drawActor(ctx, entry.player, entry.skin, view);
}

function drawNameForActor(entry) {
  const origin = actorDrawOrigin(entry.player);
  drawNameTag(
    ctx,
    entry.name,
    (origin.centerX - view.x) * zoom,
    (origin.y - view.y) * zoom - 2 * devicePixels,
    devicePixels,
  );
}

function drawShopNameTags() {
  for (const shop of SHOPS) {
    const centerX = (shop.sprite.x + shop.size.w / 2) * TILE;
    const topY = shop.sprite.y * TILE;
    drawNameTag(
      ctx,
      t(shop.labelKey),
      (centerX - view.x) * zoom,
      (topY - view.y) * zoom - 2 * devicePixels,
      devicePixels,
      NAMETAG_PALETTE,
      7,
    );
  }
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
  ctx.drawImage(village.canvas, view.x, view.y, view.w, view.h, 0, 0, view.w, view.h);

  for (const plot of PLOTS) {
    const cells = plot.index === ownPlotIndex ? save.cells : remoteFarms.get(plot.index)?.cells;
    if (cells) drawCrops(ctx, cells, plot, view);
  }

  const actors = [{ player, skin: skinFor(identity.id), name: identity.name }];
  for (const remote of remotePlayers.values()) {
    actors.push({
      player: remote.player,
      skin: remote.skin || skinFor(remote.userId),
      name: remote.displayName,
    });
  }
  actors.sort((left, right) => actorDrawOrigin(left.player).centerY - actorDrawOrigin(right.player).centerY);
  actors.forEach(drawActorWithName);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawShopNameTags();
  actors.forEach(drawNameForActor);
}

function iconStyle(cropId) {
  const icon = cropIcon(cropId);
  const position = icon.frames > 1 ? (icon.frame / (icon.frames - 1)) * 100 : 0;
  return `background-image:url('${icon.src}');background-size:${icon.frames * 100}% 100%;background-position:${position}% 0`;
}

function cropName(cropId) {
  return t(`garden.plants.${cropId}.name`);
}

function resolveAction(now = gardenNow()) {
  if (isMoving(player) || !Number.isInteger(ownPlotIndex)) {
    return { kind: "none", enabled: false, action: null };
  }

  const base = contextAt(player.tileX, player.tileY, { ownPlotIndex });
  if (base.kind === "shop") return { ...base, action: "shop", label: t(base.labelKey) };
  if (base.kind === "closedShop") return { ...base, action: null, tag: { title: t("garden.shop_closed") } };
  if (base.kind !== "plot") return { ...base, action: null };

  const cell = save.cells[base.cell];
  const state = cellState(cell, now);
  if (state === "ready") {
    const crop = CROPS[cell.cropId];
    const full = !canAddInventoryStack(save, "crop", cell.cropId);
    const sub = t("garden.worth", { value: formatCoins(crop.sellPrice) });
    return {
      ...base,
      action: "harvest",
      disabled: full,
      label: t(full ? "garden.inventory_full" : "garden.action_harvest"),
      tag: { cropId: cell.cropId, title: cropName(cell.cropId), sub },
    };
  }
  if (state === "growing") {
    return {
      ...base,
      action: null,
      tag: { cropId: cell.cropId, title: cropName(cell.cropId), sub: duration(cell.readyAt - now) },
    };
  }

  const stack = selectedStack(save);
  if (stack?.kind === "seed") {
    return {
      ...base,
      action: "plant",
      seedId: stack.id,
      label: t("garden.action_plant"),
      tag: {
        cropId: stack.id,
        title: cropName(stack.id),
        sub: t("garden.grows_in", { value: duration(CROPS[stack.id].growSeconds * 1000) }),
      },
    };
  }
  return { ...base, action: null };
}

function renderContext(now = gardenNow()) {
  currentContext = resolveAction(now);
  const { action, tag } = currentContext;
  elements.interactButton.hidden = !action;
  elements.interactButton.disabled = Boolean(currentContext.disabled);
  if (action) {
    elements.interactLabel.textContent = currentContext.label;
    elements.interactButton.classList.toggle("is-harvest", action === "harvest" && !currentContext.disabled);
  }

  elements.contextTag.hidden = !tag;
  if (!tag) return;
  elements.contextTitle.textContent = tag.title;
  elements.contextSub.textContent = tag.sub || "";
  elements.contextSub.hidden = !tag.sub;
  if (tag.cropId) elements.contextIcon.setAttribute("style", iconStyle(tag.cropId));
  elements.contextIcon.hidden = !tag.cropId;
}

function renderHud() {
  renderHotbar?.(save);
  elements.coins.textContent = formatCoins(save.coins);
}

function persist(reason = "action") {
  bumpRevision(save);
  save.lastSavedAt = gardenNow();
  renderHud();
  if (!cloudStore) return;
  try {
    cloudStore.schedule(save, { reason, immediate: true });
    cloudStore.flushBestEffort();
  } catch (error) {
    console.error("KaktusGarden save scheduling failed:", error);
    showToast(t("garden.save_failed"));
  }
}

function interact() {
  if (isMoving(player) || uiBlocksMovement()) return;
  const now = gardenNow();
  currentContext = resolveAction(now);
  const { action } = currentContext;
  if (!action || currentContext.disabled) return;

  if (action === "shop") {
    openSheet(currentContext.id);
    return;
  }
  if (action === "plant") {
    if (plantSeed(save, currentContext.cell, currentContext.seedId, now)) {
      clampSelection();
      persist("plant");
      renderContext(now);
    }
    return;
  }
  if (action === "harvest") {
    const result = harvestCell(save, currentContext.cell, now);
    if (result?.reason === "inventoryFull") {
      showToast(t("garden.inventory_full"));
      renderContext(now);
      return;
    }
    if (!result?.ok) return;
    const heaviest = result.items.reduce((best, item) => Math.max(best, item.weight), 0);
    showToast(t("garden.harvested", {
      amount: result.items.length,
      product: cropName(result.cropId),
      weight: formatWeight(heaviest),
    }));
    persist("harvest");
    renderContext(now);
  }
}

function openSheet(shopId) {
  input.clear();
  openShop = shopId;
  renderSheet();
  elements.sheet.hidden = false;
  elements.scrim.hidden = false;
}

function closeSheet() {
  input.clear();
  openShop = null;
  elements.sheet.hidden = true;
  elements.scrim.hidden = true;
}

function renderSheet() {
  if (!openShop) return;
  if (openShop === "seeds") elements.sheetContent.innerHTML = renderSeedShop(save, gardenNow());
  else if (openShop === "crops") elements.sheetContent.innerHTML = renderSellShop(save, roomMoneyMultiplier());
  else elements.sheetContent.innerHTML = renderPlaceholder(openShop);
}

function onSheetClick(event) {
  const buy = event.target.closest("[data-buy]");
  if (buy) {
    const result = buySeed(save, buy.dataset.buy);
    if (result?.reason === "inventoryFull") {
      showToast(t("garden.inventory_full"));
      return;
    }
    if (result === true) {
      showToast(t("garden.bought", { crop: cropName(buy.dataset.buy) }));
      persist("buy-seed");
      renderSheet();
    }
    return;
  }

  const sell = event.target.closest("[data-sell]");
  if (sell) {
    const result = sellHarvest(save, sell.dataset.sell, roomMoneyMultiplier());
    if (result) {
      showToast(t("garden.sold", { amount: result.count, value: formatCoins(result.value) }));
      persist("sell-crop");
      renderSheet();
    }
    return;
  }

  if (event.target.closest("[data-sell-all]")) {
    const result = sellHarvest(save, null, roomMoneyMultiplier());
    if (result) {
      showToast(t("garden.sold", { amount: result.count, value: formatCoins(result.value) }));
      persist("sell-all");
      renderSheet();
    }
  }
}

function clampSelection() {
  const stacks = inventoryStacks(save);
  if (stacks.length && save.selectedSlot >= stacks.length) save.selectedSlot = stacks.length - 1;
  if (!stacks.length) save.selectedSlot = 0;
  renderHotbar?.(save);
}

function selectSlot(index) {
  if (index < 0 || index >= HOTBAR_SLOTS || uiBlocksMovement()) return;
  save.selectedSlot = index;
  renderHotbar?.(save);
  persist("select-slot");
}

function teleport(id) {
  if (!Number.isInteger(ownPlotIndex) || uiBlocksMovement()) return;
  const target = teleportTarget(id, { ownPlotIndex });
  if (!target) return;
  setPlayerTile(player, target.x, target.y);
  const spot = playerWorldPosition(player);
  focusCamera(camera, spot.x, spot.y, 1);
  lastMovementSignature = "";
  broadcastLocalMovement(true);
  renderContext();
}

function ensureRemotePlayer(presence) {
  let remote = remotePlayers.get(presence.userId);
  const plot = PLOTS[presence.slotIndex];
  if (!plot) return null;
  if (!remote) {
    remote = {
      userId: presence.userId,
      slotIndex: presence.slotIndex,
      displayName: presence.displayName,
      skin: presence.skin || skinFor(presence.userId),
      player: createPlayer(plot.spawn.x, plot.spawn.y),
      stepMs: STEP_MS,
    };
    remotePlayers.set(presence.userId, remote);
  } else {
    if (remote.slotIndex !== presence.slotIndex) {
      remote.slotIndex = presence.slotIndex;
      setPlayerTile(remote.player, plot.spawn.x, plot.spawn.y);
    }
    remote.displayName = presence.displayName || remote.displayName;
    remote.skin = presence.skin || remote.skin;
  }
  return remote;
}

function applyRoster(roster) {
  for (const presence of roster) {
    if (presence.userId === identity.id) continue;
    ensureRemotePlayer(presence);
  }
  roomPlayerCount = Math.max(1, roster.length, multiplayer?.snapshot?.members?.length || 0);
  renderRoomStatus();
  if (openShop === "crops") renderSheet();
  broadcastLocalMovement(true);
}

function applyRemoteMovement(movement) {
  const remote = ensureRemotePlayer(movement.presence);
  if (!remote) return;
  remote.player.fromX = movement.fromX;
  remote.player.fromY = movement.fromY;
  remote.player.tileX = movement.tileX;
  remote.player.tileY = movement.tileY;
  remote.player.facing = movement.facing;
  remote.player.stepProgress = movement.fromX === movement.tileX && movement.fromY === movement.tileY ? 1 : 0;
  remote.player.walkTime = remote.player.stepProgress === 1 ? 0 : movement.sequence * movement.stepMs;
  remote.stepMs = movement.stepMs;
}

function applyRoomSnapshot(snapshot) {
  const nextFarms = new Map();
  const activePlayers = new Set();
  for (const member of snapshot.members) {
    if (member.userId === identity.id) continue;
    activePlayers.add(member.userId);
    if (Array.isArray(member.cells)) {
      nextFarms.set(member.slotIndex, { userId: member.userId, cells: member.cells });
    }
    ensureRemotePlayer({
      userId: member.userId,
      slotIndex: member.slotIndex,
      displayName: member.displayName,
      skin: member.skin || skinFor(member.userId),
    });
  }
  for (const userId of remotePlayers.keys()) {
    if (!activePlayers.has(userId)) remotePlayers.delete(userId);
  }
  remoteFarms = nextFarms;
  roomPlayerCount = Math.max(1, snapshot.members.length);
  renderRoomStatus();
  if (openShop === "crops") renderSheet();
}

function renderRoomStatus() {
  const assignment = multiplayer?.assignment;
  elements.serverStatus.hidden = !assignment;
  if (!assignment) return;
  elements.serverName.textContent = t("garden.players_label");
  elements.serverCount.textContent = t("garden.server_players", {
    count: Math.max(1, Math.min(6, roomPlayerCount || assignment.occupancy || 1)),
  });
  elements.serverBoost.textContent = t("garden.server_boost", { percent: roomMoneyBoostPercent() });
}

async function copyRoomLink() {
  const url = multiplayer?.inviteUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast(t("garden.room_link_copied"));
  } catch (error) {
    console.warn("Raumlink konnte nicht kopiert werden:", error);
    showToast(t("garden.connection_failed_message"));
  }
}

function bindTouchControls() {
  let pointerId = null;
  const setFromPoint = (event) => {
    if (uiBlocksMovement()) {
      input.clear();
      return;
    }
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
    if (event.pointerId === pointerId) setFromPoint(event);
  });
  const stop = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    input.setDirection(null);
  };
  elements.pad.addEventListener("pointerup", stop);
  elements.pad.addEventListener("pointercancel", stop);
}

function bindUi() {
  renderHotbar = createHotbar(elements.hotbar, { onSelect: selectSlot });
  renderHud();
  elements.sheetContent.addEventListener("click", onSheetClick);
  elements.sheetClose.addEventListener("click", closeSheet);
  elements.scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openShop) closeSheet();
  });

  window.setInterval(() => {
    const now = gardenNow();
    const slot = restockSlot(now);
    if (slot !== save.shop.slot) {
      save.shop = createStock(slot);
      renderSheet();
      persist("shop-restock");
    }
    const timer = document.getElementById("restock-timer");
    if (timer) timer.textContent = duration(nextRestockAt(save.shop.slot) - now);
  }, 1000);

  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || uiBlocksMovement()) return;
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= HOTBAR_SLOTS) selectSlot(digit - 1);
  });

  bindTouchControls();
  elements.teleports.addEventListener("click", (event) => {
    const button = event.target.closest("[data-teleport]");
    if (button) teleport(button.dataset.teleport);
  });
  elements.interactButton.addEventListener("click", () => input.triggerInteract());
  elements.serverStatus.addEventListener("click", copyRoomLink);
  elements.settingsButton.addEventListener("click", () => {
    input.clear();
    elements.settingsDialog.showModal();
  });
  elements.profileButton.addEventListener("click", () => showToast(t("garden.menu_soon")));
  elements.statsButton.addEventListener("click", () => showToast(t("garden.menu_soon")));

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resize();
  });
  new ResizeObserver(resize).observe(elements.stage);
  resize();

  onLanguageChange(() => {
    renderContext();
    renderSheet();
    renderRoomStatus();
    if (currentAccessIssue) showAccessIssue(currentAccessIssue);
  });
  renderContext();
}

async function initializeCloud(auth) {
  cloudStore = await createGardenCloudStore({
    client: auth.client,
    session: auth.session,
    user: auth.user,
    debounceMs: 0,
    onError: (error) => {
      console.warn("KaktusGarden Cloud-Save:", error);
      showToast(t("garden.save_failed"));
    },
  });
  cloudStore.bindLifecycle();

  let loaded = null;
  let reset = false;
  try {
    loaded = await cloudStore.load();
  } catch (error) {
    if (!RESETTABLE_SAVE_ERRORS.has(error?.code)) throw error;
    console.warn("Alter KaktusGarden-Testsave wird durch v4 ersetzt:", error.code);
    reset = true;
  }

  save = normalizeState(loaded?.state || null);
  if (!loaded?.state || reset) {
    bumpRevision(save);
    save.lastSavedAt = gardenNow();
    cloudStore.schedule(save, { reason: reset ? "reset-old-save" : "initial-save", immediate: true });
    await cloudStore.flushBestEffort();
  }
}

async function initializeMultiplayer(auth) {
  multiplayer = await createGardenMultiplayer({
    client: auth.client,
    session: auth.session,
    user: auth.user,
    onRoster: applyRoster,
    onMovement: applyRemoteMovement,
    onSnapshot: applyRoomSnapshot,
    onStatus: applyMultiplayerStatus,
    onError: (error) => console.warn("KaktusGarden Multiplayer:", error),
  });
  const assignment = await multiplayer.connect({
    roomCode: gardenRoomCodeFromUrl(),
    presence: {
      displayName: identity.name,
      level: identity.level,
      skin: skinFor(identity.id),
    },
  });
  ownPlotIndex = assignment.slotIndex;
  const localShopSlot = save.shop.slot;
  save = normalizeState(save, gardenNow());
  if (save.shop.slot !== localShopSlot) persist("server-restock-sync");
  else renderHud();
  roomPlayerCount = Math.max(1, multiplayer.roster.length || assignment.occupancy || 1);
  multiplayer.bindLifecycle();
  renderRoomStatus();
  broadcastLocalMovement(true);
}

async function boot() {
  await i18nReady;

  let auth;
  try {
    auth = await requireGardenSession();
  } catch (error) {
    handleRequiredConnectionError(error);
    return;
  }

  const assetsPromise = Promise.all([bakeVillage(), loadActorSheets(), loadCropSheets()]);
  const identityPromise = loadIdentity(auth);
  try {
    await initializeCloud(auth);
  } catch (error) {
    handleRequiredConnectionError(error);
    return;
  }

  const [assets, loadedIdentity] = await Promise.all([assetsPromise, identityPromise]);
  village = assets[0];
  identity = loadedIdentity?.signedIn
    ? loadedIdentity
    : {
      id: auth.user.id,
      name: auth.user.email?.split("@")[0] || t("garden.guest"),
      level: 1,
      signedIn: true,
    };
  readNameTagPalette(document.body);
  bindUi();

  try {
    await initializeMultiplayer(auth);
  } catch (error) {
    handleRequiredConnectionError(error);
    return;
  }

  if (new URLSearchParams(location.search).has("debug")) {
    window.__garden = {
      player,
      camera,
      input,
      step,
      draw,
      teleport,
      interact,
      get save() { return save; },
      get context() { return currentContext; },
      get identity() { return identity; },
      get multiplayer() { return multiplayer; },
      get remotePlayers() { return remotePlayers; },
      get remoteFarms() { return remoteFarms; },
      get zoom() { return zoom; },
    };
  }

  elements.loader.classList.add("is-done");
  window.requestAnimationFrame((timestamp) => {
    lastFrame = timestamp;
    window.requestAnimationFrame(frame);
  });
}

boot().catch((error) => {
  console.error("KaktusGarden boot failed:", error);
  handleRequiredConnectionError(error);
});
