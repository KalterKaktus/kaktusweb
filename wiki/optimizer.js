// KaktusClicker Kauf-Optimizer für die Wiki-Seite.
//
// Liest den Cloud-Save (read-only!) des eingeloggten Spielers, berechnet aus den
// Buildings + ihren spezifischen Upgrade-Multiplikatoren die nächsten 10 Käufe
// mit dem besten ROI (Cost / Cps).
//
// Ignoriert bewusst: globale Multiplikatoren (Prestige-Nopal-Boni, Achievement-
// Boosts, Frenzy/Goldlauf), da sie sich auf ALLE Buildings gleich auswirken und
// daher die Reihenfolge nicht verändern.

import { buildings, upgrades } from "/games/KaktusClicker/data.js";
import { loadCloudSave, getGameSession, KAKTUS_GAME_ID } from "/js/game-cloud.js";
import { formatNumber } from "/games/KaktusClicker/format.js";

const root = document.getElementById("optimizer-root");
const statusEl = document.getElementById("optimizer-status");
const resultEl = document.getElementById("optimizer-result");
const manualEl = document.getElementById("optimizer-manual");
const toggleManualBtn = document.getElementById("optimizer-toggle-manual");
const recomputeBtn = document.getElementById("optimizer-recompute");

const PRICE_GROWTH = 1.15;
const SIMULATION_STEPS = 10;

// --- Berechnungs-Logik ---

function getBuildingMultiplier(buildingId, boughtUpgradeIds) {
    const setIds = new Set(boughtUpgradeIds);
    return upgrades
        .filter((upgrade) => upgrade.buildingId === buildingId && setIds.has(upgrade.id))
        .reduce((mult, upgrade) => mult * (upgrade.buildingMultiplier || 1), 1);
}

function getCurrentCost(baseCost, owned) {
    return baseCost * Math.pow(PRICE_GROWTH, owned);
}

function simulateBestBuys(ownedMap, boughtUpgradeIds) {
    // Pro Building den Multiplier einmal vorab berechnen (stabil über die Simulation).
    const buildingState = buildings.map((building) => ({
        id: building.id,
        name: building.name,
        icon: building.icon,
        baseCost: building.baseCost,
        cps: building.cps,
        multiplier: getBuildingMultiplier(building.id, boughtUpgradeIds),
        owned: Math.max(0, Math.floor(Number(ownedMap?.[building.id]) || 0)),
    }));

    const plan = [];
    for (let step = 1; step <= SIMULATION_STEPS; step++) {
        let best = null;
        for (const b of buildingState) {
            const cost = getCurrentCost(b.baseCost, b.owned);
            const effectiveCps = b.cps * b.multiplier;
            if (effectiveCps <= 0) continue;
            const roi = cost / effectiveCps;
            if (!best || roi < best.roi) {
                best = { ...b, cost, effectiveCps, roi };
            }
        }
        if (!best) break;
        plan.push({
            step,
            id: best.id,
            name: best.name,
            icon: best.icon,
            cost: best.cost,
            cps: best.cps,
            multiplier: best.multiplier,
            effectiveCps: best.effectiveCps,
            roi: best.roi,
            ownedBefore: best.owned,
            ownedAfter: best.owned + 1,
        });
        // Owned anpassen für nächste Iteration
        const target = buildingState.find((b) => b.id === best.id);
        target.owned += 1;
    }
    return plan;
}

// --- Render ---

function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.dataset.type = type;
    statusEl.textContent = message;
}

function renderPlan(plan, source) {
    if (!plan.length) {
        resultEl.innerHTML = `<p class="opt-empty">Keine Empfehlung — alle Buildings haben CPS 0 oder Daten fehlen.</p>`;
        return;
    }

    const sourceTag = source === "cloud"
        ? `<span class="opt-source-pill opt-source-cloud">Aus deinem Cloud-Save</span>`
        : `<span class="opt-source-pill opt-source-manual">Manuelle Eingabe</span>`;

    resultEl.innerHTML = `
        <div class="opt-result-head">
            <h3>Nächste 10 beste Käufe</h3>
            ${sourceTag}
        </div>
        <ol class="opt-plan">
            ${plan.map((entry) => `
                <li class="opt-plan-row" style="--opt-step:${entry.step}">
                    <span class="opt-step-num">#${entry.step}</span>
                    <span class="opt-step-icon">${entry.icon}</span>
                    <div class="opt-step-main">
                        <strong>${entry.name}</strong>
                        <small>
                            Besitz ${entry.ownedBefore} → ${entry.ownedAfter}
                            · ${formatNumber(entry.effectiveCps)} CPS
                            ${entry.multiplier > 1 ? `<em>(×${entry.multiplier.toFixed(1)} aus Upgrades)</em>` : ""}
                        </small>
                    </div>
                    <div class="opt-step-cost">
                        <b>${formatNumber(entry.cost)}</b>
                        <small>Kakteen</small>
                    </div>
                    <div class="opt-step-roi" title="Cost ÷ CPS = Sekunden bis Refinanzierung">
                        <b>${formatNumber(entry.roi)}</b>
                        <small>s ROI</small>
                    </div>
                </li>
            `).join("")}
        </ol>
        <p class="opt-disclaimer">
            ROI = Kosten ÷ effektive CPS = Sekunden bis sich der Kauf refinanziert hat (niedriger = besser).
            Globale Multiplikatoren (Prestige, Achievements, Goldlauf) wurden bewusst ignoriert — sie skalieren alle Käufe gleich.
            <strong>Dein Spielstand wird nie geändert, nur gelesen.</strong>
        </p>
    `;
}

