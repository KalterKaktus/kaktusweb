import {
  ensureKaktusSeason,
  fetchLeaderboard,
  getGameProfile,
  getGameSession,
  getMonthlyLeaderboardPeriod,
  loadCloudSave,
  pushCloudSave,
  signOutGameSession,
} from "/js/game-cloud.js";
import { getSupabase, isConfigReady } from "/js/supabase-client.js";
import { addPendingXp, setXpUser } from "/js/xp-service.js";
import { renderLevelTag, renderPlayerName } from "/js/progression.js";
import { achievements, buildings, changelogEntries, upgrades } from "./data.js";
import {
  CLICK_FRENZY_TARGET,
  getAchievementMultiplier,
  getAutoClickRate,
  getAutomaticProduction,
  getBuildingCost,
  getBuildingProduction,
  getClickYield,
  getNewNopal,
  getNopalGap,
  getPrestigeMultiplier,
  getUpgradeMultipliers,
  isClickFrenzyActive,
  totalBuildings,
} from "./economy.js";
import { formatDuration, formatNumber } from "./format.js";
import { createInitialState, normalizeLoadedState, resetRunForPrestige } from "./state.js";
import { t, onLanguageChange, getLanguage } from "/js/i18n.js";

function tName(item, category) {
    const key = `clicker.${category}.${item.id}.name`;
    const value = t(key);
    if (value !== key) return value;
    // Generierte Upgrades: dynamisch aus dem Building-Namen zusammensetzen.
    // Tier-Upgrades (V3) nutzen clicker.upgrade_tier_<N>, Core-Upgrades das
    // bestehende clicker.upgrade_core_suffix.
    if (category === "upgrades" && item.buildingId) {
        const bKey = `clicker.buildings.${item.buildingId}.name`;
        const bValue = t(bKey);
        if (bValue !== bKey) {
            if (item.tier) {
                const tierKey = `clicker.upgrade_tier_${item.tier}`;
                const tierValue = t(tierKey, { name: bValue });
                if (tierValue !== tierKey) return tierValue;
            } else {
                return t("clicker.upgrade_core_suffix", { name: bValue });
            }
        }
    }
    return item.name;
}
function tDesc(item, category) {
    const key = `clicker.${category}.${item.id}.description`;
    const value = t(key);
    if (value !== key) return value;
    if (category === "upgrades" && item.buildingId) {
        const bKey = `clicker.buildings.${item.buildingId}.name`;
        const bValue = t(bKey);
        if (bValue !== bKey) return t("clicker.upgrade_prod_x2", { name: bValue });
    }
    return item.description || item.goal || "";
}
function tGoal(item) {
    const key = `clicker.achievements.${item.id}.goal`;
    const value = t(key);
    return value === key ? (item.goal || "") : value;
}
function tSaveLabel(label) {
    const map = {
        "Gespeichert": "clicker.save_saved",
        "Zurückgesetzt": "clicker.save_reset",
        "Prestige gespeichert": "clicker.save_prestige",
        "Offline Fortschritt eingesammelt": "clicker.save_offline",
        "Goldlauf aktiv": "clicker.frenzy_active",
        "Monatssaison resettet": "clicker.save_season_reset",
    };
    const key = map[label];
    return key ? t(key) : label;
}

const STORAGE_KEY = "kaktus-clicker-save-v1";
const CLICK_FRENZY_MS = 30000;
const OFFLINE_LIMIT_SECONDS = 12 * 60 * 60;
const OFFLINE_MIN_SECONDS = 5 * 60;
const OFFLINE_RATE = 0.5;
// Economy V3: Events geben mehr (600 s / 2 h Produktion) und kommen öfter.
const GOLDEN_REWARD_SECONDS = 600;
const RED_REWARD_SECONDS = 7200;
const GOLDEN_EVENT_DELAY = [60 * 1000, 2.5 * 60 * 1000];
const RED_EVENT_DELAY = [6 * 60 * 1000, 14 * 60 * 1000];
// Autoklicker gelten nur beim aktiven Spielen: Tab sichtbar UND echte Eingabe
// innerhalb dieses Fensters. Verhindert, dass ein offener Tab über Nacht als
// "aktiv" durchgeht — genau das war der Grund, warum Auto-Collect rausflog.
const AUTO_CLICK_ACTIVE_WINDOW_MS = 15000;
const AUTO_CLICK_TICK_MS = 500;
const ADMIN_GAME_EVENT_POLL_MS = 2500;
const RANDOM_EVENT_CONFIG = {
  golden: { duration: 10000, rewardSeconds: GOLDEN_REWARD_SECONDS, label: "Goldkaktus" },
  red: { duration: 10000, rewardSeconds: RED_REWARD_SECONDS, label: "Rubinkaktus" },
};

let state = createInitialState(getMonthlyLeaderboardPeriod().id);
let cloudSync = { enabled: false, user: null };
let cloudSaveTimer = null;
let leaderboardLoaded = false;
let frenzyMeterFrame = null;
let viewportRecoveryTimer = null;
let adminEventPollTimer = null;
let adminGameEventsPrimed = false;
const activeRandomEvents = new Map();
const seenAdminGameEventIds = new Set();

// Audio wurde mit dem Cozy-Redesign komplett entfernt (Musik, Effekte, AudioContext
// und die Lautstärkeregler). Die alten Dateien passten stilistisch nicht mehr und
// waren mit 5 MB das mit Abstand schwerste Asset des Spiels. Neue, zum Look passende
// Sounds kommen später — dann wieder mit eigenem Unlock über einen AudioContext.

