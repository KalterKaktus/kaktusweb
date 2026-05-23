// fishArtSystem — datengetriebenes Fisch-SVG-System.
//
// Öffentliche API ist EXAKT identisch geblieben:
//   - renderFishArt(fish, options)
//   - exportierte SHAPES nur intern verwendet
//
// Neues Anchor-System:
//   Jede SHAPE definiert ihre eigenen Befestigungspunkte (eye, gill, dorsal,
//   belly, forehead, mouth). featureMarkup() baut Features relativ zu diesen
//   Punkten auf — kein Schweben mehr, egal wie extrem die Körperform ist.
//
// Art Direction:
//   - Wissenschaftliche-Illustration-Look meets game art
//   - Konsistente Linienstärke: 7 Body, 6 Flossen, 3-4 Details
//   - Lateral Line (echte Fisch-Anatomie) statt Cartoon-Glanz
//   - Flossenstrahlen als dünne Linien INNERHALB der Flossen
//   - Schlankes Auge mit einzelnem Catchlight
//   - Cozy-Set (organisch): dart, wedge, deep, block, kite, orb, angler, ribbon
//   - Predator-Set (kantig): needle, blade, sail, crown, monarch
//
// Rarity-Spreizung:
//   - Common/Uncommon: plain
//   - Rare: ausgeprägteres Pattern
//   - Epic: Innenglow + 3 helle Akzente am Fisch
//   - Legendary: Tiefsee-Aura, leuchtendes Auge, 5 biolumineszente Akzente
//
// viewBox bleibt 0 0 240 160. Kopf links, Schwanz rechts.

