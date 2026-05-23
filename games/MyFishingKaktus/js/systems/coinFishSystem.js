const SHAPES = {
    small: `<svg viewBox="0 0 140 78" xmlns="http://www.w3.org/2000/svg">
        <path d="M42 39 8 13 19 39 8 65Z" fill="#0a1a24"/>
        <ellipse cx="82" cy="39" rx="48" ry="25" fill="#0a1a24"/>
    </svg>`,
    big: `<svg viewBox="0 0 184 92" xmlns="http://www.w3.org/2000/svg">
        <path d="M52 46 10 13 23 46 10 79Z" fill="#0a1a24"/>
        <path d="M92 24 116 0 138 28Z" fill="#0a1a24"/>
        <ellipse cx="106" cy="46" rx="64" ry="30" fill="#0a1a24"/>
    </svg>`,
    sword: `<svg viewBox="0 0 264 86" xmlns="http://www.w3.org/2000/svg">
        <path d="M64 43 12 13 27 43 12 73Z" fill="#0a1a24"/>
        <path d="M120 23 144 0 164 25Z" fill="#0a1a24"/>
        <ellipse cx="140" cy="43" rx="86" ry="22" fill="#0a1a24"/>
        <path d="M218 43 262 40 262 46Z" fill="#0a1a24"/>
    </svg>`,
    shark: `<svg viewBox="0 0 286 118" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 61 -4 31 13 61 -4 91Z" fill="#0a1a24"/>
        <path d="M126 47 160 5 182 49Z" fill="#0a1a24"/>
        <path d="M88 72 104 102 124 74Z" fill="#0a1a24"/>
        <path d="M272 60 212 42 122 46 60 55 24 61 60 69 122 78 212 80 272 62Z" fill="#0a1a24"/>
    </svg>`,
};

const TIERS = [
    { id: "small", baseMs: 180000, sizeRem: 6.5, swimSec: 12 },
    { id: "big", baseMs: 600000, sizeRem: 9, swimSec: 13.5 },
    { id: "sword", baseMs: 1200000, sizeRem: 13, swimSec: 15 },
    { id: "shark", baseMs: 2700000, sizeRem: 16.5, swimSec: 17 },
];

export class CoinFishSystem {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.timers = [];
        this.running = false;
    }

    start() {
        this.running = true;
        TIERS.forEach((tier) => this.scheduleTier(tier));
    }

    stop() {
        this.running = false;
        this.timers.forEach((timer) => window.clearTimeout(timer));
        this.timers = [];
    }

    scheduleTier(tier) {
        const spawnMult = Math.max(0.1, Number(this.options.getSpawnMultiplier?.()) || 1);
        const delay = tier.baseMs * (0.6 + Math.random() * 0.8) / spawnMult;
        const timer = window.setTimeout(() => {
            this.spawn(tier);
            if (this.running) {
                this.scheduleTier(tier);
            }
        }, delay);
        this.timers.push(timer);
    }

    spawnTier(tierId) {
        const tier = TIERS.find((entry) => entry.id === tierId);
        if (tier) {
            this.spawn(tier, true);
        }
    }

    spawn(tier, force = false) {
        if (!force && (!this.running || !this.options.canSpawn())) {
            return;
        }

        const leftward = Math.random() < 0.5;
        const fish = document.createElement("button");
        fish.type = "button";
        fish.className = `coin-fish coin-fish--${tier.id}`;
        fish.setAttribute("aria-label", "Fischschatten einsammeln für Coins");
        fish.style.setProperty("--size", `${tier.sizeRem}rem`);
        fish.style.setProperty("--top", `${18 + Math.random() * 56}%`);
        fish.style.setProperty("--swim", `${tier.swimSec}s`);
        fish.style.animationDirection = leftward ? "reverse" : "normal";
        fish.style.animationDelay = `0s, ${(-Math.random() * 3).toFixed(2)}s`;
        fish.innerHTML = `<span class="coin-fish-shape"${leftward ? " style=\"transform:scaleX(-1)\"" : ""}>${SHAPES[tier.id]}</span>`;

        fish.addEventListener("click", () => {
            if (fish.dataset.collected) {
                return;
            }
            fish.dataset.collected = "1";
            fish.style.left = window.getComputedStyle(fish).left;
            fish.classList.add("is-collected");
            this.options.onCollect(tier.id, fish);
            window.setTimeout(() => fish.remove(), 360);
        }, { once: true });

        fish.addEventListener("animationend", (event) => {
            if (event.animationName === "coin-fish-cross") {
                fish.remove();
            }
        });

        // Sanfter Ripple-Trail hinter dem schwimmenden Schatten.
        if (typeof this.options.onTrail === "function") {
            const trailInterval = 600 + Math.random() * 400;
            const trailTimer = window.setInterval(() => {
                if (!fish.isConnected || fish.dataset.collected) {
                    window.clearInterval(trailTimer);
                    return;
                }
                const rect = fish.getBoundingClientRect();
                const stageRect = this.root.getBoundingClientRect();
                if (!stageRect.width || rect.right < stageRect.left || rect.left > stageRect.right) {
                    return;
                }
                const cx = (rect.left + rect.width / 2) - stageRect.left;
                const cy = (rect.top + rect.height / 2) - stageRect.top;
                this.options.onTrail(cx, cy);
            }, trailInterval);
        }

        this.root.append(fish);
    }
}
