// ============================================================================
// js/systems/angelUiSystem.js
// ============================================================================
// Angel-UI System (v2). Visuelle Angel mit Per-Area-Charakter + Per-Level
// Detail-Progression. Gleiche externe API wie v1 — drop-in.
//
// Architektur:
//   themes.js    — Area-Blueprints (Daten) + Geometrie + Color-Helpers
//   shapes.js    — Shape-Registries (rod/grip/reel/eyelet/hook/bait/aura)
//   composer.js  — composeRodSvg(area, levels) → SVG string
//   this file    — UI-Shell (Part-Tabs + Detail-Panel) und Buy-Bridge
// ============================================================================

import { UPGRADES } from "../data/upgrades.js";
import { getUpgradeCost, getUpgradeLevel } from "./upgradeSystem.js";
import { composeRodSvg } from "./angel/composer.js";
import { t } from "/js/i18n.js";

// Reihenfolge im Selector — passt zur Anglerlogik (vorne nach hinten).
const PART_ORDER = ["rod", "line", "hook", "bait", "luck"];

// Anzeige-Labels pro Part — via i18n, mit deutschem Fallback.
function partLabel(part) {
    const key = `fishing.parts.${part}`;
    const value = t(key);
    if (value !== key) return value;
    return { rod: "Rute", line: "Schnur", hook: "Haken", bait: "Köder", luck: "Glück" }[part] || part;
}

function upgradeName(upgrade) {
    const key = `fishing.upgrades.${upgrade.id}.name`;
    const value = t(key);
    return value === key ? upgrade.name : value;
}

function upgradeCopy(upgrade) {
    const key = `fishing.upgrades.${upgrade.id}.copy`;
    const value = t(key);
    return value === key ? upgrade.copy : value;
}

// Welcher Upgrade-Key hinter welchem Part steckt (Köder = "sonar" intern).
const PART_TO_UPGRADE = {
    rod: "rod",
    line: "line",
    hook: "hook",
    bait: "sonar",
    luck: "luck",
};

export class AngelUiSystem {
    constructor(root, options = {}) {
        this.root = root;
        this.options = options;
        this.stage = root.querySelector("#angel-stage");
        this.partsBar = root.querySelector("#angel-parts");
        this.detail = root.querySelector("#angel-detail");
        this.selectedPart = PART_ORDER[0];

        // Cache: re-render der SVG nur bei Level-/Area-Änderung.
        // Spart Composite-Layer-Arbeit, wenn der Shop offen bleibt während
        // andere Game-Events feuern und render() öfter aufgerufen wird.
        this._svgCache = { key: "", svg: "" };

        this.partsBar.addEventListener("click", (event) => {
            const button = event.target.closest("[data-angel-part]");
            if (!button) return;
            this.selectedPart = button.dataset.angelPart;
            this.render();
        });

        this.detail.addEventListener("click", (event) => {
            const button = event.target.closest("[data-angel-buy]");
            if (!button) return;
            const upgradeId = button.dataset.angelBuy;
            if (this.options.onBuy && this.options.onBuy(upgradeId)) {
                this.render();
            }
        });
    }

    render() {
        const state = this.options.getState();
        const levels = Object.fromEntries(
            PART_ORDER.map((part) => [part, getUpgradeLevel(state, PART_TO_UPGRADE[part])])
        );
        const area = state.currentArea || "pond";

        // SVG-Stage (mit Cache)
        const cacheKey = `${area}|${levels.rod}|${levels.line}|${levels.hook}|${levels.bait}|${levels.luck}`;
        if (cacheKey !== this._svgCache.key) {
            this._svgCache.key = cacheKey;
            this._svgCache.svg = composeRodSvg(area, levels);
        }
        this.stage.innerHTML = this._svgCache.svg;

        // Part-Tabs
        this.partsBar.innerHTML = PART_ORDER.map((part) => {
            const upgradeId = PART_TO_UPGRADE[part];
            const lvl = getUpgradeLevel(state, upgradeId);
            const max = UPGRADES[upgradeId].maxLevel;
            const isActive = part === this.selectedPart;
            const isMaxed = lvl >= max;
            return `
                <button type="button"
                        class="angel-part-tab ${isActive ? "is-active" : ""} ${isMaxed ? "is-maxed" : ""}"
                        data-angel-part="${part}"
                        role="tab"
                        aria-selected="${isActive}">
                    <span class="angel-part-tab-name">${partLabel(part)}</span>
                    <span class="angel-part-tab-level">${t("fishing.level_short")} ${lvl}/${max}</span>
                </button>
            `;
        }).join("");

        // Detail-Panel
        const partKey = this.selectedPart;
        const upgradeId = PART_TO_UPGRADE[partKey];
        const upgrade = UPGRADES[upgradeId];
        const lvl = getUpgradeLevel(state, upgradeId);
        const max = upgrade.maxLevel;
        const cost = getUpgradeCost(state, upgradeId);
        const isMaxed = lvl >= max;
        const canAfford = !isMaxed && cost !== null && state.coins >= cost;

        const levelDots = Array.from({ length: max }, (_, i) => {
            const filled = i < lvl ? "is-filled" : "";
            return `<span class="angel-level-dot ${filled}"></span>`;
        }).join("");

        const formatCoins = this.options.formatCoins;
        const formattedCost = formatCoins ? formatCoins(cost) : cost;

        const buttonHtml = isMaxed
            ? `<button class="angel-buy is-maxed" type="button" disabled>${t("fishing.max_level_reached")}</button>`
            : `<button class="angel-buy ${canAfford ? "is-available" : "is-locked"}" type="button" data-angel-buy="${upgradeId}" ${canAfford ? "" : "disabled"}>
                   ${canAfford ? t("fishing.upgrade_button", { cost: formattedCost }) : t("fishing.upgrade_button_locked", { cost: formattedCost })}
               </button>`;

        this.detail.innerHTML = `
            <header class="angel-detail-head">
                <div>
                    <p class="angel-detail-kicker">${partLabel(partKey)}</p>
                    <strong class="angel-detail-name">${upgradeName(upgrade)}</strong>
                </div>
                <div class="angel-level-line" aria-label="${t("fishing.level_of", { lvl, max })}">${levelDots}</div>
            </header>
            <p class="angel-detail-copy">${upgradeCopy(upgrade)}</p>
            ${buttonHtml}
        `;
    }
}

export { PART_ORDER, partLabel, PART_TO_UPGRADE };
