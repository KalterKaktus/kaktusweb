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
import { t, onLanguageChange, ready as i18nReady } from "/js/i18n.js";
// Gemeinsam mit Spiel und Wiki-Tabellen. Vorher lag hier eine eigene Kopie, die
// die Blüten-Upgrades aus Economy V3 nicht kannte und sie alle als
// „<Gebäude> Kern" beschriftete.
import { buildingName as tBuilding, upgradeName as tUpgrade } from "/games/KaktusClicker/names.js";

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
    // Pro Building den Multiplier einmal vorab berechnen; er ändert sich im Lauf
    // der Simulation nur noch, wenn ein Upgrade gekauft wird.
    const buildingState = buildings.map((building) => ({
        id: building.id,
        name: building.name,
        // Übersetzter Anzeigename — der Plan wird bei Sprachwechsel neu gebaut.
        displayName: tBuilding(building),
        icon: building.icon,
        baseCost: building.baseCost,
        cps: building.cps,
        multiplier: getBuildingMultiplier(building.id, boughtUpgradeIds),
        owned: Math.max(0, Math.floor(Number(ownedMap?.[building.id]) || 0)),
    }));
    const byId = new Map(buildingState.map((b) => [b.id, b]));

    // Economy V3 hat 120 gestaffelte ×2-Upgrades ergänzt. Sie nur beim Multiplikator
    // mitzurechnen, aber nie als Kauf vorzuschlagen, führte in die Irre: ein
    // freigeschaltetes ×2 schlägt fast immer das nächste Gebäude.
    const owned = new Set(boughtUpgradeIds);
    const openUpgrades = upgrades.filter((upgrade) =>
        upgrade.buildingMultiplier && !owned.has(upgrade.id));
    // Innerhalb dieses Laufs gekaufte Upgrades — bewusst lokal, damit die aus
    // data.js importierten Objekte unangetastet bleiben.
    const plannedUpgradeIds = new Set();

    const plan = [];
    for (let step = 1; step <= SIMULATION_STEPS; step++) {
        let best = null;

        for (const b of buildingState) {
            const cost = getCurrentCost(b.baseCost, b.owned);
            const gain = b.cps * b.multiplier;
            if (gain <= 0) continue;
            const roi = cost / gain;
            if (!best || roi < best.roi) {
                best = { kind: "building", building: b, cost, gain, roi };
            }
        }

        for (const upgrade of openUpgrades) {
            if (plannedUpgradeIds.has(upgrade.id)) continue;
            const b = byId.get(upgrade.buildingId);
            if (!b) continue;
            // Blüten-Upgrades erscheinen erst ab ihrer Besitz-Schwelle.
            if (upgrade.unlockOwned && b.owned < upgrade.unlockOwned) continue;
            // Zugewinn = was die bereits besessenen Exemplare zusätzlich liefern.
            const gain = b.owned * b.cps * b.multiplier * (upgrade.buildingMultiplier - 1);
            if (gain <= 0) continue;
            const roi = upgrade.cost / gain;
            if (!best || roi < best.roi) {
                best = { kind: "upgrade", building: b, upgrade, cost: upgrade.cost, gain, roi };
            }
        }

        if (!best) break;

        if (best.kind === "building") {
            plan.push({
                step,
                kind: "building",
                id: best.building.id,
                name: best.building.name,
                displayName: best.building.displayName,
                icon: best.building.icon,
                cost: best.cost,
                cps: best.building.cps,
                multiplier: best.building.multiplier,
                effectiveCps: best.gain,
                roi: best.roi,
                ownedBefore: best.building.owned,
                ownedAfter: best.building.owned + 1,
            });
            best.building.owned += 1;
        } else {
            plan.push({
                step,
                kind: "upgrade",
                id: best.upgrade.id,
                name: best.upgrade.name,
                displayName: tUpgrade(best.upgrade),
                icon: best.upgrade.icon,
                cost: best.cost,
                cps: best.building.cps,
                multiplier: best.building.multiplier,
                effectiveCps: best.gain,
                roi: best.roi,
                targetBuilding: best.building.displayName,
            });
            // Wirkung sofort einrechnen, sonst empfiehlt der nächste Schritt dasselbe
            // Upgrade nochmal und die Gebäude-ROI bliebe zu pessimistisch.
            best.building.multiplier *= best.upgrade.buildingMultiplier;
            plannedUpgradeIds.add(best.upgrade.id);
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
                <li class="opt-plan-row ${entry.kind === "upgrade" ? "is-upgrade" : ""}" style="--opt-step:${entry.step}">
                    <span class="opt-step-num">#${entry.step}</span>
                    <span class="opt-step-icon">${entry.icon}</span>
                    <div class="opt-step-main">
                        <strong>${entry.displayName || entry.name}</strong>
                        <small>
                            ${entry.kind === "upgrade"
                                ? `${t("wiki.opt.upgrade_for")} ${entry.targetBuilding} · +${formatNumber(entry.effectiveCps)} CPS`
                                : `${t("wiki.opt.owned")} ${entry.ownedBefore} → ${entry.ownedAfter}
                                   · ${formatNumber(entry.effectiveCps)} CPS
                                   ${entry.multiplier > 1 ? `<em>(×${entry.multiplier.toFixed(1)} ${t("wiki.opt.from_upgrades")})</em>` : ""}`}
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
            <!-- Seit Economy V3 gibt es 150 Gebäude-Upgrades. Als eine flache
                 Liste war das unbedienbar, deshalb pro Gebäude eingeklappt. -->
            ${buildings.map((b) => {
                const own = upgrades.filter((u) => u.buildingMultiplier && u.buildingId === b.id);
                if (!own.length) return "";
                const checked = own.filter((u) => prefillUpgrades.includes(u.id)).length;
                return `
                    <details class="opt-manual-upgrade-group">
                        <summary>
                            <span class="opt-manual-icon">${b.icon}</span>
                            ${tBuilding(b)}
                            <em>${checked}/${own.length}</em>
                        </summary>
                        <div class="opt-manual-upgrade-grid">
                            ${own.map((u) => `
                                <label class="opt-manual-upgrade-row">
                                    <input type="checkbox" data-manual-upgrade="${u.id}" ${prefillUpgrades.includes(u.id) ? "checked" : ""}>
                                    <span>${tUpgrade(u)} <em>(×${u.buildingMultiplier})</em></span>
                                </label>
                            `).join("")}
                        </div>
                    </details>`;
            }).join("")}
        </details>
        <button type="button" class="opt-manual-run" id="optimizer-manual-run">${t("wiki.opt.compute_plan")}</button>
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
