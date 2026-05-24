// Angel-UI System — ersetzt den klassischen Shop durch eine visuelle Angel,
// deren Teile (Rute, Schnur, Haken, Köder, Glück) sich mit jedem Upgrade-Level
// optisch wandeln. Wechsel zwischen den Parts via Tabs, Detail-Panel rechts.

import { UPGRADES, UPGRADE_ORDER } from "../data/upgrades.js";
import { getUpgradeCost, getUpgradeLevel } from "./upgradeSystem.js";

// Reihenfolge im Selector — passt zur Anglerlogik (vorne nach hinten).
const PART_ORDER = ["rod", "line", "hook", "bait", "luck"];

// Anzeige-Labels pro Part (UI nutzt diese statt UPGRADES[id].name das ein paar Sachen anders heißt).
const PART_LABELS = {
    rod: "Rute",
    line: "Schnur",
    hook: "Haken",
    bait: "Köder",
    luck: "Glück",
};

// Welcher Upgrade-Key hinter welchem Part steckt (Köder = "sonar" intern).
const PART_TO_UPGRADE = {
    rod: "rod",
    line: "line",
    hook: "hook",
    bait: "sonar",
    luck: "luck",
};

// Generische Line-Breite pro Level (Area-übergreifend).
const LINE_WIDTH = [1.0, 1.3, 1.6, 1.9, 2.3, 2.7];

// Glow-Stärke ab welchem Level
const GLOW_LEVEL = 3;

// Pro Area eine eigene Angel-Palette + leichte Shape-Variationen.
// Jede Area hat einen klar erkennbaren Charakter:
//   - pond  = warm/Holz, klassische Angler-Optik
//   - lake  = grün-bambus, schlanker
//   - ocean = tiefseeblau/karbon, robuster Griff, harpoon-ähnlicher Haken
const ANGEL_THEMES = {
    pond: {
        rod:  ["#8b5a2b", "#a2683b", "#c9a35a", "#445470", "#cfd8e0", "#ffd166"],
        grip: ["#3a230f", "#4a2c12", "#5a3818", "#1a2330", "#2a3140", "#3e2e08"],
        line: ["#7a838a", "#9aa3aa", "#cfd5db", "#e6dba0", "#ffe066", "#fff5b3"],
        hook: ["#a8a8a8", "#c0c0c0", "#dadada", "#ffb866", "#ff7a4a", "#ffd166"],
        bait: ["#8a5a2f", "#5d7a30", "#3a8090", "#c46cff", "#ff7a8c", "#ffd166"],
        luck: ["#bfbfbf", "#8fd9a8", "#ffd166", "#a35cff", "#ff7a8c", "#7aeaff"],
        // Standard-Rute, kreisförmige Ring-Wickel
        ringShape: "circle",
        rodThickness: 1.0,
        handleThickness: 1.0,
    },
    lake: {
        rod:  ["#6a8a3a", "#577f2c", "#3f7d5a", "#264c70", "#7aaecf", "#a8e8c6"],
        grip: ["#2a3a0f", "#37310f", "#1f3a26", "#102035", "#1c3b54", "#1a4030"],
        line: ["#9ec2a8", "#b8cdd0", "#dde9e2", "#a8e0e8", "#7ad6ff", "#d4fffa"],
        hook: ["#a08350", "#bfa56e", "#dad0b3", "#a8c8e8", "#5ae0ff", "#6cffd6"],
        bait: ["#5a7a30", "#7aa050", "#3aa088", "#9c6cff", "#ff8e9c", "#a0ffd6"],
        luck: ["#bfd4b8", "#6fd8a0", "#a8e0e8", "#5cb0ff", "#a3e8ff", "#90ffe8"],
        // Bambus-Optik: Ringe sind kleine Querstriche
        ringShape: "bamboo",
        rodThickness: 0.85,
        handleThickness: 0.9,
    },
    ocean: {
        rod:  ["#1f3a5c", "#2c4a7a", "#34547a", "#0a1a30", "#bdc4ce", "#ffd166"],
        grip: ["#0a1a30", "#10243a", "#08182a", "#04101e", "#2a3a5a", "#3e2e08"],
        line: ["#5a6e8e", "#a8b4cc", "#cfd5e8", "#9ed0ff", "#ffd166", "#fff5b3"],
        hook: ["#7a6648", "#a08866", "#cfb588", "#ff8e6a", "#ff5050", "#ffd166"],
        bait: ["#ff8a9a", "#ff6a3a", "#3ac0e0", "#c46cff", "#ff5050", "#ffd166"],
        luck: ["#cfd5e8", "#ffaaaa", "#ffd166", "#a35cff", "#5cffe0", "#fff5b3"],
        // Hochsee-Optik: dickere Eyelets, robuster Griff
        ringShape: "eyelet",
        rodThickness: 1.2,
        handleThickness: 1.3,
    },
};

