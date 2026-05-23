import { RARITIES } from "../data/rarities.js";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export class FishingMinigame {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.holdSurface = root.querySelector("[data-fishing-hold]");
        this.fishMarker = root.querySelector("[data-fishing-fish]");
        this.zone = root.querySelector("[data-fishing-zone]");
        this.progress = root.querySelector("[data-fishing-progress]");
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
        this.render();
        if (game.progress >= 1) {
            this.finish(true);
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
