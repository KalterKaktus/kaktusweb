import { AREAS, PRESTIGE_CAP } from "./data/areas.js";
import { RARITIES } from "./data/rarities.js";
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
import { getRarityChances, rollCatch } from "./systems/raritySystem.js";
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
        showBroadcast(`Wetter-Event: ${event.name} — ${event.buffLabel} (5 Min.)`);
    } else if (previous) {
        showBroadcast("Wetter-Event vorbei.");
    }
}

const broadcast = new BroadcastSystem((payload) => {
    const adjective = RARITY_ADJECTIVE[payload?.rarity];
    if (!adjective || !payload.fish) {
        return;
    }
    showBroadcast(`${payload.name || "Ein Angler"} hat einen ${adjective} ${payload.fish} gefangen!!!`);
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
        ? entries.map((entry) => `
            <article class="inventory-row">
                ${renderFishArt(entry.fish)}
                <div class="inventory-info">
                    <strong>${entry.fish.name}</strong>
                    <small>${entry.fish.rarity} &middot; ${entry.count}x gefangen</small>
                    <small>Gesamt ${kg(entry.totalKg)} &middot; Bestes ${kg(entry.bestKg)}</small>
                </div>
                <div class="inventory-value">
                    <b>${coins(entry.totalValue)}</b>
                    <span>Coins</span>
                </div>
            </article>
        `).join("")
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
                            <span class="area-lock">Durch Prestige gesperrt</span>
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
                                return `
                                    <article class="index-fish ${entry ? "" : "is-shadow"}">
                                        ${renderFishArt(fish, { silhouette: !entry })}
                                        <strong>${entry ? fish.name : "Unbekannter Fisch"}</strong>
                                        <small>${entry ? `${entry.count}x gefangen - Bestes Gewicht ${kg(entry.bestKg)}` : "Noch nicht gefangen"}</small>
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
                    <span class="area-lock">${unlocked ? `${progress.caught}/${progress.total}` : `Prestige ${area.prestige}`}</span>
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
            <p>Prestige leert Coins, Upgrades und Inventar. Dein Fish Index, Fänge und freigeschaltete Areas bleiben.</p>
            <ul>
                <li class="${prestige.coinsReady ? "is-ready" : ""}">${prestige.coinsReady ? "Bereit:" : "Fehlt:"} ${coins(prestige.requiredCoins)} Coins halten</li>
                <li class="${prestige.upgradesReady ? "is-ready" : ""}">${prestige.upgradesReady ? "Bereit:" : "Fehlt:"} alle Upgrades maxen</li>
                <li class="is-open">Prestige ${state.prestige + 1} schaltet ${AREAS[prestige.nextArea].name} frei</li>
            </ul>
            <button id="prestige-now" type="button" ${prestige.canPrestige ? "" : "disabled"}>Prestige durchführen</button>
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

function showCatch(candidate, isNew = false) {
    const popup = document.createElement("article");
    popup.className = isNew ? "catch-popup is-new" : "catch-popup";
    popup.style.setProperty("--rarity", RARITIES[candidate.fish.rarity]?.color || "#79d9f7");
    popup.innerHTML = `
        ${isNew ? `<span class="catch-new-badge">NEU im Index</span>` : ""}
        ${renderFishArt(candidate.fish)}
        <div class="catch-popup-info">
            ${isNew ? `<em class="catch-popup-kicker">Neuer Fisch entdeckt</em>` : ""}
            <strong>${candidate.fish.name}</strong>
            <small>${candidate.fish.rarity} &middot; ${kg(candidate.kg)}</small>
            <span>${coins(candidate.value)} Coins Verkaufswert</span>
        </div>
    `;
    elements.popups.append(popup);
    window.setTimeout(() => popup.remove(), isNew ? 4400 : 2800);
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
                <strong>${escapeHtml(entry.name)}</strong>
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
        if (candidate.fish.rarity === "Epic" || candidate.fish.rarity === "Legendary") {
            broadcast.announce({
                name: playerName,
                fish: candidate.fish.name,
                rarity: candidate.fish.rarity,
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
    const candidate = rollCatch(state.currentArea, luckLevel, forcedRarity);
    minigame.start(candidate, bonuses);
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
