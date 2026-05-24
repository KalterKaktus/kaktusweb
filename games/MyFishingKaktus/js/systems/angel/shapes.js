// ============================================================================
// js/systems/angel/shapes.js
// ============================================================================
// Shape-Registries. Jede Shape-Funktion bekommt ein ctx-Objekt und gibt
// einen SVG-String zurück.
//
// ctx = {
//   uid     — eindeutiger Präfix für Gradient-IDs (Composer setzt das)
//   geom    — GEO aus themes.js
//   bp      — Area-Blueprint
//   levels  — { rod, line, hook, bait, luck }
//   color   — Part-Farbe + Level bereits resolved
//   accent  — bp.accent
//   ...     — manche Shapes bekommen zusätzliche Hilfsfarben (siehe Composer)
// }
//
// Neue Variante:
//   RodShapes.crystal = (ctx) => `<g>…</g>`;
//   GripShapes.bone   = (ctx) => `<g>…</g>`;
//   …
// Dann in themes.js: parts.rod = "crystal", parts.grip = "bone".
// ============================================================================

import { shade, clamp5 } from "./themes.js";

// ─── Helper: Taper-Polygon ──────────────────────────────────────────────────
// a, b: Endpunkte; nx, ny: Normale; wA, wB: Breite an A bzw. B;
// side: 0 = beidseitig, +1 = nur obere Hälfte, -1 = nur untere
function makeTaperPoly(a, b, nx, ny, wA, wB, side = 0) {
    let pts;
    if (side === 0) {
        pts = [
            [a.x + nx * wA, a.y + ny * wA],
            [b.x + nx * wB, b.y + ny * wB],
            [b.x - nx * wB, b.y - ny * wB],
            [a.x - nx * wA, a.y - ny * wA],
        ];
    } else if (side > 0) {
        pts = [
            [a.x + nx * wA, a.y + ny * wA],
            [b.x + nx * wB, b.y + ny * wB],
            [b.x, b.y],
            [a.x, a.y],
        ];
    } else {
        pts = [
            [a.x, a.y],
            [b.x, b.y],
            [b.x - nx * wB, b.y - ny * wB],
            [a.x - nx * wA, a.y - ny * wA],
        ];
    }
    return pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" ");
}

