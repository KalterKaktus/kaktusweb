import { AREAS } from "../data/areas.js";

function randomBetween([min, max]) {
    return min + Math.random() * (max - min);
}

export class BubbleSystem {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.timer = 0;
        this.running = false;
    }

    start() {
        this.running = true;
        this.schedule(550);
    }

    stop() {
        this.running = false;
        window.clearTimeout(this.timer);
    }

    clear() {
        this.root.querySelectorAll(".fish-spot").forEach((spot) => spot.remove());
    }

    // Erzeugt einen Force-Spawn-Spot mit fixer Rarity. Ignoriert das Spawn-Cap, bleibt
    // länger sichtbar (Default 12s) und nutzt eine eigene CSS-Variante.
    //
    // options.lifetimeSec: überschreibt die Sichtbarkeitsdauer (für Daily-Spawns wo
    // garantiert wird dass der Spieler nichts verpasst).
    spawnForced(rarity, options = {}) {
        if (!this.running) return;
        if (!this.options.canSpawn || !this.options.canSpawn()) return;

        const spot = document.createElement("button");
        spot.type = "button";
        spot.className = `fish-spot is-forced is-rarity-${String(rarity || "").toLowerCase()}`;
        spot.setAttribute("aria-label", `${rarity}-Fischstelle anangeln`);
        spot.dataset.forcedRarity = rarity;
        if (options.lifetimeSec && Number.isFinite(options.lifetimeSec)) {
            spot.style.animationDuration = `${options.lifetimeSec}s`;
        }
        const spotXPct = 14 + Math.random() * 72;
        const spotYPct = 22 + Math.random() * 56;
        spot.style.setProperty("--spot-x", `${spotXPct}%`);
        spot.style.setProperty("--spot-y", `${spotYPct}%`);
        spot.innerHTML =
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-swimmer"></span>';
        spot.addEventListener("click", () => {
            spot.classList.add("is-popped");
            const forcedRarity = spot.dataset.forcedRarity || null;
            window.setTimeout(() => spot.remove(), 320);
            this.options.onPick(forcedRarity);
        }, { once: true });
        spot.addEventListener("animationend", (event) => {
            if (event.animationName === "fish-spot-expire") {
                spot.remove();
            }
        });
        this.root.append(spot);
        if (typeof this.options.onSpawn === "function") {
            const rect = this.root.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.options.onSpawn(rect.width * spotXPct / 100, rect.height * spotYPct / 100);
            }
        }
    }

    schedule(delay) {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.spawn(), delay);
    }

    spawn() {
        if (!this.running) {
            return;
        }

        const state = this.options.getState();
        const sonarLevel = Math.max(0, Number(state.upgrades.sonar) || 0);
        // Jedes Köder-Level erlaubt einen weiteren Spot gleichzeitig (1 → 6 bei Maxlevel).
        const maxSpots = 1 + sonarLevel;
        // Lifetime: L0 = 4 s, +1.6 s pro Level → 4, 5.6, 7.2, 8.8, 10.4, 12 s. Cap bei 12 s.
        const lifetimeSec = Math.min(12, 4 + sonarLevel * 1.6);
        // Wartezeit zwischen Verschwinden und Erscheinen — L0 = 10 s („entspannt").
        // Pro Level kürzer, L5 = ~0.4 s (fast nahtlos).
        const waitSec = Math.max(0.4, 10 - sonarLevel * 1.92);
        // Gesamtzyklus = Wartezeit + Lebenszeit (so wartet man am Anfang IMMER 10 s
        // zwischen Spots, unabhängig davon wie lang der Fisch sichtbar war).
        const spawnIntervalSec = waitSec + lifetimeSec;
        const spawnMultiplier = Math.max(0.1, Number(this.options.getSpawnMultiplier?.()) || 1);
        const nextDelay = (spawnIntervalSec * 1000) / spawnMultiplier;

        if (!this.options.canSpawn() || this.root.querySelectorAll(".fish-spot").length >= maxSpots) {
            // Wenn nicht gespawnt werden kann (UI offen / Cap erreicht), entspannt
            // alle 5 s wieder probieren — kein Sinn Timer schnell zu rotieren wenn nichts passiert.
            this.schedule(5000);
            return;
        }

        const spot = document.createElement("button");
        spot.type = "button";
        spot.className = "fish-spot";
        spot.setAttribute("aria-label", "Fischstelle anangeln");
        const spotXPct = 10 + Math.random() * 80;
        const spotYPct = 18 + Math.random() * 64;
        spot.style.setProperty("--spot-x", `${spotXPct}%`);
        spot.style.setProperty("--spot-y", `${spotYPct}%`);
        spot.style.animationDuration = `${lifetimeSec}s`;
        spot.innerHTML =
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-swimmer"></span>';
        spot.addEventListener("click", () => {
            spot.classList.add("is-popped");
            const forcedRarity = spot.dataset.forcedRarity || null;
            window.setTimeout(() => spot.remove(), 320);
            this.options.onPick(forcedRarity);
        }, { once: true });
        spot.addEventListener("animationend", (event) => {
            if (event.animationName === "fish-spot-expire") {
                spot.remove();
            }
        });
        this.root.append(spot);
        if (typeof this.options.onSpawn === "function") {
            const rect = this.root.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const x = rect.width * spotXPct / 100;
                const y = rect.height * spotYPct / 100;
                this.options.onSpawn(x, y);
            }
        }
        this.schedule(nextDelay);
    }
}