const elements = {
  cactusCount: document.querySelector("#cactus-count"),
  cactusRate: document.querySelector("#cactus-rate"),
  clickPower: document.querySelector("#click-power"),
  achievementMultiplier: document.querySelector("#achievement-multiplier"),
  scorePrestigeMultiplier: document.querySelector("#score-prestige-multiplier"),
  scoreFrenzyMultiplier: document.querySelector("#score-frenzy-multiplier"),
  cactusButton: document.querySelector("#cactus-button"),
  clickZone: document.querySelector(".click-zone"),
  buildingList: document.querySelector("#building-list"),
  upgradeList: document.querySelector("#upgrade-list"),
  totalEarned: document.querySelector("#total-earned"),
  totalClicks: document.querySelector("#total-clicks"),
  totalBuildings: document.querySelector("#total-buildings"),
  totalUpgrades: document.querySelector("#total-upgrades"),
  achievementList: document.querySelector("#achievement-list"),
  saveStatus: document.querySelector("#save-status"),
  saveButton: document.querySelector("#save-button"),
  changelogButton: document.querySelector("#changelog-button"),
  resetButton: document.querySelector("#reset-button"),
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".tab-panel"),
  scoreCard: document.querySelector(".score-card"),
  frenzyBadge: document.querySelector("#frenzy-badge"),
  eventMeter: document.querySelector("#event-meter"),
  eventMeterLabel: document.querySelector("#event-meter-label"),
  eventMeterValue: document.querySelector("#event-meter-value"),
  eventMeterFill: document.querySelector("#event-meter-fill"),
  hudNopal: document.querySelector("#hud-nopal"),
  prestigeNopal: document.querySelector("#prestige-nopal"),
  prestigeBonus: document.querySelector("#prestige-bonus"),
  prestigeNewNopal: document.querySelector("#prestige-new-nopal"),
  prestigeNextBonus: document.querySelector("#prestige-next-bonus"),
  prestigeGap: document.querySelector("#prestige-gap"),
  prestigeCount: document.querySelector("#prestige-count"),
  prestigeButton: document.querySelector("#prestige-button"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  leaderboardHint: document.querySelector("#leaderboard-hint"),
  leaderboardReset: document.querySelector("#leaderboard-reset"),
  leaderboardLastMonthList: document.querySelector("#leaderboard-last-month-list"),
};

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}


function setClickerViewportHeight() {
  const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  if (height > 0) {
    document.documentElement.style.setProperty("--clicker-viewport-height", `${height}px`);
  }
}

function recoverClickerViewport() {
  window.clearTimeout(viewportRecoveryTimer);
  setClickerViewportHeight();
  viewportRecoveryTimer = window.setTimeout(() => {
    setClickerViewportHeight();
    elements.clickZone?.getBoundingClientRect();
  }, 260);
}

function tryLockPortraitOrientation() {
  if (!window.matchMedia("(display-mode: standalone)").matches || !screen.orientation?.lock) {
    return;
  }

  screen.orientation.lock("portrait").catch(() => {
    // Browsers may reject orientation locks for a web app.
  });
}

function getIdleSaveLabel() {
  return cloudSync.enabled ? t("clicker.save_status_cloud") : t("clicker.save_status_local");
}

function scheduleCloudSave() {
  if (!cloudSync.enabled || !cloudSync.user) {
    return;
  }

  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(async () => {
    const result = await pushCloudSave(cloudSync.user, state);
    if (result?.error) {
      elements.saveStatus.textContent = "Cloud-Fehler";
      console.error(result.error.message);
      return;
    }

    elements.saveStatus.textContent = "Cloud gespeichert";
    window.setTimeout(() => {
      elements.saveStatus.textContent = getIdleSaveLabel();
    }, 1300);
  }, 900);
}

