import { AREAS, PRESTIGE_CAP } from "./data/areas.js";
import { INDEX_REWARDS, RARITIES } from "./data/rarities.js";
import { UPGRADES, UPGRADE_ORDER } from "./data/upgrades.js";
import { getAvailableAreas, getPrestigeState, prestigeToNextArea } from "./systems/areaSystem.js";
import { AudioSystem } from "./systems/audioSystem.js?v=2";
import { BroadcastSystem } from "./systems/broadcastSystem.js";
import { BubbleSystem } from "./systems/bubbleSystem.js";
import { CoinFishSystem } from "./systems/coinFishSystem.js";
import { renderFishArt } from "./systems/fishArtSystem.js";
import { FishingMinigame } from "./systems/fishingMinigame.js";
import { getAreaIndexProgress, getGroupedFishIndex } from "./systems/indexSystem.js";
import { addCatch, getInventoryEntries, sellAll } from "./systems/inventorySystem.js";
import { getFishValue, getRarestFishInArea, getRarityChances, rollCatch } from "./systems/raritySystem.js";
import { applyMutationsToCandidate, EVENT_MUTATIONS, MUTATIONS_BY_ID, rollMutations, STANDARD_MUTATIONS } from "./data/mutations.js";
import { FISH_BY_ID } from "./data/fish.js";
import { logCatch, setTelemetryUser } from "./systems/telemetry.js";
import { addPendingXp, setXpUser, xpForCatch } from "/js/xp-service.js";
import { renderLevelTag, renderPlayerName } from "/js/progression.js";
import { createInitialState, fetchLeaderboard, loadState, normalizeState, saveState } from "./systems/saveSystem.js";
import { buyUpgrade, getMinigameBonuses, getUpgradeCost } from "./systems/upgradeSystem.js";
import { WaterSystem } from "./systems/waterSystem.js";
import { WeatherSystem } from "./systems/weatherSystem.js";
import { WeatherEventSystem } from "./systems/weatherEventSystem.js";
import { KarlSystem } from "./systems/karlSystem.js";
import { KARL_NAME } from "./data/karl.js";
import { DailySystem } from "./systems/dailySystem.js";
import { AngelUiSystem } from "./systems/angelUiSystem.js";
import { FISHING_CHANGELOG } from "./data/changelog.js";
import { fetchProfile } from "/js/profile.js";
import { getSupabase, isConfigReady } from "/js/supabase-client.js";

const elements = {
    shell: document.querySelector(".fishing-shell"),
    water: document.getElementById("water-stage"),
    stageHint: document.getElementById("stage-hint"),
    popups: document.getElementById("catch-popups"),
    coinCount: document.getElementById("coin-count"),
    areaName: document.getElementById("area-name"),
    prestigeCount: document.getElementById("prestige-count"),
    catchCount: document.getElementById("catch-count"),
    menu: document.getElementById("game-menu"),
    menuToggle: document.getElementById("game-menu-toggle"),
    upgrades: document.getElementById("upgrade-list"),
    angelBody: document.getElementById("angel-body"),
    inventory: document.getElementById("inventory-list"),
    inventoryValue: document.getElementById("inventory-value"),
    sellAll: document.getElementById("sell-all"),
    index: document.getElementById("fish-index"),
    areas: document.getElementById("area-list"),
    prestige: document.getElementById("prestige-card"),
    stats: document.getElementById("stats-grid"),
    leaderboard: document.getElementById("leaderboard-list"),
    leaderboardReload: document.getElementById("reload-leaderboard"),
    saveStatus: document.getElementById("save-status"),
    saveNow: document.getElementById("save-now"),
    resetSave: document.getElementById("reset-save"),
    reducedMotion: document.getElementById("reduced-motion"),
    musicToggle: document.getElementById("music-toggle"),
    musicVolume: document.getElementById("music-volume"),
    sfxToggle: document.getElementById("sfx-toggle"),
    sfxVolume: document.getElementById("sfx-volume"),
    fishingOverlay: document.getElementById("fishing-overlay"),
    broadcastFeed: document.getElementById("broadcast-feed"),
    areaTransition: document.getElementById("area-transition"),
    areaTransitionName: document.getElementById("area-transition-name"),
    areaTransitionKicker: document.getElementById("area-transition-kicker"),
    weatherBanner: document.getElementById("weather-banner"),
};

const audio = new AudioSystem();
let playerName = "Ein Angler";
let broadcastTimer = 0;

function showBroadcast(message) {
    const feed = elements.broadcastFeed;
    feed.textContent = message;
    feed.hidden = false;
    feed.classList.remove("is-visible");
    void feed.offsetWidth;
    feed.classList.add("is-visible");
    window.clearTimeout(broadcastTimer);
    broadcastTimer = window.setTimeout(() => feed.classList.remove("is-visible"), 8500);
}

const RARITY_ADJECTIVE = {
    Common: "Common",
    Uncommon: "Uncommon",
    Rare: "Rare",
    Epic: "Epischen",
    Legendary: "Legendären",
};

const COIN_FISH_REWARDS = {
    pond: { small: 8, big: 23, sword: 50, shark: 107 },
    lake: { small: 46, big: 138, sword: 300, shark: 632 },
    ocean: { small: 1300, big: 3900, sword: 8600, shark: 18000 },
};

let weatherBannerTimer = 0;

function formatCountdown(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderWeatherBanner() {
    if (!weatherEventSystem) {
        return;
    }
    const status = weatherEventSystem.getStatus();
    const el = elements.weatherBanner;
    if (status.isActive) {
        const e = status.event;
        el.style.setProperty("--event-accent", e.accent);
        el.innerHTML =
            `<span class="weather-banner-icon" aria-hidden="true">${e.icon}</span>` +
            `<span class="weather-banner-name">${e.name}</span>` +
            `<span class="weather-banner-sep">·</span>` +
            `<span class="weather-banner-buff">${e.buffLabel}</span>` +
            `<span class="weather-banner-sep">·</span>` +
            `<span class="weather-banner-time">${formatCountdown(status.msLeft)}</span>`;
        el.hidden = false;
        void el.offsetWidth;
        el.classList.add("is-visible");
    } else {
        el.classList.remove("is-visible");
        window.clearTimeout(weatherBannerTimer);
        weatherBannerTimer = window.setTimeout(() => { el.hidden = true; }, 600);
    }
}

function handleWeatherChange(event, previous) {
    renderWeatherBanner();
    audio.unlock();
    audio.setEventMood(event?.type || null);
    const rainIntensity = event?.type === "rain" ? 0.55 : event?.type === "storm" ? 0.95 : 0;
    audio.setRainAmbient(rainIntensity);
    if (event) {
        audio.playSell();
        showBroadcast(`Wetter-Event: ${event.name} — ${event.buffLabel} (2,5 Min.)`);
    } else if (previous) {
        showBroadcast("Wetter-Event vorbei.");
    }
}

const broadcast = new BroadcastSystem((payload) => {
    const adjective = RARITY_ADJECTIVE[payload?.rarity];
    if (!adjective || !payload.fish) {
        return;
    }
    const mutPrefix = payload.mutationLabel ? `${payload.mutationLabel} ` : "";
    showBroadcast(`${payload.name || "Ein Angler"} hat einen ${mutPrefix}${adjective} ${payload.fish} gefangen!!!`);
});

const coinFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const kgFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
let state = createInitialState();
let user = null;
let saveTimer = 0;
let cloudSaveBlocked = false;
let activeWindow = null;
let leaderboardLoaded = false;
let bubbleSystem;
let coinFishSystem;
let waterSystem;
let weatherSystem;
let karlSystem;
let dailySystem;
let weatherEventSystem;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function coins(value) {
    return coinFormat.format(Math.max(0, Math.round(Number(value) || 0)));
}

function kg(value) {
    return `${kgFormat.format(Math.max(0, Number(value) || 0))} kg`;
}

function setHint(message) {
    elements.stageHint.textContent = message;
}

let areaTransitionTimer = 0;

let areaTransitionCoverTimer = 0;

function playAreaTransition(kicker, onCovered) {
    const el = elements.areaTransition;
    elements.areaTransitionKicker.textContent = kicker;
    elements.areaTransitionName.textContent = AREAS[state.currentArea].name;
    el.hidden = false;
    el.classList.remove("is-running");
    void el.offsetWidth;
    el.classList.add("is-running");
    window.clearTimeout(areaTransitionCoverTimer);
    window.clearTimeout(areaTransitionTimer);
    areaTransitionCoverTimer = window.setTimeout(() => {
        if (typeof onCovered === "function") {
            onCovered();
        }
    }, 1200);
    areaTransitionTimer = window.setTimeout(() => {
        el.hidden = true;
        el.classList.remove("is-running");
    }, 3600);
}

function setSaveStatus(message, isError = false) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.classList.toggle("is-error", isError);
}

