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
import { achievements, buildings, changelogEntries, upgrades } from "./data.js";
import {
  getAchievementMultiplier,
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

const STORAGE_KEY = "kaktus-clicker-save-v1";
const AUDIO_STORAGE_KEY = "kaktus-clicker-audio-v1";
const CLICK_FRENZY_TARGET = 1000;
const CLICK_FRENZY_MS = 30000;
const OFFLINE_LIMIT_SECONDS = 12 * 60 * 60;
const OFFLINE_MIN_SECONDS = 5 * 60;
const OFFLINE_RATE = 0.5;
const GOLDEN_REWARD_SECONDS = 300;
const RED_REWARD_SECONDS = 1800;
const GOLDEN_EVENT_DELAY = [3 * 60 * 1000, 7 * 60 * 1000];
const RED_EVENT_DELAY = [20 * 60 * 1000, 40 * 60 * 1000];
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
const backgroundMusic = new Audio();
const eventAppearSound = new Audio();
let audioSettings = loadAudioSettings();
let soundEffectsUnlocked = false;
// AudioContext: einheitlicher Unlock-Mechanismus (Fishing-Pattern). Beide Audio-Elemente
// werden bei initAudio() per MediaElementSource an den Context gehängt — beim ersten
// User-Klick reicht ein einziges ctx.resume() um die ganze Audio-Pipeline freizuschalten,
// unabhängig vom Mute-Status. Vorher: cloned <audio> mit muted=true, was als "muted autoplay"
// nicht als gültiger Unlock zählt → Goldkaktus-Sound kam bei Music=mute nicht.
let audioCtx = null;

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
  musicToggle: document.querySelector("#music-toggle"),
  musicVolume: document.querySelector("#music-volume"),
  soundToggle: document.querySelector("#sound-toggle"),
  soundVolume: document.querySelector("#sound-volume"),
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

function loadAudioSettings() {
  try {
    return {
      musicMuted: false,
      soundMuted: false,
      musicVolume: 0.24,
      soundVolume: 0.62,
      ...(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY)) || {}),
    };
  } catch {
    return {
      musicMuted: false,
      soundMuted: false,
      musicVolume: 0.24,
      soundVolume: 0.62,
    };
  }
}

function clampAudioVolume(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function saveAudioSettings() {
  localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(audioSettings));
}

function setAudioButtonState(button, muted, activeLabel, mutedLabel) {
  button.classList.toggle("is-muted", muted);
  button.title = muted ? mutedLabel : activeLabel;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(muted));
}

function renderAudioControls() {
  audioSettings.musicVolume = clampAudioVolume(audioSettings.musicVolume);
  audioSettings.soundVolume = clampAudioVolume(audioSettings.soundVolume);
  backgroundMusic.volume = audioSettings.musicVolume;
  eventAppearSound.volume = audioSettings.soundVolume;
  elements.musicVolume.value = String(Math.round(audioSettings.musicVolume * 100));
  elements.soundVolume.value = String(Math.round(audioSettings.soundVolume * 100));
  setAudioButtonState(elements.musicToggle, audioSettings.musicMuted, "Musik stummschalten", "Musik einschalten");
  setAudioButtonState(elements.soundToggle, audioSettings.soundMuted, "Sound stummschalten", "Sound einschalten");
}

function startBackgroundMusic() {
  if (audioSettings.musicMuted) {
    return;
  }

  backgroundMusic.play().catch(() => {
    // Browser may wait for the first real tap before starting music.
  });
}

function unlockSoundEffects() {
  if (soundEffectsUnlocked) {
    return;
  }
  // AudioContext-basierter Unlock (analog zum Fishing-AudioSystem): ein resume()
  // genügt um die Audio-Pipeline endgültig freizugeben, unabhängig vom Mute-Status.
  // Beide Audio-Elemente sind in initAudio() per MediaElementSource an den Context
  // gehängt — sobald der Context "running" ist, dürfen sie alle .play()-Calls fahren.
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  if (audioCtx && audioCtx.state === "running") {
    soundEffectsUnlocked = true;
  }
}