function saveState(label = "Gespeichert") {
  const now = Date.now();
  state.lastSavedAt = now;
  state.lastOnlineTimestamp = now;
  const translated = tSaveLabel(label);
  elements.saveStatus.textContent = translated;

  if (cloudSync.enabled) {
    scheduleCloudSave();
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  window.setTimeout(() => {
    if (elements.saveStatus.textContent === translated) {
      elements.saveStatus.textContent = getIdleSaveLabel();
    }
  }, 1300);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showGameModal({ title, message = "", bodyHtml = "", buttonLabel = "Okay", onConfirm, tone = "" }) {
  document.querySelector(".game-modal-backdrop")?.remove();
  const backdrop = document.createElement("div");
  backdrop.className = `game-modal-backdrop ${tone}`.trim();
  backdrop.innerHTML = `
    <section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
      <h2 id="game-modal-title">${escapeHtml(title)}</h2>
      ${message ? `<p>${escapeHtml(message)}</p>` : ""}
      ${bodyHtml}
      <button class="cozy-button game-modal-button" type="button">${escapeHtml(buttonLabel)}</button>
    </section>
  `;
  backdrop.querySelector("button")?.addEventListener("click", () => {
    onConfirm?.();
    backdrop.remove();
  });
  document.body.append(backdrop);
}

function showChangelog() {
  showGameModal({
    title: t("clicker.changelog_title"),
    bodyHtml: `
      <div class="changelog-entries">
        ${changelogEntries.map((entry) => {
          // entry.ru trägt die russische Variante; fehlt sie → deutscher Fallback.
          const view = getLanguage() === "ru" && entry.ru ? entry.ru : entry;
          return `
          <section class="changelog-entry">
            <p class="changelog-date">${escapeHtml(entry.date)}</p>
            <h3>${escapeHtml(view.title)}</h3>
            <ul class="changelog-list">
              ${view.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </section>
        `;
        }).join("")}
      </div>
    `,
  });
}

function addCactus(amount) {
  const value = Math.max(0, Number(amount) || 0);
  state.cactus += value;
  state.totalEarned += value;
}

function updateAchievements() {
  const unlocked = [];
  for (const achievement of achievements) {
    if (!state.achievements.includes(achievement.id) && achievement.test(state)) {
      state.achievements.push(achievement.id);
      unlocked.push(tName(achievement, "achievements"));
    }
  }

  if (unlocked.length) {
    elements.saveStatus.textContent = t("clicker.achievement_toast", { name: unlocked.at(-1) });
  }

  return unlocked.length > 0;
}

function getUpgrade(id) {
  return upgrades.find((upgrade) => upgrade.id === id);
}

function clickCactus(event) {
  const earned = getClickYield(state);
  addCactus(earned);
  state.totalClicks += 1;
  lastRealInputAt = Date.now();
  // XP: alle 100 Clicks = 1 XP (sehr gemächlich, dafür konstant beim Spielen).
  // Spike-XP gibt's beim Prestige.
  if (state.totalClicks % 100 === 0) addPendingXp(1, "clicker-click");
  chargeClickFrenzy();
  spawnFloat(event.clientX, event.clientY, `+${formatNumber(earned)}`);
  const achievementChanged = updateAchievements();
  renderGameplayHud({ achievementChanged });
}

// --- Autoklicker (Economy V3) -----------------------------------------------
// Klicken automatisch mit, aber NUR beim aktiven Spielen: Tab sichtbar und
// echte Eingabe in den letzten AUTO_CLICK_ACTIVE_WINDOW_MS. Sie erzeugen
// Klick-Ertrag und laden den Goldlauf, erhöhen aber bewusst NICHT totalClicks:
// Klick-Abzeichen und Klick-XP bleiben Handarbeit, und der XP-Durchsatz zum
// Server ändert sich nicht.
let lastRealInputAt = 0;
let autoClickCarry = 0;

function isActivelyPlaying(now = Date.now()) {
  return !document.hidden && now - lastRealInputAt < AUTO_CLICK_ACTIVE_WINDOW_MS;
}

function runAutoClicks() {
  const rate = getAutoClickRate(state);
  if (!rate || !isActivelyPlaying()) {
    autoClickCarry = 0;
    return;
  }

  // Bruchteile sammeln, damit auch krumme Raten (2/s bei 500-ms-Takt) exakt sind.
  autoClickCarry += rate * (AUTO_CLICK_TICK_MS / 1000);
  const whole = Math.floor(autoClickCarry);
  if (whole <= 0) {
    return;
  }
  autoClickCarry -= whole;

  const earned = getClickYield(state) * whole;
  addCactus(earned);
  for (let i = 0; i < whole; i += 1) {
    chargeClickFrenzy();
  }
  // Ein Sammel-Float am Kaktus statt einem pro Auto-Klick — bei 20/s würden
  // einzelne Floats das DOM fluten.
  const rect = elements.cactusButton.getBoundingClientRect();
  spawnFloat(
    rect.left + rect.width * (0.35 + Math.random() * 0.3),
    rect.top + rect.height * (0.25 + Math.random() * 0.3),
    `+${formatNumber(earned)}`,
    "is-auto"
  );
  const achievementChanged = updateAchievements();
  renderGameplayHud({ achievementChanged });
}

function chargeClickFrenzy() {
  if (isClickFrenzyActive(state)) {
    return;
  }

  state.events.clickCharge = Math.min(CLICK_FRENZY_TARGET, state.events.clickCharge + 1);
  if (state.events.clickCharge < CLICK_FRENZY_TARGET) {
    return;
  }

  state.events.clickCharge = 0;
  state.events.frenzyUntil = Date.now() + CLICK_FRENZY_MS;
  state.events.frenzies += 1;
  elements.saveStatus.textContent = t("clicker.frenzy_active");
  startFrenzyMeterLoop();
}

function spawnFloat(x, y, text, className = "") {
  const pop = document.createElement("span");
  pop.className = `float-pop ${className}`.trim();
  pop.textContent = text;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.append(pop);
  pop.addEventListener("animationend", () => pop.remove(), { once: true });
}

function buyBuilding(id) {
  const building = buildings.find((item) => item.id === id);
  if (!building) {
    return;
  }

  const cost = getBuildingCost(state, building);
  if (state.cactus < cost) {
    return;
  }

  state.cactus -= cost;
  state.buildings[id] += 1;
  updateAchievements();
  render();
}

function isUpgradeUnlocked(upgrade) {
  // Tier-Upgrades erscheinen erst ab der Besitz-Schwelle ihres Gebäudes.
  return !upgrade.unlockOwned || (state.buildings[upgrade.buildingId] || 0) >= upgrade.unlockOwned;
}

function buyUpgrade(id) {
  const upgrade = getUpgrade(id);
  if (!upgrade || state.upgrades.includes(id) || state.cactus < upgrade.cost || !isUpgradeUnlocked(upgrade)) {
    return;
  }

  state.cactus -= upgrade.cost;
  state.upgrades.push(id);
  updateAchievements();
  render();
}

function performPrestige() {
  const newNopal = getNewNopal(state);
  if (newNopal <= 0) {
    return;
  }

  const confirmed = window.confirm(
    t("clicker.prestige_confirm_body", { nopal: formatNumber(newNopal) })
  );
  if (!confirmed) {
    return;
  }

  state.prestige.nopal += newNopal;
  state.prestige.totalNopalEarned += newNopal;
  state.prestige.prestiges += 1;
  resetRunForPrestige(state);
  ensureRandomEventSchedules();
  updateAchievements();
  // XP für Prestige (skaliert mit erworbenen Nopals — größere Prestiges geben mehr XP).
  addPendingXp(100 + Math.min(900, Math.floor(newNopal * 5)), "clicker-prestige");
  saveState("Prestige gespeichert");
  render();
}

function renderShop() {
  elements.buildingList.innerHTML = buildings.map((building) => {
    const cost = getBuildingCost(state, building);
    const owned = state.buildings[building.id];
    const disabled = state.cactus < cost ? "disabled" : "";
    return `
      <button class="shop-item" type="button" data-building="${building.id}" ${disabled}>
        <span class="item-icon" aria-hidden="true">${escapeHtml(building.icon)}</span>
        <span class="item-body">
          <span class="item-name">${escapeHtml(tName(building, "buildings"))}</span>
          <span class="item-description">${escapeHtml(tDesc(building, "buildings"))}</span>
          <span class="item-meta">${formatNumber(getBuildingProduction(state, building))}${escapeHtml(t("clicker.per_sec_short"))} · ${escapeHtml(t("clicker.owned_short"))}: ${formatNumber(owned)}</span>
        </span>
        <span class="item-price">${formatNumber(cost)}</span>
      </button>
    `;
  }).join("");
}

function renderUpgrades() {
  // Gekaufte raus, verriegelte Tier-Upgrades raus — sonst stünden ab Tag 1
  // über 150 Einträge in der Liste. Sortierung nach Preis: das nächste
  // erreichbare Ziel steht oben.
  const visibleUpgrades = upgrades
    .filter((upgrade) => !state.upgrades.includes(upgrade.id) && isUpgradeUnlocked(upgrade))
    .sort((a, b) => a.cost - b.cost);
  elements.upgradeList.innerHTML = visibleUpgrades.length
    ? visibleUpgrades.map((upgrade) => {
      const disabled = state.cactus < upgrade.cost ? "disabled" : "";
      return `
        <button class="shop-item is-upgrade" type="button" data-upgrade="${upgrade.id}" ${disabled}>
          <span class="item-icon" aria-hidden="true">${escapeHtml(upgrade.icon)}</span>
          <span class="item-body">
            <span class="item-name">${escapeHtml(tName(upgrade, "upgrades"))}</span>
            <span class="item-description">${escapeHtml(tDesc(upgrade, "upgrades"))}</span>
          </span>
          <span class="item-price">${formatNumber(upgrade.cost)}</span>
        </button>
      `;
    }).join("")
    : `<p class="item-description">${escapeHtml(t("clicker.all_upgrades_bought"))}</p>`;
}

function syncPurchaseAffordability() {
  elements.buildingList.querySelectorAll("[data-building]").forEach((button) => {
    const building = buildings.find((item) => item.id === button.dataset.building);
    if (building) {
      button.disabled = state.cactus < getBuildingCost(state, building);
    }
  });

  elements.upgradeList.querySelectorAll("[data-upgrade]").forEach((button) => {
    const upgrade = getUpgrade(button.dataset.upgrade);
    if (upgrade) {
      button.disabled = state.cactus < upgrade.cost;
    }
  });
}

function renderAchievements() {
  elements.achievementList.innerHTML = achievements.map((achievement) => {
    const unlocked = state.achievements.includes(achievement.id);
    return `
      <div class="achievement ${unlocked ? "is-unlocked" : ""}">
        <span class="achievement-mark" aria-hidden="true">${unlocked ? "✓" : ""}</span>
        <span class="achievement-copy">
          <strong>${escapeHtml(tName(achievement, "achievements"))}</strong>
          <small>${escapeHtml(tGoal(achievement))}</small>
        </span>
        <span class="achievement-reward">${unlocked ? "+0,1x" : escapeHtml(t("clicker.achievement_open"))}</span>
      </div>
    `;
  }).join("");
}

function renderStatsOnly() {
  elements.cactusCount.textContent = formatNumber(state.cactus);
  elements.cactusRate.textContent = formatNumber(getAutomaticProduction(state));
  elements.clickPower.textContent = formatNumber(getClickYield(state));
  elements.hudNopal.textContent = formatNumber(state.prestige.nopal);
  elements.achievementMultiplier.textContent = `x${formatNumber(getAchievementMultiplier(state))}`;
  elements.scorePrestigeMultiplier.textContent = `x${formatNumber(getPrestigeMultiplier(state))}`;
  elements.totalEarned.textContent = formatNumber(state.totalEarned);
  elements.totalClicks.textContent = formatNumber(state.totalClicks);
  elements.totalBuildings.textContent = formatNumber(totalBuildings(state));
  elements.totalUpgrades.textContent = formatNumber(state.upgrades.length);
}

function renderPrestige() {
  const newNopal = getNewNopal(state);
  const nextPrestigeMultiplier = getPrestigeMultiplier({
    ...state,
    prestige: {
      ...state.prestige,
      nopal: state.prestige.nopal + newNopal,
    },
  });
  elements.prestigeNopal.textContent = formatNumber(state.prestige.nopal);
  elements.prestigeBonus.textContent = `x${formatNumber(getPrestigeMultiplier(state))}`;
  elements.prestigeNewNopal.textContent = formatNumber(newNopal);
  elements.prestigeNextBonus.textContent = `x${formatNumber(nextPrestigeMultiplier)}`;
  elements.prestigeGap.textContent = formatNumber(getNopalGap(state));
  elements.prestigeCount.textContent = formatNumber(state.prestige.prestiges);
  elements.prestigeButton.disabled = newNopal <= 0;
}

function renderEventMeter(now = Date.now()) {
  const active = isClickFrenzyActive(state, now);
  const remainingMs = Math.max(0, state.events.frenzyUntil - now);
  const fill = active
    ? (remainingMs / CLICK_FRENZY_MS) * 100
    : (state.events.clickCharge / CLICK_FRENZY_TARGET) * 100;

  elements.eventMeterFill.style.width = `${Math.min(100, Math.max(0, fill))}%`;
  elements.eventMeterLabel.textContent = active ? t("clicker.frenzy_active") : t("clicker.frenzy_charging");
  elements.eventMeterValue.textContent = active
    ? `${formatDuration(remainingMs / 1000)} x3`
    : t("clicker.frenzy_progress", {
      value: formatNumber(state.events.clickCharge),
      target: formatNumber(CLICK_FRENZY_TARGET),
    });
  elements.frenzyBadge.hidden = !active;
  elements.scoreFrenzyMultiplier.hidden = !active;
  elements.scoreCard.classList.toggle("is-frenzy", active);
  elements.cactusButton.classList.toggle("is-frenzy", active);
  elements.eventMeter.classList.toggle("is-frenzy", active);
}

function startFrenzyMeterLoop() {
  if (frenzyMeterFrame) {
    return;
  }

  const tick = () => {
    renderEventMeter();
    if (isClickFrenzyActive(state)) {
      frenzyMeterFrame = window.requestAnimationFrame(tick);
      return;
    }

    frenzyMeterFrame = null;
    renderStatsOnly();
  };

  frenzyMeterFrame = window.requestAnimationFrame(tick);
}

function renderGameplayHud({ achievementChanged = false } = {}) {
  renderStatsOnly();
  syncPurchaseAffordability();
  renderPrestige();
  renderEventMeter();

  if (achievementChanged) {
    renderAchievements();
  }
}

function render() {
  renderStatsOnly();
  renderShop();
  renderUpgrades();
  renderAchievements();
  renderPrestige();
  renderEventMeter();
}

// Produktion nach echt verstrichener Zeit statt "1 Sekunde pro Tick":
// Browser drosseln setInterval in Hintergrund-Tabs auf ~1 Tick/Minute — vorher
// bekam ein offener Hintergrund-Tab dadurch nur ~2 % der Produktion (schlechter
// als die 50 % offline!). Cap 300 s: längere Lücken (Tab eingefroren, Rechner
// im Standby) gehören dem Offline-Ertrag, nicht dem Live-Ticker.
let lastProductionTickAt = Date.now();

function payProduction() {
  const now = Date.now();
  const dt = Math.min(300, Math.max(0, (now - lastProductionTickAt) / 1000));
  lastProductionTickAt = now;
  const production = getAutomaticProduction(state);
  if (production > 0 && dt > 0) {
    addCactus(production * dt);
    const achievementChanged = updateAchievements();
    renderGameplayHud({ achievementChanged });
  } else {
    renderEventMeter();
  }
}

function formatLeaderboardCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ru = getLanguage() === "ru";
  const [d, h, m, s] = ru ? ["д", "ч", "м", "с"] : ["T", "h", "m", "s"];
  return `${days}${d} ${String(hours).padStart(2, "0")}${h} ${String(minutes).padStart(2, "0")}${m} ${String(seconds).padStart(2, "0")}${s}`;
}

function updateLeaderboardResetCountdown() {
  const period = getMonthlyLeaderboardPeriod();
  if (state.season.id !== period.id) {
    if (cloudSync.enabled) {
      window.location.reload();
      return;
    }

    state = createInitialState(period.id);
    leaderboardLoaded = false;
    saveState("Monatssaison resettet");
    render();
  }

  elements.leaderboardReset.textContent = t("clicker.leaderboard_reset_countdown", {
    countdown: formatLeaderboardCountdown(period.nextResetAt.getTime() - Date.now()),
  });
}

async function renderLeaderboard(force = false) {
  if (!elements.leaderboardList || (leaderboardLoaded && !force)) {
    return;
  }

  elements.leaderboardList.innerHTML = `<p class="item-description">${escapeHtml(t("clicker.leaderboard_loading"))}</p>`;
  elements.leaderboardLastMonthList.innerHTML = `<p class="item-description">${escapeHtml(t("clicker.leaderboard_last_month_loading"))}</p>`;

  const { entries, previousTopThree, error } = await fetchLeaderboard();
  if (error) {
    elements.leaderboardList.innerHTML = `<p class="item-description">${escapeHtml(error.message)}</p>`;
    elements.leaderboardLastMonthList.innerHTML = `<p class="item-description">${escapeHtml(t("clicker.leaderboard_offline"))}</p>`;
    return;
  }

  leaderboardLoaded = true;
  renderLeaderboardRows(elements.leaderboardLastMonthList, previousTopThree || [], t("clicker.leaderboard_no_archive"));
  renderLeaderboardRows(elements.leaderboardList, entries || [], t("clicker.leaderboard_empty"));
  elements.leaderboardHint.textContent = cloudSync.enabled
    ? t("clicker.leaderboard_hint_signed")
    : t("clicker.leaderboard_hint_anon");
}

function renderLeaderboardRows(root, rows, emptyText) {
  root.innerHTML = rows.length
    ? rows.map((entry) => `
      <div class="leaderboard-row ${entry.rank <= 3 ? "is-top" : ""}">
        <span class="leaderboard-rank">#${entry.rank}</span>
        <span class="leaderboard-name">${renderLevelTag(entry.level || 0, entry.equippedBadge || null)}${renderPlayerName(escapeHtml(entry.name), { vip: entry.vip, vipColor: entry.vipColor })}</span>
        <span class="leaderboard-score">${formatNumber(entry.totalEarned ?? entry.score)}</span>
      </div>
    `).join("")
    : `<p class="item-description">${escapeHtml(emptyText)}</p>`;
}

function computeOfflineReward(now = Date.now()) {
  const seconds = Math.min(
    OFFLINE_LIMIT_SECONDS,
    Math.max(0, (now - Number(state.lastOnlineTimestamp || now)) / 1000)
  );
  const production = getAutomaticProduction(state, { includeEvent: false, now });
  const reward = production * OFFLINE_RATE * seconds;
  const fullOnlineReward = production * seconds;
  state.lastOnlineTimestamp = now;

  if (seconds < OFFLINE_MIN_SECONDS || reward <= 0) {
    return null;
  }

  return { seconds, reward, fullOnlineReward };
}

function showOfflineReward(reward) {
  showGameModal({
    title: t("clicker.offline_title"),
    tone: "is-offline",
    bodyHtml: `
      <p class="offline-note">${escapeHtml(t("clicker.offline_note"))}</p>
      <dl class="offline-reward">
        <div>
          <dt>${escapeHtml(t("clicker.offline_time"))}</dt>
          <dd>${escapeHtml(formatDuration(reward.seconds))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t("clicker.offline_reward"))}</dt>
          <dd>${escapeHtml(formatNumber(reward.reward))}</dd>
        </div>
        <div>
          <dt>${escapeHtml(t("clicker.offline_full"))}</dt>
          <dd>${escapeHtml(formatNumber(reward.fullOnlineReward))}</dd>
        </div>
      </dl>
    `,
    buttonLabel: t("clicker.offline_claim"),
    onConfirm: () => {
      addCactus(reward.reward);
      updateAchievements();
      render();
      saveState("Offline Fortschritt eingesammelt");
    },
  });
}

function randomDelay([min, max]) {
  return Math.floor(min + Math.random() * (max - min));
}

function scheduleNextRandomEvent(kind) {
  if (kind === "golden") {
    state.events.nextGoldenAt = randomDelay(GOLDEN_EVENT_DELAY);
  } else {
    state.events.nextRedAt = randomDelay(RED_EVENT_DELAY);
  }
}

function ensureRandomEventSchedules() {
  if (!state.events.nextGoldenAt || state.events.nextGoldenAt <= 0) {
    scheduleNextRandomEvent("golden");
  }

  if (!state.events.nextRedAt || state.events.nextRedAt <= 0) {
    scheduleNextRandomEvent("red");
  }
}

function restartRandomEventSchedules() {
  scheduleNextRandomEvent("golden");
  scheduleNextRandomEvent("red");
}

function checkRandomEvents() {
  if (document.hidden) {
    return;
  }

  state.events.nextGoldenAt -= 1000;
  state.events.nextRedAt -= 1000;

  if (!activeRandomEvents.has("golden") && state.events.nextGoldenAt <= 0) {
    spawnConfiguredRandomEvent("golden");
  }

  if (!activeRandomEvents.has("red") && state.events.nextRedAt <= 0) {
    spawnConfiguredRandomEvent("red");
  }
}

function pauseRandomEvents() {
  for (const [kind, entry] of activeRandomEvents.entries()) {
    window.clearTimeout(entry.timeout);

    if (entry.button) {
      entry.button.remove();
    }

    activeRandomEvents.delete(kind);
  }

  saveState("Random Events pausiert");
}

function spawnConfiguredRandomEvent(kind) {
  const config = RANDOM_EVENT_CONFIG[kind];
  if (!config || activeRandomEvents.has(kind)) {
    return;
  }

  spawnRandomEvent(kind, config.duration, config.rewardSeconds, config.label);
}

function showAdminToast(message) {
  const toast = document.createElement("div");
  toast.className = "admin-toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 5200);
}

function handleAdminGameEvent(row) {
  const expired = row?.expires_at && Date.parse(row.expires_at) <= Date.now();
  if (row?.id && seenAdminGameEventIds.has(row.id)) {
    return;
  }

  if (row?.id) {
    seenAdminGameEventIds.add(row.id);
  }

  if (document.hidden || !row || expired || row.game_id !== "kaktus-clicker") {
    return;
  }

  if (row.event_type === "spawn-goldkaktus") {
    spawnConfiguredRandomEvent("golden");
    showAdminToast("⚙ " + t("clicker.golden_admin_hint"));
  }

  if (row.event_type === "spawn-rubinkaktus") {
    spawnConfiguredRandomEvent("red");
    showAdminToast("⚙ " + t("clicker.red_admin_hint"));
  }

  if (row.event_type === "force-reload") {
    showAdminToast("⚙ " + t("clicker.new_version"));
    window.setTimeout(() => location.reload(), 1500);
  }
}

async function fetchLiveAdminGameEvents() {
  if (!isConfigReady()) {
    return [];
  }

  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("admin_game_events")
    .select("id,game_id,event_type,expires_at,created_at")
    .eq("game_id", "kaktus-clicker")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Admin-Events konnten nicht geladen werden:", error.message);
    return [];
  }

  return data || [];
}

async function primeAdminGameEvents() {
  const rows = await fetchLiveAdminGameEvents();
  rows.forEach((row) => {
    if (row.id) {
      seenAdminGameEventIds.add(row.id);
    }
  });
  adminGameEventsPrimed = true;
}

async function pollAdminGameEvents() {
  if (document.hidden) {
    return;
  }

  if (!adminGameEventsPrimed) {
    await primeAdminGameEvents();
    return;
  }

  const rows = await fetchLiveAdminGameEvents();
  rows.forEach(handleAdminGameEvent);
}

function restartAdminGameEventCursor() {
  adminGameEventsPrimed = false;
  primeAdminGameEvents();
}

function subscribeAdminGameEvents() {
  if (!isConfigReady()) {
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  supabase
    .channel("kaktus-clicker-admin-events")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "admin_game_events",
        filter: "game_id=eq.kaktus-clicker",
      },
      ({ new: row }) => handleAdminGameEvent(row)
    )
    .subscribe();

  restartAdminGameEventCursor();
  window.clearInterval(adminEventPollTimer);
  adminEventPollTimer = window.setInterval(pollAdminGameEvents, ADMIN_GAME_EVENT_POLL_MS);
}

