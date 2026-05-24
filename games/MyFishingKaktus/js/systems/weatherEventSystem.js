// WeatherEventSystem — globale, zeitsynchrone Wetter-Events mit Buffs.
//
// Mechanik:
//   - Fester Epoch (2026-01-01 UTC) + Slot-Länge 15 min.
//   - Pro Slot ist das Wetter die ersten 2,5 min aktiv, danach 12,5 min "klar".
//   - Welcher Typ läuft = deterministischer Hash(Slot-Index) → für alle Clients
//     identisch ohne Server-Roundtrip (Clock-Drift im Sekundenbereich ist OK).
//
// Buffs werden vom Spiel via getBuffs() abgefragt und multiplikativ angewendet.

const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
const SLOT_MS = 15 * 60 * 1000;          // 15 min (vorher 30) — doppelt so viele Events
const ACTIVE_MS = 2.5 * 60 * 1000;       // 2,5 min aktiv (vorher 5) — gleicher Zeit-Anteil
const TICK_MS = 4000;

// Weights pro Event — höher = häufiger. Standard 20 für jedes normale Event,
// seltene Events bekommen kleinere Werte. Verteilung passt sich automatisch an
// die Summe an (z.B. 5 × 20 + 1 × 5 = 105 total → seltenes Event = 5/105 ≈ 4.8 %).
export const WEATHER_EVENTS = [
    {
        type: "sunny",
        name: "Sonniges Wetter",
        weight: 20,
        buff: "luck",
        mult: 2,
        buffLabel: "Glück 2× + SUNNY-Mutation ×2 (20 %)",
        water: "calm",
        fog: 0,
        rain: 0,
        accent: "#ffd166",
        icon: "☀",
        mutation: "sunny",
        mutationChance: 0.20,
    },
    {
        type: "rain",
        name: "Regenschauer",
        weight: 20,
        buff: "spawnRate",
        mult: 2,
        buffLabel: "Spawnrate 2× + WET-Mutation ×2 (20 %)",
        water: "calm",
        fog: 0,
        rain: 0.55,
        accent: "#7ec0ff",
        icon: "🌧",
        mutation: "wet",
        mutationChance: 0.20,
    },
    {
        type: "storm",
        name: "Sturm",
        weight: 20,
        buff: "hook",
        mult: 2,
        buffLabel: "Haken 2× + STORMY-Mutation ×2 (20 %)",
        water: "storm",
        fog: 0,
        rain: 0.85,
        accent: "#9aa6ff",
        icon: "⛈",
        mutation: "stormy",
        mutationChance: 0.20,
    },
    {
        type: "fog",
        name: "Nebel",
        weight: 20,
        buff: "rod",
        mult: 2,
        buffLabel: "Rute 2× + MISTY-Mutation ×2 (20 %)",
        water: "calm",
        fog: 0.55,
        rain: 0,
        accent: "#c8d8e6",
        icon: "🌫",
        mutation: "misty",
        mutationChance: 0.20,
    },
    {
        type: "night",
        name: "Nachtangeln",
        weight: 20,
        buff: "line",
        mult: 2,
        buffLabel: "Schnur 2× + NOCTURNAL-Mutation ×2 (20 %)",
        water: "deepsea",
        fog: 0.18,
        rain: 0,
        accent: "#a3a4ff",
        icon: "🌙",
        mutation: "nocturnal",
        mutationChance: 0.20,
    },
    {
        type: "abyss",
        name: "Abyss",
        weight: 5, // ~4 % Chance pro Slot
        buff: "epicChance",
        mult: 2,
        buffLabel: "Epic+ Spawn 2× + ABYSSAL-Mutation ×4 (15 %)",
        water: "abyss",
        fog: 0,
        rain: 0,
        accent: "#5fb8ff",
        icon: "🌌",
        // Während Abyss aktiv: 15 % Chance pro Fang auf ABYSSAL-Mutation (×4 coins).
        mutation: "abyssal",
        mutationChance: 0.15,
    },
    // --- Mutation-Only Events: kein Stat-Buff, aber jeweils eigene Mutation ---
    // Seltenheit ↔ Mutation-Mult invers: häufigster gibt niedrigsten Mult.
    // Slot-Weights: poli 6, glut 4, blut 3, geist 2. Mutation-Chance dazu so dass
    // im 5-min-Window pro Catch eine spürbare Trefferquote besteht.
    {
        type: "polarlicht",
        name: "Polarlicht",
        weight: 6,
        water: "calm",
        fog: 0.18,
        rain: 0,
        accent: "#a3ff8c",
        icon: "🌠",
        mutation: "aurora",
        mutationChance: 0.30,
        buffLabel: "AURORA-Mutation ×3 (30 %)",
    },
    {
        type: "glutsturm",
        name: "Glutsturm",
        weight: 4,
        water: "storm",
        fog: 0.12,
        rain: 0,
        accent: "#ff7a3a",
        icon: "🔥",
        mutation: "ember",
        mutationChance: 0.25,
        buffLabel: "EMBER-Mutation ×5 (25 %)",
    },
    {
        type: "blutmond",
        name: "Blutmond",
        weight: 3,
        water: "deepsea",
        fog: 0.22,
        rain: 0,
        accent: "#ff4060",
        icon: "🌑",
        mutation: "crimson",
        mutationChance: 0.20,
        buffLabel: "CRIMSON-Mutation ×7 (20 %)",
    },
    {
        type: "geistermeer",
        name: "Geistermeer",
        weight: 2,
        water: "deepsea",
        fog: 0.32,
        rain: 0,
        accent: "#c8f5ff",
        icon: "👻",
        mutation: "haunted",
        mutationChance: 0.15,
        buffLabel: "HAUNTED-Mutation ×10 (15 %)",
    },
];

