// ============================================================================
// js/systems/angel/themes.js
// ============================================================================
// Blueprint-System: Area = Daten-Objekt. Neue Area = neuer Block in
// AREA_BLUEPRINTS. Composer + Shapes lesen nur diese Daten.
//
// Erweitern:
//   1. (Optional) Neue Shape-Variante in shapes.js registrieren
//   2. Neuen Eintrag in AREA_BLUEPRINTS anlegen
//   3. Fertig.
// ============================================================================

// ─── Color helpers ──────────────────────────────────────────────────────────
export function shade(hex, amt) {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    let r = parseInt(n.slice(0, 2), 16);
    let g = parseInt(n.slice(2, 4), 16);
    let b = parseInt(n.slice(4, 6), 16);
    r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
    g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
    b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function hexAlpha(hex, a) {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

export const clamp5 = (n) => Math.max(0, Math.min(5, (n | 0)));
export const pick = (arr, lvl) => arr[clamp5(lvl)];

// ─── Geometry (gemeinsam für alle Areas) ────────────────────────────────────
// Anchor-Punkte. Alle Shapes hängen sich an diese Punkte — NICHT verändern,
// sonst kollidieren Line/Reel/Eyelets nicht mehr mit Rod/Grip.
export const GEO = {
    tip:     { x: 54,  y: 26 },
    ferrule: { x: 252, y: 136 },
    gripEnd: { x: 345, y: 188 },
    baitX: 54, baitY: 160,
    viewWidth: 400, viewHeight: 240,
};
GEO.rodDx  = GEO.ferrule.x - GEO.tip.x;
GEO.rodDy  = GEO.ferrule.y - GEO.tip.y;
GEO.rodLen = Math.hypot(GEO.rodDx, GEO.rodDy);
GEO.rodNx  = -GEO.rodDy / GEO.rodLen;
GEO.rodNy  =  GEO.rodDx / GEO.rodLen;
GEO.rodAng = (Math.atan2(GEO.rodDy, GEO.rodDx) * 180) / Math.PI;
GEO.gripDx  = GEO.gripEnd.x - GEO.ferrule.x;
GEO.gripDy  = GEO.gripEnd.y - GEO.ferrule.y;
GEO.gripLen = Math.hypot(GEO.gripDx, GEO.gripDy);
GEO.gripAng = (Math.atan2(GEO.gripDy, GEO.gripDx) * 180) / Math.PI;
GEO.gripNx  = -GEO.gripDy / GEO.gripLen;
GEO.gripNy  =  GEO.gripDx / GEO.gripLen;

// Line-Width pro Level (Area-übergreifend).
export const LINE_WIDTH = [1.0, 1.3, 1.6, 1.9, 2.3, 2.7];

// ============================================================================
// AREA BLUEPRINTS — HIER NEUE AREAS HINZUFÜGEN
// ============================================================================
// Schema:
//   name    : Anzeige-Name (optional, fürs Debugging)
//   parts   : { rod, grip, reel, eyelet, hook, bait } — Strings aus den
//             Shape-Registries in shapes.js
//   aura    : { type, color } — type aus AuraShapes, color für Aura-Tint
//   accent  : Akzentfarbe (Reel-Knöpfe, Highlights)
//   palette : { rod, grip, line, hook, bait, luck } — je 6-Eintrag-Array (L0→L5)
// ============================================================================
export const AREA_BLUEPRINTS = {
    pond: {
        name: "Pond · Klassischer Angler",
        parts:  { rod: "classic", grip: "cork", reel: "spinning", eyelet: "chrome", hook: "j", bait: "spinner" },
        aura:   { type: "none" },
        accent: "#ffd166",
        palette: {
            rod:  ["#8b5a2b", "#a2683b", "#c9a35a", "#a87e3a", "#cfd8e0", "#ffd166"],
            grip: ["#3a230f", "#4a2c12", "#5a3818", "#3a3018", "#2a3140", "#3e2e08"],
            line: ["#7a838a", "#9aa3aa", "#cfd5db", "#e6dba0", "#ffe066", "#fff5b3"],
            hook: ["#a8a8a8", "#c0c0c0", "#dadada", "#ffb866", "#ff7a4a", "#ffd166"],
            bait: ["#8a5a2f", "#5d7a30", "#3a8090", "#c46cff", "#ff7a8c", "#ffd166"],
            luck: ["#bfbfbf", "#8fd9a8", "#ffd166", "#a35cff", "#ff7a8c", "#7aeaff"],
        },
    },
    lake: {
        name: "Lake · Mystischer Wald",
        parts:  { rod: "driftwood", grip: "wrap", reel: "fly", eyelet: "wire", hook: "barbed", bait: "fly" },
        aura:   { type: "leaves", color: "#8fd9a8" },
        accent: "#a8e8c6",
        palette: {
            rod:  ["#4a3a26", "#5a4530", "#6a5840", "#3f7d5a", "#2a8e6c", "#7fffb9"],
            grip: ["#26190a", "#2d1f10", "#1f3a26", "#1a4030", "#0a4838", "#10302a"],
            line: ["#9ec2a8", "#b8cdd0", "#dde9e2", "#a8e0e8", "#7ad6ff", "#d4fffa"],
            hook: ["#8a7c5a", "#a08350", "#bfa56e", "#a8c8e8", "#5ae0ff", "#6cffd6"],
            bait: ["#7a6438", "#7aa050", "#3aa088", "#9c6cff", "#ff8e9c", "#a0ffd6"],
            luck: ["#bfd4b8", "#6fd8a0", "#a8e0e8", "#5cb0ff", "#a3e8ff", "#90ffe8"],
        },
    },
    ocean: {
        name: "Ocean · Industrieller Tiefseejäger",
        parts:  { rod: "tactical", grip: "rubber", reel: "baitcaster", eyelet: "heavy", hook: "treble", bait: "jig" },
        aura:   { type: "bubbles", color: "#5cffe0" },
        accent: "#5cffe0",
        palette: {
            rod:  ["#1f3a5c", "#2c4a7a", "#34547a", "#1a2a48", "#bdc4ce", "#ffd166"],
            grip: ["#0a1a30", "#10243a", "#08182a", "#04101e", "#2a3a5a", "#0a2030"],
            line: ["#5a6e8e", "#a8b4cc", "#cfd5e8", "#9ed0ff", "#ffd166", "#fff5b3"],
            hook: ["#7a6648", "#a08866", "#cfb588", "#ff8e6a", "#ff5050", "#ffd166"],
            bait: ["#3a5a7a", "#4a7090", "#3ac0e0", "#c46cff", "#ff5050", "#ffd166"],
            luck: ["#cfd5e8", "#ffaaaa", "#ffd166", "#a35cff", "#5cffe0", "#fff5b3"],
        },
    },

    // ─── Beispiel für eine vierte Area (auskommentiert) ─────────────────────
    // volcano: {
    //     name: "Volcano · Glühende Schmiede",
    //     parts:  { rod: "tactical", grip: "wrap", reel: "spinning", eyelet: "heavy", hook: "barbed", bait: "jig" },
    //     aura:   { type: "embers", color: "#ff7a3a" },
    //     accent: "#ff9a3a",
    //     palette: {
    //         rod:  ["#3a1a08","#4a2010","#5a2e18","#6a3a20","#a85a30","#ffb070"],
    //         grip: ["#1a0a04","#2a1408","#3a1a0c","#4a2010","#5a2814","#ff5030"],
    //         line: ["#7a838a","#9aa3aa","#cfd5db","#ffae66","#ff7a3a","#fff5b3"],
    //         hook: ["#a8a8a8","#c0c0c0","#dadada","#ff8e6a","#ff5050","#ffd166"],
    //         bait: ["#8a3a0f","#a85020","#ff6c3a","#ff9050","#ff5030","#ffd166"],
    //         luck: ["#bfbfbf","#ff9a6a","#ffd166","#ff7a3a","#ff5050","#fff5b3"],
    //     },
    // },
};

export function getAreaBlueprint(areaId) {
    return AREA_BLUEPRINTS[areaId] || AREA_BLUEPRINTS.pond;
}