function svgRod(area, levels) {
    const theme = ANGEL_THEMES[area] || ANGEL_THEMES.pond;
    const rodLvl  = levels.rod  || 0;
    const lineLvl = levels.line || 0;
    const hookLvl = levels.hook || 0;
    const baitLvl = levels.bait || 0;
    const luckLvl = levels.luck || 0;

    const rodColor   = theme.rod[Math.min(5, rodLvl)];
    const rodGrip    = theme.grip[Math.min(5, rodLvl)];
    const lineColor  = theme.line[Math.min(5, lineLvl)];
    const lineW      = LINE_WIDTH[Math.min(5, lineLvl)];
    const hookColor  = theme.hook[Math.min(5, hookLvl)];
    const baitColor  = theme.bait[Math.min(5, baitLvl)];
    const luckColor  = theme.luck[Math.min(5, luckLvl)];

    const rodGlow  = rodLvl  >= GLOW_LEVEL ? `filter: drop-shadow(0 0 6px ${rodColor});`  : "";
    const lineGlow = lineLvl >= GLOW_LEVEL ? `filter: drop-shadow(0 0 4px ${lineColor});` : "";
    const hookGlow = hookLvl >= GLOW_LEVEL ? `filter: drop-shadow(0 0 5px ${hookColor});` : "";
    const baitGlow = baitLvl >= GLOW_LEVEL ? `filter: drop-shadow(0 0 7px ${baitColor});` : "";
    const luckGlow = luckLvl >= GLOW_LEVEL ? `filter: drop-shadow(0 0 6px ${luckColor});` : "";

    // Rute: diagonal von unten-rechts (Griff) nach oben-links (Spitze).
    // Schnur hängt von Spitze gerade runter, Haken + Köder am Ende.
    // Glücks-Charm baumelt vom Griff.

    // Rod-Form: Pond=Kreis, Lake=Bambus-Knoten, Ocean=Eyelet-Ringe
    // (entfernt sich vom obsoleten Code, der nur Kreise hatte)

    // Hook-Shape skaliert mit Level
    const hookSize = 1 + hookLvl * 0.18;
    const hookBarbs = hookLvl >= 2 ? `<path d="M -4 ${10 * hookSize} L 0 ${6 * hookSize} L 4 ${10 * hookSize}" stroke="${hookColor}" stroke-width="${1.4 * hookSize}" fill="none" stroke-linecap="round"/>` : "";
    const hookTwin = hookLvl >= 4 ? `<path d="M 6 0 q 8 ${10*hookSize} 0 ${20*hookSize}" stroke="${hookColor}" stroke-width="${2.2 * hookSize}" fill="none" stroke-linecap="round"/>` : "";

    // Bait/Köder
    const baitSize = 6 + baitLvl * 1.4;
    let baitShape = `<ellipse cx="0" cy="0" rx="${baitSize}" ry="${baitSize * 0.7}" fill="${baitColor}"/>`;
    if (baitLvl >= 2) baitShape += `<circle cx="${baitSize * 0.4}" cy="-${baitSize * 0.2}" r="${baitSize * 0.25}" fill="#fff" opacity="0.7"/>`;
    if (baitLvl >= 3) baitShape += `<path d="M -${baitSize} 0 q -${baitSize * 0.6} ${baitSize * 0.7} -${baitSize * 1.3} ${baitSize * 0.4}" stroke="${baitColor}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    if (baitLvl >= 5) baitShape += `<polygon points="${baitSize * 1.2},${-baitSize * 0.5} ${baitSize * 1.6},0 ${baitSize * 1.2},${baitSize * 0.5}" fill="${baitColor}" opacity="0.85"/>`;

    // Luck-Charm
    let luckShape = "";
    if (luckLvl === 0) {
        luckShape = `<circle cx="0" cy="0" r="5" fill="${luckColor}"/>`;
    } else if (luckLvl === 1) {
        // Kleeblatt-Andeutung
        luckShape = `<g fill="${luckColor}"><circle cx="-4" cy="0" r="4"/><circle cx="4" cy="0" r="4"/><circle cx="0" cy="-4" r="4"/></g>`;
    } else if (luckLvl === 2) {
        // 4-Leaf Clover
        luckShape = `<g fill="${luckColor}"><circle cx="-5" cy="0" r="5"/><circle cx="5" cy="0" r="5"/><circle cx="0" cy="-5" r="5"/><circle cx="0" cy="5" r="5"/></g>`;
    } else if (luckLvl === 3) {
        // Stern
        luckShape = `<polygon points="0,-9 2.5,-3 9,-3 4,1 6,8 0,4 -6,8 -4,1 -9,-3 -2.5,-3" fill="${luckColor}"/>`;
    } else if (luckLvl === 4) {
        // Stern mit Glow-Ring
        luckShape = `<circle cx="0" cy="0" r="11" fill="none" stroke="${luckColor}" stroke-width="1.5" opacity="0.6"/><polygon points="0,-9 2.5,-3 9,-3 4,1 6,8 0,4 -6,8 -4,1 -9,-3 -2.5,-3" fill="${luckColor}"/>`;
    } else {
        // Kosmisch — Doppelstern + Aura
        luckShape = `<circle cx="0" cy="0" r="14" fill="none" stroke="${luckColor}" stroke-width="1" opacity="0.45"/><circle cx="0" cy="0" r="10" fill="none" stroke="${luckColor}" stroke-width="1.2" opacity="0.7"/><polygon points="0,-10 3,-3 10,-3 4.5,1.5 7,9 0,4.5 -7,9 -4.5,1.5 -10,-3 -3,-3" fill="${luckColor}"/>`;
    }

    // Layout: Rute schräg von oben-links (Spitze) nach unten-rechts (Griff).
    // Hook + Bait deutlich höher gerückt damit sie nicht am Bildrand kleben.
    const ringsCountX = Math.max(2, 3 + Math.floor(rodLvl / 2));
    // Schräge Rod-Linie: von (70,35) nach (320,175). dx/dy für senkrechte Bambus-/Eyelet-Striche.
    const rodDx = 320 - 70;
    const rodDy = 175 - 35;
    const rodLen = Math.hypot(rodDx, rodDy);
    const perpX = -rodDy / rodLen;
    const perpY = rodDx / rodLen;
    const ringsHtml = Array.from({ length: ringsCountX }, (_, i) => {
        const t = 0.15 + (i / (ringsCountX + 1)) * 0.7;
        const cx = 70 + rodDx * t;
        const cy = 35 + rodDy * t;
        if (theme.ringShape === "bamboo") {
            // Bambus-Knoten: kurzer Querstrich senkrecht zur Rute
            const half = 5;
            const x1 = cx + perpX * half;
            const y1 = cy + perpY * half;
            const x2 = cx - perpX * half;
            const y2 = cy - perpY * half;
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${rodGrip}" stroke-width="2.2" stroke-linecap="round"/>`;
        }
        if (theme.ringShape === "eyelet") {
            // Eyelet: leerer Ring, klein
            return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="none" stroke="${rodGrip}" stroke-width="1.6"/>`;
        }
        // Default: gefüllter Kreis (Pond)
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="${rodGrip}"/>`;
    }).join("");

    const rodStroke = (4.5 + rodLvl * 0.5) * theme.rodThickness;
    const handleStroke = (8 + rodLvl * 0.45) * theme.handleThickness;

    return `
        <svg class="angel-svg" viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <!-- Schnur (vom Rod-Tip nach unten) -->
            <line x1="70" y1="35" x2="70" y2="170" stroke="${lineColor}" stroke-width="${lineW}" stroke-linecap="round" style="${lineGlow}"/>

            <!-- Rute -->
            <g style="${rodGlow}">
                <line x1="70" y1="35" x2="320" y2="175" stroke="${rodColor}" stroke-width="${rodStroke}" stroke-linecap="round"/>
                ${ringsHtml}
                <!-- Griff -->
                <line x1="307" y1="167" x2="343" y2="192" stroke="${rodGrip}" stroke-width="${handleStroke}" stroke-linecap="round"/>
            </g>

            <!-- Glücks-Charm (vom Griff baumelnd) -->
            <g transform="translate(328 208)" style="${luckGlow}">
                <line x1="0" y1="-14" x2="0" y2="-2" stroke="${luckColor}" stroke-width="1.2" opacity="0.6"/>
                ${luckShape}
            </g>

            <!-- Haken + Bait am Schnur-Ende -->
            <g transform="translate(70 170)" style="${hookGlow}">
                <path d="M 0 0 q 0 ${9 * hookSize} -7 ${12 * hookSize} q -9 ${3 * hookSize} -9 -${3 * hookSize}"
                      stroke="${hookColor}" stroke-width="${2 * hookSize}" fill="none" stroke-linecap="round"/>
                ${hookBarbs}
                ${hookTwin}
                <g transform="translate(-11 ${12 * hookSize})" style="${baitGlow}">
                    ${baitShape}
                </g>
            </g>
        </svg>
    `;
}