function hashSlot(slot) {
    let x = (slot ^ 0x9e3779b1) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x >>> 0;
}

// Weighted-Pick: hash-Wert wird modulo total-weight gerollt, dann durch die
// Events durchiteriert bis das richtige Sub-Bucket erreicht ist.
function pickEventForSlot(slot) {
    const total = WEATHER_EVENTS.reduce((s, e) => s + (e.weight || 1), 0);
    let roll = hashSlot(slot) % total;
    for (const event of WEATHER_EVENTS) {
        const w = event.weight || 1;
        if (roll < w) return event;
        roll -= w;
    }
    return WEATHER_EVENTS[0];
}

function slotOf(now) {
    return Math.floor((now - EPOCH) / SLOT_MS);
}

// Welche Event-Types einen Partikel-Layer bekommen.
const PARTICLE_EVENT_TYPES = new Set(["abyss", "polarlicht", "glutsturm", "blutmond", "geistermeer"]);

function buildEvent(slot) {
    const base = pickEventForSlot(slot);
    const slotStart = EPOCH + slot * SLOT_MS;
    return { ...base, slot, startsAt: slotStart, endsAt: slotStart + ACTIVE_MS };
}

export class WeatherEventSystem {
    constructor(options = {}) {
        this.options = options;
        this.currentEvent = null;
        this._tick();
        this._timer = window.setInterval(() => this._tick(), TICK_MS);
    }

    _tick() {
        if (this._forced) {
            return;
        }
        const now = Date.now();
        const slot = slotOf(now);
        const slotStart = EPOCH + slot * SLOT_MS;
        const intoSlot = now - slotStart;
        const nowActive = intoSlot < ACTIVE_MS;
        const nowEvent = nowActive ? buildEvent(slot) : null;
        const before = this.currentEvent;
        const sameSlot = (nowEvent?.slot ?? null) === (before?.slot ?? null);
        const sameState = (!!nowEvent) === (!!before);
        if (!sameState || !sameSlot) {
            this.currentEvent = nowEvent;
            this._applyVisuals(nowEvent);
            this.options.onChange?.(nowEvent, before);
        }
    }

