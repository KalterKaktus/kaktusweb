// KaktusClicker Kauf-Optimizer für die Wiki-Seite.
//
// Diese Datei ist reine Oberfläche: Spielstand holen (read-only!), Eingaben
// einsammeln, Ergebnis darstellen. Gerechnet wird in `clicker-planner.js` —
// dort steht auch, warum der Planer echte Zeit simuliert statt Käufe nach
// Refinanzierungs-Zeit zu sortieren.

import { buildings, upgrades } from "/games/KaktusClicker/data.js";
import { loadCloudSave, getGameSession } from "/js/game-cloud.js";
import { formatNumber } from "/games/KaktusClicker/format.js";
import { t, onLanguageChange, ready as i18nReady, getLanguage } from "/js/i18n.js";
import {
    createPlanState,
    evaluatePrestige,
    getCoreMultiplier,
    getPrestigeOutlook,
    planRun,
    PRESTIGE_SEARCH,
} from "./clicker-planner.js";

const buildingById = new Map(buildings.map((b) => [b.id, b]));
const upgradeById = new Map(upgrades.map((u) => [u.id, u]));
const buildingUpgrades = upgrades.filter((u) => u.buildingId && u.buildingMultiplier > 1);

const HORIZONS = [3600, 6 * 3600, 24 * 3600];
const PRESTIGE_HORIZONS = HORIZONS;
const VISIBLE_STEPS = 12;
const DEFAULT_CLICKS_PER_SECOND = 4;

// --- Namen ---------------------------------------------------------------

function tBuilding(b) {
    const key = `clicker.buildings.${b.id}.name`;
    const value = t(key);
    return value === key ? b.name : value;
}

// Gleiche Logik wie tName() im Spiel: die generierten Kern- und Blüten-Upgrades
// haben keinen eigenen Key, ihr Name entsteht aus Gebäudename plus Suffix.
function tUpgrade(u) {
    const key = `clicker.upgrades.${u.id}.name`;
    const value = t(key);
    if (value !== key) return value;
    if (u.buildingId) {
        const bKey = `clicker.buildings.${u.buildingId}.name`;
        const bValue = t(bKey);
        if (bValue !== bKey) {
            const suffixKey = u.tier ? `clicker.upgrade_tier_${u.tier}` : "clicker.upgrade_core_suffix";
            const suffix = t(suffixKey, { name: bValue });
            if (suffix !== suffixKey) return suffix;
        }
    }
    return u.name;
}

function locale() {
    return getLanguage() === "ru" ? "ru-RU" : "de-DE";
}

