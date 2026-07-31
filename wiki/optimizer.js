// KaktusClicker Kauf-Optimizer für die Wiki-Seite.
//
// Liest den Cloud-Save (read-only!) des eingeloggten Spielers und berechnet die
// nächsten 10 Käufe mit dem besten ROI. Kandidaten sind sowohl Gebäude als auch
// die gebäudebezogenen Upgrades — seit Economy V3 ist das der entscheidende
// Punkt: ein Blüten-Upgrade kostet ~2,5 Stückpreise, verdoppelt aber ALLE
// besessenen Exemplare. Bei 10 Stück ist es damit rund 4x, bei 100 Stück rund
// 40x rentabler als ein weiteres Gebäude. Ein Plan, der nur Gebäude vorschlägt,
// wäre schlicht falsch.
//
// ROI = Kosten ÷ zusätzliche CPS = Sekunden bis der Kauf sich refinanziert hat.
//
// Ignoriert bewusst: globale Multiplikatoren (Prestige-Nopal, Achievements,
// Goldlauf) — sie skalieren jeden Kandidaten gleich und ändern die Reihenfolge
// daher nicht. Ebenso Klick-, Klick-Sog- und Autoklicker-Upgrades: die zahlen
// auf den Klick-Ertrag ein, nicht auf die CPS, und sind mit einer CPS-ROI nicht
// vergleichbar.

import { buildings, upgrades } from "/games/KaktusClicker/data.js";
import { loadCloudSave, getGameSession, KAKTUS_GAME_ID } from "/js/game-cloud.js";
import { formatNumber } from "/games/KaktusClicker/format.js";
import { t, onLanguageChange, ready as i18nReady } from "/js/i18n.js";

const buildingById = new Map(buildings.map((b) => [b.id, b]));

// Gebäudename in aktueller Sprache (Fallback = deutscher Originalname).
function tBuilding(b) {
    const key = `clicker.buildings.${b.id}.name`;
    const value = t(key);
    return value === key ? b.name : value;
}

// Upgrade-Name — gleiche Logik wie tName() im Spiel: die generierten Core- und
// Blüten-Upgrades haben keinen eigenen Key, ihr Name wird aus dem Gebäudenamen
// plus Suffix zusammengesetzt.
function tUpgrade(u) {
    const key = `clicker.upgrades.${u.id}.name`;
    const value = t(key);
    if (value !== key) return value;
    if (u.buildingId) {
        const bKey = `clicker.buildings.${u.buildingId}.name`;
        const bValue = t(bKey);
        if (bValue !== bKey) {
            if (u.tier) {
                const tierKey = `clicker.upgrade_tier_${u.tier}`;
                const tierValue = t(tierKey, { name: bValue });
                if (tierValue !== tierKey) return tierValue;
            } else {
                return t("clicker.upgrade_core_suffix", { name: bValue });
            }
        }
    }
    return u.name;
}

const root = document.getElementById("optimizer-root");
const statusEl = document.getElementById("optimizer-status");
const resultEl = document.getElementById("optimizer-result");
const manualEl = document.getElementById("optimizer-manual");
const toggleManualBtn = document.getElementById("optimizer-toggle-manual");
const recomputeBtn = document.getElementById("optimizer-recompute");

const PRICE_GROWTH = 1.15;
const SIMULATION_STEPS = 10;

// Nur Upgrades, die auf ein Gebäude wirken, sind Teil der CPS-Rechnung.
const buildingUpgrades = upgrades.filter((u) => u.buildingId && u.buildingMultiplier > 1);

// --- Berechnungs-Logik ---

function getBuildingCost(baseCost, owned) {
    return Math.ceil(baseCost * Math.pow(PRICE_GROWTH, owned));
}

// Ein Upgrade ist kaufbar, sobald sein Gebäude die Schwelle erreicht hat.
// Upgrades ohne unlockOwned (Legacy + Core) sind von Anfang an sichtbar.
function isUpgradeUnlocked(upgrade, ownedMap) {
    if (!upgrade.unlockOwned) return true;
    return (Number(ownedMap?.[upgrade.buildingId]) || 0) >= upgrade.unlockOwned;
}

function normaliseOwned(ownedMap) {
    const owned = {};
    for (const b of buildings) {
        owned[b.id] = Math.max(0, Math.floor(Number(ownedMap?.[b.id]) || 0));
    }
    return owned;
}

function collectMultipliers(boughtIds) {
    const multipliers = {};
    for (const b of buildings) multipliers[b.id] = 1;
    for (const u of buildingUpgrades) {
        if (boughtIds.has(u.id)) multipliers[u.buildingId] *= u.buildingMultiplier;
    }
    return multipliers;
}

