import { getLanguage, onLanguageChange, ready as i18nReady, t } from "/js/i18n.js";
import { PLANTS, PLANT_ORDER, PLANT_RENDER, PRODUCTS, RARITIES, TOOLS, growthSprite, plantIcon } from "./data/plants.js";
import { BEDS, BUILDINGS, FOCUS_VIEW, MAP_HEIGHT, MAP_WIDTH, TILE } from "./data/farmMap.js";
import { drawWorld, loadWorldAssets, pickRenderScale } from "./render/worldRenderer.js";
import { addExperience, advanceState, emptyField } from "./state.js";
import {
  initializeStorage,
  listFarmSnapshots,
  loadFarmSnapshot,
  savePlayerData,
} from "./storage.js";

const elements = {
  loader: document.getElementById("garden-loading"),
  stage: document.getElementById("garden-stage"),
  world: document.getElementById("garden-world"),
  track: document.getElementById("world-track"),
  canvas: document.getElementById("world-canvas"),
  layer: document.getElementById("world-layer"),
  sheet: document.getElementById("garden-sheet"),
  scrim: document.getElementById("sheet-scrim"),
  panelContent: document.getElementById("panel-content"),
  panelClose: document.getElementById("panel-close"),
  backButton: document.getElementById("back-button"),
  visitBanner: document.getElementById("visit-banner"),
  visitName: document.getElementById("visit-name"),
  playerName: document.getElementById("player-name"),
  playerLevel: document.getElementById("player-level"),
  playerAvatar: document.getElementById("player-avatar"),
  coins: document.getElementById("coin-count"),
  gems: document.getElementById("gem-count"),
  seedDialog: document.getElementById("seed-dialog"),
  seedList: document.getElementById("seed-list"),
  bedDialog: document.getElementById("bed-dialog"),
  bedTitle: document.getElementById("bed-title"),
  bedTime: document.getElementById("bed-time"),
  bedProgress: document.getElementById("bed-progress"),
  bedRemove: document.getElementById("bed-remove"),
  settingsDialog: document.getElementById("settings-dialog"),
  settingsButton: document.getElementById("settings-button"),
  reducedMotion: document.getElementById("reduced-motion"),
  saveModeText: document.getElementById("save-mode-text"),
  toast: document.getElementById("toast"),
};

const MIN_PX = 0.6;
const MAX_PX = 3;

let state;
let user = null;
let profile = null;
let saveMode = "local";
let activePanel = null;
let renderedPanel = null;
let shopTab = "seeds";
let selectedFieldId = null;
let bedDialogFieldId = null;
let visiting = null;
let saveTimer = null;
let toastTimer = null;
let playersRequest = 0;

let worldImages = null;
let renderScale = 0;
let worldLayout = "";
let layoutTimer = null;
let bedViews = [];
let buildingViews = [];

function locale() {
  return getLanguage() === "ru" ? "ru-RU" : "de-DE";
}

function formatNumber(value) {
  return new Intl.NumberFormat(locale()).format(Math.max(0, Number(value) || 0));
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds < 60) return t("garden.time_seconds", { value: seconds });
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? t("garden.time_minutes_seconds", { minutes, seconds: rest }) : t("garden.time_minutes", { value: minutes });
}

function relativeTime(value) {
  if (!value) return t("garden.offline_unknown");
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 90) return t("garden.just_now");
  if (seconds < 3600) return t("garden.minutes_ago", { value: Math.floor(seconds / 60) });
  if (seconds < 86400) return t("garden.hours_ago", { value: Math.floor(seconds / 3600) });
  return t("garden.days_ago", { value: Math.floor(seconds / 86400) });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function plantName(plantId) {
  return t(`garden.plants.${plantId}.name`);
}

function productName(productId) {
  return t(`garden.products.${productId}`);
}

function rarityName(rarity) {
  return t(`garden.rarities.${rarity}`);
}

function spriteStyle(sprite) {
  if (!sprite) return "";
  const position = sprite.frames > 1 ? (sprite.frame / (sprite.frames - 1)) * 100 : 0;
  return `--sprite-image:url('${sprite.src}');--sprite-frames:${sprite.frames};--sprite-position:${position.toFixed(4)}%;--sprite-width:${sprite.frameWidth};--sprite-height:${sprite.frameHeight}`;
}

function cropIconMarkup(plantId, className = "product-image") {
  return `<span class="pixel-sprite ${className}" aria-hidden="true" style="${spriteStyle(plantIcon(plantId))}"></span>`;
}

