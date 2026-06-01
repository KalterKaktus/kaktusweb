import { RARITIES } from "../data/rarities.js";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Per-Rarity Drain pro Sekunde wenn der Fisch ausserhalb der Catch-Zone ist.
// Neue Anker (aggressiver, damit man ohne Upgrades den Druck spürt):
//   Common = 6 s, Uncommon = 4.8 s, Rare = 3.7 s, Epic = 2.9 s, Legendary = 2.4 s.
// Line-Upgrade reduziert das um 12 % pro Level (kumulativ, Lvl 5 = 40 % Drain übrig).
//   → Mit Maxlevel-Line: Common ~15 s, Legendary ~6 s — deutlich entspannter.
const TENSION_DRAIN_BY_RARITY = {
    Common: 0.167,
    Uncommon: 0.21,
    Rare: 0.27,
    Epic: 0.34,
    Legendary: 0.42,
};

// Bewegungs-Verhalten pro Rarity. Common = sehr ruhig, Legendary = aggressiv & hektisch.
//   baseSpeed/speedVariance: Geschwindigkeit (Anteil der Track-Breite pro Sekunde)
//   minTurn/maxTurn: Sekunden bis zur nächsten Richtungs-Entscheidung
//   flipChance: Wahrscheinlichkeit, beim Turn die Richtung umzukehren
const FISH_BEHAVIOR = {
    Common:    { baseSpeed: 0.10, speedVariance: 0.06, minTurn: 0.70, maxTurn: 1.60, flipChance: 0.45 },
    Uncommon:  { baseSpeed: 0.14, speedVariance: 0.10, minTurn: 0.55, maxTurn: 1.35, flipChance: 0.55 },
    Rare:      { baseSpeed: 0.22, speedVariance: 0.14, minTurn: 0.40, maxTurn: 1.05, flipChance: 0.65 },
    Epic:      { baseSpeed: 0.30, speedVariance: 0.18, minTurn: 0.28, maxTurn: 0.85, flipChance: 0.72 },
    Legendary: { baseSpeed: 0.42, speedVariance: 0.22, minTurn: 0.20, maxTurn: 0.68, flipChance: 0.78 },
};

// Rod-Level beeinflusst Fish-Speed (langsamer) und Turn-Häufigkeit (seltener).
// Cap so dass selbst bei Maxlevel ein Legendary noch deutlich aggressiver bleibt als ein Common.
function rodSpeedMultiplier(rod) { return Math.max(0.65, 1 - rod * 0.06); }
function rodTurnMultiplier(rod) { return 1 + rod * 0.08; }

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
                if (this.active.held !== held) {
                    this.options.onHoldChange?.(held);
                }
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

        // iOS-Lupe: muss touchstart/touchend explizit mit { passive: false } blockt
        // werden — CSS allein reicht nicht. Auch dblclick blocken weil Safari sonst
        // beim doppelten Tippen die Text-Auswahl-Lupe öffnet.
        const blockTouch = (event) => { if (event.cancelable) event.preventDefault(); };
        this.holdSurface.addEventListener("touchstart", blockTouch, { passive: false });
        this.holdSurface.addEventListener("touchend", blockTouch, { passive: false });
        this.holdSurface.addEventListener("touchmove", blockTouch, { passive: false });
        this.holdSurface.addEventListener("dblclick", blockSelection);
        // Auch auf dem ganzen Overlay-Card iOS-Lupe verhindern beim Doppeltippen.
        const overlayCard = this.root.querySelector(".fishing-overlay-card");
        if (overlayCard) {
            overlayCard.addEventListener("dblclick", blockSelection);
            overlayCard.addEventListener("contextmenu", blockSelection);
        }

        // Keyboard-Shortcuts: Leertaste = halten zum Angeln, X / ESC = abbrechen.
        // window-level listeners damit auch funktioniert wenn focus nicht auf
        // holdSurface ist. Filter via `this.active` (kein Effekt wenn Minispiel
        // gerade nicht läuft).
        window.addEventListener("keydown", (event) => {
            if (!this.active) return;
            if (event.repeat) return;  // ignoriere OS-key-repeat (Space hold)
            if (event.code === "Space" || event.key === " ") {
                event.preventDefault();
                setHeld(true);
            } else if (event.key === "x" || event.key === "X" || event.key === "Escape") {
                event.preventDefault();
                this.finish(false);
            }
        });
        window.addEventListener("keyup", (event) => {
            if (!this.active) return;
            if (event.code === "Space" || event.key === " ") {
                event.preventDefault();
                setHeld(false);
            }
        });
        // Falls Browser fokus verliert während Space gehalten wird:
        // setHeld(false) sonst klemmt der hold-state.
        window.addEventListener("blur", () => {
            if (this.active) setHeld(false);
        });
    }

    start(candidate, bonuses) {
        if (this.active) {
            return;
        }

        const rarity = RARITIES[candidate.fish.rarity];
        const rod = Math.max(0, bonuses.rod || 0);
        const line = Math.max(0, bonuses.line || 0);
        const hook = Math.max(0, bonuses.hook || 0);
        const behavior = FISH_BEHAVIOR[candidate.fish.rarity] || FISH_BEHAVIOR.Common;
        const rodSpeedMult = rodSpeedMultiplier(rod);
        const rodTurnMult = rodTurnMultiplier(rod);
        const initSpeed = (behavior.baseSpeed + Math.random() * behavior.speedVariance) * rodSpeedMult;
        const initTurn = (behavior.minTurn + Math.random() * (behavior.maxTurn - behavior.minTurn)) * rodTurnMult;

        this.active = {
            candidate,
            behavior,
            rodSpeedMult,
            rodTurnMult,
            held: false,
            lastTime: performance.now(),
            progress: 0,
            fishPosition: 0.5,
            fishVelocity: (Math.random() > 0.5 ? 1 : -1) * initSpeed,
            fishTurnIn: initTurn,
            zonePosition: 0.2,
            zoneVelocity: 0,
            zoneWidth: Math.min(0.44, 0.19 + rod * 0.035),
            catchSpeed: (0.3 + hook * 0.045) / rarity.difficulty,
            lossSpeed: Math.max(0.035, 0.13 * rarity.difficulty * (1 - line * 0.11)),
            // Schnur-Spannung (1.0 = voll, 0 = Fisch reisst aus).
            // Drain ist pro Rarity fest verankert (Common 6s → Legendary 2.4s ohne Upgrades).
            // Line-Upgrade reduziert linear 12 % pro Level (Lvl 5 = 40 % Drain übrig).
            tension: 1,
            tensionDrain: Math.max(
                0.04,
                (TENSION_DRAIN_BY_RARITY[candidate.fish.rarity] || 0.21) * (1 - line * 0.12)
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
            const flip = Math.random() < game.behavior.flipChance ? -1 : 1;
            const speed = (game.behavior.baseSpeed + Math.random() * game.behavior.speedVariance) * game.rodSpeedMult;
            game.fishVelocity = flip * Math.sign(game.fishVelocity || 1) * speed;
            game.fishTurnIn = (game.behavior.minTurn + Math.random() * (game.behavior.maxTurn - game.behavior.minTurn)) * game.rodTurnMult;
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
        this.options.onHoldChange?.(false);
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