function applyMotionSetting() {
    document.body.classList.toggle("reduce-fishing-motion", Boolean(state.settings.reducedMotion));
    elements.reducedMotion.checked = Boolean(state.settings.reducedMotion);
}

function openWindow(name) {
    activeWindow = name;
    document.querySelectorAll("[data-window]").forEach((windowElement) => {
        windowElement.hidden = windowElement.dataset.window !== name;
    });
    closeMenu();
    renderWindow(name);
    if (name === "stats" && !leaderboardLoaded) {
        loadLeaderboard();
    }
}

function closeWindows() {
    activeWindow = null;
    document.querySelectorAll("[data-window]").forEach((windowElement) => {
        windowElement.hidden = true;
    });
}

function openMenu() {
    elements.menu.hidden = false;
    elements.menuToggle.setAttribute("aria-expanded", "true");
}

function closeMenu() {
    elements.menu.hidden = true;
    elements.menuToggle.setAttribute("aria-expanded", "false");
}

function renderHud() {
    elements.coinCount.textContent = coins(state.coins);
    elements.areaName.textContent = AREAS[state.currentArea].name;
    elements.prestigeCount.textContent = `${state.prestige}/${PRESTIGE_CAP}`;
    elements.catchCount.textContent = coins(state.stats.totalCaught);
    elements.water.dataset.area = state.currentArea;
}

let angelUiSystem = null;

function renderShop() {
    if (angelUiSystem) {
        angelUiSystem.render();
    }
}

function renderMutationChips(mutationsMap) {
    if (!mutationsMap) return "";
    // Sortierung: Event-Mutationen zuerst (höherer Mult), dann Standard nach Mult absteigend.
    const entries = Object.entries(mutationsMap)
        .map(([id, count]) => ({ id, count, def: MUTATIONS_BY_ID[id] }))
        .filter((e) => e.def && e.count > 0)
        .sort((a, b) => (b.def.mult - a.def.mult) || (b.count - a.count));
    if (!entries.length) return "";
    return `<div class="inv-mut-row">${entries.map((e) => {
        const glow = e.def.glow ? " is-glow" : "";
        const mult = e.def.mult % 1 === 0 ? e.def.mult : e.def.mult.toFixed(1);
        return `<span class="inv-mut-chip${glow}" style="--mut:${e.def.color}" title="${e.def.name} ×${mult} — ${e.count}× gefangen">×${mult} <b>${e.count}</b></span>`;
    }).join("")}</div>`;
}

function renderInventory() {
    const entries = getInventoryEntries(state);
    const totalValue = entries.reduce((sum, entry) => sum + entry.totalValue, 0);
    const totalKg = entries.reduce((sum, entry) => sum + entry.totalKg, 0);
    const totalCount = entries.reduce((sum, entry) => sum + entry.count, 0);
    elements.inventoryValue.innerHTML = `
        <span class="inv-total-coins">${coins(totalValue)} Coins</span>
        <span class="inv-total-meta">${coins(totalCount)} Fische &middot; ${kg(totalKg)} gesamt</span>
    `;
    elements.sellAll.disabled = entries.length === 0;
    elements.inventory.innerHTML = entries.length
        ? entries.map((entry) => {
            const rarity = RARITIES[entry.fish.rarity];
            const area = AREAS[entry.fish.area];
            // Basewert pro KILOGRAMM (Rarity × Fish-Mult × Area-Mult) — Indikator wie wertvoll
            // dieser Fisch generell pro kg ist, unabhängig vom konkreten Gewicht.
            const basePerKg = Math.max(1, Math.round(rarity.valuePerKg * entry.fish.valueMultiplier * area.valueMultiplier));
            return `
            <article class="inventory-row">
                ${renderFishArt(entry.fish)}
                <div class="inventory-info">
                    <strong>${entry.fish.name}</strong>
                    <small>${entry.fish.rarity} &middot; ${entry.count}x gefangen</small>
                    <small>Gesamt ${kg(entry.totalKg)} &middot; Bestes ${kgQualityDisplay(entry.bestKg, entry.fish.maxKg)}</small>
                    <small class="inv-base">${coins(basePerKg)} Coins/kg</small>
                    ${renderMutationChips(entry.mutations)}
                </div>
                <div class="inventory-value">
                    <b>${coins(entry.totalValue)}</b>
                    <span>Coins</span>
                </div>
            </article>
        `}).join("")
        : `<p class="empty-copy">Dein Inventar ist leer. Tippe eine Fischstelle an, um zu angeln.</p>`;
}