function coinMarkup() {
  return '<span class="pixel-icon icon-coin" aria-hidden="true"></span>';
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function playerDisplayName() {
  return profile?.username || user?.email?.split("@")[0] || t("garden.guest");
}

/* ---------------------------------------------------------------- Weltbühne */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Legt Sichtausschnitt und Zoom fest. `--px` ist der Umrechner von Map-Pixeln
 * in CSS-Pixel; alle Overlay-Elemente rechnen damit, deshalb sitzen Beete,
 * Gebäude und Pflanzen immer exakt auf ihren Tiles.
 *
 * Der Zoom richtet sich nach FOCUS_VIEW: Zaun und Gebäude müssen immer
 * vollständig sichtbar sein, auch auf einem schmalen Handy. Bleibt danach noch
 * Platz, wächst das Fenster über den Fokus hinaus und zeigt vom Waldrand so
 * viel, wie auf den Bildschirm passt — auf dem Desktop also fast die ganze
 * Karte statt eines kleinen Quadrats in der Mitte.
 */
function layoutWorld() {
  const rect = elements.stage.getBoundingClientRect();
  // Nie breiter als der Viewport messen, egal was die Bühne meldet — sonst
  // könnte eine einmal zu groß gesetzte Welt ihre eigene Messgrundlage aufblähen.
  const availableWidth = Math.min(elements.stage.clientWidth || rect.width, document.documentElement.clientWidth - 24);
  // Abstand der Bühne zum Seitenanfang, NICHT zum Viewport: `rect.top` schrumpft
  // beim Scrollen, dadurch würde die Welt bei jedem Resize wachsen und sich
  // hochschaukeln — nach einer Bildschirmdrehung war die Karte deshalb verrutscht.
  const stageOffset = rect.top + window.scrollY;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const availableHeight = Math.max(260, viewportHeight - stageOffset - 26);

  const focusWidth = FOCUS_VIEW.w * TILE;
  const focusHeight = FOCUS_VIEW.h * TILE;
  const px = clamp(Math.min(availableWidth / focusWidth, availableHeight / focusHeight), MIN_PX, MAX_PX);

  const viewWidth = Math.min(MAP_WIDTH, availableWidth / px);
  const viewHeight = Math.min(MAP_HEIGHT, availableHeight / px);
  const viewX = clamp(FOCUS_VIEW.x * TILE + focusWidth / 2 - viewWidth / 2, 0, MAP_WIDTH - viewWidth);
  const viewY = clamp(FOCUS_VIEW.y * TILE + focusHeight / 2 - viewHeight / 2, 0, MAP_HEIGHT - viewHeight);

  const signature = `${viewX.toFixed(2)},${viewY.toFixed(2)},${px.toFixed(4)}`;
  if (signature === worldLayout) return;
  worldLayout = signature;

  elements.world.style.width = `${Math.round(viewWidth * px)}px`;
  elements.world.style.height = `${Math.round(viewHeight * px)}px`;
  elements.world.style.setProperty("--px", String(px));
  elements.track.style.width = `${MAP_WIDTH * px}px`;
  elements.track.style.height = `${MAP_HEIGHT * px}px`;
  elements.track.style.left = `${-Math.round(viewX * px)}px`;
  elements.track.style.top = `${-Math.round(viewY * px)}px`;

  const scale = pickRenderScale(px);
  if (worldImages && scale !== renderScale) {
    renderScale = scale;
    drawWorld(elements.canvas, worldImages, scale);
  }
}

function mapVars(element, x, y, w, h) {
  element.style.setProperty("--mx", String(x * TILE));
  element.style.setProperty("--my", String(y * TILE));
  element.style.setProperty("--mw", String(w * TILE));
  element.style.setProperty("--mh", String(h * TILE));
}

function buildWorldOverlay() {
  elements.layer.textContent = "";
  // So viele Sprite-Slots wie die üppigste Pflanze braucht; überzählige werden
  // pro Beet ausgeblendet.
  const maxSlots = Math.max(PLANT_RENDER.slots, ...PLANT_ORDER.map((id) => PLANTS[id].render.slots));

  bedViews = BEDS.map((bed) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "farm-bed";
    button.dataset.fieldId = String(bed.fieldId);
    mapVars(button, bed.x, bed.y, bed.w, bed.h);

    const crops = document.createElement("span");
    crops.className = "bed-crops";
    crops.setAttribute("aria-hidden", "true");
    const sprites = Array.from({ length: maxSlots }, () => {
      const sprite = document.createElement("i");
      sprite.className = "crop-sprite pixel-sprite";
      sprite.hidden = true;
      crops.append(sprite);
      return sprite;
    });

    const track = document.createElement("span");
    track.className = "bed-track-mini";
    track.setAttribute("aria-hidden", "true");
    track.hidden = true;
    const fill = document.createElement("span");
    track.append(fill);

    const status = document.createElement("span");
    status.className = "bed-status";
    status.setAttribute("aria-hidden", "true");
    status.hidden = true;

    button.append(crops, track, status);
    elements.layer.append(button);
    return { button, sprites, track, fill, status, plantId: null, spriteKey: "" };
  });

  buildingViews = BUILDINGS.map((building) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `farm-building building-${building.id}`;
    button.dataset.panel = building.id;
    mapVars(button, building.hit.x, building.hit.y, building.hit.w, building.hit.h);
    const label = document.createElement("span");
    label.className = "building-label";
    button.append(label);
    elements.layer.append(button);
    return { building, button, label };
  });
}

