// Generiert die Daten-Tabellen der KaktusClicker-Wiki-Seite direkt aus data.js.
//
// Warum generiert statt im HTML gepflegt: die Gebäude-, Abzeichen- und
// Upgrade-Tabellen waren nach Economy V3 komplett veraltet (33 statt 158
// Upgrades, 20 statt 30 Abzeichen, CPS-Werte aus der alten Balance). Von Hand
// gepflegt rotten sie bei jedem Balance-Patch erneut — und zwar doppelt, weil
// die russische Fassung als HTML-String in ru.json liegt.
//
// Die Namen kommen über die bestehenden i18n-Keys (clicker.buildings.*,
// clicker.achievements.*, clicker.upgrades.*), die Zahlen aus data.js. Damit ist
// beides automatisch aktuell und übersetzt.
//
// Die Sections tragen data-i18n-html, ihr innerHTML wird also bei jedem
// Sprachwechsel ersetzt — inklusive der eingefügten Tabellen. Deshalb hängt das
// Rendern an onLanguageChange(): i18n.js ruft applyTranslations() immer VOR
// notify() auf, die Platzhalter sind zum Zeitpunkt des Listeners also wieder da.

import { buildings, upgrades, achievements } from "/games/KaktusClicker/data.js";
import { t, onLanguageChange, ready as i18nReady, getLanguage } from "/js/i18n.js";

function tItem(item, category, field = "name") {
    const key = `clicker.${category}.${item.id}.${field}`;
    const value = t(key);
    if (value !== key) return value;
    // Generierte Upgrades haben keinen eigenen Key — Name aus Gebäude + Suffix
    // zusammensetzen, genau wie tName() im Spiel.
    if (category === "upgrades" && item.buildingId && field === "name") {
        const bValue = t(`clicker.buildings.${item.buildingId}.name`);
        if (bValue !== `clicker.buildings.${item.buildingId}.name`) {
            const suffixKey = item.tier ? `clicker.upgrade_tier_${item.tier}` : "clicker.upgrade_core_suffix";
            const suffix = t(suffixKey, { name: bValue });
            if (suffix !== suffixKey) return suffix;
        }
    }
    return item[field] ?? item.name;
}

function locale() {
    return getLanguage() === "ru" ? "ru-RU" : "de-DE";
}

// Große Zahlen als Exponent, kleine ausgeschrieben — die Tabellen spannen
// 15 bis 3,83e32, ein einheitliches Format wäre in beide Richtungen unlesbar.
function num(value) {
    if (value >= 1e15 || (value !== 0 && value < 0.01)) {
        return value.toExponential(2).replace("e+", "e");
    }
    return value.toLocaleString(locale(), { maximumFractionDigits: 3 });
}

function seconds(value) {
    return `${num(value)} ${t("wiki.ct.unit_seconds")}`;
}

function table(headers, rows) {
    return `
        <table class="wiki-table">
            <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>`;
}

function renderBuildings() {
    return table(
        ["#", t("wiki.ct.col_name"), t("wiki.ct.col_base_cost"), "CPS", t("wiki.ct.col_payback")],
        buildings.map((b, index) => [
            index + 1,
            tItem(b, "buildings"),
            num(b.baseCost),
            num(b.cps),
            seconds(b.baseCost / b.cps),
        ]),
    );
}

function renderAchievements() {
    return table(
        [t("wiki.ct.col_name"), t("wiki.ct.col_condition")],
        achievements.map((a) => [tItem(a, "achievements"), tItem(a, "achievements", "goal")]),
    );
}

// Alles, was NICHT auf ein einzelnes Gebäude wirkt: Klick-Upgrades, Klick-Sog
// und Autoklicker. Die 150 gebäudebezogenen Upgrades stehen bewusst nicht
// einzeln in der Tabelle — sie folgen alle demselben Schema (x2 auf ein
// Gebäude), das der Fließtext beschreibt.
function renderSpecialUpgrades() {
    const special = upgrades.filter((u) => !u.buildingId);
    return table(
        [t("wiki.ct.col_name"), t("wiki.ct.col_cost"), t("wiki.ct.col_effect")],
        special.map((u) => [tItem(u, "upgrades"), num(u.cost), tItem(u, "upgrades", "description")]),
    );
}

const RENDERERS = {
    buildings: renderBuildings,
    achievements: renderAchievements,
    "special-upgrades": renderSpecialUpgrades,
};

function renderAll() {
    document.querySelectorAll("[data-clicker-table]").forEach((host) => {
        const renderer = RENDERERS[host.dataset.clickerTable];
        if (renderer) host.innerHTML = renderer();
    });
}

if (document.querySelector("[data-clicker-table]")) {
    i18nReady.then(renderAll);
    onLanguageChange(renderAll);
}