function positionRandomEventOverCactus(button) {
  const zone = elements.clickZone.getBoundingClientRect();
  const cactus = elements.cactusButton.getBoundingClientRect();
  const cactusX = cactus.left - zone.left;
  const cactusY = cactus.top - zone.top;
  const x = cactusX + cactus.width * (0.26 + Math.random() * 0.48);
  const y = cactusY + cactus.height * (0.18 + Math.random() * 0.56);
  const edge = 48;

  button.style.left = `${Math.min(Math.max(edge, x), Math.max(edge, zone.width - edge))}px`;
  button.style.top = `${Math.min(Math.max(edge, y), Math.max(edge, zone.height - edge))}px`;
}

function spawnRandomEvent(kind, duration, rewardSeconds, label) {
  const button = document.createElement("button");
  const shrinkSeconds = duration / 1000;
  button.className = `random-event-cactus is-${kind}`;
  button.type = "button";
  button.style.setProperty("--event-life", `${shrinkSeconds}s`);
  button.setAttribute("aria-label", `${label} fangen`);
  // Der Spiel-Kaktus selbst, per CSS-Filter gold bzw. rot getönt — Spieler
  // erkennen sofort "das ist ein besonderer Kaktus", kein Extra-Asset nötig.
  button.innerHTML = `<img class="random-event-icon" src="assets/cactus/cactus.webp" alt="" aria-hidden="true">`;
  elements.clickZone.append(button);
  positionRandomEventOverCactus(button);

  const removeEvent = (caught) => {
    const entry = activeRandomEvents.get(kind);
    const buttonRect = button.getBoundingClientRect();
    window.clearTimeout(entry?.timeout);
    activeRandomEvents.delete(kind);
    button.remove();
    scheduleNextRandomEvent(kind);

    // Kein Auto-Collect mehr: nur bei aktivem Klick gibt's Reward + Hit-Count.
    // Spawn-Häufigkeit ist im Gegenzug erhöht (GOLDEN_EVENT_DELAY / RED_EVENT_DELAY).
    if (!caught) {
      return;
    }
    const reward = getAutomaticProduction(state, { includeEvent: false }) * rewardSeconds;
    addCactus(reward);
    if (kind === "golden") {
      state.events.goldenHits += 1;
    } else {
      state.events.redHits += 1;
    }
    spawnFloat(
      buttonRect.left + buttonRect.width / 2,
      buttonRect.top + buttonRect.height / 2,
      `${label} +${formatNumber(reward)}`,
      `is-event-reward is-${kind}`
    );
    elements.saveStatus.textContent = `${label}: +${formatNumber(reward)}`;
    updateAchievements();
    render();
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    removeEvent(true);
  }, { once: true });
  activeRandomEvents.set(kind, {
    button,
    timeout: window.setTimeout(() => removeEvent(false), duration),
  });
}