function renderBuildingLabels() {
  for (const view of buildingViews) {
    const text = t(view.building.labelKey);
    view.label.textContent = text;
    view.button.setAttribute("aria-label", text);
    view.button.hidden = Boolean(visiting);
    view.button.classList.toggle("is-active", activePanel === view.building.id);
  }
}

/* ------------------------------------------------------------------- Beete */

function displayedFields() {
  return visiting?.farm_snapshot?.fields || state.fields;
}

function fieldLabel(field) {
  if (!field || field.state === "empty") return t("garden.field_empty", { value: (field?.fieldId ?? 0) + 1 });
  const plant = plantName(field.plantId);
  if (field.state === "ready") return t("garden.field_ready", { plant });
  return t("garden.field_growing", { plant, time: formatDuration(field.readyAt - Date.now()) });
}

function applyCropSprites(view, field, plant, now) {
  const sprite = growthSprite(field.plantId, field, now);
  if (!sprite) return;
  const { slots, slotStep, baseline, scale } = plant.render;
  const bedWidth = BEDS[0].w * TILE;
  const start = (bedWidth - slots * slotStep * scale) / 2;
  const key = `${sprite.src}|${sprite.frame}|${slots}`;
  if (key === view.spriteKey) return;
  view.spriteKey = key;

  view.sprites.forEach((element, index) => {
    if (index >= slots) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    element.setAttribute("style", spriteStyle(sprite));
    element.style.setProperty("--sx", String(start + slotStep * scale * (index + 0.5)));
    element.style.setProperty("--base", String(baseline));
    element.style.setProperty("--pscale", String(scale));
  });
}

function renderBeds() {
  const now = Date.now();
  const fields = displayedFields();
  bedViews.forEach((view, fieldId) => {
    const field = { ...emptyField(fieldId), ...(fields[fieldId] || {}), fieldId };
    const plant = field.plantId ? PLANTS[field.plantId] : null;
    const growing = Boolean(plant) && field.state === "growing";
    const ready = Boolean(plant) && field.state === "ready";

    // Die Auswahl-Markierung hängt direkt am geöffneten Dialog statt an einem
    // eigenen Zustand — so bleibt kein Beet markiert, wenn ein Dialog auf einem
    // Weg geschlossen wird, den wir nicht selbst ausgelöst haben.
    const highlighted = (selectedFieldId === fieldId && elements.seedDialog.open)
      || (bedDialogFieldId === fieldId && elements.bedDialog.open);
    view.button.classList.toggle("is-selected", highlighted);
    view.button.classList.toggle("is-ready", ready);
    view.button.classList.toggle("is-growing", growing);
    view.button.classList.toggle("is-empty", !plant);
    view.button.disabled = Boolean(visiting);
    view.button.setAttribute("aria-label", fieldLabel(field));

    if (!plant) {
      if (view.plantId !== null) {
        view.sprites.forEach((sprite) => { sprite.hidden = true; });
        view.plantId = null;
        view.spriteKey = "";
      }
      view.status.hidden = true;
      view.track.hidden = true;
      return;
    }

    view.plantId = field.plantId;
    applyCropSprites(view, field, plant, now);

    if (growing) {
      const duration = Math.max(1, field.readyAt - field.plantedAt);
      const progress = Math.max(0, Math.min(1, (now - field.plantedAt) / duration));
      view.track.hidden = false;
      view.fill.style.width = `${(progress * 100).toFixed(2)}%`;
      view.status.hidden = false;
      view.status.classList.remove("is-ready");
      view.status.textContent = formatDuration(field.readyAt - now);
    } else {
      view.track.hidden = true;
      view.status.hidden = false;
      view.status.classList.add("is-ready");
      view.status.textContent = t("garden.harvest_now");
    }
  });
}