// ============================================================================
// ROD BLANKS
// ============================================================================
export const RodShapes = {
    classic({ uid, geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const wTip = 1.0, wFer = 4.6 + lvl * 0.32;
        const blank = makeTaperPoly(geom.tip, geom.ferrule, geom.rodNx, geom.rodNy, wTip, wFer);
        const hi    = makeTaperPoly(geom.tip, geom.ferrule, geom.rodNx, geom.rodNy, wTip - 0.4, wFer * 0.4, +1);
        return `
            <g>
                <polygon points="${blank}" fill="url(#${uid}_rod)"/>
                <polygon points="${hi}" fill="${shade(color, 0.4)}" opacity="0.45"/>
            </g>`;
    },

    driftwood({ uid, geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const wTip = 1.4, wFer = 5.4 + lvl * 0.3;
        const blank = makeTaperPoly(geom.tip, geom.ferrule, geom.rodNx, geom.rodNy, wTip, wFer);
        const hi    = makeTaperPoly(geom.tip, geom.ferrule, geom.rodNx, geom.rodNy, wTip - 0.5, wFer * 0.4, +1);

        // Knoten entlang der Rute
        const knotPositions = [0.22, 0.42, 0.6, 0.78];
        const knots = knotPositions.map((t) => {
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w  = wTip + (wFer - wTip) * t;
            const r  = w * 0.85 + 1;
            return `
                <ellipse cx="${(cx + geom.rodNx * w * 0.5).toFixed(2)}" cy="${(cy + geom.rodNy * w * 0.5).toFixed(2)}"
                    rx="${r.toFixed(2)}" ry="${(r * 0.7).toFixed(2)}"
                    transform="rotate(${geom.rodAng.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"
                    fill="${shade(color, -0.2)}"/>
                <ellipse cx="${(cx + geom.rodNx * w * 0.4).toFixed(2)}" cy="${(cy + geom.rodNy * w * 0.4).toFixed(2)}"
                    rx="${(r * 0.4).toFixed(2)}" ry="${(r * 0.3).toFixed(2)}"
                    transform="rotate(${geom.rodAng.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"
                    fill="${shade(color, -0.5)}"/>`;
        }).join("");

        // 2 Astansätze
        const branches = [0.32, 0.68].map((t) => {
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w  = wTip + (wFer - wTip) * t;
            const tipX = cx + geom.rodNx * (w + 7) - (geom.rodDy / geom.rodLen) * 4;
            const tipY = cy + geom.rodNy * (w + 7) + (geom.rodDx / geom.rodLen) * 4;
            return `<path d="M ${(cx + geom.rodNx * w).toFixed(2)} ${(cy + geom.rodNy * w).toFixed(2)}
                Q ${(cx + geom.rodNx * (w + 4)).toFixed(2)} ${(cy + geom.rodNy * (w + 4)).toFixed(2)}
                ${tipX.toFixed(1)} ${tipY.toFixed(1)}"
                stroke="${shade(color, -0.3)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        }).join("");

        // Maserung
        let grain = "";
        for (let i = 0; i < 4; i++) {
            const t0 = 0.1 + i * 0.22;
            const t1 = t0 + 0.12;
            const off = ((i % 2) - 0.5) * 0.5;
            const x0 = geom.tip.x + geom.rodDx * t0 + geom.rodNx * off;
            const y0 = geom.tip.y + geom.rodDy * t0 + geom.rodNy * off;
            const x1 = geom.tip.x + geom.rodDx * t1 + geom.rodNx * off * 1.4;
            const y1 = geom.tip.y + geom.rodDy * t1 + geom.rodNy * off * 1.4;
            grain += `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2 - 0.5).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}"
                stroke="${shade(color, -0.35)}" stroke-width="0.5" fill="none" opacity="0.7"/>`;
        }

        return `
            <g>
                <polygon points="${blank}" fill="url(#${uid}_rod)"/>
                ${branches}
                ${knots}
                ${grain}
                <polygon points="${hi}" fill="${shade(color, 0.3)}" opacity="0.3"/>
            </g>`;
    },

    tactical({ uid, geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const wTip = 0.9, wFer = 5.2 + lvl * 0.32;
        const blank = makeTaperPoly(geom.tip, geom.ferrule, geom.rodNx, geom.rodNy, wTip, wFer);
        const hi    = makeTaperPoly(geom.tip, geom.ferrule, geom.rodNx, geom.rodNy, wTip - 0.3, wFer * 0.45, +1);

        const bandPositions = [0.18, 0.36, 0.55, 0.74];
        const bands = bandPositions.map((t) => {
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w  = wTip + (wFer - wTip) * t;
            return `
                <rect x="-1.5" y="${(-w - 0.5).toFixed(2)}" width="3" height="${(w * 2 + 1).toFixed(2)}"
                    transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${geom.rodAng.toFixed(2)})"
                    fill="${shade(color, -0.45)}"/>
                <rect x="-1.5" y="${(-w - 0.5).toFixed(2)}" width="3" height="0.8"
                    transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${geom.rodAng.toFixed(2)})"
                    fill="${shade(color, 0.4)}" opacity="0.6"/>`;
        }).join("");

        const notches = [0.27, 0.46, 0.65].map((t) => {
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w  = wTip + (wFer - wTip) * t;
            const topX = cx + geom.rodNx * w;
            const topY = cy + geom.rodNy * w;
            const dxAxis = geom.rodDx / geom.rodLen;
            const dyAxis = geom.rodDy / geom.rodLen;
            const pts = [
                [topX - dxAxis * 3, topY - dyAxis * 3],
                [topX - geom.rodNx * 2, topY - geom.rodNy * 2],
                [topX + dxAxis * 3, topY + dyAxis * 3],
            ].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
            return `<polygon points="${pts}" fill="#0a1a30"/>`;
        }).join("");

        return `
            <g>
                <polygon points="${blank}" fill="url(#${uid}_rod)"/>
                <polygon points="${hi}" fill="${shade(color, 0.45)}" opacity="0.6"/>
                ${notches}
                ${bands}
            </g>`;
    },
};

// ============================================================================
// GRIPS
// ============================================================================
export const GripShapes = {
    cork({ uid, geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const gW = 7 + lvl * 0.4;
        const gLen = geom.gripLen;
        let stipple = "";
        for (let i = 0; i < 14; i++) {
            const px = 10 + i * ((gLen - 20) / 14);
            const py = i % 3 === 0 ? -gW * 0.18 : i % 3 === 1 ? 0 : gW * 0.22;
            stipple += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.45" fill="${shade(color, -0.45)}" opacity="0.55"/>`;
        }
        return `
            <g transform="translate(${geom.ferrule.x} ${geom.ferrule.y}) rotate(${geom.gripAng.toFixed(2)})">
                <rect x="-1" y="${(-gW * 0.55).toFixed(2)}" width="7" height="${(gW * 1.1).toFixed(2)}" fill="${shade(color, -0.2)}"/>
                <rect x="6" y="${(-gW * 0.5).toFixed(2)}" width="${(gLen - 12).toFixed(2)}" height="${gW.toFixed(2)}"
                    fill="url(#${uid}_grip)" rx="${(gW * 0.25).toFixed(2)}"/>
                ${stipple}
                <rect x="${(gLen - 7).toFixed(2)}" y="${(-gW * 0.6).toFixed(2)}" width="4" height="${(gW * 1.2).toFixed(2)}"
                    fill="${shade(color, -0.4)}" rx="1"/>
            </g>`;
    },

    wrap({ uid, geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const gW = 7 + lvl * 0.35;
        const gLen = geom.gripLen;
        const segs = 6;
        const segLen = (gLen - 16) / segs;
        let wraps = "";
        for (let i = 0; i < segs; i++) {
            const x = 8 + i * segLen;
            wraps += `<line x1="${x.toFixed(2)}" y1="${(-gW * 0.45).toFixed(2)}" x2="${(x + segLen).toFixed(2)}" y2="${(gW * 0.45).toFixed(2)}"
                stroke="${shade(color, 0.35)}" stroke-width="0.7"/>
                <line x1="${x.toFixed(2)}" y1="${(gW * 0.45).toFixed(2)}" x2="${(x + segLen).toFixed(2)}" y2="${(-gW * 0.45).toFixed(2)}"
                stroke="${shade(color, 0.35)}" stroke-width="0.7"/>`;
        }
        let bands = "";
        for (let i = 1; i < segs; i++) {
            const x = 8 + i * segLen;
            bands += `<line x1="${x.toFixed(2)}" y1="${(-gW * 0.55).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(gW * 0.55).toFixed(2)}"
                stroke="${shade(color, -0.3)}" stroke-width="0.8"/>`;
        }
        return `
            <g transform="translate(${geom.ferrule.x} ${geom.ferrule.y}) rotate(${geom.gripAng.toFixed(2)})">
                <rect x="-1" y="${(-gW * 0.6).toFixed(2)}" width="6" height="${(gW * 1.2).toFixed(2)}" fill="${shade(color, -0.4)}"/>
                <rect x="5" y="${(-gW * 0.5).toFixed(2)}" width="${(gLen - 10).toFixed(2)}" height="${gW.toFixed(2)}"
                    fill="url(#${uid}_grip)" rx="${(gW * 0.18).toFixed(2)}"/>
                ${wraps}
                ${bands}
                <rect x="${(gLen - 6).toFixed(2)}" y="${(-gW * 0.65).toFixed(2)}" width="4" height="${(gW * 1.3).toFixed(2)}"
                    fill="${shade(color, -0.5)}" rx="0.5"/>
                <circle cx="${(gLen - 2).toFixed(2)}" cy="0" r="${(gW * 0.35).toFixed(2)}"
                    fill="none" stroke="${shade(color, 0.4)}" stroke-width="0.7"/>
            </g>`;
    },

    rubber({ uid, geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const gW = 8 + lvl * 0.4;
        const gLen = geom.gripLen;
        let ribs = "";
        const ribCount = 16;
        for (let i = 0; i < ribCount; i++) {
            const x = 8 + i * ((gLen - 18) / ribCount);
            ribs += `<line x1="${x.toFixed(2)}" y1="${(-gW * 0.4).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(gW * 0.4).toFixed(2)}"
                stroke="${shade(color, -0.5)}" stroke-width="0.6"/>`;
        }
        return `
            <g transform="translate(${geom.ferrule.x} ${geom.ferrule.y}) rotate(${geom.gripAng.toFixed(2)})">
                <rect x="-2" y="${(-gW * 0.6).toFixed(2)}" width="7" height="${(gW * 1.2).toFixed(2)}" fill="#5a6878"/>
                <rect x="-2" y="${(-gW * 0.6).toFixed(2)}" width="7" height="1" fill="#9aa8b8"/>
                <rect x="5" y="${(-gW * 0.5).toFixed(2)}" width="${(gLen - 12).toFixed(2)}" height="${gW.toFixed(2)}"
                    fill="url(#${uid}_grip)" rx="${(gW * 0.12).toFixed(2)}"/>
                ${ribs}
                <rect x="${(gLen - 8).toFixed(2)}" y="${(-gW * 0.65).toFixed(2)}" width="6" height="${(gW * 1.3).toFixed(2)}" fill="#0a1620"/>
                <rect x="${(gLen - 8).toFixed(2)}" y="${(-gW * 0.65).toFixed(2)}" width="6" height="1.2" fill="#3a4858"/>
            </g>`;
    },
};

// ============================================================================
// REELS — ctx hat zusätzlich lineColor (für Spool-Linie)
// ============================================================================
export const ReelShapes = {
    spinning({ uid, geom, color, lineColor, accent }) {
        const t = 0.18;
        const ax = geom.ferrule.x + geom.gripDx * t;
        const ay = geom.ferrule.y + geom.gripDy * t;
        return `
            <g transform="translate(${ax.toFixed(2)} ${ay.toFixed(2)})">
                <rect x="-3" y="-5" width="6" height="9" fill="${shade(color, -0.25)}"/>
                <g transform="translate(${(geom.gripNx * 9).toFixed(2)} ${(geom.gripNy * 9).toFixed(2)})">
                    <circle r="9" fill="url(#${uid}_reel)" stroke="${shade(color, -0.5)}" stroke-width="0.5"/>
                    <circle r="5.5" fill="${shade(color, -0.3)}" stroke="${shade(color, -0.55)}" stroke-width="0.4"/>
                    <circle r="4.2" fill="none" stroke="${lineColor}" stroke-width="0.5" opacity="0.7"/>
                    <circle r="3.4" fill="none" stroke="${lineColor}" stroke-width="0.5" opacity="0.6"/>
                    <circle r="1" fill="${accent}"/>
                    <g transform="translate(7 6)">
                        <line x1="0" y1="0" x2="3" y2="3" stroke="${shade(color, -0.45)}" stroke-width="1.4"/>
                        <circle cx="3" cy="3" r="1.8" fill="${shade(color, -0.05)}"/>
                    </g>
                </g>
            </g>`;
    },

    fly({ uid, geom, color, lineColor, accent }) {
        const t = 0.16;
        const ax = geom.ferrule.x + geom.gripDx * t;
        const ay = geom.ferrule.y + geom.gripDy * t;
        const spokes = [0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return `<line x1="0" y1="0" x2="${(Math.cos(rad) * 7).toFixed(2)}" y2="${(Math.sin(rad) * 7).toFixed(2)}"
                stroke="${shade(color, -0.55)}" stroke-width="0.7"/>`;
        }).join("");
        return `
            <g transform="translate(${ax.toFixed(2)} ${ay.toFixed(2)})">
                <rect x="-2.5" y="-4" width="5" height="7" fill="${shade(color, -0.25)}"/>
                <g transform="translate(${(geom.gripNx * 8).toFixed(2)} ${(geom.gripNy * 8).toFixed(2)})">
                    <circle r="9" fill="url(#${uid}_reel)" stroke="${shade(color, -0.55)}" stroke-width="0.6"/>
                    ${spokes}
                    <circle r="6" fill="none" stroke="${shade(color, -0.5)}" stroke-width="0.8"/>
                    <circle r="5" fill="none" stroke="${lineColor}" stroke-width="0.5" opacity="0.75"/>
                    <circle r="2.5" fill="${shade(color, 0.1)}" stroke="${shade(color, -0.5)}" stroke-width="0.4"/>
                    <circle r="0.8" fill="${accent}"/>
                    <line x1="4" y1="4" x2="6.5" y2="6.5" stroke="${shade(color, -0.5)}" stroke-width="1.2"/>
                    <circle cx="6.5" cy="6.5" r="1.2" fill="${shade(color, 0.2)}"/>
                </g>
            </g>`;
    },

    baitcaster({ uid, geom, color, lineColor, accent }) {
        const t = 0.16;
        const ax = geom.ferrule.x + geom.gripDx * t;
        const ay = geom.ferrule.y + geom.gripDy * t;
        return `
            <g transform="translate(${ax.toFixed(2)} ${ay.toFixed(2)})">
                <rect x="-3.5" y="-4" width="7" height="6" fill="${shade(color, -0.3)}"/>
                <g transform="translate(${(geom.gripNx * 9).toFixed(2)} ${(geom.gripNy * 9).toFixed(2)})">
                    <rect x="-11" y="-7" width="22" height="14" rx="2.5" fill="url(#${uid}_reel)" stroke="${shade(color, -0.5)}" stroke-width="0.5"/>
                    <rect x="-9" y="-6.4" width="18" height="2.5" fill="${shade(color, -0.4)}"/>
                    <rect x="-9" y="-1" width="18" height="1.5" fill="${shade(color, -0.5)}"/>
                    <rect x="-2" y="-1.4" width="3" height="2.3" fill="${accent}"/>
                    <ellipse cx="0" cy="3" rx="9" ry="2.2" fill="${shade(color, -0.5)}"/>
                    <ellipse cx="0" cy="3" rx="7" ry="1.6" fill="${lineColor}" opacity="0.7"/>
                    <g transform="translate(11 0)">
                        <polygon points="0,-2.5 0.7,-0.7 2.5,0 0.7,0.7 0,2.5 -0.7,0.7 -2.5,0 -0.7,-0.7" fill="${accent}"/>
                    </g>
                    <g transform="translate(-2 6)">
                        <line x1="0" y1="0" x2="4" y2="3" stroke="${shade(color, -0.55)}" stroke-width="1.4"/>
                        <line x1="0" y1="0" x2="-4" y2="-3" stroke="${shade(color, -0.55)}" stroke-width="1.4"/>
                        <circle cx="4" cy="3" r="1.6" fill="${shade(color, 0.2)}"/>
                        <circle cx="-4" cy="-3" r="1" fill="${shade(color, 0.1)}"/>
                    </g>
                </g>
            </g>`;
    },
};