function renderIndex() {
    // Performance: nur die aktuelle Area rendert die vollen Fisch-SVGs.
    // Andere Areas zeigen nur den Fortschritts-Counter — vermeidet 60+ SVG-Renders.
    const groups = getGroupedFishIndex(state);
    elements.index.innerHTML = groups.map((areaBlock) => {
        const unlocked = state.unlockedAreas.includes(areaBlock.areaId);
        const area = AREAS[areaBlock.areaId];
        const isCurrent = areaBlock.areaId === state.currentArea;

        if (!unlocked) {
            return `
                <section class="index-area is-locked is-collapsed">
                    <div class="index-area-head">
                        <h3>${area.name}</h3>
                        <div class="index-area-meta">
                            <strong>${areaBlock.progress.caught}/${areaBlock.progress.total}</strong>
                            <span class="area-lock">Noch nicht freigeschaltet</span>
                        </div>
                    </div>
                </section>
            `;
        }

        if (!isCurrent) {
            return `
                <section class="index-area is-collapsed">
                    <div class="index-area-head">
                        <h3>${area.name}</h3>
                        <div class="index-area-meta">
                            <strong>${areaBlock.progress.caught}/${areaBlock.progress.total}</strong>
                            <span class="area-hint">Wechsel zu ${area.name} um die Fische zu sehen</span>
                        </div>
                    </div>
                </section>
            `;
        }

        const chances = getRarityChances(areaBlock.areaId, state.upgrades.luck);

        return `
            <section class="index-area is-current">
                <div class="index-area-head">
                    <h3>${area.name}</h3>
                    <strong>${areaBlock.progress.caught}/${areaBlock.progress.total}</strong>
                </div>
                ${areaBlock.groups.map((group) => `
                    <div class="index-rarity">
                        <div class="index-rarity-head">
                            <div class="rarity-head-left">
                                <span class="rarity-pill" style="--rarity:${RARITIES[group.rarity].color}">${group.rarity}</span>
                                <span class="rarity-chance" style="--rarity:${RARITIES[group.rarity].color}">${((chances[group.rarity] || 0) * 100).toFixed(1)}% Fangchance</span>
                            </div>
                            <small>${group.fish.filter((fish) => state.index[fish.id]?.count).length}/${group.fish.length}</small>
                        </div>
                        <div class="index-grid">
                            ${group.fish.map((fish) => {
                                const entry = state.index[fish.id];
                                const owned = !!entry && entry.count > 0;
                                const unclaimed = owned && !entry.claimed;
                                const reward = INDEX_REWARDS[fish.rarity] || 0;
                                const classes = ["index-fish"];
                                if (!owned) classes.push("is-shadow");
                                if (unclaimed) classes.push("is-unclaimed");
                                if (owned && !unclaimed) classes.push("is-collectible");
                                // Mutations-Counter X/13 — sichtbarer Hinweis dass Card anklickbar ist
                                const mutCount = owned && entry.mutations ? Object.keys(entry.mutations).filter((id) => entry.mutations[id] > 0).length : 0;
                                const mutBadge = owned && !unclaimed
                                    ? `<span class="index-mut-badge" title="Klick für Mutations-Übersicht">${mutCount}/13 🧬</span>`
                                    : "";
                                return `
                                    <article class="${classes.join(" ")}" data-fish-id="${fish.id}" ${owned && !unclaimed ? `data-action="open-mutations"` : ""}>
                                        ${mutBadge}
                                        ${renderFishArt(fish, { silhouette: !owned })}
                                        <strong>${owned ? fish.name : "Unbekannter Fisch"}</strong>
                                        <small>${owned ? `${entry.count}x &middot; ${kgQualityDisplay(entry.bestKg, fish.maxKg)}` : "Noch nicht gefangen"}</small>
                                        ${unclaimed ? `
                                            <button class="index-claim-overlay" type="button" data-action="claim-index" data-fish-id="${fish.id}">
                                                <span class="index-claim-coin">+${coins(reward)}</span>
                                                <span class="index-claim-label">Coins sammeln</span>
                                            </button>
                                        ` : ""}
                                    </article>
                                `;
                            }).join("")}
                        </div>
                    </div>
                `).join("")}
            </section>
        `;
    }).join("");
}

function renderAreas() {
    elements.areas.innerHTML = Object.values(AREAS).map((area) => {
        const progress = getAreaIndexProgress(state, area.id);
        const unlocked = state.unlockedAreas.includes(area.id);
        return `
            <article class="area-card ${state.currentArea === area.id ? "is-active" : ""}">
                <div class="area-card-head">
                    <h3>${area.name}</h3>
                    <span class="area-lock">${unlocked ? `${progress.caught}/${progress.total}` : `Freischaltbar ab Prestige ${area.prestige}`}</span>
                </div>
                <p>${unlocked ? "Dieses Gewässer ist verfügbar." : "Noch nicht freigeschaltet."}</p>
                <button data-switch-area="${area.id}" type="button" ${!unlocked || state.currentArea === area.id ? "disabled" : ""}>
                    ${state.currentArea === area.id ? "Aktiv" : "Hier angeln"}
                </button>
            </article>
        `;
    }).join("");

    const prestige = getPrestigeState(state);
    elements.prestige.innerHTML = prestige.capped
        ? `
            <h3>Prestige-Cap erreicht</h3>
            <p>Du hast alle V1-Areas geöffnet. Neue Gewässer kommen mit späteren Updates.</p>
        `
        : `
            <h3>Nächstes Gewässer: ${AREAS[prestige.nextArea].name}</h3>
            <p>Beim Freischalten startest du mit frischen Coins, Upgrades und leerem Inventar. Dein Fish Index, alle bisherigen Fänge und freigeschalteten Areas bleiben dir erhalten.</p>
            <ul>
                <li class="${prestige.coinsReady ? "is-ready" : ""}">${prestige.coinsReady ? "Bereit:" : "Noch nötig:"} ${coins(prestige.requiredCoins)} Coins zur Hand haben</li>
                <li class="${prestige.upgradesReady ? "is-ready" : ""}">${prestige.upgradesReady ? "Bereit:" : "Noch nötig:"} alle Upgrades voll ausgebaut</li>
                <li class="is-open">Prestige ${state.prestige + 1} schaltet ${AREAS[prestige.nextArea].name} frei</li>
            </ul>
            <button id="prestige-now" type="button" ${prestige.canPrestige ? "" : "disabled"}>${AREAS[prestige.nextArea].name} freischalten</button>
        `;
}

