// Generiert die Wiki-Tabellen direkt aus den Spieldaten.
//
// Warum generiert statt hartcodiert: Die Tabellen im Wiki waren nach Economy V3
// komplett falsch — 30 CPS-Werte, Upgrade-Anzahl, Abzeichen, Prestige-Formeln.
// Handgepflegte Zahlen veralten garantiert beim nächsten Balancing. Der
// Kauf-Optimizer macht es seit jeher richtig (importiert data.js live) und war
// deshalb als Einziges nie veraltet.
//
// WICHTIG — Zusammenspiel mit wiki.js: Das ist ein Modul, läuft also NACH dem
// klassischen wiki.js. Dessen Suche snapshottet `innerHTML` jeder Section und
// stellt daraus bei jeder Eingabe wieder her. Ohne Signal würde die erste Suche
// die generierten Tabellen wegwerfen. Nach jedem Render feuern wir deshalb
// `kk:wikicontent`, worauf wiki.js neu snapshottet.

import { achievements, buildings, upgrades } from "/games/KaktusClicker/data.js";
import { formatNumber } from "/games/KaktusClicker/format.js";
import {
    achievementGoal,
    achievementName,
    buildingName,
    upgradeName,
} from "/games/KaktusClicker/names.js";
import { t, onLanguageChange } from "/js/i18n.js";

// Amortisation lesbar machen. formatDuration() aus dem Spiel taugt hier nicht:
// Gebäude 30 käme auf "4255h 33m 20s". Stattdessen die jeweils größte sinnvolle
// Einheit — die Aussage ist die Größenordnung, nicht die Sekunde.
function formatPayback(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";
    if (seconds < 90) return `${Math.round(seconds)} ${t("wiki.gen.unit_s")}`;
    if (seconds < 5400) return `${Math.round(seconds / 60)} ${t("wiki.gen.unit_min")}`;
    if (seconds < 172800) return `${Math.round(seconds / 3600)} ${t("wiki.gen.unit_h")}`;
    return `${Math.round(seconds / 86400)} ${t("wiki.gen.unit_d")}`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[c]);
}

function table(headers, rows) {
    return `
        <div class="table-wrap">
            <table class="wiki-table">
                <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
                <tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
            </table>
        </div>`;
}

function renderBuildings() {
    // Amortisation ist die Kernaussage von Economy V3: baseCost / cps ist jetzt
    // über alle 30 Gebäude in derselben Größenordnung statt exponentiell zu
    // explodieren. Deshalb steht sie als eigene Spalte drin.
    const rows = buildings.map((building, index) => [
        String(index + 1),
        escapeHtml(buildingName(building)),
        formatNumber(building.baseCost),
        formatNumber(building.cps),
        formatPayback(building.baseCost / building.cps),
    ]);
    return table(
        ["#", t("wiki.gen.name"), t("wiki.gen.base_cost"), t("wiki.gen.cps"), t("wiki.gen.payback")],
        rows
    );
}

function renderUpgrades() {
    const clickUpgrades = upgrades.filter((u) => u.clickMultiplier);
    const clickScaling = upgrades.filter((u) => u.clickCpsMultiplier);
    const autoClick = upgrades.filter((u) => u.autoClicksPerSecond);
    const core = upgrades.filter((u) => u.buildingId && !u.tier);
    const tiers = upgrades.filter((u) => u.tier);

    const simpleRows = (list) => list.map((u) => [
        escapeHtml(upgradeName(u)),
        formatNumber(u.cost),
        escapeHtml(u.description || ""),
    ]);
    const headers = [t("wiki.gen.name"), t("wiki.gen.cost"), t("wiki.gen.effect")];

    // Die 141 Gebäude-Upgrades einzeln aufzulisten wäre unlesbar. Muster
    // erklären, Volltabelle in ein aufklappbares <details>.
    const buildingRows = [...core, ...tiers]
        .sort((a, b) => a.cost - b.cost)
        .map((u) => [
            escapeHtml(upgradeName(u)),
            formatNumber(u.cost),
            u.unlockOwned
                ? escapeHtml(t("wiki.gen.unlock_at", { count: String(u.unlockOwned) }))
                : "—",
        ]);

    return `
        <h3>${escapeHtml(t("wiki.gen.click_upgrades"))} (${clickUpgrades.length})</h3>
        ${table(headers, simpleRows(clickUpgrades))}

        <h3>${escapeHtml(t("wiki.gen.click_scaling"))} (${clickScaling.length})</h3>
        ${table(headers, simpleRows(clickScaling))}

        <h3>${escapeHtml(t("wiki.gen.autoclick"))} (${autoClick.length})</h3>
        ${table(headers, withFallbackRow(simpleRows(autoClick), 3))}

        <h3>${escapeHtml(t("wiki.gen.building_upgrades"))} (${core.length + tiers.length})</h3>
        <p>${escapeHtml(t("wiki.gen.building_upgrades_note"))}</p>
        <details class="wiki-details">
            <summary>${escapeHtml(t("wiki.gen.show_all", { count: String(buildingRows.length) }))}</summary>
            ${table([t("wiki.gen.name"), t("wiki.gen.cost"), t("wiki.gen.unlock")], buildingRows)}
        </details>`;
}

// Leere Kategorie soll keine kopflose Tabelle erzeugen — kann passieren, wenn
// eine Upgrade-Art in data.js mal wieder entfällt.
function withFallbackRow(rows, columns) {
    return rows.length ? rows : [Array(columns).fill("—")];
}

function renderAchievements() {
    const rows = achievements.map((achievement) => [
        escapeHtml(achievementName(achievement)),
        escapeHtml(achievementGoal(achievement)),
    ]);
    return table([t("wiki.gen.name"), t("wiki.gen.condition")], rows);
}

const RENDERERS = {
    buildings: renderBuildings,
    upgrades: renderUpgrades,
    achievements: renderAchievements,
};

// Zähler, die im Fließtext stehen und sonst genauso veralten würden.
function renderCounts() {
    const values = {
        buildings: String(buildings.length),
        upgrades: String(upgrades.length),
        achievements: String(achievements.length),
        "achievement-max": `x${formatNumber(1 + achievements.length * 0.1)}`,
    };
    document.querySelectorAll("[data-wiki-count]").forEach((el) => {
        const value = values[el.dataset.wikiCount];
        if (value !== undefined) el.textContent = value;
    });
}

function renderAll() {
    document.querySelectorAll("[data-wiki-table]").forEach((container) => {
        const render = RENDERERS[container.dataset.wikiTable];
        if (render) container.innerHTML = render();
    });
    renderCounts();
    // wiki.js muss seinen Such-Snapshot erneuern, sonst löscht die erste
    // Sucheingabe alles hier Generierte wieder weg.
    document.dispatchEvent(new CustomEvent("kk:wikicontent"));
}

renderAll();
onLanguageChange(renderAll);