function bindEvents() {
  elements.cactusButton.addEventListener("click", clickCactus);

  // Keyboard: Leertaste = Cactus klicken. event.repeat ignorieren damit
  // gehaltene Space nicht spammt (würde sonst die ganze Anti-Click-Frenzy
  // Logik umgehen). Skip wenn fokus in input/textarea oder Modal offen.
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.key !== " ") return;
    if (event.repeat) return;
    const target = event.target;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
    // Auch nicht klicken wenn ein modal/changelog overlay offen ist
    if (document.querySelector(".game-modal-backdrop")) return;
    event.preventDefault();
    // spawnFloat braucht x/y — bei Keyboard nehmen wir das Zentrum des Buttons
    const rect = elements.cactusButton.getBoundingClientRect();
    clickCactus({
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
  });
  elements.saveButton.addEventListener("click", () => saveState("Manuell gespeichert"));
  elements.changelogButton.addEventListener("click", showChangelog);
  elements.prestigeButton.addEventListener("click", performPrestige);

  elements.buildingList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-building]");
    if (button) {
      buyBuilding(button.dataset.building);
    }
  });

  elements.upgradeList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-upgrade]");
    if (button) {
      buyUpgrade(button.dataset.upgrade);
    }
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      elements.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      elements.panels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === `${tab.dataset.tab}-panel`);
        if (panel.id === `${tab.dataset.tab}-panel`) {
          panel.scrollTop = 0;
        }
      });

      if (tab.dataset.tab === "leaderboard") {
        renderLeaderboard(true);
      }
    });
  });

  elements.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm(t("clicker.reset_confirm_full"));
    if (!confirmed) {
      return;
    }

    state = createInitialState(getMonthlyLeaderboardPeriod().id);
    ensureRandomEventSchedules();
    leaderboardLoaded = false;
    saveState("Zurückgesetzt");
    render();
  });

  // Jede Eingabe zählt als "aktiv spielen" für die Autoklicker — auch Käufe
  // und Tab-Wechsel im Panel, nicht nur Kaktus-Klicks.
  window.addEventListener("pointerdown", () => { lastRealInputAt = Date.now(); });
  window.addEventListener("keydown", () => { lastRealInputAt = Date.now(); });
  window.setInterval(runAutoClicks, AUTO_CLICK_TICK_MS);

  window.setInterval(() => saveState("Automatisch gespeichert"), 15000);
  window.setInterval(() => {
    payProduction();
    checkRandomEvents();
    updateLeaderboardResetCountdown();
  }, 1000);
  window.addEventListener("kk-admin-reload", () => {
    window.clearTimeout(cloudSaveTimer);
    cloudSync = { enabled: false, user: null };
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseRandomEvents();
      return;
    }

    ensureRandomEventSchedules();
    checkRandomEvents();
    restartAdminGameEventCursor();
    recoverClickerViewport();
  });

  window.addEventListener("orientationchange", recoverClickerViewport);
  window.addEventListener("resize", recoverClickerViewport);
  window.visualViewport?.addEventListener("resize", recoverClickerViewport);
  window.addEventListener("pointerdown", tryLockPortraitOrientation, { once: true });
  window.addEventListener("keydown", tryLockPortraitOrientation, { once: true });
  window.addEventListener("beforeunload", () => saveState("Gespeichert"));
}