function renderStats() {
    const completion = getAvailableAreas(state)
        .map((areaId) => getAreaIndexProgress(state, areaId))
        .reduce((totals, progress) => ({
            caught: totals.caught + progress.caught,
            total: totals.total + progress.total,
        }), { caught: 0, total: 0 });

    elements.stats.innerHTML = [
        ["Total Caught", coins(state.stats.totalCaught)],
        ["Fish Index", `${completion.caught}/${completion.total}`],
        ["Prestige", `${state.prestige}/${PRESTIGE_CAP}`],
        ["Coins verdient", coins(state.stats.totalCoinsEarned)],
        ["Verkaufte Fische", coins(state.stats.totalSold)],
        ["Schwerster Fang", kg(state.stats.bestWeightKg)],
        ["Wertvollster Fang", `${coins(state.stats.bestCatchValue)} Coins`],
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

function syncAudioUi() {
    elements.musicToggle.checked = !audio.settings.musicMuted;
    elements.sfxToggle.checked = !audio.settings.sfxMuted;
    elements.musicVolume.value = String(Math.round(audio.settings.musicVolume * 100));
    elements.sfxVolume.value = String(Math.round(audio.settings.sfxVolume * 100));
}

function renderSettings() {
    applyMotionSetting();
    syncAudioUi();
}

function renderWindow(name) {
    if (name === "shop") {
        renderShop();
    }
    if (name === "inventory") {
        renderInventory();
    }
    if (name === "index") {
        renderIndex();
    }
    if (name === "areas") {
        renderAreas();
    }
    if (name === "stats") {
        renderStats();
    }
    if (name === "settings") {
        renderSettings();
    }
    if (name === "changelog") {
        renderChangelog();
    }
}

let changelogRendered = false;
function escapeHtmlSimple(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function renderChangelog() {
    if (changelogRendered) return;
    const root = document.getElementById("fishing-changelog");
    if (!root) return;
    root.innerHTML = FISHING_CHANGELOG.map((entry) => `
        <section class="changelog-entry">
            <p class="changelog-date">${escapeHtmlSimple(entry.date)}</p>
            <h3>${escapeHtmlSimple(entry.title)}</h3>
            <ul class="changelog-list">
                ${entry.items.map((item) => `<li>${escapeHtmlSimple(item)}</li>`).join("")}
            </ul>
        </section>
    `).join("");
    changelogRendered = true;
}

function renderAll() {
    renderHud();
    if (activeWindow) {
        renderWindow(activeWindow);
    }
}

// Quality-Color: lerp red → orange → green → gold basierend auf kg/maxKg Ratio.
// Smooth Übergang über 4 RGB-Stops.
function qualityColor(ratio) {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    const stops = [
        { p: 0.00, rgb: [255, 107, 107] }, // red
        { p: 0.33, rgb: [255, 153, 102] }, // orange
        { p: 0.66, rgb: [101, 226, 162] }, // green
        { p: 1.00, rgb: [255, 209, 102] }, // gold
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i], b = stops[i + 1];
        if (r >= a.p && r <= b.p) {
            const t = (r - a.p) / (b.p - a.p);
            const mix = (c1, c2) => Math.round(c1 + (c2 - c1) * t);
            return `rgb(${mix(a.rgb[0], b.rgb[0])}, ${mix(a.rgb[1], b.rgb[1])}, ${mix(a.rgb[2], b.rgb[2])})`;
        }
    }
    return `rgb(${stops[stops.length - 1].rgb.join(",")})`;
}

// Seltenheits-Berechnung: gibt die ungefähre 1-in-X Wahrscheinlichkeit für diesen
// exakten Catch zurück (Rarity × Mutationen × kg-Quality, multiplikativ). Wird
// als "1 / X" Popup unterhalb des Catch-Popups angezeigt — Roblox-Style Drop-Brag.
//
// Vereinfachte Wahrscheinlichkeiten (auf Catch-Basis, ohne Wetter-conditional):
const _RARITY_BASE_P = { Common: 0.75, Uncommon: 0.22, Rare: 0.07, Epic: 0.02, Legendary: 0.005 };
const _MUTATION_BASE_P = {
    big: 0.065, huge: 0.025, shiny: 0.010,
    sunny: 0.033, wet: 0.033, stormy: 0.033, misty: 0.033, nocturnal: 0.033,
    abyssal: 0.0063, aurora: 0.015, ember: 0.0083, crimson: 0.005, haunted: 0.0025,
};

function catchRarityRatio(candidate) {
    const fish = candidate.fish;
    let p = _RARITY_BASE_P[fish.rarity] || 0.5;
    // Mutations werden durch Glück sanft gebuffed → effektive Wahrscheinlichkeit sinkt mit Lvl.
    const luckMult = 1 + (state?.upgrades?.luck || 0) * 0.08;
    for (const id of (candidate.mutations || [])) {
        const base = _MUTATION_BASE_P[id] || 0.01;
        p *= Math.min(0.95, base * luckMult);
    }
    // kg-Quality: nur Bonus-Seltenheit ab 90% (sonst zählt's praktisch nicht)
    if (fish.maxKg > 0) {
        const ratio = Math.min(1, candidate.kg / fish.maxKg);
        if (ratio >= 0.99) p *= 0.008;        // ~1/125 für 99%+
        else if (ratio >= 0.95) p *= 0.05;    // ~1/20
        else if (ratio >= 0.90) p *= 0.10;    // ~1/10
    }
    return p;
}

function formatRarityOdds(p) {
    if (!p || p >= 1) return null;
    const oneIn = 1 / p;
    if (oneIn < 1000) return `1 / ${Math.round(oneIn)}`;
    if (oneIn < 1000000) {
        const k = oneIn / 1000;
        return `1 / ${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
    }
    if (oneIn < 1000000000) {
        const m = oneIn / 1000000;
        return `1 / ${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
    }
    const b = oneIn / 1000000000;
    return `1 / ${b < 10 ? b.toFixed(2) : b.toFixed(1)}B`;
}

function kgQualityDisplay(currentKg, maxKg) {
    const cur = Number(currentKg) || 0;
    const max = Number(maxKg) || 0;
    if (max <= 0) return kg(cur);
    const ratio = Math.min(1, cur / max);
    const color = qualityColor(ratio);
    const pct = Math.round(ratio * 100);
    // Glow ab 99% — Trophy-Display feiert nahezu-perfekte Fische
    const glow = ratio >= 0.99 ? " is-perfect" : "";
    return `<span class="kg-quality${glow}" style="color:${color}">${kg(cur)} / ${kg(max)} <small>(${pct}%)</small></span>`;
}

function renderMutationBadges(candidate) {
    const ids = Array.isArray(candidate?.mutations) ? candidate.mutations : [];
    if (!ids.length) return "";
    const badges = ids.map((id) => {
        const m = MUTATIONS_BY_ID[id];
        if (!m) return "";
        const glow = m.glow ? " is-glow" : "";
        return `<span class="mutation-badge${glow}" style="--mut:${m.color}">${m.name}</span>`;
    }).join("");
    const multTxt = candidate.mutationMult && candidate.mutationMult > 1
        ? `<span class="mutation-mult">×${Number(candidate.mutationMult).toFixed(candidate.mutationMult % 1 === 0 ? 0 : 1)}</span>`
        : "";
    return `<div class="mutation-row">${badges}${multTxt}</div>`;
}

function mutationLabel(candidate) {
    const ids = Array.isArray(candidate?.mutations) ? candidate.mutations : [];
    return ids.map((id) => MUTATIONS_BY_ID[id]?.name).filter(Boolean).join(" ");
}

function showCatch(candidate, isNew = false) {
    const popup = document.createElement("article");
    const hasMutation = Array.isArray(candidate?.mutations) && candidate.mutations.length > 0;
    popup.className = `catch-popup${isNew ? " is-new" : ""}${hasMutation ? " is-mutated" : ""}`;
    popup.style.setProperty("--rarity", RARITIES[candidate.fish.rarity]?.color || "#79d9f7");
    if (hasMutation) {
        const first = MUTATIONS_BY_ID[candidate.mutations[0]];
        const last = MUTATIONS_BY_ID[candidate.mutations[candidate.mutations.length - 1]];
        if (first) popup.style.setProperty("--mut-primary", first.color);
        if (last) popup.style.setProperty("--mut-glow", last.color);
    }
    // Seltenheit berechnen — wenn der Fang besonders ist (Mutation / hohe kg-Quality /
    // Epic+ Rarity) zeigen wir ein extra "1 / X"-Popup mit Bounce-Animation.
    const rarityP = catchRarityRatio(candidate);
    const odds = formatRarityOdds(rarityP);
    const kgRatio = candidate.fish.maxKg > 0 ? candidate.kg / candidate.fish.maxKg : 0;
    const showRarityPopup = hasMutation
        || kgRatio >= 0.90
        || candidate.fish.rarity === "Epic"
        || candidate.fish.rarity === "Legendary";

    popup.innerHTML = `
        ${isNew ? `<span class="catch-new-badge">NEU im Index</span>` : ""}
        ${renderFishArt(candidate.fish)}
        <div class="catch-popup-info">
            ${renderMutationBadges(candidate)}
            ${isNew ? `<em class="catch-popup-kicker">Neuer Fisch entdeckt</em>` : ""}
            <strong>${candidate.fish.name}</strong>
            <small>${candidate.fish.rarity} &middot; ${kgQualityDisplay(candidate.kg, candidate.fish.maxKg)}</small>
            <span>${coins(candidate.value)} Coins Verkaufswert</span>
        </div>
    `;
    elements.popups.append(popup);
    // Mutationen + seltene Fänge länger sichtbar (Show-Off-Moment).
    const dur = showRarityPopup ? 5600 : (isNew ? 4400 : 2800);
    window.setTimeout(() => popup.remove(), dur);

    // Roblox-Style: zusätzliches Seltenheits-Popup das nochmal hochpoppt
    if (showRarityPopup && odds) {
        showRarityOddsPopup(candidate, odds);
    }
}

function showRarityOddsPopup(candidate, odds) {
    // Verzögert öffnen damit's NACH dem Catch-Popup peaked
    window.setTimeout(() => {
        const odd = document.createElement("div");
        odd.className = "rarity-odds-popup";
        // Glow-Farbe: letzte Mutation > Rarity-Farbe
        const lastMut = candidate.mutations?.length
            ? MUTATIONS_BY_ID[candidate.mutations[candidate.mutations.length - 1]]
            : null;
        const accent = lastMut?.color || RARITIES[candidate.fish.rarity]?.color || "#ffd166";
        odd.style.setProperty("--accent", accent);
        odd.innerHTML = `
            <span class="rarity-odds-kicker">Seltenheit</span>
            <strong class="rarity-odds-value">${odds}</strong>
        `;
        elements.popups.append(odd);
        window.setTimeout(() => odd.remove(), 3600);
    }, 600);
}

function showCoinGain(amount, fishEl) {
    const stageRect = elements.water.getBoundingClientRect();
    const fishRect = fishEl.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) {
        return;
    }
    const pop = document.createElement("div");
    pop.className = "coin-gain";
    pop.textContent = `+${coins(amount)}`;
    pop.style.left = `${((fishRect.left + fishRect.width / 2) - stageRect.left) / stageRect.width * 100}%`;
    pop.style.top = `${((fishRect.top + fishRect.height / 2) - stageRect.top) / stageRect.height * 100}%`;
    elements.water.append(pop);
    window.setTimeout(() => pop.remove(), 1400);
}

async function saveNow() {
    window.clearTimeout(saveTimer);
    if (cloudSaveBlocked) {
        setSaveStatus("Cloud nicht geladen. Bitte neu laden.", true);
        return;
    }
    setSaveStatus(user ? "Cloud-Save läuft..." : "Lokal speichern...");
    const result = await saveState(state, user);
    if (result.error) {
        setSaveStatus("Cloud-Save fehlgeschlagen.", true);
        return;
    }
    setSaveStatus(result.mode === "cloud" ? "Cloud-Save aktuell." : "Lokal gespeichert.");
}

function scheduleSave() {
    if (cloudSaveBlocked) {
        setSaveStatus("Cloud nicht geladen. Bitte neu laden.", true);
        return;
    }
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveNow(), 750);
}

async function loadLeaderboard() {
    if (!user) {
        leaderboardLoaded = true;
        elements.leaderboard.innerHTML = `<p class="empty-copy">Melde dich an, um die Rangliste zu sehen und deinen Fortschritt einzutragen.</p>`;
        return;
    }

    elements.leaderboard.innerHTML = `<p class="empty-copy">Rangliste wird geladen...</p>`;
    const { entries, error } = await fetchLeaderboard();
    leaderboardLoaded = true;
    if (error) {
        elements.leaderboard.innerHTML = `<p class="empty-copy">${escapeHtml(error.message)}</p>`;
        return;
    }

    elements.leaderboard.innerHTML = entries.length
        ? entries.slice(0, 100).map((entry) => `
            <article class="leaderboard-row ${entry.rank <= 3 ? "is-top" : ""}">
                <b>#${entry.rank}</b>
                <strong>${renderLevelTag(entry.level, entry.equippedBadge)}${renderPlayerName(escapeHtml(entry.name), { vip: entry.vip, vipColor: entry.vipColor })}</strong>
                <small>Prestige ${entry.prestige} - ${coins(entry.totalCaught)} Fische</small>
            </article>
        `).join("")
        : `<p class="empty-copy">Noch keine Fänge in der Rangliste.</p>`;
}

const minigame = new FishingMinigame(elements.fishingOverlay, {
    onOpen() {
        setHint("Halte die grüne Zone am Punkt. Der Fangfortschritt sinkt nur langsam, wenn du ihn verlierst.");
    },
    onClose() {
        audio.pauseReel?.();
        setHint("Tippe die nächste Fischstelle an.");
    },
    onHoldChange(held) {
        if (held) {
            audio.playReel?.();
        } else {
            audio.pauseReel?.();
        }
    },
    onCatch(candidate) {
        const isNew = !state.index[candidate.fishId]?.count;
        addCatch(state, candidate);
        showCatch(candidate, isNew);
        audio.playCatch();
        // Telemetrie: anonymes Event-Log für Balance-Analyse (nur eingeloggte User).
        logCatch(candidate, weatherEventSystem?.getEvent?.() || null);
        // XP für diesen Catch (Rarity + Mutations-Bonus). Wird im Hintergrund batched.
        addPendingXp(xpForCatch(candidate), "fishing-catch");
        // Broadcast-Trigger: Epic/Legendary IMMER, plus jeder Fang mit einer Mutation
        // ab Multiplier ×3 — also SHINY (×3), AURORA (×3), ABYSSAL (×4), EMBER (×5),
        // CRIMSON (×7), HAUNTED (×10). Die ×2-Mutationen (BIG/HUGE, alle Standard-Wetter)
        // sind explizit ausgeschlossen, sonst würde der Feed spammen.
        const SHOUT_MULT_THRESHOLD = 3;
        const hasShoutMutation = (candidate.mutations || [])
            .some((id) => (MUTATIONS_BY_ID[id]?.mult || 0) >= SHOUT_MULT_THRESHOLD);
        const isHighRarity = candidate.fish.rarity === "Epic" || candidate.fish.rarity === "Legendary";
        if (isHighRarity || hasShoutMutation) {
            broadcast.announce({
                name: playerName,
                fish: candidate.fish.name,
                rarity: candidate.fish.rarity,
                mutationLabel: mutationLabel(candidate),
            });
        }
        renderAll();
        scheduleSave();
    },
    onEscape(candidate) {
        audio.playEscape();
        setHint(`${candidate.fish.rarity} entwischt. Die nächste Fischstelle kommt.`);
    },
});

function startFishing(forcedRarity = null) {
    audio.unlock();
    audio.playCast();
    const luckLevel = weatherEventSystem ? weatherEventSystem.applyLuck(state.upgrades.luck) : state.upgrades.luck;
    const bonuses = weatherEventSystem ? weatherEventSystem.applyBonuses(getMinigameBonuses(state)) : getMinigameBonuses(state);
    const rarityMults = weatherEventSystem?.getRarityMultipliers?.() || null;
    // Dev-Overrides (nur in Preview/Localhost aktiv): forciert Rarity / Fisch / Gewicht / Mutationen.
    const devRarity = window.__dev?.consumeForcedRarity?.() || null;
    const devFishMode = window.__dev?.consumeForcedFishMode?.() || null;
    const devWeightMode = window.__dev?.consumeForcedWeightMode?.() || null;
    let baseCandidate = rollCatch(state.currentArea, luckLevel, devRarity || forcedRarity, rarityMults);
    // "Rarest"-Override: ersetzt den gerollten Fisch durch den seltensten im selben Rarity-Pool.
    if (devFishMode === "rarest") {
        const rarest = getRarestFishInArea(state.currentArea, baseCandidate.fish.rarity);
        if (rarest) {
            baseCandidate = {
                ...baseCandidate,
                fishId: rarest.id,
                fish: rarest,
                value: getFishValue(rarest, baseCandidate.kg),
            };
        }
    }
    // "Max Weight"-Override: pusht kg auf den Max-Wert des Fisches.
    if (devWeightMode === "max") {
        const maxKg = Number(baseCandidate.fish.maxKg) || baseCandidate.kg;
        baseCandidate = {
            ...baseCandidate,
            kg: maxKg,
            value: getFishValue(baseCandidate.fish, maxKg),
        };
    }
    const event = weatherEventSystem?.getEvent?.() || null;
    // Mutationen kriegen sanften Glück-Bonus (+8 % chance pro Glück-Level, max 95 %).
    // Roher state.upgrades.luck (0-5) — bewusst NICHT der bereits gebufte luckLevel,
    // sonst würde Sonne (×2) auch Mutationen verdoppeln, was zu viel wäre.
    let mutations = rollMutations(event, state.upgrades.luck);
    const devMuts = window.__dev?.consumeForcedMutations?.();
    if (devMuts) mutations = devMuts;
    const candidate = applyMutationsToCandidate(baseCandidate, mutations);
    minigame.start(candidate, bonuses);
}

function claimIndexReward(fishId) {
    const fish = FISH_BY_ID[fishId];
    const entry = state.index[fishId];
    if (!fish || !entry || entry.count <= 0 || entry.claimed) return;
    const reward = INDEX_REWARDS[fish.rarity] || 0;
    if (reward <= 0) return;
    entry.claimed = true;
    state.coins += reward;
    state.stats.totalCoinsEarned += reward;
    audio.playSell?.();
    showBroadcast(`📖 Fish-Index: +${coins(reward)} Coins für ${fish.name} eingesammelt!`);
    renderIndex();
    renderHud();
    scheduleSave();
}

let mutationDetailOpen = false;
function openMutationDetail(fishId) {
    const fish = FISH_BY_ID[fishId];
    const entry = state.index[fishId];
    if (!fish || !entry) return;
    if (mutationDetailOpen) return;
    mutationDetailOpen = true;
    const ownedMuts = entry.mutations || {};
    const overlay = document.createElement("div");
    overlay.className = "mutation-detail-overlay";
    overlay.innerHTML = `
        <div class="mutation-detail-panel" style="--rarity:${RARITIES[fish.rarity].color}">
            <button class="mutation-detail-close" type="button" aria-label="Schliessen">×</button>
            <header class="mutation-detail-head">
                <div class="mutation-detail-art">${renderFishArt(fish)}</div>
                <div>
                    <p class="mutation-detail-kicker">Mutations-Sammlung</p>
                    <h2>${fish.name}</h2>
                    <small>${fish.rarity} &middot; ${entry.count}× gefangen</small>
                </div>
            </header>
            <div class="mutation-detail-body">
                ${renderMutationDetailGroup("Standard-Mutationen", STANDARD_MUTATIONS, ownedMuts)}
                ${renderMutationDetailGroup("Wetter-Mutationen (Standard)", ["sunny","wet","stormy","misty","nocturnal"].map(id => EVENT_MUTATIONS[id]), ownedMuts)}
                ${renderMutationDetailGroup("Rare-Wetter-Mutationen", ["abyssal","aurora","ember","crimson","haunted"].map(id => EVENT_MUTATIONS[id]), ownedMuts)}
            </div>
            <footer class="mutation-detail-foot">
                <span>${Object.values(ownedMuts).reduce((s, v) => s + v, 0)} Mutations-Catches total</span>
                <span>${Object.keys(ownedMuts).length} / 13 verschiedene gefunden</span>
            </footer>
        </div>
    `;
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest(".mutation-detail-close")) {
            overlay.remove();
            mutationDetailOpen = false;
        }
    });
    document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") {
            overlay.remove();
            mutationDetailOpen = false;
            document.removeEventListener("keydown", escHandler);
        }
    });
    document.body.append(overlay);
}