// ============================================================================
// EYELETS
// ============================================================================
export const EyeletShapes = {
    chrome({ geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const n = Math.max(3, 4 + Math.floor(lvl / 2));
        const wTip = 1.0, wFer = 4.6 + lvl * 0.32;
        let out = "";
        for (let i = 0; i < n; i++) {
            const t = 0.12 + (i / (n - 1)) * 0.84;
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w = wTip + (wFer - wTip) * t;
            const r = 2.2 + i * 0.18;
            const ox = cx + geom.rodNx * (w + r + 0.5);
            const oy = cy + geom.rodNy * (w + r + 0.5);
            out += `
                <g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) rotate(${geom.rodAng.toFixed(2)})">
                    <line x1="0" y1="${(r * 0.5).toFixed(2)}" x2="0" y2="${(r + 1.5).toFixed(2)}" stroke="${shade(color, -0.3)}" stroke-width="0.7"/>
                    <ellipse cx="0" cy="0" rx="${(r + 0.6).toFixed(2)}" ry="${(r * 0.55 + 0.4).toFixed(2)}" fill="${shade(color, -0.3)}"/>
                    <ellipse cx="0" cy="0" rx="${r.toFixed(2)}" ry="${(r * 0.55).toFixed(2)}" fill="none" stroke="${shade(color, 0.3)}" stroke-width="0.6"/>
                </g>`;
        }
        return out;
    },

    wire({ geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const n = Math.max(3, 4 + Math.floor(lvl / 2));
        const wTip = 1.4, wFer = 5.4 + lvl * 0.3;
        let out = "";
        for (let i = 0; i < n; i++) {
            const t = 0.12 + (i / (n - 1)) * 0.84;
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w = wTip + (wFer - wTip) * t;
            const r = 2.6 + i * 0.18;
            const ox = cx + geom.rodNx * (w + r + 1);
            const oy = cy + geom.rodNy * (w + r + 1);
            out += `
                <g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) rotate(${geom.rodAng.toFixed(2)})">
                    <path d="M -0.5 ${(r * 0.6).toFixed(2)} q 0.5 1 0 ${(r + 1).toFixed(2)}" stroke="${shade(color, -0.4)}" stroke-width="0.6" fill="none"/>
                    <path d="M 0.5 ${(r * 0.6).toFixed(2)} q -0.5 1 0 ${(r + 1).toFixed(2)}" stroke="${shade(color, -0.4)}" stroke-width="0.6" fill="none"/>
                    <ellipse cx="0" cy="0" rx="${r.toFixed(2)}" ry="${(r * 0.55).toFixed(2)}" fill="none" stroke="${shade(color, -0.2)}" stroke-width="0.9"/>
                </g>`;
        }
        return out;
    },

    heavy({ geom, color, levels }) {
        const lvl = clamp5(levels.rod);
        const n = Math.max(3, 4 + Math.floor(lvl / 2));
        const wTip = 0.9, wFer = 5.2 + lvl * 0.32;
        let out = "";
        for (let i = 0; i < n; i++) {
            const t = 0.12 + (i / (n - 1)) * 0.84;
            const cx = geom.tip.x + geom.rodDx * t;
            const cy = geom.tip.y + geom.rodDy * t;
            const w = wTip + (wFer - wTip) * t;
            const r = 2.5 + i * 0.2;
            const ox = cx + geom.rodNx * (w + r + 1);
            const oy = cy + geom.rodNy * (w + r + 1);
            out += `
                <g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) rotate(${geom.rodAng.toFixed(2)})">
                    <rect x="-1" y="${(r * 0.4).toFixed(2)}" width="2" height="${(r + 1.4).toFixed(2)}" fill="${shade(color, -0.5)}"/>
                    <rect x="${(-(r + 1)).toFixed(2)}" y="${(-(r * 0.7 + 0.6)).toFixed(2)}" width="${(2 * (r + 1)).toFixed(2)}" height="${(2 * (r * 0.7 + 0.6)).toFixed(2)}" fill="${shade(color, -0.45)}"/>
                    <ellipse cx="0" cy="0" rx="${r.toFixed(2)}" ry="${(r * 0.6).toFixed(2)}" fill="none" stroke="${shade(color, 0.35)}" stroke-width="0.7"/>
                    <ellipse cx="0" cy="0" rx="${(r - 1.4).toFixed(2)}" ry="${(r * 0.45).toFixed(2)}" fill="#0a1a30"/>
                </g>`;
        }
        return out;
    },
};

// ============================================================================
// HOOKS — werden lokal (am Bait) gerendert; ctx braucht keine geom hier
// ============================================================================
export const HookShapes = {
    j({ uid, levels }) {
        const lvl = clamp5(levels.hook);
        const s = 1.0 + lvl * 0.14;
        const barb = lvl >= 2
            ? `<path d="M ${(-9 * s).toFixed(2)} ${(12 * s).toFixed(2)} l 3 -3" stroke="url(#${uid}_hook)" stroke-width="${(1.2 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>`
            : "";
        return `
            <g>
                <circle cx="0" cy="-1" r="1.6" fill="none" stroke="url(#${uid}_hook)" stroke-width="0.7"/>
                <path d="M 0 0 L 0 ${(14 * s).toFixed(2)}
                    A ${(7 * s).toFixed(2)} ${(7 * s).toFixed(2)} 0 0 1 ${(-7 * s).toFixed(2)} ${(21 * s).toFixed(2)}
                    A ${(5 * s).toFixed(2)} ${(5 * s).toFixed(2)} 0 0 1 ${(-9 * s).toFixed(2)} ${(12 * s).toFixed(2)}"
                    stroke="url(#${uid}_hook)" stroke-width="${(1.6 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>
                ${barb}
            </g>`;
    },

    barbed({ uid, levels }) {
        const lvl = clamp5(levels.hook);
        const s = 1.1 + lvl * 0.16;
        const secondaryBarb = lvl >= 1
            ? `<path d="M ${(-9 * s).toFixed(2)} ${(18 * s).toFixed(2)} l 4 -1.5" stroke="url(#${uid}_hook)" stroke-width="${(1.2 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>`
            : "";
        const fang = lvl >= 3
            ? `<polygon points="${(-11 * s).toFixed(2)},${(11 * s).toFixed(2)} ${(-13 * s).toFixed(2)},${(7 * s).toFixed(2)} ${(-9 * s).toFixed(2)},${(9 * s).toFixed(2)}" fill="url(#${uid}_hook)"/>`
            : "";
        return `
            <g>
                <circle cx="0" cy="-1" r="1.8" fill="none" stroke="url(#${uid}_hook)" stroke-width="0.8"/>
                <path d="M 0 0 L 0 ${(14 * s).toFixed(2)}
                    A ${(8 * s).toFixed(2)} ${(8 * s).toFixed(2)} 0 0 1 ${(-8 * s).toFixed(2)} ${(22 * s).toFixed(2)}
                    A ${(6 * s).toFixed(2)} ${(6 * s).toFixed(2)} 0 0 1 ${(-11 * s).toFixed(2)} ${(11 * s).toFixed(2)}"
                    stroke="url(#${uid}_hook)" stroke-width="${(1.8 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>
                <path d="M ${(-11 * s).toFixed(2)} ${(11 * s).toFixed(2)} l 4 -2"
                    stroke="url(#${uid}_hook)" stroke-width="${(1.4 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>
                ${secondaryBarb}
                ${fang}
            </g>`;
    },

    treble({ uid, levels }) {
        const lvl = clamp5(levels.hook);
        const s = 1.0 + lvl * 0.13;
        const arm = (rotDeg) => {
            const barb = lvl >= 2
                ? `<path d="M ${(-7.5 * s).toFixed(2)} ${(8 * s).toFixed(2)} l 2.5 -1.5" stroke="url(#${uid}_hook)" stroke-width="${(1.1 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>`
                : "";
            return `<g transform="rotate(${rotDeg})">
                <path d="M 0 ${(8 * s).toFixed(2)}
                    A ${(6 * s).toFixed(2)} ${(6 * s).toFixed(2)} 0 0 1 ${(-6 * s).toFixed(2)} ${(16 * s).toFixed(2)}
                    A ${(4 * s).toFixed(2)} ${(4 * s).toFixed(2)} 0 0 1 ${(-7.5 * s).toFixed(2)} ${(8 * s).toFixed(2)}"
                    stroke="url(#${uid}_hook)" stroke-width="${(1.5 * s).toFixed(2)}" fill="none" stroke-linecap="round"/>
                ${barb}
            </g>`;
        };
        return `
            <g>
                <circle cx="0" cy="-1.5" r="1.9" fill="none" stroke="url(#${uid}_hook)" stroke-width="0.8"/>
                <line x1="0" y1="0" x2="0" y2="${(8 * s).toFixed(2)}" stroke="url(#${uid}_hook)" stroke-width="${(1.7 * s).toFixed(2)}" stroke-linecap="round"/>
                ${arm(0)}
                ${arm(120)}
                ${arm(-120)}
                <circle cx="0" cy="${(8 * s).toFixed(2)}" r="${(1.3 * s).toFixed(2)}" fill="url(#${uid}_hook)"/>
            </g>`;
    },
};

// ============================================================================
// BAITS — ctx hat zusätzlich color, auraColor, accent
// ============================================================================
export const BaitShapes = {
    spinner({ uid, color, levels }) {
        const lvl = clamp5(levels.bait);
        const b = 6 + lvl * 1.1;
        let eye = "";
        if (lvl >= 1) eye = `<circle cx="${(b * 0.25).toFixed(2)}" cy="${(b * 0.45).toFixed(2)}" r="${(b * 0.18).toFixed(2)}" fill="#fff"/>
            <circle cx="${(b * 0.27).toFixed(2)}" cy="${(b * 0.47).toFixed(2)}" r="${(b * 0.09).toFixed(2)}" fill="#111"/>`;
        let tail = "";
        if (lvl >= 3) tail = `<path d="M 0 ${(b * 2).toFixed(2)} q ${(b * 0.6).toFixed(2)} ${(b * 0.4).toFixed(2)} ${(b * 1.1).toFixed(2)} 0
            q -${(b * 0.5).toFixed(2)} ${(b * 0.2).toFixed(2)} -${(b * 1.1).toFixed(2)} 0 Z"
            fill="${shade(color, -0.2)}" opacity="0.85"/>`;
        let stripes = "";
        if (lvl >= 4) for (let i = 0; i < 3; i++) {
            stripes += `<line x1="${(-b * 0.5).toFixed(2)}" y1="${(b * (0.5 + i * 0.4)).toFixed(2)}"
                x2="${(b * 0.5).toFixed(2)}" y2="${(b * (0.5 + i * 0.4)).toFixed(2)}" stroke="#fff" stroke-width="0.4" opacity="0.4"/>`;
        }
        return `
            <g>
                <ellipse cx="0" cy="${(b * 0.9).toFixed(2)}" rx="${(b * 0.85).toFixed(2)}" ry="${(b * 1.25).toFixed(2)}" fill="url(#${uid}_bait)"/>
                <ellipse cx="${(-b * 0.25).toFixed(2)}" cy="${(b * 0.4).toFixed(2)}" rx="${(b * 0.25).toFixed(2)}" ry="${(b * 0.5).toFixed(2)}" fill="#fff" opacity="0.35"/>
                ${eye}
                ${tail}
                ${stripes}
            </g>`;
    },

    fly({ uid, color, levels, auraColor }) {
        const lvl = clamp5(levels.bait);
        const b = 5 + lvl * 0.9;
        const wispCount = 4 + lvl;
        let feathers = "";
        for (let i = 0; i < wispCount; i++) {
            const ang = -30 + (i / (wispCount - 1)) * 60;
            const rad = (ang * Math.PI) / 180;
            const tx = Math.sin(rad) * b * 1.8;
            const ty = b * 1.6 + Math.cos(rad) * b * 1.4;
            feathers += `<path d="M 0 ${(b * 0.6).toFixed(2)} Q ${(tx * 0.4).toFixed(2)} ${(b * 1.4).toFixed(2)} ${tx.toFixed(1)} ${ty.toFixed(1)}"
                stroke="${shade(color, 0.05 + i * 0.04)}" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.85"/>`;
        }
        const beadColors = [shade(color, 0.3), color, shade(color, -0.2), shade(color, -0.4)];
        const beadCount = 2 + Math.min(2, lvl);
        let beads = "";
        for (let i = 0; i < beadCount; i++) {
            beads += `<circle cx="0" cy="${(i * b * 0.35).toFixed(2)}" r="${(b * 0.22).toFixed(2)}"
                fill="${beadColors[i]}" stroke="${shade(color, -0.4)}" stroke-width="0.35"/>`;
        }
        const eye = lvl >= 2
            ? `<circle cx="${(b * 0.18).toFixed(2)}" cy="0" r="${(b * 0.14).toFixed(2)}" fill="#fff"/>
               <circle cx="${(b * 0.2).toFixed(2)}" cy="0.5" r="${(b * 0.07).toFixed(2)}" fill="#111"/>`
            : "";
        const glint = lvl >= 4 && auraColor
            ? `<circle cx="0" cy="${(b * 0.3).toFixed(2)}" r="${(b * 0.5).toFixed(2)}" fill="none" stroke="${auraColor}" stroke-width="0.4" opacity="0.6"/>`
            : "";
        return `
            <g>
                ${feathers}
                <ellipse cx="0" cy="${(b * 0.7).toFixed(2)}" rx="${(b * 0.4).toFixed(2)}" ry="${(b * 0.8).toFixed(2)}" fill="url(#${uid}_bait)"/>
                ${beads}
                ${eye}
                ${glint}
            </g>`;
    },

    jig({ uid, color, levels, accent }) {
        const lvl = clamp5(levels.bait);
        const b = 6 + lvl * 1.0;
        const sCount = 10 + lvl;
        let skirt = "";
        for (let i = 0; i < sCount; i++) {
            const ang = -55 + (i / (sCount - 1)) * 110;
            const rad = (ang * Math.PI) / 180;
            const tx = Math.sin(rad) * b * 1.4;
            const ty = b * 2.2 + Math.abs(Math.cos(rad)) * b * 0.9;
            const sway = Math.sin(i * 0.7) * b * 0.3;
            skirt += `<path d="M ${(Math.sin(rad) * b * 0.4).toFixed(1)} ${(b * 1.1).toFixed(1)}
                Q ${((tx + sway) * 0.6).toFixed(1)} ${(b * 1.8).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}"
                stroke="${i % 2 === 0 ? shade(color, 0.15) : shade(color, -0.2)}" stroke-width="0.55" fill="none" stroke-linecap="round" opacity="0.85"/>`;
        }
        const eye = lvl >= 1
            ? `<circle cx="${(b * 0.3).toFixed(2)}" cy="${(b * 0.5).toFixed(2)}" r="${(b * 0.16).toFixed(2)}" fill="#fff"/>
               <circle cx="${(b * 0.32).toFixed(2)}" cy="${(b * 0.52).toFixed(2)}" r="${(b * 0.08).toFixed(2)}" fill="#111"/>`
            : "";
        const glow = lvl >= 3
            ? `<ellipse cx="0" cy="${(b * 0.6).toFixed(2)}" rx="${(b * 0.95).toFixed(2)}" ry="${(b * 0.7).toFixed(2)}" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.7"/>`
            : "";
        return `
            <g>
                ${skirt}
                <path d="M ${(-b * 0.9).toFixed(2)} ${(b * 0.6).toFixed(2)} Q ${(-b * 0.9).toFixed(2)} 0 0 0
                    Q ${(b * 0.9).toFixed(2)} 0 ${(b * 0.9).toFixed(2)} ${(b * 0.6).toFixed(2)}
                    Q ${(b * 0.9).toFixed(2)} ${(b * 1.2).toFixed(2)} 0 ${(b * 1.2).toFixed(2)}
                    Q ${(-b * 0.9).toFixed(2)} ${(b * 1.2).toFixed(2)} ${(-b * 0.9).toFixed(2)} ${(b * 0.6).toFixed(2)} Z"
                    fill="url(#${uid}_bait)" stroke="${shade(color, -0.4)}" stroke-width="0.4"/>
                <ellipse cx="${(-b * 0.25).toFixed(2)}" cy="${(b * 0.35).toFixed(2)}" rx="${(b * 0.25).toFixed(2)}" ry="${(b * 0.18).toFixed(2)}" fill="#fff" opacity="0.5"/>
                ${eye}
                ${glow}
            </g>`;
    },
};

// ============================================================================
// AURAS — ctx hat bp (für Farbe). Auras werden auf Layer 0 gerendert
// (hinter Rod/Grip/Reel etc.).
// ============================================================================
export const AuraShapes = {
    none: () => "",

    leaves({ bp, uid }) {
        const color = (bp.aura && bp.aura.color) || "#8fd9a8";
        const leaves = [
            { x: 70,  y: 50,  s: 1.0,  rot: -25, op: 0.65 },
            { x: 120, y: 35,  s: 0.7,  rot: 15,  op: 0.55 },
            { x: 180, y: 70,  s: 0.9,  rot: -10, op: 0.7  },
            { x: 235, y: 110, s: 0.8,  rot: 30,  op: 0.6  },
            { x: 95,  y: 130, s: 0.6,  rot: 45,  op: 0.45 },
            { x: 30,  y: 105, s: 0.85, rot: -50, op: 0.65 },
            { x: 295, y: 70,  s: 0.7,  rot: 20,  op: 0.55 },
        ];
        const leafSvg = leaves.map((lf) => `
            <g transform="translate(${lf.x} ${lf.y}) rotate(${lf.rot})" opacity="${lf.op}">
                <path d="M 0 ${(-7 * lf.s).toFixed(2)} Q ${(5 * lf.s).toFixed(2)} 0 0 ${(7 * lf.s).toFixed(2)} Q ${(-5 * lf.s).toFixed(2)} 0 0 ${(-7 * lf.s).toFixed(2)} Z"
                    fill="${color}" stroke="${shade(color, -0.3)}" stroke-width="0.4"/>
                <line x1="0" y1="${(-6 * lf.s).toFixed(2)}" x2="0" y2="${(6 * lf.s).toFixed(2)}" stroke="${shade(color, -0.35)}" stroke-width="0.35" opacity="0.7"/>
            </g>`).join("");
        return `
            <radialGradient id="${uid}_aura_lake" cx="0.4" cy="0.4" r="0.7">
                <stop offset="0" stop-color="${color}" stop-opacity="0.18"/>
                <stop offset="1" stop-color="${color}" stop-opacity="0"/>
            </radialGradient>
            <rect x="0" y="0" width="400" height="240" fill="url(#${uid}_aura_lake)"/>
            ${leafSvg}`;
    },

    bubbles({ bp, uid }) {
        const color = (bp.aura && bp.aura.color) || "#5cffe0";
        const bubbles = [
            { x: 40,  y: 200, r: 2.2, op: 0.55 },
            { x: 55,  y: 175, r: 1.4, op: 0.5  },
            { x: 35,  y: 155, r: 0.9, op: 0.4  },
            { x: 70,  y: 145, r: 1.8, op: 0.5  },
            { x: 80,  y: 120, r: 1.0, op: 0.4  },
            { x: 90,  y: 95,  r: 0.7, op: 0.3  },
            { x: 280, y: 80,  r: 1.3, op: 0.35 },
            { x: 305, y: 55,  r: 0.9, op: 0.3  },
            { x: 195, y: 35,  r: 0.7, op: 0.25 },
        ];
        const bubSvg = bubbles.map((bb) => `
            <circle cx="${bb.x}" cy="${bb.y}" r="${bb.r}" fill="none" stroke="${color}" stroke-width="0.5" opacity="${bb.op}"/>
            <circle cx="${(bb.x - bb.r * 0.35).toFixed(2)}" cy="${(bb.y - bb.r * 0.35).toFixed(2)}" r="${(bb.r * 0.25).toFixed(2)}" fill="${color}" opacity="${(bb.op * 0.7).toFixed(2)}"/>`).join("");
        return `
            <radialGradient id="${uid}_aura_ocean" cx="0.5" cy="0.6" r="0.8">
                <stop offset="0" stop-color="${color}" stop-opacity="0.14"/>
                <stop offset="1" stop-color="${color}" stop-opacity="0"/>
            </radialGradient>
            <rect x="0" y="0" width="400" height="240" fill="url(#${uid}_aura_ocean)"/>
            ${bubSvg}`;
    },

    embers({ bp, uid }) {
        const color = (bp.aura && bp.aura.color) || "#ff7a3a";
        const sparks = [
            { x: 60,  y: 60,  r: 1.6, op: 0.7 },
            { x: 110, y: 80,  r: 1.0, op: 0.5 },
            { x: 170, y: 50,  r: 1.4, op: 0.65 },
            { x: 220, y: 95,  r: 0.8, op: 0.45 },
            { x: 280, y: 130, r: 1.2, op: 0.55 },
            { x: 40,  y: 145, r: 0.9, op: 0.45 },
        ];
        const sparkSvg = sparks.map((sp) =>
            `<circle cx="${sp.x}" cy="${sp.y}" r="${sp.r}" fill="${color}" opacity="${sp.op}"/>`
        ).join("");
        return `
            <radialGradient id="${uid}_aura_volc" cx="0.5" cy="0.5" r="0.7">
                <stop offset="0" stop-color="${color}" stop-opacity="0.2"/>
                <stop offset="1" stop-color="${color}" stop-opacity="0"/>
            </radialGradient>
            <rect x="0" y="0" width="400" height="240" fill="url(#${uid}_aura_volc)"/>
            ${sparkSvg}`;
    },

    runes({ bp, uid }) {
        const color = (bp.aura && bp.aura.color) || "#a35cff";
        const runes = [
            { x: 65,  y: 55,  s: 0.9, char: "✦" },
            { x: 150, y: 35,  s: 0.7, char: "✧" },
            { x: 220, y: 78,  s: 0.8, char: "✦" },
            { x: 95,  y: 130, s: 0.6, char: "✧" },
            { x: 290, y: 110, s: 0.75, char: "✦" },
        ];
        const runeSvg = runes.map((rn) =>
            `<text x="${rn.x}" y="${rn.y}" fill="${color}" opacity="0.6" style="font: ${(10 * rn.s).toFixed(1)}px sans-serif" text-anchor="middle">${rn.char}</text>`
        ).join("");
        return `
            <radialGradient id="${uid}_aura_rune" cx="0.5" cy="0.5" r="0.7">
                <stop offset="0" stop-color="${color}" stop-opacity="0.18"/>
                <stop offset="1" stop-color="${color}" stop-opacity="0"/>
            </radialGradient>
            <rect x="0" y="0" width="400" height="240" fill="url(#${uid}_aura_rune)"/>
            ${runeSvg}`;
    },
};

// ============================================================================
// LUCK CHARM (gemeinsam für alle Areas — Farbe variiert per Palette)
// ============================================================================
export function renderLuckCharm({ color, levels }) {
    const lvl = clamp5(levels.luck);
    const dark = shade(color, -0.3);
    let shape = "";
    if (lvl === 0) {
        shape = `<circle r="5" fill="${color}" stroke="${dark}" stroke-width="0.5"/>`;
    } else if (lvl === 1) {
        shape = `<g stroke="${dark}" stroke-width="0.4">
            <circle cx="-4" cy="0" r="4" fill="${color}"/>
            <circle cx="4" cy="0" r="4" fill="${color}"/>
            <circle cx="0" cy="-4" r="4" fill="${color}"/>
        </g>`;
    } else if (lvl === 2) {
        shape = `<g stroke="${dark}" stroke-width="0.4">
            <circle cx="-5" cy="0" r="5" fill="${color}"/>
            <circle cx="5" cy="0" r="5" fill="${color}"/>
            <circle cx="0" cy="-5" r="5" fill="${color}"/>
            <circle cx="0" cy="5" r="5" fill="${color}"/>
        </g>`;
    } else if (lvl === 3) {
        shape = `<polygon points="0,-9 2.5,-3 9,-3 4,1 6,8 0,4 -6,8 -4,1 -9,-3 -2.5,-3" fill="${color}" stroke="${dark}" stroke-width="0.4"/>`;
    } else if (lvl === 4) {
        shape = `<circle r="11" fill="${color}" fill-opacity="0.1"/>
            <circle r="11" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
            <polygon points="0,-9 2.5,-3 9,-3 4,1 6,8 0,4 -6,8 -4,1 -9,-3 -2.5,-3" fill="${color}" stroke="${dark}" stroke-width="0.4"/>`;
    } else {
        shape = `<circle r="16" fill="${color}" fill-opacity="0.08"/>
            <circle r="11" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.7"/>
            <polygon points="0,-10 3,-3 10,-3 4.5,1.5 7,9 0,4.5 -7,9 -4.5,1.5 -10,-3 -3,-3" fill="${color}" stroke="${dark}" stroke-width="0.4"/>`;
    }
    return `
        <line x1="0" y1="-14" x2="0" y2="-2" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
        ${shape}`;
}