/* ------------------------------------------------------------------ Topbar */

function renderTopbar() {
  elements.playerName.textContent = visiting?.display_name || playerDisplayName();
  elements.playerLevel.textContent = formatNumber(visiting?.level ?? state.level);
  elements.coins.textContent = visiting ? "—" : formatNumber(state.coins);
  elements.gems.textContent = visiting ? "—" : formatNumber(state.gems);
  elements.visitBanner.hidden = !visiting;
  elements.visitName.textContent = visiting ? visiting.display_name : "";
  elements.settingsButton.disabled = Boolean(visiting);

  const avatarUrl = visiting?.avatar_url || (!visiting && profile?.avatar_url);
  if (avatarUrl) {
    const image = document.createElement("img");
    image.src = avatarUrl;
    image.alt = "";
    elements.playerAvatar.textContent = "";
    elements.playerAvatar.append(image);
  } else {
    elements.playerAvatar.innerHTML = '<span class="avatar-sprite" aria-hidden="true"></span>';
  }
}

/* ------------------------------------------------------------------ Menüs */

function panelHeader(kicker, title, copy) {
  return `<header class="panel-header"><p class="eyebrow">${escapeHtml(kicker)}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></header>`;
}

function renderShopPanel() {
  const cards = shopTab === "seeds" ? PLANT_ORDER.map((plantId) => {
    const plant = PLANTS[plantId];
    const stock = state.shop.stock[plantId] || 0;
    const affordable = state.coins >= plant.seedPrice;
    const stockLabel = stock ? t("garden.stock", { value: stock }) : t("garden.sold_out");
    return `<article class="product-card rarity-border-${plant.rarity}${stock ? "" : " is-unavailable"}">
      ${cropIconMarkup(plantId)}
      <div class="product-info"><span class="rarity rarity-${plant.rarity}">${escapeHtml(rarityName(plant.rarity))}</span><h3>${escapeHtml(plantName(plantId))}</h3><p class="product-meta"><span>${coinMarkup()} ${formatNumber(plant.seedPrice)}</span><span>${escapeHtml(formatDuration(plant.growthSeconds * 1000))}</span><span>${escapeHtml(stockLabel)}</span></p></div>
      <div class="card-actions"><button class="primary-button buy-seed" type="button" data-plant="${plantId}" ${stock && affordable ? "" : "disabled"}>${escapeHtml(t("garden.buy"))}</button></div>
    </article>`;
  }).join("") : `<article class="product-card">
    <div class="product-image tool-picture" aria-hidden="true"><span class="shovel-sprite"></span></div>
    <div class="product-info"><span class="rarity rarity-rare">${escapeHtml(t("garden.tool"))}</span><h3>${escapeHtml(t("garden.shovel"))}</h3><p class="product-meta"><span>${coinMarkup()} ${formatNumber(TOOLS.shovel.price)}</span><span>${escapeHtml(t("garden.owned", { value: state.inventories.tools.shovel || 0 }))}</span></p></div>
    <div class="card-actions"><button class="primary-button buy-tool" type="button" ${state.coins >= TOOLS.shovel.price ? "" : "disabled"}>${escapeHtml(t("garden.buy"))}</button></div>
  </article>`;

  elements.panelContent.innerHTML = `${panelHeader(t("garden.shop_kicker"), t("garden.shop_title"), t("garden.shop_copy"))}
    <div class="panel-tabs"><button class="panel-tab${shopTab === "seeds" ? " is-active" : ""}" type="button" data-shop-tab="seeds">${escapeHtml(t("garden.seeds"))}</button><button class="panel-tab${shopTab === "tools" ? " is-active" : ""}" type="button" data-shop-tab="tools">${escapeHtml(t("garden.tools"))}</button></div>
    ${shopTab === "seeds" ? `<div class="restock-card"><span>${escapeHtml(t("garden.next_restock"))}</span><strong id="restock-timer">${escapeHtml(formatDuration(state.shop.nextRestockAt - Date.now()))}</strong></div>` : ""}
    <div class="product-list">${cards}</div>`;
}

