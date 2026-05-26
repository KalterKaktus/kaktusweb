// Skin-System für KaktusClicker (VIP-only).
//
// 3 Slot-Kategorien: head (über dem Kaktus), eyes (auf Augenhöhe), accessory
// (am Bauch/Brustbereich). Jedes Item ist ein Inline-SVG-String mit
// `currentColor` für fill/stroke, sodass die User-Farbe durch CSS `color:`
// auf dem Container vererbt wird. Glow kommt via `filter: drop-shadow(...)`
// in styles.css (.cactus-cosmetic Regel).
//
// Positionierung relativ zum cactus-button:
//   - `top`: vertikal (in em relativ zur cactus-art-font-size)
//   - `width`: horizontale Breite des SVG (in em). Container ist via
//             left:50%/translateX(-50%) horizontal zentriert.
// Die Braille-Cactus-Art ist 21 Zeichen breit × 17 Zeilen hoch und nutzt
// line-height: 1. 1em ≈ 1 Zeichenhöhe. Der Kopf des Kaktus sitzt etwa bei
// row 0-2, die Augen bei row 4-5, der Bauchbereich bei row 7-9.

export const SKIN_SLOTS = ["head", "eyes", "accessory"];

// SVG-Konvention:
//   - viewBox so gewählt dass Icon den Bereich gut ausfüllt
//   - fill / stroke = currentColor → Farbe kommt vom Container
//   - keine internen filter/effect (Glow macht CSS)
//   - vector-effect:non-scaling-stroke verhindert dass Strokes bei Skalierung
//     fett werden
const SVG = {
    sombrero: `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="50" cy="38" rx="46" ry="8" fill="currentColor" opacity="0.9"/>
  <path d="M30 38 Q50 -2 70 38 Z" fill="currentColor"/>
  <ellipse cx="50" cy="30" rx="14" ry="3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
</svg>`,

    tophat: `<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="30" y="6" width="40" height="46" fill="currentColor"/>
  <ellipse cx="50" cy="52" rx="46" ry="6" fill="currentColor"/>
  <rect x="28" y="38" width="44" height="6" fill="#0a0a0a" opacity="0.55"/>
  <rect x="32" y="10" width="3" height="38" fill="currentColor" opacity="0.4"/>
</svg>`,

    crown: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 50 L8 22 L26 38 L38 10 L50 36 L62 10 L74 38 L92 22 L92 50 Z" fill="currentColor"/>
  <rect x="6" y="48" width="88" height="8" fill="currentColor"/>
  <circle cx="26" cy="36" r="3" fill="#0a0a0a" opacity="0.55"/>
  <circle cx="50" cy="34" r="3.5" fill="#0a0a0a" opacity="0.55"/>
  <circle cx="74" cy="36" r="3" fill="#0a0a0a" opacity="0.55"/>
</svg>`,

    flower: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g transform="translate(30 28)">
    <circle cx="0" cy="-14" r="9" fill="currentColor"/>
    <circle cx="13" cy="-4" r="9" fill="currentColor"/>
    <circle cx="-13" cy="-4" r="9" fill="currentColor"/>
    <circle cx="8" cy="12" r="9" fill="currentColor"/>
    <circle cx="-8" cy="12" r="9" fill="currentColor"/>
    <circle cx="0" cy="0" r="6" fill="#0a0a0a" opacity="0.6"/>
  </g>
  <rect x="28" y="48" width="4" height="10" fill="currentColor" opacity="0.7"/>
</svg>`,

    beanie: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M14 48 Q14 8 50 8 Q86 8 86 48 Z" fill="currentColor"/>
  <rect x="10" y="44" width="80" height="10" rx="4" fill="currentColor" opacity="0.75"/>
  <circle cx="50" cy="6" r="7" fill="currentColor"/>
  <line x1="30" y1="20" x2="30" y2="44" stroke="#0a0a0a" stroke-width="1.5" opacity="0.35"/>
  <line x1="50" y1="14" x2="50" y2="44" stroke="#0a0a0a" stroke-width="1.5" opacity="0.35"/>
  <line x1="70" y1="20" x2="70" y2="44" stroke="#0a0a0a" stroke-width="1.5" opacity="0.35"/>
</svg>`,

    sunglasses: `<svg viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="6" y="6" width="36" height="20" rx="6" fill="currentColor"/>
  <rect x="58" y="6" width="36" height="20" rx="6" fill="currentColor"/>
  <line x1="42" y1="14" x2="58" y2="14" stroke="currentColor" stroke-width="3"/>
  <rect x="10" y="9" width="14" height="5" rx="2" fill="#ffffff" opacity="0.35"/>
  <rect x="62" y="9" width="14" height="5" rx="2" fill="#ffffff" opacity="0.35"/>
</svg>`,

    monocle: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="30" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="3"/>
  <circle cx="30" cy="20" r="10" fill="currentColor" opacity="0.18"/>
  <path d="M42 28 Q50 38 46 48" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="46" cy="48" r="2" fill="currentColor"/>
</svg>`,

    starEyes: `<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="currentColor">
    <path d="M22 4 L26 16 L38 18 L28 26 L31 38 L22 31 L13 38 L16 26 L6 18 L18 16 Z"/>
    <path d="M78 4 L82 16 L94 18 L84 26 L87 38 L78 31 L69 38 L72 26 L62 18 L74 16 Z"/>
  </g>
</svg>`,

    scarf: `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6 14 Q50 28 94 14 L94 26 Q50 42 6 26 Z" fill="currentColor"/>
  <path d="M58 22 L70 48 L62 48 L52 30 Z" fill="currentColor" opacity="0.85"/>
  <line x1="14" y1="20" x2="86" y2="22" stroke="#0a0a0a" stroke-width="1" opacity="0.3"/>
</svg>`,

    bowtie: `<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M8 8 L42 20 L8 32 Z" fill="currentColor"/>
  <path d="M92 8 L58 20 L92 32 Z" fill="currentColor"/>
  <rect x="42" y="12" width="16" height="16" rx="2" fill="currentColor"/>
  <line x1="46" y1="14" x2="46" y2="26" stroke="#0a0a0a" stroke-width="1" opacity="0.4"/>
  <line x1="54" y1="14" x2="54" y2="26" stroke="#0a0a0a" stroke-width="1" opacity="0.4"/>
</svg>`,

    necklace: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M10 4 Q50 50 90 4" fill="none" stroke="currentColor" stroke-width="2.5"/>
  <circle cx="50" cy="36" r="6" fill="currentColor"/>
  <circle cx="34" cy="28" r="3" fill="currentColor"/>
  <circle cx="66" cy="28" r="3" fill="currentColor"/>
  <circle cx="22" cy="18" r="2.5" fill="currentColor"/>
  <circle cx="78" cy="18" r="2.5" fill="currentColor"/>
  <path d="M50 42 L46 50 L54 50 Z" fill="currentColor" opacity="0.8"/>
</svg>`,

    // ----- Head: erweiterte Auswahl ----------------------------------------
    cowboy: `<svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M2 36 Q60 26 118 36 Q60 46 2 36 Z" fill="currentColor"/>
  <path d="M40 36 Q40 6 60 6 Q80 6 80 36 Z" fill="currentColor"/>
  <path d="M52 22 L60 16 L68 22" stroke="#0a0a0a" stroke-width="2" fill="none" opacity="0.45"/>
</svg>`,

    halo: `<svg viewBox="0 0 100 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="50" cy="13" rx="40" ry="7" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <ellipse cx="50" cy="13" rx="40" ry="7" fill="currentColor" opacity="0.2"/>
</svg>`,

    horns: `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M20 50 Q10 22 22 4 Q34 18 30 50 Z" fill="currentColor"/>
  <path d="M80 50 Q90 22 78 4 Q66 18 70 50 Z" fill="currentColor"/>
</svg>`,

    antenna: `<svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <line x1="22" y1="48" x2="14" y2="14" stroke="currentColor" stroke-width="2"/>
  <line x1="38" y1="48" x2="46" y2="14" stroke="currentColor" stroke-width="2"/>
  <circle cx="14" cy="10" r="5" fill="currentColor"/>
  <circle cx="46" cy="10" r="5" fill="currentColor"/>
</svg>`,

    // ----- Eyes: erweiterte Auswahl ----------------------------------------
    nerd: `<svg viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="24" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="3"/>
  <circle cx="76" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="3"/>
  <line x1="36" y1="15" x2="64" y2="15" stroke="currentColor" stroke-width="3"/>
  <circle cx="24" cy="15" r="9" fill="#ffffff" opacity="0.18"/>
  <circle cx="76" cy="15" r="9" fill="#ffffff" opacity="0.18"/>
</svg>`,

    eyepatch: `<svg viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="20" y="6" width="22" height="18" rx="3" fill="currentColor"/>
  <line x1="4" y1="14" x2="20" y2="14" stroke="currentColor" stroke-width="2"/>
  <line x1="42" y1="14" x2="96" y2="14" stroke="currentColor" stroke-width="2"/>
  <circle cx="31" cy="15" r="3" fill="#ffffff" opacity="0.35"/>
</svg>`,

    laser: `<svg viewBox="0 0 100 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="4" y="3" width="92" height="6" rx="2" fill="currentColor"/>
  <rect x="12" y="5" width="20" height="2" fill="#ffffff" opacity="0.85"/>
  <rect x="68" y="5" width="20" height="2" fill="#ffffff" opacity="0.85"/>
</svg>`,

    // ----- Accessory: erweiterte Auswahl -----------------------------------
    tie: `<svg viewBox="0 0 40 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M14 4 L26 4 L24 16 L30 38 L20 72 L10 38 L16 16 Z" fill="currentColor"/>
  <path d="M16 16 L24 16 L22 24 L18 24 Z" fill="#0a0a0a" opacity="0.4"/>
</svg>`,

    medal: `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M14 2 L30 24 L46 2 L40 6 L30 26 L20 6 Z" fill="currentColor" opacity="0.75"/>
  <circle cx="30" cy="48" r="20" fill="currentColor"/>
  <circle cx="30" cy="48" r="14" fill="#0a0a0a" opacity="0.35"/>
  <path d="M30 38 L33 46 L42 46 L34 51 L37 60 L30 54 L23 60 L26 51 L18 46 L27 46 Z" fill="currentColor"/>
</svg>`,

    chain: `<svg viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="14" cy="10" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>
  <ellipse cx="28" cy="16" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>
  <ellipse cx="42" cy="20" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>
  <ellipse cx="58" cy="20" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>
  <ellipse cx="72" cy="16" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>
  <ellipse cx="86" cy="10" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>
</svg>`,

    collar: `<svg viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="6" y="12" width="88" height="10" rx="2" fill="currentColor"/>
  <path d="M14 12 L18 2 L22 12 Z" fill="currentColor"/>
  <path d="M30 12 L34 2 L38 12 Z" fill="currentColor"/>
  <path d="M46 12 L50 2 L54 12 Z" fill="currentColor"/>
  <path d="M62 12 L66 2 L70 12 Z" fill="currentColor"/>
  <path d="M78 12 L82 2 L86 12 Z" fill="currentColor"/>
</svg>`,
};

export const SKIN_ITEMS = {
    head: {
        none: { id: "none", name: "Ohne" },
        sombrero: {
            id: "sombrero",
            name: "Sombrero",
            svg: SVG.sombrero,
            defaultColor: "#f59e0b",
            top: "-0.9em",
            width: "7em",
        },
        tophat: {
            id: "tophat",
            name: "Zylinder",
            svg: SVG.tophat,
            defaultColor: "#a78bfa",
            top: "-1.5em",
            width: "4.5em",
        },
        crown: {
            id: "crown",
            name: "Krone",
            svg: SVG.crown,
            defaultColor: "#69f0ae",
            top: "-1.2em",
            width: "5em",
        },
        flower: {
            id: "flower",
            name: "Blume",
            svg: SVG.flower,
            defaultColor: "#ff5ec8",
            top: "-1.1em",
            width: "2.8em",
        },
        beanie: {
            id: "beanie",
            name: "Mütze",
            svg: SVG.beanie,
            defaultColor: "#00f0ff",
            top: "-1.3em",
            width: "5em",
        },
        cowboy: {
            id: "cowboy",
            name: "Cowboyhut",
            svg: SVG.cowboy,
            defaultColor: "#92400e",
            top: "-0.7em",
            width: "6.5em",
        },
        halo: {
            id: "halo",
            name: "Heiligenschein",
            svg: SVG.halo,
            defaultColor: "#fde047",
            top: "-0.7em",
            width: "5.5em",
        },
        horns: {
            id: "horns",
            name: "Hörner",
            svg: SVG.horns,
            defaultColor: "#ef4444",
            top: "-1.4em",
            width: "4.5em",
        },
        antenna: {
            id: "antenna",
            name: "Antennen",
            svg: SVG.antenna,
            defaultColor: "#00f0ff",
            top: "-1.6em",
            width: "3em",
        },
    },
    eyes: {
        none: { id: "none", name: "Ohne" },
        sunglasses: {
            id: "sunglasses",
            name: "Sonnenbrille",
            svg: SVG.sunglasses,
            defaultColor: "#00f0ff",
            top: "3.3em",
            width: "4.2em",
        },
        monocle: {
            id: "monocle",
            name: "Monokel",
            svg: SVG.monocle,
            defaultColor: "#ffe066",
            top: "3.1em",
            width: "2.4em",
        },
        starEyes: {
            id: "starEyes",
            name: "Stern-Augen",
            svg: SVG.starEyes,
            defaultColor: "#ffd166",
            top: "3.5em",
            width: "4em",
        },
        nerd: {
            id: "nerd",
            name: "Nerd-Brille",
            svg: SVG.nerd,
            defaultColor: "#a78bfa",
            top: "3.2em",
            width: "4.2em",
        },
        eyepatch: {
            id: "eyepatch",
            name: "Augenklappe",
            svg: SVG.eyepatch,
            defaultColor: "#1a1a1a",
            top: "3.3em",
            width: "4em",
        },
        laser: {
            id: "laser",
            name: "Laser-Augen",
            svg: SVG.laser,
            defaultColor: "#ff0066",
            top: "3.4em",
            width: "4.2em",
        },
    },
    accessory: {
        none: { id: "none", name: "Ohne" },
        scarf: {
            id: "scarf",
            name: "Schal",
            svg: SVG.scarf,
            defaultColor: "#ef4444",
            top: "6.4em",
            width: "5.5em",
        },
        bowtie: {
            id: "bowtie",
            name: "Fliege",
            svg: SVG.bowtie,
            defaultColor: "#a78bfa",
            top: "6.0em",
            width: "3.5em",
        },
        necklace: {
            id: "necklace",
            name: "Halskette",
            svg: SVG.necklace,
            defaultColor: "#ffd166",
            top: "5.6em",
            width: "4.5em",
        },
        tie: {
            id: "tie",
            name: "Krawatte",
            svg: SVG.tie,
            defaultColor: "#3b82f6",
            top: "5.8em",
            width: "2.2em",
        },
        medal: {
            id: "medal",
            name: "Medaille",
            svg: SVG.medal,
            defaultColor: "#ffd166",
            top: "5.6em",
            width: "3em",
        },
        chain: {
            id: "chain",
            name: "Kette",
            svg: SVG.chain,
            defaultColor: "#facc15",
            top: "6.2em",
            width: "5em",
        },
        collar: {
            id: "collar",
            name: "Spike-Halsband",
            svg: SVG.collar,
            defaultColor: "#ef4444",
            top: "6.4em",
            width: "5em",
        },
    },
};

export const SLOT_LABELS = {
    head: "Kopfbedeckung",
    eyes: "Brille",
    accessory: "Accessoire",
};

// Defaults wenn User noch nichts gespeichert hat
export function emptyCosmetics() {
    return SKIN_SLOTS.reduce((obj, slot) => {
        obj[slot] = { id: "none", color: null };
        return obj;
    }, {});
}

// Normalize: filtert unbekannte slots/ids raus, fügt defaults dazu
export function normalizeCosmetics(raw) {
    const out = emptyCosmetics();
    if (!raw || typeof raw !== "object") return out;
    for (const slot of SKIN_SLOTS) {
        const entry = raw[slot];
        if (!entry || typeof entry !== "object") continue;
        const id = String(entry.id || "none");
        if (!SKIN_ITEMS[slot][id]) continue;
        const color = typeof entry.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(entry.color)
            ? entry.color
            : null;
        out[slot] = { id, color };
    }
    return out;
}

// Render-Helper: gibt Array von Overlay-Definitionen zurück
// die als <div class="cactus-cosmetic" style="..."> mit innerHTML = svg
// über den cactus-button gelegt werden können.
// Schema: { slot, svg, top, width, color }
export function buildCosmeticOverlays(cosmetics) {
    const overlays = [];
    for (const slot of SKIN_SLOTS) {
        const entry = cosmetics?.[slot];
        if (!entry || entry.id === "none") continue;
        const item = SKIN_ITEMS[slot][entry.id];
        if (!item || !item.svg) continue;
        const color = entry.color || item.defaultColor || "#69f0ae";
        overlays.push({
            slot,
            svg: item.svg,
            top: item.top,
            width: item.width || "6em",
            color,
        });
    }
    return overlays;
}