const SHAPES = {
    // ─────────────────────────────────────────────────────────
    //   COZY-SET — organisch, weiche Béziers
    // ─────────────────────────────────────────────────────────

    dart: {
        body: "M30 80 C 26 60, 60 46, 110 44 C 158 46, 188 58, 196 80 C 188 102, 158 116, 110 116 C 60 114, 26 100, 30 80 Z",
        top: "M96 56 Q 124 28, 152 58 Q 124 52, 96 56 Z",
        bottom: "M104 104 Q 128 130, 152 104 Q 128 104, 104 104 Z",
        tail: "M190 80 C 202 68, 218 56, 224 52 L 218 80 L 224 108 C 218 104, 202 92, 190 80 Z",
        a: {
            eye: [62, 74], mouth: [30, 84], gill: [82, 82],
            forehead: [78, 56], back: [124, 48], belly: [124, 110],
        },
    },

    wedge: {
        body: "M22 82 C 22 56, 60 38, 108 38 C 156 40, 184 56, 192 82 C 184 108, 156 122, 108 122 C 60 120, 22 108, 22 82 Z",
        top: "M88 56 Q 122 22, 156 58 Q 124 50, 88 56 Z",
        bottom: "M96 108 Q 128 142, 160 108 Q 128 108, 96 108 Z",
        tail: "M186 82 C 198 68, 214 56, 222 52 L 218 82 L 222 110 C 214 106, 198 96, 186 82 Z",
        a: {
            eye: [60, 76], mouth: [24, 86], gill: [78, 84],
            forehead: [72, 56], back: [120, 48], belly: [124, 114],
        },
    },

    deep: {
        body: "M40 80 C 36 38, 80 14, 128 12 C 174 14, 198 38, 204 80 C 198 122, 174 148, 128 150 C 80 148, 36 122, 40 80 Z",
        top: "M96 32 Q 128 -10, 162 38 Q 128 18, 96 32 Z",
        bottom: "M96 124 Q 128 168, 162 120 Q 128 134, 96 124 Z",
        tail: "M196 80 C 208 60, 222 46, 226 42 L 220 80 L 226 120 C 222 116, 208 102, 196 80 Z",
        a: {
            eye: [70, 62], mouth: [40, 78], gill: [86, 76],
            forehead: [108, 32], back: [128, 16], belly: [128, 144],
        },
    },

    block: {
        body: "M28 80 C 24 50, 56 34, 104 34 C 152 36, 184 52, 194 80 C 184 108, 152 126, 104 126 C 56 124, 24 110, 28 80 Z",
        top: "M86 50 Q 122 12, 158 52 Q 124 46, 86 50 Z",
        bottom: "M92 112 Q 124 146, 162 110 Q 124 110, 92 112 Z",
        tail: "M188 80 C 198 64, 214 52, 222 48 L 216 80 L 222 112 C 214 108, 198 96, 188 80 Z",
        a: {
            eye: [60, 70], mouth: [26, 80], gill: [78, 78],
            forehead: [70, 50], back: [122, 38], belly: [124, 122],
        },
    },

    kite: {
        body: "M16 80 Q 32 54, 92 38 C 142 36, 184 50, 196 80 C 184 110, 142 124, 92 122 Q 32 106, 16 80 Z",
        top: "M86 50 Q 124 12, 160 54 Q 126 46, 86 50 Z",
        bottom: "M92 112 Q 126 150, 162 110 Q 128 110, 92 112 Z",
        tail: "M188 80 C 200 60, 218 48, 224 44 L 216 80 L 224 116 C 218 112, 200 102, 188 80 Z",
        a: {
            eye: [62, 74], mouth: [22, 86], gill: [82, 80],
            forehead: [76, 54], back: [120, 42], belly: [126, 118],
        },
    },

    orb: {
        body: "M48 82 C 44 46, 72 22, 100 22 C 130 22, 158 46, 158 82 C 158 118, 130 142, 100 142 C 72 142, 44 118, 48 82 Z",
        top: "M76 32 Q 100 4, 124 32 Q 100 26, 76 32 Z",
        bottom: "M76 134 Q 100 162, 124 134 Q 100 130, 76 134 Z",
        tail: "M154 82 C 166 72, 184 64, 194 60 L 188 82 L 194 104 C 184 100, 166 92, 154 82 Z",
        a: {
            eye: [76, 70], mouth: [48, 84], gill: [88, 84],
            forehead: [96, 24], back: [100, 22], belly: [100, 142],
        },
    },

    angler: {
        body: "M4 90 C 0 50, 28 22, 80 22 C 126 26, 158 48, 184 80 C 158 102, 126 122, 80 130 C 28 130, 0 116, 4 90 Z",
        top: "M76 32 Q 116 -6, 144 36 Q 118 26, 76 32 Z",
        bottom: "M86 124 Q 118 158, 142 120 Q 118 122, 86 124 Z",
        tail: "M180 82 C 192 70, 212 60, 220 56 L 214 82 L 220 102 C 212 98, 192 92, 180 82 Z",
        a: {
            eye: [56, 70], mouth: [6, 96], gill: [88, 86],
            forehead: [66, 36], back: [110, 30], belly: [120, 122],
        },
    },

    ribbon: {
        body: "M4 86 C 30 78, 62 70, 110 68 Q 150 66, 178 72 C 200 76, 220 80, 232 86 Q 220 92, 178 96 Q 150 100, 110 100 C 62 98, 30 94, 4 86 Z",
        top: "M88 66 Q 116 36, 142 68 Q 116 60, 88 66 Z",
        bottom: "M96 100 Q 118 124, 142 100 Q 118 100, 96 100 Z",
        tail: "M212 86 C 222 80, 230 76, 234 72 L 230 86 L 234 100 C 230 96, 222 92, 212 86 Z",
        a: {
            eye: [40, 84], mouth: [4, 88], gill: [60, 86],
            forehead: [70, 70], back: [110, 68], belly: [118, 100],
        },
    },

    // ─────────────────────────────────────────────────────────
    //   PREDATOR-SET — angular, scharfe Flossen
    // ─────────────────────────────────────────────────────────

    needle: {
        body: "M8 84 Q 22 70, 62 64 C 114 60, 168 60, 208 66 Q 226 70, 230 84 Q 226 96, 208 100 C 168 104, 114 104, 62 100 Q 22 96, 8 84 Z",
        top: "M104 64 L 126 36 L 148 66 Z",
        bottom: "M104 100 L 126 124 L 148 100 Z",
        tail: "M212 84 L 232 60 L 226 84 L 232 108 Z",
        a: {
            eye: [38, 82], mouth: [8, 86], gill: [58, 84],
            forehead: [78, 68], back: [126, 36], belly: [126, 124],
        },
    },

    blade: {
        body: "M12 84 Q 24 56, 90 38 C 152 34, 188 54, 200 84 C 188 114, 152 130, 90 128 Q 24 110, 12 84 Z",
        top: "M80 56 L 124 6 L 168 60 Z",
        bottom: "M90 110 L 124 154 L 174 102 Z",
        tail: "M192 84 L 232 32 L 222 84 L 232 134 Z",
        a: {
            eye: [62, 76], mouth: [22, 88], gill: [82, 82],
            forehead: [80, 56], back: [124, 6], belly: [124, 154],
        },
    },

    sail: {
        body: "M4 80 Q 16 78, 50 56 C 84 44, 116 42, 148 46 C 178 52, 198 66, 204 82 C 198 100, 178 114, 148 120 C 116 122, 84 120, 50 106 Q 16 84, 4 80 Z",
        top: "M58 60 L 120 -16 L 184 62 Z",
        bottom: "M94 108 Q 130 152, 168 104 Q 130 108, 94 108 Z",
        tail: "M184 82 L 232 24 L 222 82 L 232 138 Z",
        a: {
            eye: [50, 70], mouth: [4, 82], gill: [76, 78],
            forehead: [78, 50], back: [120, -16], belly: [128, 122],
        },
    },

    crown: {
        body: "M22 82 C 22 54, 60 30, 110 28 C 162 30, 194 54, 196 82 C 194 110, 162 132, 110 132 C 60 132, 22 110, 22 82 Z",
        top: "M70 60 L 86 22 L 104 52 L 124 12 L 144 52 L 162 22 L 178 62 Z",
        bottom: "M94 112 Q 130 150, 170 104 Q 130 110, 94 112 Z",
        tail: "M188 82 L 226 42 L 218 82 L 226 122 Z",
        a: {
            eye: [62, 72], mouth: [22, 86], gill: [82, 84],
            forehead: [86, 36], back: [124, 12], belly: [128, 124],
        },
    },

    monarch: {
        body: "M10 84 C 12 48, 58 22, 118 20 C 178 22, 206 50, 208 84 C 206 116, 178 142, 118 144 C 58 144, 12 118, 10 84 Z",
        top: "M58 66 L 80 14 L 104 52 L 126 4 L 152 52 L 176 18 L 196 64 Q 130 56, 58 66 Z",
        bottom: "M82 110 Q 130 174, 186 104 Q 130 116, 82 110 Z",
        tail: "M190 84 L 232 22 L 224 84 L 232 144 Z",
        a: {
            eye: [62, 70], mouth: [12, 84], gill: [86, 82],
            forehead: [104, 32], back: [126, 4], belly: [130, 138],
        },
    },

    // ───────────────────────────────────────
    //   EXOTIC-SET — untapped silhouettes
    // ───────────────────────────────────────

    /** Hai — länglich, spitze Schnauze, heterocercaler Schwanz (oberer Lobus größer). */
    shark: {
        body: "M4 86 Q 14 76, 50 68 C 110 62, 170 68, 196 86 C 170 102, 110 106, 50 100 Q 14 96, 4 86 Z",
        top: "M102 70 L 124 26 L 150 72 Z",
        bottom: "M76 100 L 84 126 L 102 102 Z",
        tail: "M196 86 C 212 56, 230 24, 234 20 L 222 86 L 234 116 C 230 110, 212 96, 196 86 Z",
        a: {
            eye: [38, 80], mouth: [4, 88], gill: [62, 84],
            forehead: [72, 70], back: [124, 26], belly: [84, 126],
        },
    },

    /** Rochen — flache Top-Down-Scheibe mit Peitschen-Schwanz. */
    ray: {
        body: "M14 80 Q 60 30, 120 30 Q 180 30, 226 80 Q 180 130, 120 130 Q 60 130, 14 80 Z",
        top: "M108 38 L 120 22 L 132 38 Z",
        bottom: "M108 122 L 120 138 L 132 122 Z",
        tail: "M214 76 L 236 74 L 232 80 L 236 86 L 214 84 Z",
        a: {
            eye: [108, 70], mouth: [120, 80], gill: [98, 88],
            forehead: [120, 34], back: [120, 22], belly: [120, 138],
        },
    },

    /** Seepferdchen — vertikale S-Kurve, gerollter Schwanz. */
    vertical: {
        body: "M84 24 C 112 18, 124 46, 116 64 Q 104 78, 120 90 Q 138 100, 134 122 Q 124 138, 106 132 Q 92 122, 104 110 Q 118 100, 102 88 Q 82 80, 88 60 Q 80 44, 70 36 Q 72 26, 84 24 Z",
        top: "M106 48 Q 132 30, 138 52 Q 122 54, 106 48 Z",
        bottom: "M88 72 Q 64 86, 64 100 Q 78 92, 96 84 Z",
        tail: "M132 128 Q 152 128, 152 144 Q 134 146, 132 128 Z",
        a: {
            eye: [96, 38], mouth: [70, 32], gill: [110, 54],
            forehead: [108, 22], back: [124, 48], belly: [100, 112],
        },
    },

    /** Crustacean — segmentierter Körper, Antennen, Fächer-Schwanz. */
    segmented: {
        body: "M16 78 Q 22 70, 36 70 Q 42 64, 58 64 Q 64 68, 80 66 Q 86 64, 102 66 Q 108 68, 124 66 Q 132 64, 148 68 Q 156 66, 172 70 Q 188 72, 200 80 Q 208 86, 200 92 Q 188 100, 172 96 Q 156 100, 148 98 Q 132 100, 124 98 Q 108 100, 102 98 Q 86 100, 80 98 Q 64 100, 58 100 Q 42 102, 36 96 Q 22 96, 16 88 Q 10 84, 16 78 Z",
        top: "M40 68 Q 20 32, 14 26 Q 26 30, 44 64 Z M54 66 Q 38 36, 30 32 Q 40 38, 58 62 Z",
        bottom: "M44 100 L 36 128 L 56 124 Z M76 100 L 70 130 L 88 124 Z M120 100 L 116 130 L 134 124 Z",
        tail: "M200 84 L 226 60 L 220 84 L 226 108 L 220 86 L 226 100 Z",
        a: {
            eye: [40, 76], mouth: [10, 84], gill: [60, 84],
            forehead: [44, 64], back: [100, 50], belly: [80, 130],
        },
    },

    /** Qualle — Glocke mit gewelltem Rand und hängenden Tentakeln. */
    jellyfish: {
        body: "M40 90 Q 26 56, 50 32 Q 80 12, 120 14 Q 158 18, 178 40 Q 192 64, 178 90 Q 168 84, 158 92 Q 148 84, 138 92 Q 128 84, 118 92 Q 108 84, 98 92 Q 88 84, 78 92 Q 68 84, 58 92 Q 50 84, 40 90 Z",
        top: "M100 14 Q 108 2, 116 14 Z M76 24 Q 84 10, 92 22 Z M134 22 Q 142 8, 150 22 Z",
        bottom: "M62 90 Q 54 110, 62 130 Q 70 144, 62 154 L 70 154 Q 78 144, 70 130 Q 78 110, 70 90 Z M98 92 Q 90 110, 98 130 Q 106 144, 98 154 L 106 154 Q 114 144, 106 130 Q 114 110, 106 92 Z M138 92 Q 130 110, 138 130 Q 146 144, 138 154 L 146 154 Q 154 144, 146 130 Q 154 110, 146 92 Z",
        tail: "M170 90 Q 184 122, 200 142 Q 210 154, 202 158 L 210 158 Q 220 142, 206 120 Q 198 100, 178 88 Z",
        a: {
            eye: [82, 50], mouth: [110, 80], gill: [70, 64],
            forehead: [108, 14], back: [112, 2], belly: [110, 96],
        },
    },

    // ───────────────────────────────────────
    //   MONSTER-SET — Secret-Fische / Boss-Drops
    //   Füllen mehr von der Canvas → wirken massiver in derselben UI-Karte
    // ───────────────────────────────────────

    /** Kraken — zentraler Körper, radial verteilte Tentakel. */
    kraken: {
        body: "M28 80 C 22 28, 80 12, 120 14 C 168 16, 216 32, 218 80 C 216 128, 168 146, 120 148 C 80 146, 22 132, 28 80 Z",
        top: "M52 32 Q 36 4, 24 4 Q 28 18, 56 38 Z M120 14 Q 112 2, 132 2 Q 138 8, 128 18 Z M188 32 Q 204 4, 220 6 Q 214 18, 184 38 Z",
        bottom: "M50 130 Q 32 158, 22 156 Q 22 138, 46 128 Z M118 146 Q 108 158, 130 156 Q 142 152, 124 146 Z M188 130 Q 210 158, 224 156 Q 212 138, 192 128 Z",
        tail: "M218 80 Q 236 60, 236 52 L 232 80 L 236 108 Q 236 100, 218 80 Z",
        a: {
            eye: [108, 68], mouth: [120, 96], gill: [82, 78],
            forehead: [120, 14], back: [120, 2], belly: [120, 148],
        },
    },

    /** Leviathan — Riesen-Seeschlange mit Stachelmane. */
    leviathan: {
        body: "M6 64 C 36 24, 80 30, 110 60 C 134 92, 172 102, 206 78 C 222 64, 234 70, 232 92 C 220 124, 184 134, 148 124 C 110 116, 86 92, 64 110 C 40 132, 14 130, 6 110 C -2 92, 0 76, 6 64 Z",
        top: "M30 56 L 38 30 L 46 56 L 54 30 L 62 56 L 70 30 L 78 56 Z M100 54 L 108 28 L 118 56 L 126 26 L 134 56 Z",
        bottom: "M40 124 Q 60 144, 70 122 Z M120 122 Q 140 142, 150 118 Z",
        tail: "M232 92 L 240 70 L 234 92 L 240 116 Z",
        a: {
            eye: [44, 60], mouth: [4, 70], gill: [62, 70],
            forehead: [40, 50], back: [56, 26], belly: [60, 144],
        },
    },

    /** Wyrm — Drachenfisch mit dreifacher Krone. */
    wyrm: {
        body: "M4 80 Q 18 50, 60 32 C 110 22, 170 30, 210 60 C 224 70, 232 80, 224 92 C 210 112, 170 126, 110 126 C 60 124, 18 110, 4 80 Z",
        top: "M64 38 L 80 2 L 94 38 L 104 4 L 116 38 L 126 2 L 136 38 Z",
        bottom: "M50 116 L 60 152 L 72 116 L 84 152 L 96 116 L 108 152 L 120 116 Z",
        tail: "M224 92 L 240 50 L 234 70 L 238 100 L 234 92 L 240 130 Z",
        a: {
            eye: [50, 64], mouth: [6, 78], gill: [72, 76],
            forehead: [70, 38], back: [104, 4], belly: [84, 152],
        },
    },

    /** Abyssal — amorpher Tiefseehorror, viele kleine Stacheln und Tentakel. */
    abyssal: {
        body: "M14 90 Q 2 50, 30 18 Q 70 4, 120 8 Q 170 10, 206 32 Q 234 58, 226 100 Q 210 134, 170 144 Q 110 152, 70 142 Q 28 130, 14 90 Z",
        top: "M40 28 L 50 6 L 60 28 Z M82 14 L 90 2 L 98 14 Z M124 8 L 132 4 L 140 8 Z M168 14 L 178 2 L 188 14 Z",
        bottom: "M60 142 Q 50 158, 64 158 Z M100 150 Q 90 158, 104 158 Z M140 150 Q 132 158, 144 158 Z M180 142 Q 192 158, 174 158 Z",
        tail: "M226 100 Q 240 90, 238 80 L 232 100 L 238 124 Q 240 110, 226 100 Z",
        a: {
            eye: [60, 60], mouth: [12, 90], gill: [80, 80],
            forehead: [100, 14], back: [124, 4], belly: [100, 158],
        },
    },
};