function harvestEntries() {
  return Object.entries(state.inventories.harvests).filter(([id, count]) => PRODUCTS[id] && count > 0);
}

function renderSellPanel() {
  const entries = harvestEntries();
  const total = entries.reduce((sum, [id, count]) => sum + PRODUCTS[id].sellPrice * count, 0);
  const cards = entries.map(([productId, count]) => {
    const product = PRODUCTS[productId];
    return `<article class="product-card">${cropIconMarkup(product.plantId)}<div class="product-info"><h3>${escapeHtml(productName(productId))}</h3><p class="product-meta"><span>${escapeHtml(t("garden.quantity", { value: count }))}</span><span>${escapeHtml(t("garden.unit_price", { value: formatNumber(product.sellPrice) }))}</span><span>${escapeHtml(t("garden.total_value", { value: formatNumber(product.sellPrice * count) }))}</span></p></div><div class="card-actions"><button class="soft-button sell-one" data-product="${productId}" type="button">${escapeHtml(t("garden.sell_one"))}</button><button class="primary-button sell-stack" data-product="${productId}" type="button">${escapeHtml(t("garden.sell_stack"))}</button></div></article>`;
  }).join("");
  elements.panelContent.innerHTML = `${panelHeader(t("garden.sell_kicker"), t("garden.sell_title"), t("garden.sell_copy"))}<div class="inventory-total"><span>${escapeHtml(t("garden.harvest_value"))}</span><strong>${coinMarkup()} ${formatNumber(total)}</strong></div>${cards ? `<div class="product-list">${cards}</div><button class="primary-button sell-all" type="button">${escapeHtml(t("garden.sell_all"))}</button>` : `<div class="empty-state">${cropIconMarkup("carrot", "empty-sprite")}${escapeHtml(t("garden.no_harvest"))}</div>`}`;
}

async function renderPlayersPanel() {
  const requestId = ++playersRequest;
  const header = panelHeader(t("garden.players_kicker"), t("garden.players_title"), t("garden.players_copy"));
  elements.panelContent.innerHTML = `${header}<div class="empty-state"><span aria-hidden="true">🌐</span>${escapeHtml(t("garden.players_loading"))}</div>`;
  try {
    const players = (await listFarmSnapshots()).filter((entry) => entry.user_id !== user?.id);
    if (requestId !== playersRequest || activePanel !== "players") return;
    const cards = players.map((entry) => {
      const name = escapeHtml(entry.display_name || t("garden.guest"));
      const avatar = entry.avatar_url ? `<img src="${escapeHtml(entry.avatar_url)}" alt="" />` : "🌵";
      const status = entry.is_online ? t("garden.online") : relativeTime(entry.last_seen || entry.updated_at);
      return `<article class="player-card"><span class="player-avatar">${avatar}</span><div class="product-info"><h3>${name}</h3><p class="product-meta"><span>${escapeHtml(t("garden.level_value", { value: entry.level || 1 }))}</span><span><i class="status-dot${entry.is_online ? " online" : ""}"></i>${escapeHtml(status)}</span></p></div><button class="primary-button visit-player" type="button" data-player="${escapeHtml(entry.user_id)}">${escapeHtml(t("garden.visit"))}</button></article>`;
    }).join("");
    elements.panelContent.innerHTML = `${header}${cards ? `<div class="player-list">${cards}</div>` : `<div class="empty-state"><span aria-hidden="true">🌱</span>${escapeHtml(saveMode === "cloud" ? t("garden.no_players") : t("garden.sign_in_players"))}</div>`}`;
  } catch (error) {
    console.error("Farm list failed:", error);
    elements.panelContent.innerHTML = `${header}<div class="empty-state"><span aria-hidden="true">🌧️</span>${escapeHtml(t("garden.players_unavailable"))}</div>`;
  }
}

function renderPanelContent() {
  if (activePanel === "shop") renderShopPanel();
  else if (activePanel === "sell") renderSellPanel();
  else if (activePanel === "players") renderPlayersPanel();
}

function renderSheet() {
  const open = Boolean(activePanel) && !visiting;
  elements.sheet.hidden = !open;
  elements.scrim.hidden = !open;
  document.body.classList.toggle("sheet-open", open);
  if (open) {
    // Nach einem Kauf wird der Inhalt neu gebaut. Die Scrollposition bleibt
    // dabei erhalten, sonst springt die Samenliste bei jedem Klick nach oben.
    const keepScroll = renderedPanel === activePanel;
    const scrollTop = keepScroll ? elements.panelContent.scrollTop : 0;
    renderPanelContent();
    renderedPanel = activePanel;
    elements.panelContent.scrollTop = scrollTop;
  } else {
    elements.panelContent.textContent = "";
    renderedPanel = null;
  }
  renderBuildingLabels();
}

