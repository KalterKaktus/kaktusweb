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

    schedule(delay) {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.spawn(), delay);
    }

    spawn() {
        if (!this.running) {
            return;
        }

        const state = this.options.getState();
        const area = AREAS[state.currentArea];
        const sonarLevel = Math.max(0, Number(state.upgrades.sonar) || 0);
        const sonarFactor = Math.max(0.52, 1 - sonarLevel * 0.09);
        const spawnMultiplier = Math.max(0.1, Number(this.options.getSpawnMultiplier?.()) || 1);
        const nextDelay = randomBetween(area.bubbleSeconds) * sonarFactor * 1000 / spawnMultiplier;

        if (!this.options.canSpawn() || this.root.querySelectorAll(".fish-spot").length >= 1) {
            this.schedule(Math.min(1600, nextDelay));
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
        spot.innerHTML =
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-ring"></span>' +
            '<span class="fish-spot-swimmer"></span>';
        spot.addEventListener("click", () => {
            spot.classList.add("is-popped");
            window.setTimeout(() => spot.remove(), 320);
            this.options.onPick();
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