function playEventAppearSound() {
  if (audioSettings.soundMuted) {
    return;
  }

  const sound = eventAppearSound.cloneNode();
  sound.volume = audioSettings.soundVolume;
  sound.play().catch(() => {});
}

function initAudio() {
  backgroundMusic.loop = true;
  backgroundMusic.preload = "metadata";
  backgroundMusic.src = "./audio/ambient-glitch.mp3";
  eventAppearSound.preload = "auto";
  eventAppearSound.src = "./audio/event-appear.mp3";

  // AudioContext aufsetzen + beide <audio>-Elemente per MediaElementSource einhängen.
  // Damit reicht später ein einziges ctx.resume() um beide freizuschalten, unabhängig
  // davon ob Musik gerade gemutet ist. Try/catch falls Browser AudioContext nicht
  // unterstützt — dann fallen wir auf altes Verhalten zurück (Musik on = funktioniert,
  // Musik mute = SFX blockiert; immerhin nicht schlimmer als vorher).
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
      const musicSource = audioCtx.createMediaElementSource(backgroundMusic);
      const eventSource = audioCtx.createMediaElementSource(eventAppearSound);
      musicSource.connect(audioCtx.destination);
      eventSource.connect(audioCtx.destination);
    }
  } catch {
    // Browser ohne AudioContext oder bereits angeschlossene Element-Sources → ignorieren.
  }

  renderAudioControls();
  startBackgroundMusic();
  window.addEventListener("pointerdown", startBackgroundMusic, { once: true });
  window.addEventListener("keydown", startBackgroundMusic, { once: true });
  window.addEventListener("pointerdown", unlockSoundEffects);
  window.addEventListener("keydown", unlockSoundEffects);
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
  return cloudSync.enabled ? "Speicherstatus: Cloud aktiv" : "Speicherstatus: Lokal gespeichert";
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
  elements.saveStatus.textContent = label;

  if (cloudSync.enabled) {
    scheduleCloudSave();
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  window.setTimeout(() => {
    if (elements.saveStatus.textContent === label) {
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
      <button class="icon-button game-modal-button" type="button">${escapeHtml(buttonLabel)}</button>
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
    title: "Changelog",
    bodyHtml: `
      <div class="changelog-entries">
        ${changelogEntries.map((entry) => `
          <section class="changelog-entry">
            <p class="changelog-date">${escapeHtml(entry.date)}</p>
            <h3>${escapeHtml(entry.title)}</h3>
            <ul class="changelog-list">
              ${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </section>
        `).join("")}
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
      unlocked.push(achievement.name);
    }
  }

  if (unlocked.length) {
    elements.saveStatus.textContent = `Abzeichen: ${unlocked.at(-1)}`;
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
  chargeClickFrenzy();
  spawnFloat(event.clientX, event.clientY, `+${formatNumber(earned)}`);
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
  elements.saveStatus.textContent = "Goldlauf aktiv";
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

function buyUpgrade(id) {
  const upgrade = getUpgrade(id);
  if (!upgrade || state.upgrades.includes(id) || state.cactus < upgrade.cost) {
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
    `Prestige setzt deinen aktuellen Run zurück und gibt dir ${formatNumber(newNopal)} Nopal. Fortfahren?`
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
        <span>
          <span class="item-name">${escapeHtml(building.name)}</span>
          <span class="item-description">${escapeHtml(building.description)}</span>
          <span class="item-meta">${formatNumber(getBuildingProduction(state, building))}/Sek. - Besitz: ${formatNumber(owned)}</span>
        </span>
        <span class="item-price">${formatNumber(cost)}</span>
      </button>
    `;
  }).join("");
}

function renderUpgrades() {
  const visibleUpgrades = upgrades.filter((upgrade) => !state.upgrades.includes(upgrade.id));
  elements.upgradeList.innerHTML = visibleUpgrades.length
    ? visibleUpgrades.map((upgrade) => {
      const disabled = state.cactus < upgrade.cost ? "disabled" : "";
      return `
        <button class="shop-item" type="button" data-upgrade="${upgrade.id}" ${disabled}>
          <span class="item-icon" aria-hidden="true">${escapeHtml(upgrade.icon)}</span>
          <span>
            <span class="item-name">${escapeHtml(upgrade.name)}</span>
            <span class="item-description">${escapeHtml(upgrade.description)}</span>
          </span>
          <span class="item-price">${formatNumber(upgrade.cost)}</span>
        </button>
      `;
    }).join("")
    : `<p class="item-description">Alle Upgrades gekauft. Deine Produktion läuft auf Anschlag.</p>`;
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
        <span class="achievement-copy">
          <strong>${escapeHtml(achievement.name)}</strong>
          <small>${escapeHtml(achievement.goal)}</small>
        </span>
        <span>${unlocked ? "+0,1x" : "Offen"}</span>
      </div>
    `;
  }).join("");
}

function renderStatsOnly() {
  elements.cactusCount.textContent = formatNumber(state.cactus);
  elements.cactusRate.textContent = formatNumber(getAutomaticProduction(state));
  elements.clickPower.textContent = formatNumber(getClickYield(state));
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
  elements.eventMeterLabel.textContent = active ? "Goldlauf aktiv" : "Goldlauf lädt";
  elements.eventMeterValue.textContent = active
    ? `${formatDuration(remainingMs / 1000)} x2`
    : `${formatNumber(state.events.clickCharge)} / ${formatNumber(CLICK_FRENZY_TARGET)} Klicks`;
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

function payProductionSecond() {
  const production = getAutomaticProduction(state);
  if (production > 0) {
    addCactus(production);
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
  return `${days}T ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
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

  elements.leaderboardReset.textContent =
    `Reset am 01. des nächsten Monats · noch ${formatLeaderboardCountdown(period.nextResetAt.getTime() - Date.now())}`;
}

async function renderLeaderboard(force = false) {
  if (!elements.leaderboardList || (leaderboardLoaded && !force)) {
    return;
  }

  elements.leaderboardList.innerHTML = `<p class="item-description">Rangliste wird geladen...</p>`;
  elements.leaderboardLastMonthList.innerHTML = `<p class="item-description">Letzter Monat wird geladen...</p>`;

  const { entries, previousTopThree, error } = await fetchLeaderboard();
  if (error) {
    elements.leaderboardList.innerHTML = `<p class="item-description">${escapeHtml(error.message)}</p>`;
    elements.leaderboardLastMonthList.innerHTML = `<p class="item-description">Monatsabschluss gerade nicht verfügbar.</p>`;
    return;
  }

  leaderboardLoaded = true;
  renderLeaderboardRows(elements.leaderboardLastMonthList, previousTopThree || [], "Noch kein Monatsabschluss gespeichert.");
  renderLeaderboardRows(elements.leaderboardList, entries || [], "Noch keine Einträge. Sei der Erste.");
  elements.leaderboardHint.textContent = cloudSync.enabled
    ? "Sortiert nach Kakteen, die in der laufenden Monatssaison geerntet wurden."
    : "Melde dich an, um deinen Saison-Score in der Rangliste zu speichern.";
}

function renderLeaderboardRows(root, rows, emptyText) {
  root.innerHTML = rows.length
    ? rows.map((entry) => `
      <div class="leaderboard-row ${entry.rank <= 3 ? "is-top" : ""}">
        <span class="leaderboard-rank">#${entry.rank}</span>
        <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
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
    title: "Offline Fortschritt",
    tone: "is-offline",
    bodyHtml: `
      <p class="offline-note">Offline-Ertrag zahlt 50% deiner normalen Auto-Produktion.</p>
      <dl class="offline-reward">
        <div>
          <dt>Offline Zeit</dt>
          <dd>${escapeHtml(formatDuration(reward.seconds))}</dd>
        </div>
        <div>
          <dt>Verdiente Kakteen mit 50%</dt>
          <dd>${escapeHtml(formatNumber(reward.reward))}</dd>
        </div>
        <div>
          <dt>Bei aktivem Spiel</dt>
          <dd>${escapeHtml(formatNumber(reward.fullOnlineReward))}</dd>
        </div>
      </dl>
    `,
    buttonLabel: "Einsammeln",
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
    showAdminToast("⚙ Admin spawnt einen Goldkaktus");
  }

  if (row.event_type === "spawn-rubinkaktus") {
    spawnConfiguredRandomEvent("red");
    showAdminToast("⚙ Admin spawnt einen Rubinkaktus");
  }

  if (row.event_type === "force-reload") {
    showAdminToast("⚙ Neue Version verfügbar — Spiel wird neu geladen…");
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
  button.innerHTML = `<img class="random-event-icon" src="/favicon-32x32.png" alt="" aria-hidden="true">`;
  elements.clickZone.append(button);
  positionRandomEventOverCactus(button);
  playEventAppearSound();

  const removeEvent = (caught) => {
    const entry = activeRandomEvents.get(kind);
    const buttonRect = button.getBoundingClientRect();
    window.clearTimeout(entry?.timeout);
    activeRandomEvents.delete(kind);
    button.remove();
    scheduleNextRandomEvent(kind);

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
  elements.saveButton.addEventListener("click", () => saveState("Manuell gespeichert"));
  elements.musicToggle.addEventListener("click", () => {
    audioSettings.musicMuted = !audioSettings.musicMuted;
    if (audioSettings.musicMuted) {
      backgroundMusic.pause();
    } else {
      startBackgroundMusic();
    }
    saveAudioSettings();
    renderAudioControls();
  });
  elements.musicVolume.addEventListener("input", () => {
    audioSettings.musicVolume = clampAudioVolume(Number(elements.musicVolume.value) / 100);
    saveAudioSettings();
    renderAudioControls();
    startBackgroundMusic();
  });
  elements.soundToggle.addEventListener("click", () => {
    audioSettings.soundMuted = !audioSettings.soundMuted;
    saveAudioSettings();
    renderAudioControls();
  });
  elements.soundVolume.addEventListener("input", () => {
    audioSettings.soundVolume = clampAudioVolume(Number(elements.soundVolume.value) / 100);
    saveAudioSettings();
    renderAudioControls();
  });
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
    const confirmed = window.confirm("Willst du deinen kompletten KaktusClicker-Spielstand inklusive Prestige wirklich löschen?");
    if (!confirmed) {
      return;
    }

    state = createInitialState(getMonthlyLeaderboardPeriod().id);
    ensureRandomEventSchedules();
    leaderboardLoaded = false;
    saveState("Zurückgesetzt");
    render();
  });

  window.setInterval(() => saveState("Automatisch gespeichert"), 15000);
  window.setInterval(() => {
    payProductionSecond();
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
    await ensureKaktusSeason();
    const profile = await getGameProfile(session.user);
    if (profile?.is_banned) {
      await signOutGameSession();
      showGameModal({ title: "Account gesperrt", message: "Dein Account wurde gesperrt." });
      elements.saveStatus.textContent = "Account gesperrt";
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
  initAudio();
  updateAchievements();
  render();
  if (isClickFrenzyActive(state)) {
    startFrenzyMeterLoop();
  }
  updateLeaderboardResetCountdown();
  elements.saveStatus.textContent = getIdleSaveLabel();

  const offlineReward = computeOfflineReward();
  saveState("Online-Zeit aktualisiert");
  if (offlineReward) {
    showOfflineReward(offlineReward);
  }
}

initGame();