function setPanel(panel) {
  if (visiting) return;
  activePanel = activePanel === panel ? null : panel;
  renderSheet();
}

function closeSheet() {
  activePanel = null;
  renderSheet();
}

function renderAll() {
  renderTopbar();
  renderBeds();
  renderSheet();
  document.body.classList.toggle("reduce-motion", Boolean(state.settings.reducedMotion));
  elements.reducedMotion.checked = Boolean(state.settings.reducedMotion);
  elements.saveModeText.textContent = saveMode === "cloud" ? t("garden.cloud_save") : t("garden.local_save");
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    try {
      await savePlayerData(state);
    } catch (error) {
      console.error("Garden save failed:", error);
      showToast(t("garden.errors.save"));
    }
  }, 350);
}

/* ------------------------------------------------------------- Spiellogik */

function openSeedInventory(fieldId) {
  selectedFieldId = fieldId;
  const cards = PLANT_ORDER.filter((plantId) => (state.inventories.seeds[plantId] || 0) > 0).map((plantId) => {
    const plant = PLANTS[plantId];
    const count = state.inventories.seeds[plantId] || 0;
    const yieldText = plant.yieldMin === plant.yieldMax ? String(plant.yieldMin) : `${plant.yieldMin}–${plant.yieldMax}`;
    return `<article class="seed-card">${cropIconMarkup(plantId)}<div class="product-info"><span class="rarity rarity-${plant.rarity}">${escapeHtml(rarityName(plant.rarity))}</span><h3>${escapeHtml(plantName(plantId))}</h3><p class="product-meta"><span>${escapeHtml(t("garden.owned", { value: count }))}</span><span>${escapeHtml(formatDuration(plant.growthSeconds * 1000))}</span><span>${escapeHtml(t("garden.expected_yield", { value: yieldText }))}</span></p></div><div class="card-actions"><button class="primary-button plant-seed" data-plant="${plantId}" type="button">${escapeHtml(t("garden.plant"))}</button></div></article>`;
  }).join("");
  elements.seedList.innerHTML = cards || `<div class="empty-state"><span aria-hidden="true">🫘</span>${escapeHtml(t("garden.no_seeds"))}</div>`;
  elements.seedDialog.showModal();
  renderBeds();
}

function plantSeed(plantId) {
  const field = state.fields[selectedFieldId];
  const plant = PLANTS[plantId];
  if (!field || field.state !== "empty" || !plant || (state.inventories.seeds[plantId] || 0) < 1) return;
  const now = Date.now();
  state.inventories.seeds[plantId] -= 1;
  Object.assign(field, {
    state: "growing",
    plantId,
    plantedAt: now,
    readyAt: now + plant.growthSeconds * 1000,
    lastHarvestAt: null,
    nextHarvestAt: null,
  });
  elements.seedDialog.close();
  showToast(t("garden.planted", { plant: plantName(plantId) }));
  renderAll();
  scheduleSave();
}

function randomYield(plant) {
  return plant.yieldMin + Math.floor(Math.random() * (plant.yieldMax - plant.yieldMin + 1));
}

function harvestField(fieldId) {
  const field = state.fields[fieldId];
  const plant = PLANTS[field?.plantId];
  if (!plant || field.state !== "ready") return;
  const amount = randomYield(plant);
  state.inventories.harvests[plant.productId] = (state.inventories.harvests[plant.productId] || 0) + amount;
  state.stats.totalHarvested += amount;
  addExperience(state, amount * (RARITIES.indexOf(plant.rarity) + 1));
  state.fields[fieldId] = emptyField(fieldId);
  showToast(t("garden.harvested", { amount, product: productName(plant.productId) }));
  renderAll();
  scheduleSave();
}

function buySeed(plantId) {
  const plant = PLANTS[plantId];
  if (!plant || state.coins < plant.seedPrice || (state.shop.stock[plantId] || 0) < 1) return;
  state.coins -= plant.seedPrice;
  state.shop.stock[plantId] -= 1;
  state.inventories.seeds[plantId] = (state.inventories.seeds[plantId] || 0) + 1;
  showToast(t("garden.bought_seed", { plant: plantName(plantId) }));
  renderAll();
  scheduleSave();
}