function renderMutationDetailGroup(title, mutations, ownedMuts) {
    return `
        <section class="mutation-detail-group">
            <h3>${title}</h3>
            <div class="mutation-detail-grid">
                ${mutations.map((m) => {
                    if (!m) return "";
                    const count = ownedMuts[m.id] || 0;
                    const owned = count > 0;
                    const mult = m.mult % 1 === 0 ? m.mult : m.mult.toFixed(1);
                    return `
                        <div class="mutation-detail-card ${owned ? "is-owned" : "is-locked"}" style="--mut:${m.color}">
                            <span class="mutation-detail-mult">×${mult}</span>
                            <strong>${m.name}</strong>
                            <small>${owned ? `${count}× gefangen` : "Noch nicht gefangen"}</small>
                        </div>
                    `;
                }).join("")}
            </div>
        </section>
    `;
}

function bindUi() {
    document.addEventListener("click", (event) => {
        const opener = event.target.closest("[data-open-window]");
        if (opener) {
            openWindow(opener.dataset.openWindow);
        }
        if (event.target.closest("[data-close-window]")) {
            closeWindows();
        }
        if (event.target.closest("[data-close-menu]")) {
            closeMenu();
        }
    });

    // Generischer UI-Klick: jeder Button im Spiel-Shell (außer Wasserfläche & Fischstellen).
    document.addEventListener("pointerdown", (event) => {
        const btn = event.target.closest("button");
        if (!btn) return;
        if (btn.classList.contains("fish-spot")) return;
        if (btn.closest(".water-stage") && !btn.closest(".game-window") && !btn.closest(".game-actions") && !btn.closest(".game-menu")) return;
        if (btn.hasAttribute("data-fishing-cancel")) {
            audio.playUiClick();
            return;
        }
        if (btn.matches("[data-buy-upgrade]") || btn.id === "sell-all") {
            // diese spielen ihren eigenen Buy/Sell-Sound nach erfolgreicher Aktion
            return;
        }
        audio.playUiClick();
    }, true);

    // Wasser-Klick: Plätscher-SFX + bestehender Splash-Ripple (vom WaterSystem getriggert).
    elements.water.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".fish-spot")) return;
        audio.unlock();
        audio.playSplash();
    });

    elements.menuToggle.addEventListener("click", () => {
        if (elements.menu.hidden) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    // Angel-UI system bridge: buyUpgrade + Buy-Sound + Save
    angelUiSystem = new AngelUiSystem(elements.angelBody, {
        getState: () => state,
        formatCoins: (value) => coins(value),
        onBuy(upgradeId) {
            if (!buyUpgrade(state, upgradeId)) return false;
            audio.playBuy?.();
            renderAll();
            scheduleSave();
            return true;
        },
    });

    elements.sellAll.addEventListener("click", () => {
        const sold = sellAll(state);
        if (!sold.value) {
            return;
        }
        audio.playSell();
        setHint(`${sold.count} Fische verkauft für ${coins(sold.value)} Coins.`);
        renderAll();
        scheduleSave();
    });

    elements.index.addEventListener("click", (event) => {
        // Claim-Button hat höhere Prio als Mutation-Detail-Open — sonst klappt das Overlay
        // gleichzeitig auf wenn man auf den Coin-Button tippt.
        const claimBtn = event.target.closest("[data-action='claim-index']");
        if (claimBtn) {
            event.stopPropagation();
            claimIndexReward(claimBtn.dataset.fishId);
            return;
        }
        const fishCard = event.target.closest("[data-action='open-mutations']");
        if (fishCard) {
            openMutationDetail(fishCard.dataset.fishId);
        }
    });

    elements.areas.addEventListener("click", (event) => {
        const button = event.target.closest("[data-switch-area]");
        const areaId = button?.dataset.switchArea;
        if (!areaId || !state.unlockedAreas.includes(areaId) || areaId === state.currentArea) {
            return;
        }
        state.currentArea = areaId;
        closeWindows();
        playAreaTransition("Gewässer gewechselt", () => {
            bubbleSystem.clear();
            setHint(`Du angelst jetzt im ${AREAS[areaId].name}.`);
            renderAll();
        });
        scheduleSave();
    });

    elements.prestige.addEventListener("click", (event) => {
        if (!event.target.closest("#prestige-now")) {
            return;
        }
        if (!prestigeToNextArea(state)) {
            return;
        }
        audio.unlock();
        audio.playPrestige();
        closeWindows();
        playAreaTransition("Neue Area freigeschaltet", () => {
            bubbleSystem.clear();
            setHint(`${AREAS[state.currentArea].name} freigeschaltet. Neue Fische warten.`);
            renderAll();
        });
        scheduleSave();
    });

    elements.reducedMotion.addEventListener("change", () => {
        state.settings.reducedMotion = elements.reducedMotion.checked;
        applyMotionSetting();
        scheduleSave();
    });

    elements.musicToggle.addEventListener("change", () => {
        audio.unlock();
        audio.setMusicMuted(!elements.musicToggle.checked);
    });
    elements.musicVolume.addEventListener("input", () => {
        audio.unlock();
        audio.setMusicVolume(Number(elements.musicVolume.value) / 100);
    });
    elements.sfxToggle.addEventListener("change", () => {
        audio.unlock();
        audio.setSfxMuted(!elements.sfxToggle.checked);
        if (elements.sfxToggle.checked) {
            audio.playCast();
        }
    });
    elements.sfxVolume.addEventListener("input", () => {
        audio.unlock();
        audio.setSfxVolume(Number(elements.sfxVolume.value) / 100);
    });
    elements.sfxVolume.addEventListener("change", () => audio.playCatch());

    window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
    window.addEventListener("keydown", () => audio.unlock(), { once: true });

    elements.saveNow.addEventListener("click", saveNow);
    elements.leaderboardReload.addEventListener("click", () => {
        leaderboardLoaded = false;
        loadLeaderboard();
    });
    elements.resetSave.addEventListener("click", () => {
        const confirmed = window.confirm("Willst du deinen My Fishing Kaktus Spielstand wirklich zurücksetzen?");
        if (!confirmed) {
            return;
        }
        state = createInitialState();
        bubbleSystem.clear();
        closeWindows();
        applyMotionSetting();
        renderAll();
        scheduleSave();
        setHint("Neuer Pond-Run gestartet.");
    });
}

const FISHING_ADMIN_GAME_ID = "my-fishing-kaktus";
const seenAdminEventIds = new Set();
let adminEventPollTimer = 0;
let adminEventsPrimed = false;

const ADMIN_WEATHER_LABELS = {
    sunny: "Sonniges Wetter",
    rain: "Regen",
    storm: "Sturm",
    fog: "Nebel",
    night: "Nacht",
    abyss: "🌌 Abyss",
    polarlicht: "🌠 Polarlicht",
    glutsturm: "🔥 Glutsturm",
    blutmond: "🌑 Blutmond",
    geistermeer: "👻 Geistermeer",
    clear: "Wetter-Reset",
};
const ADMIN_FISH_LABELS = {
    small: "Kleiner Fisch",
    big: "Großer Fisch",
    sword: "Schwertfisch",
    shark: "Hai",
};

function handleAdminEvent(row) {
    if (!row || !row.id) return;
    if (seenAdminEventIds.has(row.id)) return;
    seenAdminEventIds.add(row.id);
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return;
    if (row.game_id !== FISHING_ADMIN_GAME_ID) return;

    const type = row.event_type || "";

    if (type.startsWith("weather-")) {
        const subtype = type.slice(8);
        const label = ADMIN_WEATHER_LABELS[subtype] || subtype;
        if (subtype === "clear") {
            weatherEventSystem?.forceEvent(null);
        } else {
            weatherEventSystem?.forceEvent(subtype);
        }
        showBroadcast(`⚙ Admin hat Event gestartet: ${label}`);
        return;
    }

    if (type.startsWith("spawn-fish-")) {
        const tier = type.slice(11);
        coinFishSystem?.spawnTier(tier);
        showBroadcast(`⚙ Admin spawnt: ${ADMIN_FISH_LABELS[tier] || tier}`);
        return;
    }

    if (type === "broadcast") {
        const msg = String(row.payload?.message || "").trim();
        if (msg) {
            showBroadcast(`📢 ${msg}`);
            audio.playCatch();
        }
        return;
    }

    if (type === "force-reload") {
        showBroadcast("⚙ Admin: Neue Version verfügbar — Spiel wird neu geladen…");
        window.setTimeout(() => location.reload(), 1500);
        return;
    }

    if (type.startsWith("force-spawn-")) {
        const rarity = type.slice(12);
        // Erste Buchstabe groß, Rest klein, damit z.B. "epic" → "Epic" wird (matched RARITIES keys).
        const niceRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
        bubbleSystem?.spawnForced(niceRarity);
        showBroadcast(`⚙ Admin: ${niceRarity}-Fischstelle aufgetaucht!`);
        audio.playCatch?.();
        return;
    }

    if (type === "spawn-karl") {
        karlSystem?.spawn(30000);
    }
}

async function fetchLiveAdminEvents() {
    if (!isConfigReady()) return [];
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
        .from("admin_game_events")
        .select("id,game_id,event_type,payload,expires_at,created_at")
        .eq("game_id", FISHING_ADMIN_GAME_ID)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(20);
    if (error) {
        return [];
    }
    return data || [];
}

async function primeAdminEvents() {
    const rows = await fetchLiveAdminEvents();
    rows.forEach((row) => row.id && seenAdminEventIds.add(row.id));
    adminEventsPrimed = true;
}

async function pollAdminEvents() {
    if (document.hidden) return;
    if (!adminEventsPrimed) {
        await primeAdminEvents();
        return;
    }
    const rows = await fetchLiveAdminEvents();
    rows.forEach(handleAdminEvent);
}

function subscribeAdminEvents() {
    if (!isConfigReady()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    supabase
        .channel("fishing-admin-events")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "admin_game_events",
                filter: `game_id=eq.${FISHING_ADMIN_GAME_ID}`,
            },
            ({ new: row }) => handleAdminEvent(row)
        )
        .subscribe();

    primeAdminEvents();
    window.clearInterval(adminEventPollTimer);
    adminEventPollTimer = window.setInterval(pollAdminEvents, 12000);
}

