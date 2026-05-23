// WeatherSystem — atmosphärische Effekte über dem Wasser.
//
// Trennscharf vom WaterSystem:
//   - Rain  → wird an den WaterSystem-Shader durchgereicht (passt visuell zur Oberfläche)
//   - Fog   → eigener SVG-Overlay über der gesamten Wasserfläche INKL. der Fische
//             (Nebel gehört atmosphärisch zwischen Spieler und Szene, nicht ins Wasser)
//
// Architektur:
//   - Eigenständige Klasse, hält nur eine Referenz auf WaterSystem
//   - Fog-Layer = zwei feTurbulence-SVG-Schichten mit unterschiedlichem Tempo (Parallaxe)
//   - Keine PNG/JPG, alles inline SVG + CSS-Transforms
//   - prefers-reduced-motion + body.reduce-fishing-motion frieren die Drift ein
//   - pointer-events: none → Klicks gehen weiter durch zu Fish-Spots / Coin-Fish

const FOG_FADE_MS = 1200;

function isMotionReduced() {
    return (
        document.body.classList.contains("reduce-fishing-motion") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export class WeatherSystem {
    constructor(root, waterSystem, options = {}) {
        this.root = root;
        this.waterSystem = waterSystem || null;
        this.options = options;

        this.fog = 0;
        this.rain = 0;

        this._build();
        this.setFog(0);
    }

    _build() {
        // Idempotent bei Hot-Reload
        this.root.querySelectorAll(":scope > .weather-fog").forEach((el) => el.remove());

        // Zwei SVG-Schichten mit feTurbulence — fractalNoise sieht wie Nebel/Wolken aus.
        // Die Filter-Regions sind 200×200 (Userspace-Units), die SVGs füllen die Stage
        // und werden via CSS-Transform vorsichtig gedriftet. Wir extenden inset:-25%
        // damit die Drift keine Kanten zeigt.
        const wrap = document.createElement("div");
        wrap.className = "weather-fog";
        wrap.setAttribute("aria-hidden", "true");
        wrap.innerHTML = `
            <svg class="weather-fog-layer weather-fog-layer--back"
                 xmlns="http://www.w3.org/2000/svg"
                 preserveAspectRatio="xMidYMid slice"
                 viewBox="0 0 200 200">
                <filter id="weather-fog-back" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
                    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="3" stitchTiles="stitch"/>
                    <feColorMatrix values="0 0 0 0 0.92
                                           0 0 0 0 0.96
                                           0 0 0 0 1.00
                                           0 0 0 0.55 -0.05"/>
                </filter>
                <rect width="200" height="200" filter="url(#weather-fog-back)"/>
            </svg>
            <svg class="weather-fog-layer weather-fog-layer--front"
                 xmlns="http://www.w3.org/2000/svg"
                 preserveAspectRatio="xMidYMid slice"
                 viewBox="0 0 200 200">
                <filter id="weather-fog-front" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
                    <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="9" stitchTiles="stitch"/>
                    <feColorMatrix values="0 0 0 0 0.98
                                           0 0 0 0 1.00
                                           0 0 0 0 1.00
                                           0 0 0 0.7 -0.18"/>
                </filter>
                <rect width="200" height="200" filter="url(#weather-fog-front)"/>
            </svg>
        `;
        this.root.appendChild(wrap);
        this.wrap = wrap;
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */

    /** Nebel 0..1. Wird mit weichem Fade angewendet. */
    setFog(value) {
        const v = Math.max(0, Math.min(1, Number(value) || 0));
        this.fog = v;
        if (this.wrap) {
            // CSS-Variable + ein direktes opacity-fallback für ältere Browser
            this.wrap.style.setProperty("--weather-fog", String(v));
            this.wrap.style.opacity = String(v);
            this.wrap.style.pointerEvents = "none";
        }
    }

    /** Regen 0..1. Delegiert an den WaterSystem-Shader. */
    setRain(value) {
        const v = Math.max(0, Math.min(1, Number(value) || 0));
        this.rain = v;
        if (this.waterSystem) this.waterSystem.setRain(v);
    }

    /** Beides auf einmal: weather.set({ rain: 0.5, fog: 0.3 }). */
    set(opts) {
        if (!opts) return;
        if (typeof opts.rain === "number") this.setRain(opts.rain);
        if (typeof opts.fog === "number") this.setFog(opts.fog);
    }

    /** Sanft auf neuen Zustand überblenden (über duration ms). */
    transitionTo(opts, durationMs = FOG_FADE_MS) {
        if (!opts) return;
        const start = { rain: this.rain, fog: this.fog };
        const target = {
            rain: typeof opts.rain === "number" ? Math.max(0, Math.min(1, opts.rain)) : start.rain,
            fog: typeof opts.fog === "number" ? Math.max(0, Math.min(1, opts.fog)) : start.fog,
        };
        const t0 = performance.now();
        const step = () => {
            const t = Math.min(1, (performance.now() - t0) / durationMs);
            const eased = t * t * (3 - 2 * t); // smoothstep
            this.setRain(start.rain + (target.rain - start.rain) * eased);
            this.setFog(start.fog + (target.fog - start.fog) * eased);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    destroy() {
        if (this.wrap) this.wrap.remove();
    }
}