function buyShovel() {
  if (state.coins < TOOLS.shovel.price) return;
  state.coins -= TOOLS.shovel.price;
  state.inventories.tools.shovel = (state.inventories.tools.shovel || 0) + 1;
  showToast(t("garden.bought_shovel"));
  renderAll();
  scheduleSave();
}

function sellProduct(productId, amount) {
  const available = state.inventories.harvests[productId] || 0;
  const product = PRODUCTS[productId];
  const quantity = Math.min(available, Math.max(0, amount));
  if (!product || quantity < 1) return;
  const value = product.sellPrice * quantity;
  state.inventories.harvests[productId] -= quantity;
  state.coins += value;
  state.stats.totalSold += quantity;
  state.stats.totalCoinsEarned += value;
  showToast(t("garden.sold", { amount: quantity, value: formatNumber(value) }));
  renderAll();
  scheduleSave();
}

function sellEverything() {
  const entries = harvestEntries();
  const quantity = entries.reduce((sum, [, count]) => sum + count, 0);
  const value = entries.reduce((sum, [productId, count]) => sum + PRODUCTS[productId].sellPrice * count, 0);
  if (!quantity) return;
  for (const [productId] of entries) state.inventories.harvests[productId] = 0;
  state.coins += value;
  state.stats.totalSold += quantity;
  state.stats.totalCoinsEarned += value;
  showToast(t("garden.sold", { amount: quantity, value: formatNumber(value) }));
  renderAll();
  scheduleSave();
}

/** Zeigt Pflanze, Restzeit und die Schaufel-Option für ein wachsendes Beet. */
function openBedDialog(fieldId) {
  const field = state.fields[fieldId];
  if (!field || !PLANTS[field.plantId]) return;
  bedDialogFieldId = fieldId;
  elements.bedTitle.textContent = plantName(field.plantId);
  elements.bedRemove.disabled = false;
  elements.bedDialog.showModal();
  updateBedDialog();
  renderBeds();
}

function updateBedDialog() {
  if (bedDialogFieldId == null || !elements.bedDialog.open) return;
  const field = state.fields[bedDialogFieldId];
  if (!field || !PLANTS[field.plantId]) {
    elements.bedDialog.close();
    return;
  }
  const now = Date.now();
  const duration = Math.max(1, field.readyAt - field.plantedAt);
  const progress = Math.max(0, Math.min(1, (now - field.plantedAt) / duration));
  elements.bedProgress.style.width = `${(progress * 100).toFixed(2)}%`;
  elements.bedTime.textContent = field.state === "ready"
    ? t("garden.harvest_now")
    : t("garden.still_growing", { time: formatDuration(field.readyAt - now) });
}

function removePlant(fieldId) {
  const field = state.fields[fieldId];
  if (!field || field.state === "empty" || !PLANTS[field.plantId]) return;
  if ((state.inventories.tools.shovel || 0) < 1) {
    showToast(t("garden.need_shovel"));
    shopTab = "tools";
    activePanel = "shop";
    renderSheet();
    return;
  }
  state.inventories.tools.shovel -= 1;
  state.fields[fieldId] = emptyField(fieldId);
  showToast(t("garden.removed"));
  renderAll();
  scheduleSave();
}

async function visitFarm(playerId) {
  elements.loader.classList.remove("is-done");
  try {
    const farm = await loadFarmSnapshot(playerId);
    if (!farm?.farm_snapshot?.fields) throw new Error("missing snapshot");
    visiting = farm;
    activePanel = null;
    renderAll();
  } catch (error) {
    console.error("Farm visit failed:", error);
    showToast(t("garden.visit_failed"));
  } finally {
    elements.loader.classList.add("is-done");
  }
}

function returnHome() {
  visiting = null;
  activePanel = null;
  renderAll();
}

/* --------------------------------------------------------------- Ereignisse */

elements.layer.addEventListener("click", (event) => {
  const buildingButton = event.target.closest("[data-panel]");
  if (buildingButton) {
    setPanel(buildingButton.dataset.panel);
    return;
  }
  const bedButton = event.target.closest("[data-field-id]");
  if (!bedButton || visiting) return;
  const fieldId = Number(bedButton.dataset.fieldId);
  const field = state.fields[fieldId];
  if (!field) return;
  if (field.state === "empty") openSeedInventory(fieldId);
  else if (field.state === "ready") harvestField(fieldId);
  else openBedDialog(fieldId);
});