let renderSeq = 0;

function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function shade(hex, amount) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amount >= 0) {
        r += (255 - r) * amount; g += (255 - g) * amount; b += (255 - b) * amount;
    } else {
        r *= 1 + amount; g *= 1 + amount; b *= 1 + amount;
    }
    return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Baut Features relativ zu Anchor-Punkten der Shape.
 * Niemals freischwebend.
 */
function featureMarkup(feature, fill, outline, silhouette, a) {
    const sw7 = `fill="${fill}" stroke="${outline}" stroke-width="7" stroke-linejoin="round"`;
    const sw6 = `fill="${fill}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"`;
    const line5 = `fill="none" stroke="${outline}" stroke-width="5" stroke-linecap="round"`;
    const line4 = `fill="none" stroke="${outline}" stroke-width="4" stroke-linecap="round"`;
    const line3 = `fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"`;

    // Hilfs-Anchors
    const [fx, fy] = a.forehead;
    const [bx, by] = a.back;
    const [yx, yy] = a.belly;
    const [gx, gy] = a.gill;
    const [mx, my] = a.mouth;

    switch (feature) {
    case "long-fin": {
        // Streamer-Flosse direkt unter dem Bauch
        const cx = yx;
        const cy = yy + 10;
        return `<path d="M${cx - 22} ${cy} Q ${cx} ${cy + 24}, ${cx + 30} ${cy + 4} Q ${cx + 10} ${cy + 20}, ${cx - 22} ${cy}" ${sw6}/>`;
    }
    case "leaf-fin": {
        // Blatt-Brustflosse
        const cx = gx + 4, cy = gy + 18;
        return `<path d="M${cx - 14} ${cy} Q ${cx + 10} ${cy - 18}, ${cx + 36} ${cy - 6} Q ${cx + 20} ${cy + 18}, ${cx - 10} ${cy + 12} Q ${cx - 16} ${cy + 4}, ${cx - 14} ${cy} Z" ${sw6}/>`;
    }
    case "bubble-fin": {
        // Rundliche Brustflosse mit Punkt-Details
        const cx = gx + 6, cy = gy + 16;
        const dots = silhouette ? "" : `<circle cx="${cx + 6}" cy="${cy + 2}" r="2.4" fill="${outline}" opacity="0.55"/><circle cx="${cx + 16}" cy="${cy - 2}" r="1.8" fill="${outline}" opacity="0.55"/>`;
        return `<path d="M${cx - 8} ${cy} Q ${cx + 12} ${cy - 16}, ${cx + 30} ${cy - 4} Q ${cx + 22} ${cy + 16}, ${cx - 4} ${cy + 12} Q ${cx - 12} ${cy + 4}, ${cx - 8} ${cy} Z" ${sw6}/>${dots}`;
    }
    case "crest": {
        // Stirn-Kamm — kräftige Sichel, sitzt direkt auf dem Forehead
        const peak = fy - 38;
        return `<path d="M${fx - 20} ${fy + 4} Q ${fx - 4} ${peak}, ${fx + 18} ${fy + 4} Q ${fx + 4} ${fy - 8}, ${fx - 20} ${fy + 4} Z" ${sw6}/>`;
    }
    case "fork-tail":
        // Gabel-Schwanz — ersetzt den Standard-Tail visuell durch eine schärfere Form
        return `<path d="M193 80 C 208 50, 224 32, 224 28 L 216 80 L 224 132 C 224 128, 208 110, 193 80 Z" ${sw6}/>`;
    case "gills": {
        // Zwei Kiemen-Bögen am Gill-Anchor
        return `<path d="M${gx - 4} ${gy - 14} Q ${gx + 6} ${gy}, ${gx - 4} ${gy + 14}" ${line4}/><path d="M${gx + 8} ${gy - 16} Q ${gx + 18} ${gy}, ${gx + 8} ${gy + 16}" ${line4}/>`;
    }
    case "horn": {
        // Scharfes Horn vorne oben am Forehead — lang und klar erkennbar
        const tipX = fx - 18, tipY = fy - 44;
        return `<path d="M${fx - 8} ${fy + 4} L ${tipX} ${tipY} L ${fx + 18} ${fy + 4} Z" ${sw6}/>`;
    }
    case "horn-gills": {
        // Horn + Kiemen kombiniert
        const tipX = fx - 18, tipY = fy - 44;
        return `<path d="M${fx - 8} ${fy + 4} L ${tipX} ${tipY} L ${fx + 18} ${fy + 4} Z" ${sw6}/><path d="M${gx - 2} ${gy - 14} Q ${gx + 8} ${gy}, ${gx - 2} ${gy + 14}" ${line4}/>`;
    }
    case "spikes": {
        // Zwei spitze Stacheln über dem Rücken — zwischen Forehead und Back
        const midX = (fx + bx) / 2;
        const midY = (fy + by) / 2;
        const s1x = midX - 14;
        const s1y = midY + 4;
        const s2x = midX + 18;
        const s2y = midY;
        return `<path d="M${s1x - 10} ${s1y} L ${s1x} ${s1y - 34} L ${s1x + 10} ${s1y} Z" ${sw6}/><path d="M${s2x - 10} ${s2y} L ${s2x} ${s2y - 40} L ${s2x + 10} ${s2y} Z" ${sw6}/>`;
    }
    case "sail": {
        // Riesige Segel-Flosse über dem Rücken
        const cx = bx;
        // Basis-Y konservativ: nimm den höheren Wert (kleiner y = weiter oben) zwischen forehead.y und back.y
        // damit das Segel immer auf der Body-Linie aufsitzt und nicht schwebt.
        const baseY = Math.max(fy, by) + 4;
        const peakY = Math.min(baseY - 60, baseY - 50);
        return `<path d="M${cx - 40} ${baseY} L ${cx - 4} ${peakY} L ${cx + 40} ${baseY + 2} Z" ${sw6}/>`;
    }
    case "extra-eyes": {
        // Zwei zusätzliche Augen — eines über, eines unter dem Hauptauge
        const [ex, ey] = a.eye;
        return `<circle cx="${ex + 18}" cy="${ey - 14}" r="6" fill="${outline}"/><circle cx="${ex + 18}" cy="${ey + 16}" r="6" fill="${outline}"/>`;
    }
    case "lure": {
        // Anglerfisch-Lure — Stiel vom Forehead aus, leuchtende Birne über dem Kopf
        const bulb = silhouette ? fill : "#ffe9a6";
        const spark = silhouette ? fill : "#fffdf0";
        const halo = silhouette ? "" : `<circle cx="${fx - 30}" cy="${fy - 36}" r="18" fill="#ffe9a6" opacity="0.32"/>`;
        return `<path d="M${fx + 2} ${fy - 2} Q ${fx - 12} ${fy - 24}, ${fx - 30} ${fy - 30}" fill="none" stroke="${outline}" stroke-width="6" stroke-linecap="round"/>${halo}<circle cx="${fx - 30}" cy="${fy - 36}" r="11" fill="${bulb}" stroke="${outline}" stroke-width="5"/><circle cx="${fx - 34}" cy="${fy - 40}" r="3.5" fill="${spark}"/>`;
    }
    case "puffer-spikes": {
        // Symmetrische Stacheln rund um Body-Center
        const cx = 100, cy = 80;
        const spikes = [];
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const ix = cx + Math.cos(ang) * 56;
            const iy = cy + Math.sin(ang) * 60;
            const ox = cx + Math.cos(ang) * 78;
            const oy = cy + Math.sin(ang) * 84;
            const sideAng = ang + Math.PI / 2;
            const sx = Math.cos(sideAng) * 7;
            const sy = Math.sin(sideAng) * 7;
            spikes.push(`M${ix - sx} ${iy - sy} L ${ox} ${oy} L ${ix + sx} ${iy + sy} Z`);
        }
        return `<path d="${spikes.join(" ")}" ${sw6}/>`;
    }
    case "teeth": {
        // Zackige Zähne am Maul-Anchor
        const fillTeeth = silhouette ? fill : "#f3f7ff";
        const seg = [];
        const start = mx + 4;
        for (let i = 0; i < 7; i++) {
            const x0 = start + i * 7;
            seg.push(`L ${x0 + 3} ${my + 14}`);
            seg.push(`L ${x0 + 7} ${my}`);
        }
        return `<path d="M${start} ${my} ${seg.join(" ")} Z" fill="${fillTeeth}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    case "barbel": {
        // Barteln, hängen vom Maul herunter
        return `<path d="M${mx + 14} ${my + 12} Q ${mx + 2} ${my + 28}, ${mx - 14} ${my + 40}" ${line4}/><path d="M${mx + 22} ${my + 18} Q ${mx + 8} ${my + 36}, ${mx - 6} ${my + 52}" ${line4}/>`;
    }
    case "stripes": {
        // Vertikale dunkle Bänder über dem Körper (Clownfish-Look)
        return `<g fill="${outline}" opacity="0.42">
            <path d="M76 50 Q 72 80, 76 110 L 88 110 Q 84 80, 88 50 Z"/>
            <path d="M104 46 Q 100 80, 104 114 L 118 114 Q 114 80, 118 46 Z"/>
            <path d="M132 50 Q 128 80, 132 110 L 146 110 Q 142 80, 146 50 Z"/>
        </g>`;
    }
    case "wings": {
        // Große flügelartige Brustflossen, oben und unten
        return `<path d="M${gx - 2} ${gy - 4} Q ${gx - 24} ${gy - 28}, ${gx - 36} ${gy - 16} Q ${gx - 18} ${gy - 4}, ${gx - 2} ${gy - 4} Z" ${sw6}/><path d="M${gx + 2} ${gy + 4} Q ${gx + 22} ${gy + 32}, ${gx + 36} ${gy + 24} Q ${gx + 20} ${gy + 10}, ${gx + 2} ${gy + 4} Z" ${sw6}/>`;
    }
    case "streamers": {
        // Extreme Schwanz-/Flossenstreamer, sehr lang
        return `<path d="M198 78 Q 230 60, 234 50 Q 238 70, 218 88 Q 208 86, 198 84 Z" ${sw6}/><path d="M198 84 Q 232 100, 232 116 Q 228 128, 212 116 Q 204 96, 198 90 Z" ${sw6}/>`;
    }
    case "whiskers": {
        // Mehrere dünne Linien vom Maul — Welskatzen-Style
        return `<g fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round" opacity="0.85">
            <path d="M${mx + 18} ${my + 4} Q ${mx + 4} ${my + 18}, ${mx - 8} ${my + 22}"/>
            <path d="M${mx + 22} ${my + 12} Q ${mx + 10} ${my + 28}, ${mx - 2} ${my + 38}"/>
            <path d="M${mx + 16} ${my - 6} Q ${mx + 2} ${my - 18}, ${mx - 10} ${my - 16}"/>
            <path d="M${mx + 22} ${my - 2} Q ${mx + 10} ${my - 20}, ${mx - 2} ${my - 26}"/>
        </g>`;
    }
    case "armor": {
        // Panzerplatten entlang des Rückens
        return `<g fill="${fill}" stroke="${outline}" stroke-width="3" stroke-linejoin="round">
            <path d="M74 60 L 90 50 L 96 64 L 80 70 Z"/>
            <path d="M100 52 L 116 44 L 122 58 L 104 64 Z"/>
            <path d="M126 50 L 142 44 L 146 58 L 130 62 Z"/>
            <path d="M150 54 L 164 50 L 166 64 L 154 66 Z"/>
        </g>`;
    }
    default:
        return "";
    }
}

function rarityPattern(rarity, base) {
    const dark = shade(base, -0.4);
    const light = shade(base, 0.55);
    const bright = shade(base, 0.75);
    switch (rarity) {
    case "Uncommon":
        return `<circle cx="118" cy="94" r="9" fill="${dark}" opacity="0.5"/><circle cx="144" cy="72" r="7" fill="${dark}" opacity="0.46"/><circle cx="96" cy="104" r="6.5" fill="${dark}" opacity="0.46"/><circle cx="128" cy="110" r="5.5" fill="${dark}" opacity="0.4"/>`;
    case "Rare":
        return `<path d="M86 30 Q 76 80, 62 132" stroke="${dark}" stroke-width="12" opacity="0.38" stroke-linecap="round" fill="none"/><path d="M122 30 Q 112 82, 102 134" stroke="${dark}" stroke-width="10" opacity="0.32" stroke-linecap="round" fill="none"/><path d="M158 42 Q 152 84, 146 124" stroke="${dark}" stroke-width="8" opacity="0.28" stroke-linecap="round" fill="none"/><circle cx="150" cy="74" r="5" fill="${light}" opacity="0.65"/>`;
    case "Epic":
        return `<path d="M80 28 Q 70 82, 58 134" stroke="${dark}" stroke-width="11" opacity="0.34" stroke-linecap="round" fill="none"/><path d="M120 28 Q 110 82, 100 134" stroke="${dark}" stroke-width="9" opacity="0.3" stroke-linecap="round" fill="none"/><circle cx="122" cy="62" r="7" fill="${bright}" opacity="0.82"/><circle cx="148" cy="86" r="5.5" fill="${bright}" opacity="0.78"/><circle cx="100" cy="100" r="5" fill="${bright}" opacity="0.72"/><circle cx="134" cy="106" r="4" fill="${bright}" opacity="0.68"/>`;
    case "Legendary":
        return `<circle cx="106" cy="62" r="8" fill="${bright}" opacity="0.95"/><circle cx="138" cy="80" r="7" fill="${bright}" opacity="0.92"/><circle cx="90" cy="94" r="6.5" fill="${bright}" opacity="0.88"/><circle cx="124" cy="108" r="5.5" fill="${bright}" opacity="0.85"/><circle cx="160" cy="68" r="5" fill="${bright}" opacity="0.82"/><circle cx="112" cy="122" r="4.5" fill="${bright}" opacity="0.78"/><circle cx="156" cy="106" r="4" fill="${bright}" opacity="0.74"/>`;
    default:
        return "";
    }
}

/** Lateral Line — die seitliche Sinneslinie echter Fische, dezent. */
function lateralLine(base, a) {
    const dark = shade(base, -0.42);
    // Linie verläuft von Gill bis kurz vor Tail-Ansatz (~190)
    const startX = a.gill[0] + 10;
    const startY = (a.gill[1] + 80) / 2 + 4;
    return `<path d="M${startX} ${startY} Q 130 ${startY + 4}, 188 ${startY + 6}" fill="none" stroke="${dark}" stroke-width="2.2" opacity="0.32" stroke-linecap="round"/>`;
}

/** Flossenstrahlen — geben den Flossen Struktur. Cozy = Kurven, Predator = straight, exotic skip. */
function finRays(shapeKey, outline) {
    const noFins = ["ray", "vertical", "jellyfish", "kraken", "abyssal"];
    if (noFins.includes(shapeKey)) return "";
    const angular = ["needle", "blade", "sail", "crown", "monarch", "shark", "segmented", "leviathan", "wyrm"];
    if (angular.includes(shapeKey)) {
        return `
        <g fill="none" stroke="${outline}" stroke-width="2" stroke-linecap="round" opacity="0.4">
            <line x1="200" y1="74" x2="218" y2="62"/>
            <line x1="200" y1="80" x2="220" y2="76"/>
            <line x1="200" y1="86" x2="218" y2="96"/>
        </g>`;
    }
    return `
        <g fill="none" stroke="${outline}" stroke-width="2" stroke-linecap="round" opacity="0.42">
            <path d="M112 56 Q 122 38, 140 54"/>
            <path d="M120 58 Q 130 42, 144 56"/>
            <path d="M116 104 Q 128 122, 144 104"/>
            <path d="M124 104 Q 134 120, 148 104"/>
        </g>`;
}

function aroundSparkles(rarity, base, uid) {
    if (rarity === "Legendary") {
        const bright = shade(base, 0.78);
        return `<g opacity="0.92"><circle cx="32" cy="36" r="3.6" fill="${bright}" filter="url(#${uid}-glow)"/><circle cx="206" cy="44" r="3" fill="${bright}" filter="url(#${uid}-glow)"/><circle cx="226" cy="96" r="2.6" fill="${bright}" filter="url(#${uid}-glow)"/><circle cx="38" cy="132" r="3.2" fill="${bright}" filter="url(#${uid}-glow)"/><circle cx="188" cy="142" r="2.4" fill="${bright}" filter="url(#${uid}-glow)"/></g>`;
    }
    if (rarity === "Epic") {
        const bright = shade(base, 0.6);
        return `<g opacity="0.75"><circle cx="42" cy="40" r="2.4" fill="${bright}" filter="url(#${uid}-glow)"/><circle cx="204" cy="52" r="2" fill="${bright}" filter="url(#${uid}-glow)"/><circle cx="52" cy="134" r="2" fill="${bright}" filter="url(#${uid}-glow)"/></g>`;
    }
    return "";
}

function legendaryAura(uid, base) {
    const aura = shade(base, 0.55);
    return `<ellipse cx="120" cy="80" rx="125" ry="68" fill="${aura}" opacity="0.4" filter="url(#${uid}-glow)"/>`;
}

export function renderFishArt(fish, options = {}) {
    const shapeKey = fish?.art?.shape;
    const shape = SHAPES[shapeKey] || SHAPES.dart;
    const a = shape.a;
    const title = options.title ? `<title>${fish.name}</title>` : "";
    const ariaHidden = options.title ? "false" : "true";

    if (options.silhouette) {
        const ink = "#06101b";
        return `<svg class="fish-art ${options.className || ""}" viewBox="0 0 240 160" fill="none" aria-hidden="${ariaHidden}">${title}<path d="${shape.tail}" fill="${ink}" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/><path d="${shape.top}" fill="${ink}" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/><path d="${shape.bottom}" fill="${ink}" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/><path d="${shape.body}" fill="${ink}" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/>${featureMarkup(fish.art.feature, ink, ink, true, a)}</svg>`;
    }

    const base = fish.art.color;
    const outline = fish.art.outline;
    const finFill = shade(base, -0.18);
    const rarity = fish.rarity || "Common";
    const uid = `fa-${fish.id}-${++renderSeq}`;
    const bodyStroke = `stroke="${outline}" stroke-width="7" stroke-linejoin="round"`;
    const finStroke = `stroke="${outline}" stroke-width="6" stroke-linejoin="round"`;
    const hasGlow = rarity === "Epic" || rarity === "Legendary";
    const isLegendary = rarity === "Legendary";
    const innerGlowColor = shade(base, isLegendary ? 0.62 : 0.46);
    const [ex, ey] = a.eye;

    return `
        <svg class="fish-art ${options.className || ""}" viewBox="0 0 240 160" fill="none" aria-hidden="${ariaHidden}">
            ${title}
            <defs>
                <linearGradient id="${uid}-body" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="${shade(base, -0.32)}"/>
                    <stop offset="0.46" stop-color="${base}"/>
                    <stop offset="1" stop-color="${shade(base, 0.32)}"/>
                </linearGradient>
                <linearGradient id="${uid}-fin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="${shade(base, -0.38)}"/>
                    <stop offset="1" stop-color="${shade(base, -0.04)}"/>
                </linearGradient>
                <clipPath id="${uid}-clip">
                    <path d="${shape.body}"/>
                </clipPath>
                ${hasGlow ? `<filter id="${uid}-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${isLegendary ? 10 : 6}"/></filter>` : ""}
            </defs>
            ${isLegendary ? legendaryAura(uid, base) : ""}
            ${hasGlow ? `<path d="${shape.body}" fill="${innerGlowColor}" opacity="${isLegendary ? 0.85 : 0.55}" filter="url(#${uid}-glow)"/>` : ""}
            ${hasGlow ? aroundSparkles(rarity, base, uid) : ""}
            <path d="${shape.body}" fill="rgba(3, 12, 22, 0.22)" transform="translate(3 8)"/>
            <path d="${shape.tail}" fill="url(#${uid}-fin)" ${finStroke}/>
            <path d="${shape.top}" fill="url(#${uid}-fin)" ${finStroke}/>
            <path d="${shape.bottom}" fill="url(#${uid}-fin)" ${finStroke}/>
            <path d="${shape.body}" fill="url(#${uid}-body)" ${bodyStroke}/>
            ${finRays(shapeKey, outline)}
            <g clip-path="url(#${uid}-clip)">
                ${rarityPattern(rarity, base)}
                ${lateralLine(base, a)}
                <ellipse cx="104" cy="58" rx="58" ry="9" fill="#ffffff" opacity="0.18" transform="rotate(-6 104 58)"/>
            </g>
            ${featureMarkup(fish.art.feature, finFill, outline, false, a)}
            ${isLegendary ? `<circle cx="${ex}" cy="${ey}" r="12" fill="${shade(base, 0.7)}" filter="url(#${uid}-glow)"/>` : ""}
            <circle cx="${ex}" cy="${ey}" r="8" fill="#ffffff" stroke="${outline}" stroke-width="2.5"/>
            <circle cx="${ex + 1.5}" cy="${ey + 1}" r="4.2" fill="${outline}"/>
            <circle cx="${ex - 2}" cy="${ey - 2}" r="1.8" fill="#ffffff"/>
        </svg>
    `;
}