export class AngelUiSystem {
    constructor(root, options = {}) {
        this.root = root; // .angel-body container
        this.options = options;
        this.stage = root.querySelector("#angel-stage");
        this.partsBar = root.querySelector("#angel-parts");
        this.detail = root.querySelector("#angel-detail");
        this.selectedPart = PART_ORDER[0];

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
            if (this.options.onBuy?.(upgradeId)) {
                this.render();
            }
        });
    }

    render() {
        const state = this.options.getState();
        const levels = Object.fromEntries(PART_ORDER.map((part) => [part, getUpgradeLevel(state, PART_TO_UPGRADE[part])]));
        const area = state.currentArea || "pond";

        this.stage.innerHTML = svgRod(area, levels);

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
                    <span class="angel-part-tab-name">${PART_LABELS[part]}</span>
                    <span class="angel-part-tab-level">Lvl ${lvl}/${max}</span>
                </button>
            `;
        }).join("");

        // Detail-Panel: aktueller Part + Preis + Buy
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

        const buttonHtml = isMaxed
            ? `<button class="angel-buy is-maxed" type="button" disabled>Maximal-Level erreicht</button>`
            : `<button class="angel-buy ${canAfford ? "is-available" : "is-locked"}" type="button" data-angel-buy="${upgradeId}" ${canAfford ? "" : "disabled"}>
                   ${canAfford ? `Upgraden – ${this.options.formatCoins?.(cost) ?? cost} Coins` : `${this.options.formatCoins?.(cost) ?? cost} Coins nötig`}
               </button>`;

        this.detail.innerHTML = `
            <header class="angel-detail-head">
                <div>
                    <p class="angel-detail-kicker">${PART_LABELS[partKey]}</p>
                    <strong class="angel-detail-name">${upgrade.name}</strong>
                </div>
                <div class="angel-level-line" aria-label="Level ${lvl} von ${max}">${levelDots}</div>
            </header>
            <p class="angel-detail-copy">${upgrade.copy}</p>
            ${buttonHtml}
        `;
    }
}

export { PART_ORDER, PART_LABELS, PART_TO_UPGRADE };