    _applyVisuals(event) {
        const { waterSystem, weatherSystem } = this.options;
        const waterStage = document.getElementById("water-stage");
        if (event) {
            try { waterSystem?.setPreset(event.water); } catch {}
            try { weatherSystem?.transitionTo({ rain: event.rain || 0, fog: event.fog || 0 }); } catch {}
            // Seltene Events bekommen einen eigenen Partikel-Layer + Veil.
            const isRare = PARTICLE_EVENT_TYPES.has(event.type);
            try { weatherSystem?.setEventParticles?.(isRare ? event.type : null); } catch {}
            if (waterStage) {
                if (isRare) waterStage.dataset.eventOverlay = event.type;
                else delete waterStage.dataset.eventOverlay;
            }
        } else {
            try { waterSystem?.setPreset("calm"); } catch {}
            try { weatherSystem?.transitionTo({ rain: 0, fog: 0 }); } catch {}
            try { weatherSystem?.setEventParticles?.(null); } catch {}
            if (waterStage) delete waterStage.dataset.eventOverlay;
        }
    }

    /** Aktuelle Buff-Multiplikatoren. Default alles 1. */
    getBuffs() {
        const base = { luck: 1, spawnRate: 1, hook: 1, rod: 1, line: 1 };
        // Nur bekannte Buffs anwenden — die neuen visuellen Events haben keinen Buff.
        if (this.currentEvent && this.currentEvent.buff && this.currentEvent.mult) {
            if (base[this.currentEvent.buff] !== undefined) {
                base[this.currentEvent.buff] = this.currentEvent.mult;
            }
        }
        return base;
    }

    getEvent() {
        return this.currentEvent;
    }

    /** Effektives Luck-Level (für rollCatch). */
    applyLuck(luckLevel) {
        return luckLevel * this.getBuffs().luck;
    }

    /** Minispiel-Bonusobjekt mit Buffs multiplizieren. */
    applyBonuses(bonuses) {
        const b = this.getBuffs();
        return {
            rod: bonuses.rod * b.rod,
            line: bonuses.line * b.line,
            hook: bonuses.hook * b.hook,
            luck: bonuses.luck * b.luck,
            sonar: bonuses.sonar,
        };
    }

    /**
     * Liefert direkte Multiplikatoren auf Rarity-Gewichte für rollCatch.
     * Aktuell: Abyss-Event (epicChance) verdoppelt Chance auf Epic + Legendary.
     * Erweiterbar: neue Buff-Typen können hier weitere Rarities boosten.
     */
    getRarityMultipliers() {
        if (!this.currentEvent || this.currentEvent.buff !== "epicChance") return null;
        const mult = this.currentEvent.mult || 1;
        return { Epic: mult, Legendary: mult };
    }

    /** Test/Debug: erzwingt ein Event (oder löst die Sperre mit type=null/false). */
    forceEvent(type) {
        if (!type) {
            this._forced = false;
            this._tick();
            return;
        }
        const base = WEATHER_EVENTS.find((e) => e.type === type);
        if (!base) {
            return;
        }
        this._forced = true;
        const slotStart = Date.now();
        const event = { ...base, slot: -1, startsAt: slotStart, endsAt: slotStart + ACTIVE_MS };
        const before = this.currentEvent;
        this.currentEvent = event;
        this._applyVisuals(event);
        this.options.onChange?.(event, before);
    }

    /** Test/Debug: getStatus liefert für forced events msLeft basierend auf endsAt. */
    getStatus() {
        if (this._forced && this.currentEvent) {
            return {
                event: this.currentEvent,
                isActive: true,
                msLeft: Math.max(0, this.currentEvent.endsAt - Date.now()),
            };
        }
        const now = Date.now();
        const slot = slotOf(now);
        const slotStart = EPOCH + slot * SLOT_MS;
        const intoSlot = now - slotStart;
        if (intoSlot < ACTIVE_MS) {
            return {
                event: buildEvent(slot),
                isActive: true,
                msLeft: ACTIVE_MS - intoSlot,
            };
        }
        const nextSlot = slot + 1;
        return {
            event: buildEvent(nextSlot),
            isActive: false,
            msUntilNext: (EPOCH + nextSlot * SLOT_MS) - now,
        };
    }

    destroy() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }
}
