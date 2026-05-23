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
    // länger sichtbar (12s) und nutzt eine eigene CSS-Variante.
    spawnForced(rarity) {
        if (!this.running) return;
        if (!this.options.canSpawn || !this.options.canSpawn()) return;

        const spot = document.createElement("button");
        spot.type = "button";
        spot.className = `fish-spot is-forced is-rarity-${String(rarity || "").toLowerCase()}`;
        spot.setAttribute("aria-label", `${rarity}-Fischstelle anangeln`);
        spot.dataset.forcedRarity = rarity;
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
        // Lifetime skaliert linear: 4 s (Lvl 0) → 11.5 s (Lvl 5). Pro Level + 1.5 s.
        const lifetimeSec = 4 + sonarLevel * 1.5;
        // Spawn-Intervall richtet sich nach lifetime / maxSpots, mit Fill-Faktor 0.9
        // (also etwas schneller als nötig damit Random-Variance die Cap nicht durchhängen lässt).
        // Folge: bei jedem Level ist der Bildschirm im Steady-State stets bei maxSpots.
        const spawnMultiplier = Math.max(0.1, Number(this.options.getSpawnMultiplier?.()) || 1);
        const targetSec = (lifetimeSec / maxSpots) * 0.9;
        const minSec = targetSec * 0.65;
        const maxSec = targetSec * 1.35;
        const baseSec = minSec + Math.random() * (maxSec - minSec);
        const nextDelay = baseSec * 1000 / spawnMultiplier;

        if (!this.options.canSpawn() || this.root.querySelectorAll(".fish-spot").length >= maxSpots) {
            this.schedule(Math.min(2400, nextDelay));
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
