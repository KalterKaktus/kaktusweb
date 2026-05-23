// WeatherEventSystem — globale, zeitsynchrone Wetter-Events mit Buffs.
//
// Mechanik:
//   - Fester Epoch (2026-01-01 UTC) + Slot-Länge 30 min.
//   - Pro Slot ist das Wetter die ersten 5 min aktiv, danach 25 min "klar".
//   - Welcher Typ läuft = deterministischer Hash(Slot-Index) → für alle Clients
//     identisch ohne Server-Roundtrip (Clock-Drift im Sekundenbereich ist OK).
//
// Buffs werden vom Spiel via getBuffs() abgefragt und multiplikativ angewendet.

const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
const SLOT_MS = 30 * 60 * 1000;
const ACTIVE_MS = 5 * 60 * 1000;
const TICK_MS = 4000;

export const WEATHER_EVENTS = [
    {
        type: "sunny",
        name: "Sonniges Wetter",
        buff: "luck",
        mult: 2,
        buffLabel: "Glück 2×",
        water: "calm",
        fog: 0,
        rain: 0,
        accent: "#ffd166",
        icon: "☀",
    },
    {
        type: "rain",
        name: "Regenschauer",
        buff: "spawnRate",
        mult: 2,
        buffLabel: "Spawnrate 2×",
        water: "calm",
        fog: 0,
        rain: 0.55,
        accent: "#7ec0ff",
        icon: "🌧",
    },
    {
        type: "storm",
        name: "Sturm",
        buff: "hook",
        mult: 2,
        buffLabel: "Haken 2×",
        water: "storm",
        fog: 0,
        rain: 0.85,
        accent: "#9aa6ff",
        icon: "⛈",
    },
    {
        type: "fog",
        name: "Nebel",
        buff: "rod",
        mult: 2,
        buffLabel: "Rute 2×",
        water: "calm",
        fog: 0.55,
        rain: 0,
        accent: "#c8d8e6",
        icon: "🌫",
    },
    {
        type: "night",
        name: "Nachtangeln",
        buff: "line",
        mult: 2,
        buffLabel: "Schnur 2×",
        water: "deepsea",
        fog: 0.18,
        rain: 0,
        accent: "#a3a4ff",
        icon: "🌙",
    },
];

function hashSlot(slot) {
    let x = (slot ^ 0x9e3779b1) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x % WEATHER_EVENTS.length;
}

function slotOf(now) {
    return Math.floor((now - EPOCH) / SLOT_MS);
}

function buildEvent(slot) {
    const base = WEATHER_EVENTS[hashSlot(slot)];
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
        if (event) {
            try { waterSystem?.setPreset(event.water); } catch {}
            try { weatherSystem?.transitionTo({ rain: event.rain || 0, fog: event.fog || 0 }); } catch {}
        } else {
            try { waterSystem?.setPreset("calm"); } catch {}
            try { weatherSystem?.transitionTo({ rain: 0, fog: 0 }); } catch {}
        }
    }

    /** Aktuelle Buff-Multiplikatoren. Default alles 1. */
    getBuffs() {
        const base = { luck: 1, spawnRate: 1, hook: 1, rod: 1, line: 1 };
        if (this.currentEvent) {
            base[this.currentEvent.buff] = this.currentEvent.mult;
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