elements.backButton.addEventListener("click", returnHome);
elements.panelClose.addEventListener("click", closeSheet);
elements.scrim.addEventListener("click", closeSheet);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !activePanel) return;
  if (elements.seedDialog.open || elements.bedDialog.open || elements.settingsDialog.open) return;
  closeSheet();
});

elements.seedList.addEventListener("click", (event) => {
  const button = event.target.closest(".plant-seed");
  if (button) plantSeed(button.dataset.plant);
});

// Das Formular im Dialog schließt ihn beim Klick von selbst; das Entfernen
// hängt deshalb am Klick und nicht am Rückgabewert des Dialogs.
elements.bedRemove.addEventListener("click", () => {
  if (bedDialogFieldId != null) removePlant(bedDialogFieldId);
});

elements.panelContent.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-shop-tab]");
  if (tab) { shopTab = tab.dataset.shopTab; renderShopPanel(); return; }
  const seed = event.target.closest(".buy-seed");
  if (seed) { buySeed(seed.dataset.plant); return; }
  if (event.target.closest(".buy-tool")) { buyShovel(); return; }
  const sellOne = event.target.closest(".sell-one");
  if (sellOne) { sellProduct(sellOne.dataset.product, 1); return; }
  const sellStack = event.target.closest(".sell-stack");
  if (sellStack) { sellProduct(sellStack.dataset.product, state.inventories.harvests[sellStack.dataset.product] || 0); return; }
  if (event.target.closest(".sell-all")) { sellEverything(); return; }
  const visitor = event.target.closest(".visit-player");
  if (visitor) visitFarm(visitor.dataset.player);
});

elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
elements.reducedMotion.addEventListener("change", () => {
  state.settings.reducedMotion = elements.reducedMotion.checked;
  document.body.classList.toggle("reduce-motion", state.settings.reducedMotion);
  scheduleSave();
});

onLanguageChange(() => {
  if (!state) return;
  renderBuildingLabels();
  renderAll();
});

/**
 * Neu ausmessen. Nach einer Bildschirmdrehung meldet der Browser die neuen
 * Maße nicht sofort, deshalb wird dort mehrfach nachgemessen und der Cache
 * verworfen — der Zaun landet dadurch immer wieder mittig im Bild.
 */
function requestLayout(force = false) {
  if (force) worldLayout = "";
  window.clearTimeout(layoutTimer);
  // Bewusst kein requestAnimationFrame: in einem Hintergrund-Tab wird das nicht
  // ausgeführt, und dann käme die Seite beim Zurückwechseln falsch vermessen an.
  layoutTimer = window.setTimeout(layoutWorld, 0);
}

window.addEventListener("resize", () => requestLayout());
window.visualViewport?.addEventListener("resize", () => requestLayout());
window.addEventListener("orientationchange", () => {
  requestLayout(true);
  window.setTimeout(() => requestLayout(true), 150);
  window.setTimeout(() => requestLayout(true), 500);
});

window.setInterval(() => {
  if (!state) return;
  const result = advanceState(state);
  if (result.changed) {
    showToast(t("garden.something_ready"));
    scheduleSave();
  }
  renderBeds();
  updateBedDialog();
  const restockTimer = document.getElementById("restock-timer");
  if (restockTimer) restockTimer.textContent = formatDuration(state.shop.nextRestockAt - Date.now());
}, 1000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state) savePlayerData(state).catch(() => {});
  // Beim Zurückwechseln neu vermessen: im Hintergrund gedrehte Geräte melden
  // die neuen Maße erst jetzt zuverlässig.
  else if (document.visibilityState === "visible") requestLayout(true);
});

async function boot() {
  await i18nReady;
  const [loaded, images] = await Promise.all([
    initializeStorage(),
    loadWorldAssets().catch((error) => {
      console.error("KaktusGarden tiles failed:", error);
      return null;
    }),
  ]);
  state = loaded.state;
  user = loaded.user;
  profile = loaded.profile;
  saveMode = loaded.mode.startsWith("cloud") ? "cloud" : "local";
  worldImages = images;

  buildWorldOverlay();
  layoutWorld();
  renderAll();
  elements.loader.classList.add("is-done");
  // Legt beim ersten Öffnen eines angemeldeten Spielers direkt den Save an.
  // Dadurch erscheint er in der Besuchsliste, auch bevor er das erste Beet nutzt.
  scheduleSave();
}

boot().catch((error) => {
  console.error("KaktusGarden boot failed:", error);
  elements.loader.classList.add("is-done");
  showToast(t("garden.errors.load"));
});
