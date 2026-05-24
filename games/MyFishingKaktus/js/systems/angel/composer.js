// ============================================================================
// js/systems/angel/composer.js
// ============================================================================
// Composer baut den fertigen SVG-String aus dem Area-Blueprint + Level-Tupel.
// Eine Funktion, eine Aufgabe: composeRodSvg(area, levels) → svg string.
// ============================================================================

import { GEO, LINE_WIDTH, getAreaBlueprint, pick, clamp5, shade } from "./themes.js";
import {
    RodShapes, GripShapes, ReelShapes, EyeletShapes,
    HookShapes, BaitShapes, AuraShapes, renderLuckCharm,
} from "./shapes.js";

let UID_COUNTER = 0;
function nextUid() {
    UID_COUNTER = (UID_COUNTER + 1) % 1e9;
    return `r${UID_COUNTER.toString(36)}`;
}

// Hook-Position relativ zum Bait, abhängig vom Bait-Style.
function getHookOffset(baitStyle, baitH) {
    switch (baitStyle) {
        case "fly": return { x: 0,             y: baitH * 1.3 };
        case "jig": return { x: 0,             y: baitH * 2.3 };
        default:    return { x: -baitH * 0.4,  y: baitH * 1.9 };
    }
}

// Reel-Anchor relativ zur Grip-Achse, abhängig vom Reel-Style.
function getReelAnchor(reelStyle) {
    const t   = reelStyle === "fly" ? 0.16 : (reelStyle === "baitcaster" ? 0.16 : 0.18);
    const off = reelStyle === "fly" ? 8    : (reelStyle === "baitcaster" ? 9    : 9);
    return {
        x: GEO.ferrule.x + GEO.gripDx * t + GEO.gripNx * off,
        y: GEO.ferrule.y + GEO.gripDy * t + GEO.gripNy * off,
    };
}

