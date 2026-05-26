// Skin-System für KaktusClicker (VIP-only).
//
// 3 Slot-Kategorien: head (über dem Kaktus), eyes (auf Augenhöhe), accessory
// (unten am Bauch). Jedes Item ist ein einfacher ASCII/Unicode-String der
// per CSS absolute-positioned über dem Cactus-Pre als Overlay angezeigt wird.
//
// position.top: relativ zum cactus-button (em-Einheit), negativ = oberhalb
// position.fontSize: ascii-line-height relativ
// defaultColor: Hex, wird vom User via Color-Picker überschrieben

export const SKIN_SLOTS = ["head", "eyes", "accessory"];

export const SKIN_ITEMS = {
    head: {
        none: { id: "none", name: "Ohne" },
        sombrero: {
            id: "sombrero",
            name: "Sombrero",
            ascii: "  ╭─────╮  \n──┴─────┴──",
            defaultColor: "#d97706",
            top: "-1.6em",
        },
        tophat: {
            id: "tophat",
            name: "Zylinder",
            ascii: "   ┌───┐   \n   │   │   \n ──┴───┴── ",
            defaultColor: "#1a1a1a",
            top: "-2.6em",
        },
        crown: {
            id: "crown",
            name: "Krone",
            ascii: " ╱╲╱╲╱╲ \n│  ◆  │\n └─────┘",
            defaultColor: "#fbbf24",
            top: "-2.6em",
        },
        flower: {
            id: "flower",
            name: "Blume",
            ascii: "   ✿   \n   │   ",
            defaultColor: "#ec4899",
            top: "-1.6em",
        },
        beanie: {
            id: "beanie",
            name: "Mütze",
            ascii: "   ●   \n ╭───╮ \n └───┘ ",
            defaultColor: "#3b82f6",
            top: "-2.6em",
        },
    },
    eyes: {
        none: { id: "none", name: "Ohne" },
        sunglasses: {
            id: "sunglasses",
            name: "Sonnenbrille",
            ascii: "╭══╤══╮",
            defaultColor: "#000000",
            top: "3.4em",
        },
        monocle: {
            id: "monocle",
            name: "Monokel",
            ascii: " ◯ \n │ ",
            defaultColor: "#84cc16",
            top: "3.2em",
        },
        starEyes: {
            id: "starEyes",
            name: "Stern-Augen",
            ascii: "✦ ✦",
            defaultColor: "#fbbf24",
            top: "3.6em",
        },
    },
    accessory: {
        none: { id: "none", name: "Ohne" },
        mustache: {
            id: "mustache",
            name: "Schnurrbart",
            ascii: "╰╮╰╯╭╯",
            defaultColor: "#451a03",
            top: "4.4em",
        },
        scarf: {
            id: "scarf",
            name: "Schal",
            ascii: "～～～～～",
            defaultColor: "#dc2626",
            top: "6em",
        },
        bowtie: {
            id: "bowtie",
            name: "Fliege",
            ascii: "◣◆◢",
            defaultColor: "#7c3aed",
            top: "5em",
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
// die als <pre class="cactus-cosmetic" style="...">...</pre> über den
// cactus-button gelegt werden können.
export function buildCosmeticOverlays(cosmetics) {
    const overlays = [];
    for (const slot of SKIN_SLOTS) {
        const entry = cosmetics?.[slot];
        if (!entry || entry.id === "none") continue;
        const item = SKIN_ITEMS[slot][entry.id];
        if (!item || !item.ascii) continue;
        const color = entry.color || item.defaultColor || "#ffffff";
        overlays.push({
            slot,
            ascii: item.ascii,
            top: item.top,
            color,
        });
    }
    return overlays;
}
