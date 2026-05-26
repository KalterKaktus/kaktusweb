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
        // Visibility: im Hintergrund-Tab throttled der Browser setTimeout (auf ~1Hz) und
        // pausiert CSS-Animationen. Resultat ohne Handler: Spots werden langsam weiter
        // gespawnt, laufen aber nicht ab → bei Rückkehr stehen 2-3 Fische "auf Vorrat"
        // bereit. Fix: bei hidden den Schedule stoppen + bei visible alle Stale-Spots
        // wegräumen und sauber neu schedulen.
        this._visibilityHandler = () => this._handleVisibility();
        document.addEventListener("visibilitychange", this._visibilityHandler);
    }

    start() {
        this.running = true;
        this.schedule(550);
    }

    stop() {
        this.running = false;
        window.clearTimeout(this.timer);
    }

    destroy() {
        this.stop();
        document.removeEventListener("visibilitychange", this._visibilityHandler);
    }

    clear() {
        this.root.querySelectorAll(".fish-spot").forEach((spot) => spot.remove());
    }

    _handleVisibility() {
        if (!this.running) return;
        if (document.hidden) {
            // Tab geht in den Hintergrund — keine neuen Spots schedulen.
            this._hiddenAt = Date.now();
            window.clearTimeout(this.timer);
            return;
        }
        // Zurück aktiv: Spots wegräumen die in der Hidden-Zeit längst hätten ablaufen
        // müssen (verhindert Stack-Effekt), den Rest behalten. Dann sauber neu schedulen.
        const hiddenMs = this._hiddenAt ? Date.now() - this._hiddenAt : 0;
        this._hiddenAt = 0;
        const cutoff = Date.now() - 1500; // 1.5s Toleranz
        this.root.querySelectorAll(".fish-spot").forEach((spot) => {
            const spawnedAt = Number(spot.dataset.spawnedAt) || 0;
            const lifeMs = (Number(spot.dataset.lifetimeSec) || 7) * 1000;
            if (!spawnedAt || (Date.now() - spawnedAt > lifeMs) || (hiddenMs > 500 && spawnedAt < cutoff)) {
                spot.remove();
            }
        });
        this.schedule(550);
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
        const forcedLife = (options.lifetimeSec && Number.isFinite(options.lifetimeSec))
            ? options.lifetimeSec
            : 12;
        spot.dataset.spawnedAt = String(Date.now());
        spot.dataset.lifetimeSec = String(forcedLife);
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
        // Handpicked-Tuning für klar spürbare Progression pro Level.
        // spots = parallele Spots, lifetime = wie lange sichtbar, wait = zwischen
        // Spawns. Wichtig: nextDelay nutzt NUR waitSec (nicht +lifetime), damit
        // sich Spots tatsächlich überlappen und der maxSpots-Wert greift.
        const SONAR_TUNING = [
            { spots: 1, lifetime: 7,  wait: 5 },    // L0 — entspannt, single spot
            { spots: 2, lifetime: 9,  wait: 3.5 },  // L1 — fühlbar mehr action
            { spots: 3, lifetime: 11, wait: 2.2 },  // L2 — meistens 2 spots aktiv
            { spots: 5, lifetime: 13, wait: 1.3 },  // L3 — klar mehr fische
            { spots: 7, lifetime: 15, wait: 0.6 },  // L4 — meiste Zeit bei max
            { spots: 9, lifetime: 17, wait: 0.3 },  // L5 — quasi non-stop max
        ];
        const tuning = SONAR_TUNING[Math.min(SONAR_TUNING.length - 1, sonarLevel)];
        const maxSpots = tuning.spots;
        const lifetimeSec = tuning.lifetime;
        const waitSec = tuning.wait;
        const spawnMultiplier = Math.max(0.1, Number(this.options.getSpawnMultiplier?.()) || 1);
        const nextDelay = (waitSec * 1000) / spawnMultiplier;

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
        spot.dataset.spawnedAt = String(Date.now());
        spot.dataset.lifetimeSec = String(lifetimeSec);
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