async function initGame() {
  const period = getMonthlyLeaderboardPeriod();
  const session = await getGameSession();

  if (session?.user) {
    cloudSync.enabled = true;
    cloudSync.user = session.user;
    setXpUser(session.user);
    await ensureKaktusSeason();
    const profile = await getGameProfile(session.user);
    if (profile?.is_banned) {
      await signOutGameSession();
      showGameModal({ title: "Account gesperrt", message: t("clicker.banned_toast") });
      elements.saveStatus.textContent = "Account gesperrt";
      // Auch hier ausblenden — sonst hängt der Ladebildschirm über dem Modal.
      hideLoadingScreen();
      return;
    }

    const cloud = await loadCloudSave(session.user);
    // Bewusst KEINE lokale-zu-Cloud-Migration: sonst könnte man localStorage
    // editieren und sich per Login einen inflationierten Cloud-Save ins
    // Leaderboard heben. Neuer Account = bei 0.
    state = normalizeLoadedState(cloud?.state, period.id);
    scheduleCloudSave();
  } else {
    state = normalizeLoadedState(loadLocalState(), period.id);
  }

  ensureRandomEventSchedules();
  bindEvents();
  recoverClickerViewport();
  tryLockPortraitOrientation();
  subscribeAdminGameEvents();
  updateAchievements();
  render();
  if (isClickFrenzyActive(state)) {
    startFrenzyMeterLoop();
  }
  updateLeaderboardResetCountdown();
  elements.saveStatus.textContent = getIdleSaveLabel();

  const offlineReward = computeOfflineReward();
  saveState("Online-Zeit aktualisiert");
  hideLoadingScreen();
  if (offlineReward) {
    showOfflineReward(offlineReward);
  }
}