// --- Manual mode ---

function renderManualForm(prefillOwned = {}, prefillUpgrades = []) {
    manualEl.innerHTML = `
        <p class="opt-manual-intro">Trage manuell ein wie viel du von jedem Gebäude besitzt. Optional unten die gekauften Upgrades anhaken.</p>
        <div class="opt-manual-grid">
            ${buildings.map((b) => `
                <label class="opt-manual-field">
                    <span class="opt-manual-icon">${b.icon}</span>
                    <span class="opt-manual-name">${b.name}</span>
                    <input class="opt-manual-input" type="number" min="0" step="1"
                           data-manual-owned="${b.id}"
                           value="${prefillOwned[b.id] || 0}"
                           inputmode="numeric">
                </label>
            `).join("")}
        </div>
        <details class="opt-manual-upgrades">
            <summary>Gekaufte Upgrades anhaken (optional, beeinflusst Multiplikatoren)</summary>
            <div class="opt-manual-upgrade-grid">
                ${upgrades.filter((u) => u.buildingMultiplier).map((u) => `
                    <label class="opt-manual-upgrade-row">
                        <input type="checkbox" data-manual-upgrade="${u.id}" ${prefillUpgrades.includes(u.id) ? "checked" : ""}>
                        <span>${u.name} <em>(×${u.buildingMultiplier})</em></span>
                    </label>
                `).join("")}
            </div>
        </details>
        <button type="button" class="opt-manual-run" id="optimizer-manual-run">Plan berechnen</button>
    `;
    document.getElementById("optimizer-manual-run")?.addEventListener("click", computeManual);
}

function computeManual() {
    const ownedMap = {};
    manualEl.querySelectorAll("[data-manual-owned]").forEach((input) => {
        ownedMap[input.dataset.manualOwned] = Math.max(0, Math.floor(Number(input.value) || 0));
    });
    const boughtUpgradeIds = [];
    manualEl.querySelectorAll("[data-manual-upgrade]:checked").forEach((cb) => {
        boughtUpgradeIds.push(cb.dataset.manualUpgrade);
    });
    const plan = simulateBestBuys(ownedMap, boughtUpgradeIds);
    renderPlan(plan, "manual");
}

// --- Main flow ---

async function tryLoadCloud() {
    setStatus("Prüfe Login …");
    let session;
    try {
        session = await getGameSession();
    } catch (e) {
        session = null;
    }
    if (!session?.user?.id) {
        setStatus("Du bist nicht eingeloggt. Logg dich ein um deinen Cloud-Save automatisch zu laden, oder benutze den manuellen Modus unten.", "warn");
        manualEl.hidden = false;
        toggleManualBtn.hidden = true;
        recomputeBtn.hidden = true;
        renderManualForm();
        return;
    }

    setStatus("Lade Cloud-Save …");
    let cloud;
    try {
        cloud = await loadCloudSave(session.user);
    } catch (e) {
        cloud = null;
    }
    if (!cloud) {
        setStatus("Kein KaktusClicker Cloud-Save gefunden. Spiele eine Runde und speichere, dann komm wieder.", "warn");
        manualEl.hidden = false;
        toggleManualBtn.hidden = true;
        renderManualForm();
        return;
    }

    const ownedMap = cloud.state?.buildings || {};
    const boughtUpgradeIds = Array.isArray(cloud.state?.upgrades) ? cloud.state.upgrades : [];

    setStatus(`Cloud-Save geladen (${cloud.displayName || "Spieler"}) — Berechne …`);
    const plan = simulateBestBuys(ownedMap, boughtUpgradeIds);
    renderPlan(plan, "cloud");
    setStatus(`Cloud-Save geladen (${cloud.displayName || "Spieler"}) · Saison ${cloud.seasonId || "?"}`, "ok");
    toggleManualBtn.hidden = false;
    recomputeBtn.hidden = false;

    // Manual-Form mit Cloud-Werten vorbefüllen falls Spieler wechseln will
    renderManualForm(ownedMap, boughtUpgradeIds);
}

toggleManualBtn?.addEventListener("click", () => {
    manualEl.hidden = !manualEl.hidden;
    toggleManualBtn.textContent = manualEl.hidden
        ? "Manueller Modus"
        : "Manuelle Eingabe ausblenden";
});

recomputeBtn?.addEventListener("click", () => tryLoadCloud());

if (root) {
    tryLoadCloud();
}
