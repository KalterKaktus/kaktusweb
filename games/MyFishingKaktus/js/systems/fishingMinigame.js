import { RARITIES } from "../data/rarities.js";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Per-Rarity Drain pro Sekunde wenn der Fisch ausserhalb der Catch-Zone ist.
// Anker: Common = 10 s bis Ausriss ohne Upgrades, Legendary = 3 s.
// Line-Upgrade reduziert das um 11 % pro Level (kumulativ, also Lvl 5 = 45 %).
const TENSION_DRAIN_BY_RARITY = {
    Common: 0.100,
    Uncommon: 0.125,
    Rare: 0.167,
    Epic: 0.222,
    Legendary: 0.333,
};

export class FishingMinigame {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.holdSurface = root.querySelector("[data-fishing-hold]");
        this.fishMarker = root.querySelector("[data-fishing-fish]");
        this.zone = root.querySelector("[data-fishing-zone]");
        this.progress = root.querySelector("[data-fishing-progress]");
        this.tension = root.querySelector("[data-fishing-tension]");
        this.tensionBar = this.tension ? this.tension.parentElement : null;
        this.tensionHint = root.querySelector("[data-fishing-tension-hint]");
        this.rarityLabel = root.querySelector("[data-fishing-rarity]");
        this.cancelButton = root.querySelector("[data-fishing-cancel]");
        this.animationFrame = 0;
        this.active = null;
        this.bindInput();
    }

    bindInput() {
        const setHeld = (held) => {
            if (this.active) {
                this.active.held = held;
            }
        };

        this.holdSurface.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            this.holdSurface.setPointerCapture(event.pointerId);
            setHeld(true);
        });
        this.holdSurface.addEventListener("pointerup", () => setHeld(false));
        this.holdSurface.addEventListener("pointercancel", () => setHeld(false));
        this.holdSurface.addEventListener("pointerleave", (event) => {
            if (event.buttons === 0) {
                setHeld(false);
            }
        });
        this.cancelButton.addEventListener("click", () => this.finish(false));

        // Verhindert dass beim Press-Hold im Minispiel Text/Elemente selektiert
        // oder das Browser-Kontextmenü („Kopieren") aufpoppen.
        const blockSelection = (event) => event.preventDefault();
        this.holdSurface.addEventListener("selectstart", blockSelection);
        this.holdSurface.addEventListener("contextmenu", blockSelection);
        this.holdSurface.addEventListener("dragstart", blockSelection);
    }

    start(candidate, bonuses) {
        if (this.active) {
            return;
        }

        const rarity = RARITIES[candidate.fish.rarity];
        const rod = Math.max(0, bonuses.rod || 0);
        const line = Math.max(0, bonuses.line || 0);
        const hook = Math.max(0, bonuses.hook || 0);
        this.active = {
            candidate,
            held: false,
            lastTime: performance.now(),
            progress: 0,
            fishPosition: 0.5,
            fishVelocity: (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.18) * rarity.difficulty,
            fishTurnIn: 0.4 + Math.random() * 0.7,
            zonePosition: 0.2,
            zoneVelocity: 0,
            zoneWidth: Math.min(0.44, 0.19 + rod * 0.035),
            catchSpeed: (0.3 + hook * 0.045) / rarity.difficulty,
            lossSpeed: Math.max(0.035, 0.13 * rarity.difficulty * (1 - line * 0.11)),
            // Schnur-Spannung (1.0 = voll, 0 = Fisch reisst aus).
            // Drain ist pro Rarity fest verankert (Common 10s → Legendary 3s ohne Upgrades).
            // Line-Upgrade reduziert linear 11 % pro Level (Lvl 5 = 45 % Drain übrig).
            tension: 1,
            tensionDrain: Math.max(
                0.04,
                (TENSION_DRAIN_BY_RARITY[candidate.fish.rarity] || 0.125) * (1 - line * 0.11)
            ),
            // Refill skaliert mit Hook-Upgrade (Basis + 35 % pro Level → bei Lvl 5 quasi 2.75x).
            tensionRefill: 0.36 * (1 + hook * 0.35),
        };

        this.root.hidden = false;
        this.rarityLabel.textContent = candidate.fish.rarity;
        this.rarityLabel.style.setProperty("--rarity", rarity.color);
        this.root.style.setProperty("--rarity", rarity.color);
        this.progress.style.width = "0%";
        this.options.onOpen();
        this.animationFrame = requestAnimationFrame((time) => this.tick(time));
    }

    tick(time) {
        if (!this.active) {
            return;
        }

        const game = this.active;
        const delta = Math.min(0.05, (time - game.lastTime) / 1000 || 0);
        game.lastTime = time;
        game.fishTurnIn -= delta;
        if (game.fishTurnIn <= 0) {
            const flip = Math.random() > 0.28 ? -1 : 1;
            const speed = 0.15 + Math.random() * 0.31;
            game.fishVelocity = flip * Math.sign(game.fishVelocity || 1) * speed * RARITIES[game.candidate.fish.rarity].difficulty;
            game.fishTurnIn = 0.26 + Math.random() * 0.9;
        }

        game.fishPosition += game.fishVelocity * delta;
        if (game.fishPosition < 0.03 || game.fishPosition > 0.97) {
            game.fishPosition = clamp(game.fishPosition, 0.03, 0.97);
            game.fishVelocity *= -1;
        }

        game.zoneVelocity += (game.held ? 4.8 : -4.0) * delta;
        game.zoneVelocity *= 0.955;
        game.zonePosition = clamp(game.zonePosition + game.zoneVelocity * delta, game.zoneWidth / 2, 1 - game.zoneWidth / 2);
        if (game.zonePosition <= game.zoneWidth / 2 || game.zonePosition >= 1 - game.zoneWidth / 2) {
            game.zoneVelocity *= 0.28;
        }

        const overlap = Math.abs(game.fishPosition - game.zonePosition) <= game.zoneWidth / 2;
        game.progress = clamp(game.progress + (overlap ? game.catchSpeed : -game.lossSpeed) * delta, 0, 1);

        // Tension: ausserhalb Zone → drainen, drin → refillen. Bei 0 reisst der Fisch aus.
        game.tension = clamp(
            game.tension + (overlap ? game.tensionRefill : -game.tensionDrain) * delta,
            0,
            1
        );

        this.render();
        if (game.progress >= 1) {
            this.finish(true);
            return;
        }
        if (game.tension <= 0) {
            this.finish(false);
            return;
        }

        this.animationFrame = requestAnimationFrame((nextTime) => this.tick(nextTime));
    }

    render() {
        if (!this.active) {
            return;
        }

        const game = this.active;
        this.fishMarker.style.left = `${game.fishPosition * 100}%`;
        this.zone.style.left = `${(game.zonePosition - game.zoneWidth / 2) * 100}%`;
        this.zone.style.width = `${game.zoneWidth * 100}%`;
        this.progress.style.width = `${game.progress * 100}%`;
        if (this.tension) {
            this.tension.style.width = `${game.tension * 100}%`;
        }
        if (this.tensionBar) {
            this.tensionBar.classList.toggle("is-low", game.tension < 0.3);
        }
        if (this.tensionHint) {
            if (game.tension < 0.3) {
                this.tensionHint.textContent = "GLEICH REISST ER AUS!";
            } else if (game.tension < 0.6) {
                this.tensionHint.textContent = "Zurück in die Zone!";
            } else {
                this.tensionHint.textContent = "Halt ihn in der Zone!";
            }
        }
    }

    finish(caught) {
        if (!this.active) {
            return;
        }

        const candidate = this.active.candidate;
        cancelAnimationFrame(this.animationFrame);
        this.active = null;
        this.root.hidden = true;
        this.options.onClose();
        if (caught) {
            this.options.onCatch(candidate);
        } else {
            this.options.onEscape(candidate);
        }
    }
}