function simulateBestBuys(ownedMap, boughtUpgradeIds) {
    const owned = normaliseOwned(ownedMap);
    const bought = new Set(boughtUpgradeIds);
    const multiplier = collectMultipliers(bought);

    const plan = [];
    for (let step = 1; step <= SIMULATION_STEPS; step++) {
        let best = null;
        const consider = (candidate) => {
            if (!(candidate.gain > 0) || !(candidate.cost > 0)) return;
            candidate.roi = candidate.cost / candidate.gain;
            if (!best || candidate.roi < best.roi) best = candidate;
        };

        for (const b of buildings) {
            consider({
                type: "building",
                id: b.id,
                icon: b.icon,
                displayName: tBuilding(b),
                cost: getBuildingCost(b.baseCost, owned[b.id]),
                // Ein weiteres Exemplar bringt genau seine eigene effektive CPS.
                gain: b.cps * multiplier[b.id],
                ownedBefore: owned[b.id],
                ownedAfter: owned[b.id] + 1,
            });
        }

        for (const u of buildingUpgrades) {
            if (bought.has(u.id) || !isUpgradeUnlocked(u, owned)) continue;
            const b = buildingById.get(u.buildingId);
            if (!b) continue;
            consider({
                type: "upgrade",
                id: u.id,
                icon: u.icon,
                displayName: tUpgrade(u),
                buildingName: tBuilding(b),
                buildingId: b.id,
                factor: u.buildingMultiplier,
                cost: u.cost,
                // Das Upgrade hebt die aktuelle Produktion aller besessenen
                // Exemplare an: owned × cps × bisherigerMultiplikator × (f − 1).
                gain: owned[b.id] * b.cps * multiplier[b.id] * (u.buildingMultiplier - 1),
            });
        }

        if (!best) break;
        plan.push({ step, ...best });

        if (best.type === "building") {
            owned[best.id] += 1;
        } else {
            bought.add(best.id);
            multiplier[best.buildingId] *= best.factor;
        }
    }
    return plan;
}

// --- Render ---

function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.dataset.type = type;
    statusEl.textContent = message;
}

function planRowDetail(entry) {
    if (entry.type === "upgrade") {
        return `${entry.buildingName} ×${entry.factor} · +${formatNumber(entry.gain)} CPS`;
    }
    return `${t("wiki.opt.owned")} ${entry.ownedBefore} → ${entry.ownedAfter} · +${formatNumber(entry.gain)} CPS`;
}

function renderPlan(plan, source) {
    if (!plan.length) {
        resultEl.innerHTML = `<p class="opt-empty">${t("wiki.opt.no_recommendation")}</p>`;
        return;
    }

    const sourceTag = source === "cloud"
        ? `<span class="opt-source-pill opt-source-cloud">${t("wiki.opt.from_cloud")}</span>`
        : `<span class="opt-source-pill opt-source-manual">${t("wiki.opt.manual_input")}</span>`;

    resultEl.innerHTML = `
        <div class="opt-result-head">
            <h3>${t("wiki.opt.next_ten")}</h3>
            ${sourceTag}
        </div>
        <ol class="opt-plan">
            ${plan.map((entry) => `
                <li class="opt-plan-row opt-plan-row--${entry.type}" style="--opt-step:${entry.step}">
                    <span class="opt-step-num">#${entry.step}</span>
                    <span class="opt-step-icon">${entry.icon}</span>
                    <div class="opt-step-main">
                        <strong>${entry.displayName}</strong>
                        <small>
                            <em class="opt-kind">${t(entry.type === "upgrade" ? "wiki.opt.kind_upgrade" : "wiki.opt.kind_building")}</em>
                            ${planRowDetail(entry)}
                        </small>
                    </div>
                    <div class="opt-step-cost">
                        <b>${formatNumber(entry.cost)}</b>
                        <small>${t("clicker.score_label")}</small>
                    </div>
                    <div class="opt-step-roi" title="${t("wiki.opt.roi_tooltip")}">
                        <b>${formatNumber(entry.roi)}</b>
                        <small>s ROI</small>
                    </div>
                </li>
            `).join("")}
        </ol>
        <p class="opt-disclaimer">
            ${t("wiki.opt.disclaimer")}
        </p>
    `;
}

// --- Manual mode ---

// Seit Economy V3 gibt es 150 gebäudebezogene Upgrades. Alle gleichzeitig als
// Checkbox zu rendern wäre unbenutzbar, deshalb zeigt die Liste nur die, die
// beim eingetragenen Besitz überhaupt freigeschaltet sind — und baut sich neu
// auf, sobald die Zahlen sich ändern.
function renderManualUpgradeList(ownedMap, checkedIds) {
    const target = manualEl.querySelector("[data-manual-upgrade-list]");
    if (!target) return;

    const available = buildingUpgrades.filter((u) => isUpgradeUnlocked(u, ownedMap));
    if (!available.length) {
        target.innerHTML = `<p class="opt-manual-empty">${t("wiki.opt.no_upgrades_yet")}</p>`;
        return;
    }

    const byBuilding = buildings
        .map((b) => ({ building: b, items: available.filter((u) => u.buildingId === b.id) }))
        .filter((group) => group.items.length);

    target.innerHTML = byBuilding.map((group) => `
        <div class="opt-manual-upgrade-group">
            <h4>${group.building.icon} ${tBuilding(group.building)}</h4>
            ${group.items.map((u) => `
                <label class="opt-manual-upgrade-row">
                    <input type="checkbox" data-manual-upgrade="${u.id}" ${checkedIds.includes(u.id) ? "checked" : ""}>
                    <span>${tUpgrade(u)} <em>(×${u.buildingMultiplier})</em></span>
                </label>
            `).join("")}
        </div>
    `).join("");
}