// Sicherheitsnetz: falls init() aus irgendeinem Grund hängt (Supabase-Timeout,
// Modul-Loading-Error etc.) blendet sich der Loading-Screen nach 8 s automatisch aus
// damit der Spieler nicht endlos vorm "Der Ozean wartet" Screen steht.
window.setTimeout(() => {
    const loader = document.getElementById("fishing-loading");
    if (loader && !loader.classList.contains("is-done")) {
        console.warn("Loading-Screen Sicherheits-Fallback ausgelöst nach 8 s.");
        hideLoadingScreen();
    }
}, 8000);

async function init() {
    bindUi();
    const loaded = await loadState();
    state = normalizeState(loaded.state);
    user = loaded.user;
    setTelemetryUser(user);
    setXpUser(user);
    cloudSaveBlocked = loaded.mode === "cloud-error";
    setSaveStatus(
        loaded.mode === "cloud"
            ? "Cloud-Save geladen."
            : loaded.mode === "cloud-error"
                ? "Cloud gerade nicht erreichbar."
                : "Lokaler Save geladen."
    );
    applyMotionSetting();
    broadcast.connect();
    if (user) {
        try {
            const profile = await fetchProfile(user.id);
            if (profile?.username) {
                playerName = profile.username;
            }
        } catch {
            // keep default broadcast name
        }
    }
    waterSystem = new WaterSystem(elements.water);
    weatherSystem = new WeatherSystem(elements.water, waterSystem);
    weatherEventSystem = new WeatherEventSystem({
        waterSystem,
        weatherSystem,
        onChange: handleWeatherChange,
    });
    renderWeatherBanner();
    window.setInterval(() => {
        if (weatherEventSystem?.getStatus().isActive) {
            renderWeatherBanner();
        }
    }, 1000);
    bubbleSystem = new BubbleSystem(elements.water, {
        getState: () => state,
        canSpawn: () => !activeWindow && elements.fishingOverlay.hidden && elements.areaTransition.hidden,
        onPick: startFishing,
        getSpawnMultiplier: () => weatherEventSystem?.getBuffs().spawnRate || 1,
        onSpawn(x, y) {
            waterSystem?.pulseAt(x, y, 0.18);
            audio.playSpotEmerge?.();
        },
    });
    bubbleSystem.start();
    coinFishSystem = new CoinFishSystem(elements.water, {
        canSpawn: () => !activeWindow && elements.fishingOverlay.hidden && elements.areaTransition.hidden,
        getSpawnMultiplier: () => weatherEventSystem?.getBuffs().spawnRate || 1,
        onTrail() {
            // Wellen-Trail bewusst entfernt — Timer-Fische schwimmen geräuschlos vorbei.
        },
        onCollect(tierId, fishEl) {
            const reward = COIN_FISH_REWARDS[state.currentArea]?.[tierId] || 0;
            if (!reward) {
                return;
            }
            state.coins += reward;
            state.stats.totalCoinsEarned += reward;
            audio.playSell();
            showCoinGain(reward, fishEl);
            renderHud();
            scheduleSave();
        },
    });
    try {
    coinFishSystem.start();

    karlSystem = new KarlSystem(elements.water, {
        canSpawn: () => !activeWindow && elements.fishingOverlay.hidden && elements.areaTransition.hidden,
        getCurrentArea: () => state.currentArea,
        onSpawn() {
            showBroadcast(`🐢 ${KARL_NAME} ist aufgetaucht — tippe ihn schnell an!`);
            audio.playCatch?.();
        },
        onEscape() {
            showBroadcast(`🐢 ${KARL_NAME} ist wieder abgetaucht.`);
        },
        onReward(reward) {
            if (reward.type === "coins-fixed") {
                state.coins += reward.amount;
                state.stats.totalCoinsEarned += reward.amount;
                showBroadcast(`🐢 Karl: +${reward.amount} Coins!`);
                audio.playSell?.();
                renderAll();
                scheduleSave();
            } else if (reward.type === "spawn" && reward.rarity) {
                bubbleSystem?.spawnForced(reward.rarity);
                showBroadcast(`🐢 Karl spawnt eine ${reward.rarity}-Fischstelle!`);
                audio.playCatch?.();
            }
        },
    });
    karlSystem.start();

    dailySystem = new DailySystem({
        onClaimRegistered() {
            // Wird sofort persistiert damit Reload nicht doppelt zeigt.
            scheduleSave();
            renderHud();
        },
        onClaim(reward) {
            // Coins gutschreiben
            if (reward.coins > 0) {
                state.coins += reward.coins;
                state.stats.totalCoinsEarned += reward.coins;
            }
            // Spawn-Belohnung: pro count einen Force-Spawn auslösen.
            // Daily-Spots leben 90 s (statt 12 s) damit niemand seine garantierte
            // Belohnung verpasst — auch nicht bei 2 gleichzeitigen Spawns.
            if (reward.spawn?.rarity && reward.spawn.count > 0) {
                const count = reward.spawn.count;
                const rarity = reward.spawn.rarity;
                for (let i = 0; i < count; i++) {
                    // Leicht zeitversetzt damit Spots nicht direkt übereinander spawnen
                    window.setTimeout(() => bubbleSystem?.spawnForced(rarity, { lifetimeSec: 90 }), i * 600);
                }
            }
            const parts = [];
            if (reward.coins > 0) parts.push(`+${reward.coins.toLocaleString("de-DE")} Coins`);
            if (reward.spawn) {
                parts.push(`${reward.spawn.count > 1 ? reward.spawn.count + "× " : ""}${reward.spawn.rarity}-Fischstelle`);
            }
            if (parts.length) showBroadcast(`📅 Daily-Bonus (Tag ${reward.streakDay}): ${parts.join(" + ")}`);
            audio.playSell?.();
            renderAll();
            scheduleSave();
        },
    });
    // Erst nach init zeigen damit das Spiel komplett gerendert ist.
    if (!cloudSaveBlocked) {
        window.setTimeout(() => dailySystem.checkAndShow(state), 800);
    }

    subscribeAdminEvents();

    // Dev-Panel — wird NUR dynamisch geladen wenn:
    //   1) wir auf localhost / ?dev=1 sind UND
    //   2) die Datei devPanel.js überhaupt existiert (sie ist gitignored + wird vom
    //      Netlify-Build-Step gelöscht → in Production ist sie schlicht 404).
    // Try/catch frisst jeden Fehler still, damit das Spiel im Live-Deploy 100 %
    // unverändert läuft. NICHTS davon ist in Production sichtbar oder fetchbar.
    const isDevHost = (() => {
        try {
            const host = location.hostname || "";
            if (host === "localhost" || host === "127.0.0.1" || host === "" || host.endsWith(".local")) return true;
            if (location.protocol === "file:") return true;
            if (new URLSearchParams(location.search).get("dev") === "1") return true;
        } catch {}
        return false;
    })();
    if (isDevHost) {
        import("./systems/devPanel.js")
            .then((mod) => mod.initDevPanel({
                weatherEventSystem,
                bubbleSystem,
                karlSystem,
                giveCoins: (amount) => {
                    const n = Math.max(0, Math.floor(Number(amount) || 0));
                    if (!n) return;
                    state.coins += n;
                    state.stats.totalCoinsEarned += n;
                    renderHud();
                    scheduleSave();
                },
            }))
            .catch(() => { /* Datei existiert in Production nicht — alles ok */ });
    }

    renderAll();
    } catch (err) {
        console.error("Init failed nach Save-Load:", err);
    } finally {
        hideLoadingScreen();
    }
}

function hideLoadingScreen() {
    const loader = document.getElementById("fishing-loading");
    if (!loader) return;
    // Ein Frame Verzögerung damit Wasser-Canvas + erstes Render auf dem Bildschirm sind
    // bevor wir ausblenden — vermeidet weißen Flash.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        loader.classList.add("is-done");
        window.setTimeout(() => loader.remove(), 700);
    }));
}

init();