// Der Ladebildschirm liegt inline in der index.html, damit er ohne Warten auf ein
// Stylesheet steht. Er verschwindet erst, wenn das erste render() durch ist —
// sonst blitzt eine leere Wüste auf, bevor die Zahlen stehen.
function hideLoadingScreen() {
  const loader = document.getElementById("clicker-loading");
  if (!loader || loader.classList.contains("is-done")) {
    return;
  }

  const dismiss = () => {
    if (loader.classList.contains("is-done")) {
      return;
    }

    loader.classList.add("is-done");
    window.setTimeout(() => loader.remove(), 600);
  };

  // Normalfall: zwei Frames warten, damit das erste render() nicht nur im DOM
  // steht, sondern auch gemalt ist — sonst springt das Bild beim Ausblenden.
  requestAnimationFrame(() => requestAnimationFrame(dismiss));
  // Notausgang: in einem Hintergrund-Tab produziert der Browser keine Frames,
  // requestAnimationFrame feuert also erst beim Fokussieren. Ohne diesen Timer
  // bliebe der Ladebildschirm bis dahin stehen. dismiss() ist idempotent.
  window.setTimeout(dismiss, 1200);
}

initGame().catch((error) => {
  // Ohne diesen Fallback bliebe der Ladebildschirm bei einem Fehler für immer
  // stehen und das Spiel wäre komplett unbedienbar.
  console.error("KaktusClicker konnte nicht starten:", error);
  hideLoadingScreen();
});

// Bei Sprachwechsel alles neu rendern damit Buildings/Upgrades/Achievements
// mit übersetzten Namen erscheinen.
onLanguageChange(() => {
    try {
        render();
        elements.saveStatus.textContent = getIdleSaveLabel();
        updateLeaderboardResetCountdown();
        if (leaderboardLoaded) {
            leaderboardLoaded = false;
            renderLeaderboard(true);
        }
    } catch (error) {
        console.warn("Re-render nach Sprachwechsel fehlgeschlagen:", error);
    }
});