function readManualOwned() {
    const ownedMap = {};
    manualEl.querySelectorAll("[data-manual-owned]").forEach((input) => {
        ownedMap[input.dataset.manualOwned] = Math.max(0, Math.floor(Number(input.value) || 0));
    });
    return ownedMap;
}

function readManualUpgrades() {
    const ids = [];
    manualEl.querySelectorAll("[data-manual-upgrade]:checked").forEach((cb) => {
        ids.push(cb.dataset.manualUpgrade);
    });
    return ids;
}

function renderManualForm(prefillOwned = {}, prefillUpgrades = []) {
    manualEl.innerHTML = `
        <p class="opt-manual-intro">${t("wiki.opt.manual_intro")}</p>
        <div class="opt-manual-grid">
            ${buildings.map((b) => `
                <label class="opt-manual-field">
                    <span class="opt-manual-icon">${b.icon}</span>
                    <span class="opt-manual-name">${tBuilding(b)}</span>
                    <input class="opt-manual-input" type="number" min="0" step="1"
                           data-manual-owned="${b.id}"
                           value="${prefillOwned[b.id] || 0}"
                           inputmode="numeric">
                </label>
            `).join("")}
        </div>
        <details class="opt-manual-upgrades">
            <summary>${t("wiki.opt.check_upgrades")}</summary>
            <div class="opt-manual-upgrade-grid" data-manual-upgrade-list></div>
        </details>
        <button type="button" class="opt-manual-run" id="optimizer-manual-run">${t("wiki.opt.compute_plan")}</button>
    `;
    renderManualUpgradeList(prefillOwned, prefillUpgrades);

    // Besitz ändern schaltet Blüten-Upgrades frei bzw. wieder aus. Bereits
    // gesetzte Haken bleiben erhalten, auch wenn ein Upgrade kurz verschwindet.
    manualEl.querySelectorAll("[data-manual-owned]").forEach((input) => {
        input.addEventListener("input", () => {
            renderManualUpgradeList(readManualOwned(), readManualUpgrades());
        });
    });
    document.getElementById("optimizer-manual-run")?.addEventListener("click", computeManual);
}

function computeManual() {
    renderPlan(simulateBestBuys(readManualOwned(), readManualUpgrades()), "manual");
}

// --- Main flow ---

async function tryLoadCloud() {
    setStatus(t("wiki.opt.checking_login"));
    let session;
    try {
        session = await getGameSession();
    } catch (e) {
        session = null;
    }
    if (!session?.user?.id) {
        setStatus(t("wiki.opt.not_logged_in"), "warn");
        manualEl.hidden = false;
        toggleManualBtn.hidden = true;
        recomputeBtn.hidden = true;
        renderManualForm();
        return;
    }

    setStatus(t("wiki.opt.loading_cloud"));
    let cloud;
    try {
        cloud = await loadCloudSave(session.user);
    } catch (e) {
        cloud = null;
    }
    if (!cloud) {
        setStatus(t("wiki.opt.no_save"), "warn");
        manualEl.hidden = false;
        toggleManualBtn.hidden = true;
        renderManualForm();
        return;
    }

    const ownedMap = cloud.state?.buildings || {};
    const boughtUpgradeIds = Array.isArray(cloud.state?.upgrades) ? cloud.state.upgrades : [];

    setStatus(t("wiki.opt.loaded_calculating", { name: cloud.displayName || t("profile.player_fallback") }));
    const plan = simulateBestBuys(ownedMap, boughtUpgradeIds);
    renderPlan(plan, "cloud");
    setStatus(t("wiki.opt.loaded_season", { name: cloud.displayName || t("profile.player_fallback"), season: cloud.seasonId || "?" }), "ok");
    toggleManualBtn.hidden = false;
    recomputeBtn.hidden = false;

    // Manual-Form mit Cloud-Werten vorbefüllen falls Spieler wechseln will
    renderManualForm(ownedMap, boughtUpgradeIds);
}

toggleManualBtn?.addEventListener("click", () => {
    manualEl.hidden = !manualEl.hidden;
    toggleManualBtn.textContent = manualEl.hidden
        ? t("wiki.optimizer_manual")
        : t("wiki.opt.hide_manual");
});

recomputeBtn?.addEventListener("click", () => tryLoadCloud());

if (root) {
    // Erst nach dem Laden der Dictionaries starten — sonst würde setStatus()
    // rohe Keys anzeigen. Bei Sprachwechsel komplett neu berechnen, damit
    // Gebäudenamen und Status-Texte in der neuen Sprache erscheinen.
    i18nReady.then(() => tryLoadCloud());
    onLanguageChange(() => tryLoadCloud());
}