function formatDelay(seconds) {
    if (seconds < 1) return t("wiki.opt.at_once");
    if (seconds < 90) return t("wiki.opt.after_seconds", { value: Math.round(seconds) });
    const minutes = Math.round(seconds / 60);
    if (minutes < 90) return t("wiki.opt.after_minutes", { value: minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest
        ? t("wiki.opt.after_hours_minutes", { hours, minutes: rest })
        : t("wiki.opt.after_hours", { value: hours });
}

function formatHorizon(seconds) {
    const hours = Math.round(seconds / 3600);
    return t("wiki.opt.hours", { value: hours });
}

// --- DOM ------------------------------------------------------------------

const root = document.getElementById("optimizer-root");
const statusEl = document.getElementById("optimizer-status");
const resultEl = document.getElementById("optimizer-result");
const manualEl = document.getElementById("optimizer-manual");
const toggleManualBtn = document.getElementById("optimizer-toggle-manual");
const recomputeBtn = document.getElementById("optimizer-recompute");

// Zuletzt benutzte Eingabe, damit Fenster- und Klickrate-Wechsel neu rechnen
// können ohne den Cloud-Save erneut zu laden.
const current = {
    source: null,
    owned: {},
    boughtIds: [],
    cash: 0,
    totalEarned: 0,
    nopal: 0,
    totalNopalEarned: 0,
    achievementCount: 0,
    horizon: HORIZONS[0],
    clicksPerSecond: DEFAULT_CLICKS_PER_SECOND,
};

function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.dataset.type = type;
    statusEl.textContent = message;
}

// Erst zeichnen lassen, dann rechnen. Die Suche blockiert den Hauptthread für
// einen Moment; ohne diesen Umweg sähe der Nutzer den Hinweis nie, weil Browser
// zwischen Klick und Rechnung nicht neu zeichnen.
function afterPaint(fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
}

// --- Plan darstellen ------------------------------------------------------

function stepLabel(step) {
    if (step.kind === "building") {
        const b = buildingById.get(step.id);
        return { icon: b?.icon || "?", name: b ? tBuilding(b) : step.id };
    }
    const u = upgradeById.get(step.id);
    return { icon: u?.icon || "?", name: u ? tUpgrade(u) : step.id };
}

function renderPlan(result) {
    if (!result.steps.length) {
        resultEl.innerHTML = `<p class="opt-empty">${t("wiki.opt.no_recommendation")}</p>`;
        return;
    }

    const shown = result.steps.slice(0, VISIBLE_STEPS);
    const hidden = result.steps.length - shown.length;
    const sourceTag = current.source === "cloud"
        ? `<span class="opt-source-pill opt-source-cloud">${t("wiki.opt.from_cloud")}</span>`
        : `<span class="opt-source-pill opt-source-manual">${t("wiki.opt.manual_input")}</span>`;

    resultEl.innerHTML = `
        <div class="opt-result-head">
            <h3>${t("wiki.opt.plan_title", { window: formatHorizon(current.horizon) })}</h3>
            ${sourceTag}
        </div>
        <p class="opt-plan-summary">
            ${t("wiki.opt.plan_summary", {
                buys: formatNumber(result.steps.length),
                from: formatNumber(result.startCps),
                to: formatNumber(result.endCps),
                earned: formatNumber(result.earned),
            })}
        </p>
        <ol class="opt-plan">
            ${shown.map((step) => {
                const label = stepLabel(step);
                return `
                <li class="opt-plan-row opt-plan-row--${step.kind}" style="--opt-step:${step.step}">
                    <span class="opt-step-num">#${step.step}</span>
                    <span class="opt-step-icon">${label.icon}</span>
                    <div class="opt-step-main">
                        <strong>${label.name}</strong>
                        <small>
                            <em class="opt-kind">${t(step.kind === "upgrade" ? "wiki.opt.kind_upgrade" : "wiki.opt.kind_building")}</em>
                            ${formatDelay(step.atSeconds)}
                        </small>
                    </div>
                    <div class="opt-step-cost">
                        <b>${formatNumber(step.cost)}</b>
                        <small>${t("clicker.score_label")}</small>
                    </div>
                </li>`;
            }).join("")}
        </ol>
        ${hidden > 0 ? `<p class="opt-plan-rest">${t("wiki.opt.more_steps", { count: formatNumber(hidden) })}</p>` : ""}
        <p class="opt-disclaimer">${t("wiki.opt.disclaimer")}</p>
    `;
}

// --- Steuerung (Zeitfenster, Klickrate, Prestige) -------------------------

function renderControls() {
    const host = document.getElementById("optimizer-controls");
    if (!host) return;
    host.innerHTML = `
        <div class="opt-control">
            <span class="opt-control-label">${t("wiki.opt.horizon_label")}</span>
            <div class="opt-horizons" role="group">
                ${HORIZONS.map((h) => `
                    <button type="button" class="opt-horizon${h === current.horizon ? " is-active" : ""}"
                            data-horizon="${h}" aria-pressed="${h === current.horizon}">${formatHorizon(h)}</button>
                `).join("")}
            </div>
        </div>
        <label class="opt-control opt-control--clicks">
            <span class="opt-control-label">${t("wiki.opt.clicks_label")}</span>
            <input type="number" min="0" max="30" step="1" id="optimizer-clicks"
                   value="${current.clicksPerSecond}" inputmode="numeric">
        </label>
        <p class="opt-control-hint">${t("wiki.opt.clicks_hint")}</p>
    `;

    host.querySelectorAll("[data-horizon]").forEach((btn) => {
        btn.addEventListener("click", () => {
            current.horizon = Number(btn.dataset.horizon);
            renderControls();
            compute();
        });
    });
    document.getElementById("optimizer-clicks")?.addEventListener("change", (event) => {
        current.clicksPerSecond = Math.max(0, Math.min(30, Math.floor(Number(event.target.value) || 0)));
        event.target.value = current.clicksPerSecond;
        compute();
    });
}

function renderPrestigeButton() {
    const host = document.getElementById("optimizer-prestige");
    if (!host) return;
    const outlook = getPrestigeOutlook({
        totalEarned: current.totalEarned,
        nopal: current.nopal,
        totalNopalEarned: current.totalNopalEarned,
    });

    if (outlook.newNopal <= 0) {
        host.innerHTML = `
            <h3>${t("wiki.opt.prestige_heading")}</h3>
            <p class="opt-prestige-none">
                ${t("wiki.opt.prestige_none", { amount: formatNumber(outlook.missingForNext) })}
            </p>`;
        return;
    }

    host.innerHTML = `
        <h3>${t("wiki.opt.prestige_heading")}</h3>
        <p class="opt-prestige-gain">
            ${t("wiki.opt.prestige_gain", {
                nopal: formatNumber(outlook.newNopal),
                from: outlook.currentMultiplier.toLocaleString(locale(), { maximumFractionDigits: 2 }),
                to: outlook.afterMultiplier.toLocaleString(locale(), { maximumFractionDigits: 2 }),
            })}
        </p>
        <button type="button" class="opt-prestige-run" id="optimizer-prestige-run">
            ${t("wiki.opt.prestige_button")}
        </button>
        <div class="opt-prestige-result" id="optimizer-prestige-result"></div>`;

    document.getElementById("optimizer-prestige-run")?.addEventListener("click", runPrestigeCheck);
}

function runPrestigeCheck() {
    const out = document.getElementById("optimizer-prestige-result");
    const button = document.getElementById("optimizer-prestige-run");
    if (!out) return;
    out.innerHTML = `<p class="opt-computing">${t("wiki.opt.prestige_computing")}</p>`;
    if (button) button.disabled = true;

    afterPaint(() => {
        let report;
        try {
            report = evaluatePrestige({
                owned: current.owned,
                boughtIds: current.boughtIds,
                cash: current.cash,
                totalEarned: current.totalEarned,
                nopal: current.nopal,
                totalNopalEarned: current.totalNopalEarned,
                achievementCount: current.achievementCount,
                // Ohne Klicks käme ein frisch zurückgesetzter Spielstand nie in
                // Gang: keine Gebäude, kein Guthaben, kein Einkommen. Deshalb
                // wird für beide Seiten dieselbe Rate angesetzt, mindestens 1.
                clicksPerSecond: Math.max(1, current.clicksPerSecond),
                horizons: PRESTIGE_HORIZONS,
                search: PRESTIGE_SEARCH,
            });
        } catch (error) {
            console.error("Prestige-Vergleich fehlgeschlagen:", error);
            out.innerHTML = `<p class="opt-empty">${t("wiki.opt.compute_failed")}</p>`;
            if (button) button.disabled = false;
            return;
        }
        if (button) button.disabled = false;

        const verdict = report.verdict === "worth-it"
            ? `<p class="opt-prestige-verdict is-yes">${t("wiki.opt.prestige_yes", {
                window: formatHorizon(report.breakEvenSeconds),
            })}</p>`
            : `<p class="opt-prestige-verdict is-no">${t("wiki.opt.prestige_no", {
                window: formatHorizon(PRESTIGE_HORIZONS[PRESTIGE_HORIZONS.length - 1]),
            })}</p>`;

        out.innerHTML = `
            ${verdict}
            <div class="table-wrap">
                <table class="wiki-table opt-prestige-table">
                    <thead><tr>
                        <th>${t("wiki.opt.prestige_col_window")}</th>
                        <th>${t("wiki.opt.prestige_col_keep")}</th>
                        <th>${t("wiki.opt.prestige_col_reset")}</th>
                    </tr></thead>
                    <tbody>
                        ${report.comparisons.map((row) => `
                            <tr class="${row.prestigeWins ? "is-reset" : "is-keep"}">
                                <td>${formatHorizon(row.horizonSeconds)}</td>
                                <td>${formatNumber(row.keepEarned)}</td>
                                <td>${formatNumber(row.resetEarned)}</td>
                            </tr>`).join("")}
                    </tbody>
                </table>
            </div>
            <p class="opt-disclaimer">${t("wiki.opt.prestige_note")}</p>`;
    });
}

// --- Rechnen --------------------------------------------------------------

function compute() {
    if (!resultEl) return;
    resultEl.innerHTML = `<p class="opt-computing">${t("wiki.opt.computing")}</p>`;
    afterPaint(() => {
        try {
            const start = createPlanState({
                owned: current.owned,
                boughtIds: current.boughtIds,
                cash: current.cash,
            });
            const result = planRun(start, {
                horizonSeconds: current.horizon,
                coreMultiplier: getCoreMultiplier(current.nopal, current.achievementCount),
                clicksPerSecond: current.clicksPerSecond,
            });
            renderPlan(result);
        } catch (error) {
            console.error("Plan-Berechnung fehlgeschlagen:", error);
            resultEl.innerHTML = `<p class="opt-empty">${t("wiki.opt.compute_failed")}</p>`;
        }
        renderPrestigeButton();
    });
}

// --- Manueller Modus ------------------------------------------------------

// Seit Economy V3 gibt es 150 gebäudebezogene Upgrades. Alle gleichzeitig als
// Checkbox zu rendern wäre unbenutzbar, deshalb zeigt die Liste nur die, die
// beim eingetragenen Besitz überhaupt freigeschaltet sind — und baut sich neu
// auf, sobald die Zahlen sich ändern.
function renderManualUpgradeList(ownedMap, checkedIds) {
    const target = manualEl.querySelector("[data-manual-upgrade-list]");
    if (!target) return;

    const available = buildingUpgrades.filter(
        (u) => !u.unlockOwned || (Number(ownedMap?.[u.buildingId]) || 0) >= u.unlockOwned,
    );
    if (!available.length) {
        target.innerHTML = `<p class="opt-manual-empty">${t("wiki.opt.no_upgrades_yet")}</p>`;
        return;
    }

    target.innerHTML = buildings
        .map((b) => ({ building: b, items: available.filter((u) => u.buildingId === b.id) }))
        .filter((group) => group.items.length)
        .map((group) => `
            <div class="opt-manual-upgrade-group">
                <h4>${group.building.icon} ${tBuilding(group.building)}</h4>
                ${group.items.map((u) => `
                    <label class="opt-manual-upgrade-row">
                        <input type="checkbox" data-manual-upgrade="${u.id}" ${checkedIds.includes(u.id) ? "checked" : ""}>
                        <span>${tUpgrade(u)} <em>(×${u.buildingMultiplier})</em></span>
                    </label>`).join("")}
            </div>`).join("");
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
    manualEl.querySelectorAll("[data-manual-upgrade]:checked").forEach((cb) => ids.push(cb.dataset.manualUpgrade));
    return ids;
}

function manualNumber(field) {
    const input = manualEl.querySelector(`[data-manual-extra="${field}"]`);
    return Math.max(0, Number(input?.value) || 0);
}

function renderManualForm(prefill = {}) {
    const owned = prefill.owned || {};
    const bought = prefill.boughtIds || [];
    manualEl.innerHTML = `
        <p class="opt-manual-intro">${t("wiki.opt.manual_intro")}</p>
        <div class="opt-manual-grid">
            ${buildings.map((b) => `
                <label class="opt-manual-field">
                    <span class="opt-manual-icon">${b.icon}</span>
                    <span class="opt-manual-name">${tBuilding(b)}</span>
                    <input class="opt-manual-input" type="number" min="0" step="1"
                           data-manual-owned="${b.id}" value="${owned[b.id] || 0}" inputmode="numeric">
                </label>`).join("")}
        </div>
        <div class="opt-manual-extra">
            ${[
                ["cash", t("wiki.opt.field_cash"), prefill.cash || 0],
                ["totalEarned", t("wiki.opt.field_total_earned"), prefill.totalEarned || 0],
                ["nopal", t("wiki.opt.field_nopal"), prefill.nopal || 0],
                ["achievements", t("wiki.opt.field_achievements"), prefill.achievementCount || 0],
            ].map(([field, label, value]) => `
                <label class="opt-manual-field">
                    <span class="opt-manual-name">${label}</span>
                    <input class="opt-manual-input opt-manual-input--wide" type="number" min="0" step="1"
                           data-manual-extra="${field}" value="${value}" inputmode="numeric">
                </label>`).join("")}
        </div>
        <details class="opt-manual-upgrades">
            <summary>${t("wiki.opt.check_upgrades")}</summary>
            <div class="opt-manual-upgrade-grid" data-manual-upgrade-list></div>
        </details>
        <button type="button" class="opt-manual-run" id="optimizer-manual-run">${t("wiki.opt.compute_plan")}</button>
    `;
    renderManualUpgradeList(owned, bought);

    // Besitz ändern schaltet Blüten-Upgrades frei bzw. wieder aus. Gesetzte
    // Haken bleiben erhalten, auch wenn ein Upgrade kurz verschwindet.
    manualEl.querySelectorAll("[data-manual-owned]").forEach((input) => {
        input.addEventListener("input", () => renderManualUpgradeList(readManualOwned(), readManualUpgrades()));
    });
    document.getElementById("optimizer-manual-run")?.addEventListener("click", () => {
        current.source = "manual";
        current.owned = readManualOwned();
        current.boughtIds = readManualUpgrades();
        current.cash = manualNumber("cash");
        current.totalEarned = manualNumber("totalEarned");
        current.nopal = manualNumber("nopal");
        // Ohne eigenes Feld: bereits verdiente Nopal sind mindestens die
        // gehaltenen. Unterschätzt den verfügbaren Neu-Nopal nie.
        current.totalNopalEarned = current.nopal;
        current.achievementCount = manualNumber("achievements");
        compute();
    });
}

// --- Ablauf ---------------------------------------------------------------

function useManualOnly(message) {
    setStatus(message, "warn");
    manualEl.hidden = false;
    toggleManualBtn.hidden = true;
    recomputeBtn.hidden = true;
    renderControls();
    renderManualForm();
    resultEl.innerHTML = "";
}

async function tryLoadCloud() {
    setStatus(t("wiki.opt.checking_login"));
    let session;
    try {
        session = await getGameSession();
    } catch (e) {
        session = null;
    }
    if (!session?.user?.id) {
        useManualOnly(t("wiki.opt.not_logged_in"));
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
        useManualOnly(t("wiki.opt.no_save"));
        return;
    }

    const state = cloud.state || {};
    current.source = "cloud";
    current.owned = state.buildings || {};
    current.boughtIds = Array.isArray(state.upgrades) ? state.upgrades : [];
    current.cash = Number(state.cactus) || 0;
    current.totalEarned = Number(state.totalEarned) || cloud.totalEarned || 0;
    current.nopal = Number(state.prestige?.nopal) || 0;
    current.totalNopalEarned = Number(state.prestige?.totalNopalEarned) || 0;
    current.achievementCount = Array.isArray(state.achievements) ? state.achievements.length : 0;

    const name = cloud.displayName || t("profile.player_fallback");
    setStatus(t("wiki.opt.loaded_season", { name, season: cloud.seasonId || "?" }), "ok");
    toggleManualBtn.hidden = false;
    recomputeBtn.hidden = false;

    renderControls();
    renderManualForm({ ...current, achievementCount: current.achievementCount });
    compute();
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
    // rohe Keys anzeigen. Bei Sprachwechsel komplett neu aufbauen, damit
    // Gebäudenamen und Status-Texte in der neuen Sprache erscheinen.
    i18nReady.then(() => tryLoadCloud());
    onLanguageChange(() => tryLoadCloud());
}