export function composeRodSvg(area, levels) {
    const bp = getAreaBlueprint(area);
    const uid = nextUid();

    const rodColor  = pick(bp.palette.rod,  levels.rod);
    const gripColor = pick(bp.palette.grip, levels.rod);
    const lineColor = pick(bp.palette.line, levels.line);
    const hookColor = pick(bp.palette.hook, levels.hook);
    const baitColor = pick(bp.palette.bait, levels.bait);
    const luckColor = pick(bp.palette.luck, levels.luck);
    const lineW     = LINE_WIDTH[clamp5(levels.line)];
    const accent    = bp.accent;
    const auraColor = bp.aura && bp.aura.color;

    const baitLvl = clamp5(levels.bait);
    const baitH = bp.parts.bait === "fly" ? (5 + baitLvl * 0.9)
                : bp.parts.bait === "jig" ? (6 + baitLvl * 1.0)
                : (6 + baitLvl * 1.1);

    const ctxRod  = { uid, geom: GEO, bp, levels, color: rodColor,  accent };
    const ctxGrip = { uid, geom: GEO, bp, levels, color: gripColor, accent };
    const ctxReel = { uid, geom: GEO, bp, levels, color: gripColor, lineColor, accent };
    const ctxEye  = { uid, geom: GEO, bp, levels, color: rodColor };
    const ctxBait = { uid, color: baitColor, levels, auraColor, accent };
    const ctxHook = { uid, levels };
    const ctxAura = { bp, uid };

    const reelAnchor = getReelAnchor(bp.parts.reel);
    const hookOff    = getHookOffset(bp.parts.bait, baitH);

    const auraFn = AuraShapes[bp.aura && bp.aura.type] || AuraShapes.none;
    const auraSvg = auraFn(ctxAura);

    const defs = `
        <defs>
            <linearGradient id="${uid}_rod" gradientUnits="userSpaceOnUse"
                x1="${(GEO.tip.x + GEO.rodNx * 4).toFixed(2)}" y1="${(GEO.tip.y + GEO.rodNy * 4).toFixed(2)}"
                x2="${(GEO.tip.x - GEO.rodNx * 4).toFixed(2)}" y2="${(GEO.tip.y - GEO.rodNy * 4).toFixed(2)}">
                <stop offset="0" stop-color="${shade(rodColor, 0.28)}"/>
                <stop offset="0.45" stop-color="${rodColor}"/>
                <stop offset="1" stop-color="${shade(rodColor, -0.4)}"/>
            </linearGradient>
            <linearGradient id="${uid}_grip" gradientUnits="userSpaceOnUse" x1="0" y1="-12" x2="0" y2="12">
                <stop offset="0" stop-color="${shade(gripColor, 0.35)}"/>
                <stop offset="0.5" stop-color="${gripColor}"/>
                <stop offset="1" stop-color="${shade(gripColor, -0.4)}"/>
            </linearGradient>
            <radialGradient id="${uid}_reel" cx="0.35" cy="0.3" r="0.9">
                <stop offset="0" stop-color="${shade(gripColor, 0.5)}"/>
                <stop offset="0.6" stop-color="${shade(gripColor, 0.05)}"/>
                <stop offset="1" stop-color="${shade(gripColor, -0.4)}"/>
            </radialGradient>
            <linearGradient id="${uid}_bait" gradientUnits="userSpaceOnUse" x1="0" y1="${(-baitH).toFixed(2)}" x2="0" y2="${(baitH * 2).toFixed(2)}">
                <stop offset="0" stop-color="${shade(baitColor, 0.4)}"/>
                <stop offset="0.5" stop-color="${baitColor}"/>
                <stop offset="1" stop-color="${shade(baitColor, -0.45)}"/>
            </linearGradient>
            <linearGradient id="${uid}_hook" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="6" y2="0">
                <stop offset="0" stop-color="${shade(hookColor, 0.4)}"/>
                <stop offset="0.5" stop-color="${hookColor}"/>
                <stop offset="1" stop-color="${shade(hookColor, -0.4)}"/>
            </linearGradient>
            <filter id="${uid}_sh" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>
                <feOffset dx="0" dy="1.2" result="off"/>
                <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>`;

    const line = `
        <path d="M ${reelAnchor.x.toFixed(1)} ${reelAnchor.y.toFixed(1)}
            Q ${(GEO.tip.x + (reelAnchor.x - GEO.tip.x) * 0.3).toFixed(1)} ${(GEO.tip.y + (reelAnchor.y - GEO.tip.y) * 0.4).toFixed(1)}
            ${GEO.tip.x} ${GEO.tip.y}"
            stroke="${lineColor}" stroke-width="${lineW}" fill="none" stroke-linecap="round" opacity="0.95"/>
        <path d="M ${GEO.tip.x} ${GEO.tip.y}
            Q ${(GEO.tip.x + 2).toFixed(1)} ${((GEO.tip.y + GEO.baitY) / 2).toFixed(1)}
            ${GEO.baitX} ${GEO.baitY}"
            stroke="${lineColor}" stroke-width="${lineW}" fill="none" stroke-linecap="round" opacity="0.95"/>`;

    return `
<svg class="angel-svg" viewBox="0 0 ${GEO.viewWidth} ${GEO.viewHeight}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${defs}

    <!-- Layer 0 — Aura -->
    ${auraSvg}

    <!-- Layer 1 — Grip (unter Rod) -->
    <g filter="url(#${uid}_sh)">
        ${GripShapes[bp.parts.grip](ctxGrip)}
    </g>

    <!-- Layer 2 — Reel -->
    <g filter="url(#${uid}_sh)">
        ${ReelShapes[bp.parts.reel](ctxReel)}
    </g>

    <!-- Layer 3 — Rod Blank -->
    <g filter="url(#${uid}_sh)">
        ${RodShapes[bp.parts.rod](ctxRod)}
    </g>

    <!-- Layer 4 — Eyelets + Tip-Ring -->
    ${EyeletShapes[bp.parts.eyelet](ctxEye)}
    <circle cx="${GEO.tip.x}" cy="${GEO.tip.y}" r="1.6" fill="${shade(rodColor, -0.3)}"/>
    <circle cx="${GEO.tip.x}" cy="${GEO.tip.y}" r="0.9" fill="none" stroke="${shade(rodColor, 0.4)}" stroke-width="0.4"/>

    <!-- Layer 5 — Line -->
    ${line}

    <!-- Layer 6 — Bait + Hook -->
    <g transform="translate(${GEO.baitX} ${GEO.baitY})">
        ${BaitShapes[bp.parts.bait](ctxBait)}
        <g transform="translate(${hookOff.x.toFixed(2)} ${hookOff.y.toFixed(2)})">
            ${HookShapes[bp.parts.hook](ctxHook)}
        </g>
    </g>

    <!-- Layer 7 — Luck-Charm -->
    <g transform="translate(${GEO.gripEnd.x - 3} ${GEO.gripEnd.y + 14})">
        ${renderLuckCharm({ color: luckColor, levels })}
    </g>
</svg>`;
}
