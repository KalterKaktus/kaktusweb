import {
    KARL_NAME,
    KARL_REWARDS_BY_AREA,
    currentKarlSlot,
    getKarlStatus,
} from "../data/karl.js";

const KARL_IMAGE_SRC = "assets/karl.png";

// Toleranz beim Putzen: ab so viel Sauberkeit (0..1) ist Karl „sauber genug" für die Belohnung.
const CLEAN_TOLERANCE = 0.93;
const BRUSH_RADIUS_REL = 0.055; // Brush-Radius beim Putzen (rel. zur Canvas-Breite)

// Karl-Bild wird beim Konstruktor vorgeladen damit das Cleaning sofort den Dreck
// auf der Schildkröten-Silhouette anzeigen kann.
let karlImagePromise = null;
function loadKarlImage() {
    if (karlImagePromise) return karlImagePromise;
    karlImagePromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = KARL_IMAGE_SRC;
    });
    return karlImagePromise;
}

function weightedPick(entries) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const e of entries) {
        roll -= e.weight;
        if (roll <= 0) return e;
    }
    return entries[entries.length - 1];
}

export class KarlSystem {
    constructor(root, options = {}) {
        this.root = root;
        this.options = options;
        this.shadow = null;
        this.shadowTimer = 0;
        this.shadowTickTimer = 0;
        this.cleaning = null;     // { canvas, ctx, dirtMap, totalDirtPx, removedPx }
        this.lastHandledSlot = -1;
        this.running = false;
        this.checkTimer = 0;
        this._buildOverlays();
    }

    start() {
        this.running = true;
        // Karl-Bild vorab laden damit das Cleaning-Overlay sofort startklar ist.
        loadKarlImage().catch(() => {});
        // Schaut alle 5 s nach ob ein neuer Slot-Karl spawnen soll. Sehr billig.
        this.checkTimer = window.setInterval(() => this._tickAutoSpawn(), 5000);
        this._tickAutoSpawn();
    }

    stop() {
        this.running = false;
        window.clearInterval(this.checkTimer);
    }

    _tickAutoSpawn() {
        if (!this.running) return;
        if (this.shadow) return;
        const status = getKarlStatus();
        if (!status.isActive) return;
        if (this.lastHandledSlot === status.slot) return;
        this.lastHandledSlot = status.slot;
        if (typeof this.options.canSpawn === "function" && !this.options.canSpawn()) return;
        this.spawn(status.msLeft);
    }

    /** Spawnt Karl manuell (Test/Admin). Optional ms wie lange er bleibt. */
    spawn(visibleMs = 30000) {
        if (this.shadow) return;
        if (typeof this.options.canSpawn === "function" && !this.options.canSpawn()) return;
        // Markiere den aktuellen Slot als bedient, damit das Auto-Tick nicht später
        // im selben Slot einen ZWEITEN Karl spawnt (Admin/Test gehen sonst um den Tick-Guard rum).
        this.lastHandledSlot = currentKarlSlot();
        // Doppelte DOM-Schatten vermeiden (z.B. wenn alte Fade-Out-Animation noch läuft).
        this.root.querySelectorAll(".karl-shadow").forEach((el) => el.remove());

        const shadow = document.createElement("button");
        shadow.type = "button";
        shadow.className = "karl-shadow";
        shadow.setAttribute("aria-label", `${KARL_NAME} antippen`);
        // Größe wie großer Fisch, Position zufällig
        shadow.style.left = `${15 + Math.random() * 70}%`;
        shadow.style.top = `${30 + Math.random() * 50}%`;
        shadow.style.setProperty("--karl-drift-x", `${(Math.random() * 80 - 40).toFixed(0)}px`);
        shadow.style.setProperty("--karl-drift-y", `${(Math.random() * 40 - 20).toFixed(0)}px`);
        shadow.innerHTML = `<img src="${KARL_IMAGE_SRC}" alt="" aria-hidden="true" draggable="false">`;
        shadow.addEventListener("click", () => {
            if (!this.shadow) return;
            this._removeShadow();
            this._openCleaning();
        }, { once: true });

        this.root.append(shadow);
        this.shadow = shadow;
        this.options.onSpawn?.();

        this.shadowTimer = window.setTimeout(() => {
            // Karl entwischt ohne geklickt zu werden.
            this._removeShadow();
            this.options.onEscape?.();
        }, visibleMs);
    }

    _removeShadow() {
        window.clearTimeout(this.shadowTimer);
        if (this.shadow) {
            this.shadow.classList.add("is-gone");
            const node = this.shadow;
            window.setTimeout(() => node.remove(), 600);
            this.shadow = null;
        }
    }

    _buildOverlays() {
        const cleanOverlay = document.createElement("section");
        cleanOverlay.className = "karl-overlay";
        cleanOverlay.id = "karl-overlay";
        cleanOverlay.hidden = true;
        cleanOverlay.setAttribute("aria-hidden", "true");
        cleanOverlay.innerHTML = `
            <div class="karl-card">
                <header>
                    <div>
                        <p>Bonus-Event</p>
                        <strong>${KARL_NAME}</strong>
                    </div>
                    <button type="button" class="karl-abort" data-karl-abort>Schließen</button>
                </header>
                <p class="karl-hint">Putz Karls Panzer sauber — wisch den Dreck mit dem Finger oder der Maus weg.</p>
                <div class="karl-stage">
                    <img class="karl-image" src="${KARL_IMAGE_SRC}" alt="${KARL_NAME}" draggable="false">
                    <canvas class="karl-canvas" data-karl-canvas></canvas>
                </div>
                <div class="karl-progress">
                    <span class="karl-progress-label">Sauberkeit</span>
                    <div class="karl-progress-bar"><span data-karl-progress></span></div>
                </div>
            </div>
        `;
        document.body.append(cleanOverlay);
        this.cleanOverlay = cleanOverlay;
        cleanOverlay.querySelector("[data-karl-abort]").addEventListener("click", () => this._closeCleaning(false));

        const wheelOverlay = document.createElement("section");
        wheelOverlay.className = "karl-wheel-overlay";
        wheelOverlay.id = "karl-wheel-overlay";
        wheelOverlay.hidden = true;
        wheelOverlay.setAttribute("aria-hidden", "true");
        wheelOverlay.innerHTML = `
            <div class="karl-wheel-card">
                <header>
                    <div>
                        <p>Glücksrad</p>
                        <strong>Drehen für deine Belohnung</strong>
                    </div>
                </header>
                <div class="karl-wheel-stage">
                    <div class="karl-wheel" data-karl-wheel></div>
                    <div class="karl-wheel-pointer" aria-hidden="true"></div>
                </div>
                <button type="button" class="karl-wheel-spin" data-karl-spin>Drehen</button>
            </div>
        `;
        document.body.append(wheelOverlay);
        this.wheelOverlay = wheelOverlay;
        wheelOverlay.querySelector("[data-karl-spin]").addEventListener("click", () => this._spinWheel());

        // --- Reward-Popup (zeigt sich nach dem Spin) ---
        const rewardPopup = document.createElement("section");
        rewardPopup.className = "karl-reward-popup";
        rewardPopup.id = "karl-reward-popup";
        rewardPopup.hidden = true;
        rewardPopup.setAttribute("aria-hidden", "true");
        rewardPopup.innerHTML = `
            <div class="karl-reward-card" data-karl-reward-card>
                <div class="karl-reward-burst" aria-hidden="true"></div>
                <p class="karl-reward-kicker">Karl schenkt dir</p>
                <strong class="karl-reward-title" data-karl-reward-title>—</strong>
                <p class="karl-reward-sub" data-karl-reward-sub></p>
                <button type="button" class="karl-reward-claim" data-karl-claim>Einsammeln</button>
            </div>
        `;
        document.body.append(rewardPopup);
        this.rewardPopup = rewardPopup;
        rewardPopup.querySelector("[data-karl-claim]").addEventListener("click", () => this._claimReward());
    }

    async _openCleaning() {
        this.cleanOverlay.hidden = false;
        this.cleanOverlay.setAttribute("aria-hidden", "false");
        this.options.onOpenCleaning?.();
        // Canvas Setup
        const canvas = this.cleanOverlay.querySelector("[data-karl-canvas]");
        // Ein Frame Verzögerung damit das Overlay layoutet und getBoundingClientRect echte Maße liefert.
        await new Promise((r) => requestAnimationFrame(r));
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(200, Math.floor(rect.width * dpr));
        canvas.height = Math.max(200, Math.floor(rect.height * dpr));
        const ctx = canvas.getContext("2d");

        // Schmutz = Karl-Silhouette in dreckigem Braun/Grün. Nur sein Panzer ist bedeckt,
        // nicht das ganze Canvas. Sieht aus wie eine echte Schmutzschicht.
        const img = await loadKarlImage().catch(() => null);
        if (img) {
            // Karl-Bild mit object-fit:contain Logik einpassen (gleiche Geometrie wie das Background-IMG).
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const cAspect = canvas.width / canvas.height;
            let drawW, drawH, drawX, drawY;
            if (imgAspect > cAspect) {
                drawW = canvas.width;
                drawH = canvas.width / imgAspect;
            } else {
                drawH = canvas.height;
                drawW = canvas.height * imgAspect;
            }
            drawX = (canvas.width - drawW) / 2;
            drawY = (canvas.height - drawH) / 2;
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            // Pixel auf dreckiges Braun/Grün-Olive tonen — über source-atop bleibt der Alpha-Kanal.
            ctx.globalCompositeOperation = "source-atop";
            const tintGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            tintGrad.addColorStop(0.0, "rgba(56, 36, 14, 0.92)");
            tintGrad.addColorStop(0.4, "rgba(46, 56, 18, 0.94)");
            tintGrad.addColorStop(0.7, "rgba(40, 26, 10, 0.92)");
            tintGrad.addColorStop(1.0, "rgba(34, 44, 12, 0.94)");
            ctx.fillStyle = tintGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Etwas Textur-Noise auf den Dreck (zufällige dunkle Tupfen, aber im Silhouetten-Layer)
            for (let i = 0; i < 50; i++) {
                const x = drawX + Math.random() * drawW;
                const y = drawY + Math.random() * drawH;
                const r = (3 + Math.random() * 14) * dpr;
                const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                grad.addColorStop(0, "rgba(20, 14, 4, 0.7)");
                grad.addColorStop(1, "rgba(20, 14, 4, 0)");
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = "source-over";
        }

        // Initial-Dreck via Grid-Sampling zählen (selbe Methode wie _sampleProgress
        // damit das Verhältnis sauber rechnet).
        const step = 6;
        const data0 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let initialDirty = 0;
        for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
                const idx = (y * canvas.width + x) * 4 + 3;
                if (data0[idx] > 30) initialDirty++;
            }
        }

        this.cleaning = { canvas, ctx, initialDirty: Math.max(1, initialDirty), finished: false };
        this._updateProgress(0);
        this._bindCleaningInput();
    }

    _bindCleaningInput() {
        const canvas = this.cleaning.canvas;
        let drawing = false;
        const erase = (event) => {
            if (!this.cleaning || this.cleaning.finished) return;
            const rect = canvas.getBoundingClientRect();
            const cx = ((event.clientX - rect.left) / rect.width) * canvas.width;
            const cy = ((event.clientY - rect.top) / rect.height) * canvas.height;
            const r = BRUSH_RADIUS_REL * canvas.width;
            const ctx = this.cleaning.ctx;
            ctx.save();
            // WICHTIG: opaker fillStyle setzen — destination-out löscht nur dort wo der
            // Erase-Stroke Alpha > 0 hat. Vorheriger Gradient-fillStyle vom Setup hatte
            // ausserhalb seines Ursprungs Alpha = 0 → nichts wurde gelöscht.
            ctx.fillStyle = "#000";
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            this._sampleProgress();
        };
        const onDown = (event) => {
            event.preventDefault();
            canvas.setPointerCapture?.(event.pointerId);
            drawing = true;
            erase(event);
        };
        const onMove = (event) => { if (drawing) { event.preventDefault(); erase(event); } };
        const onUp = () => { drawing = false; };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("pointerleave", onUp);
        // iOS Lupe verhindern
        canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
        canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        canvas.addEventListener("selectstart", (e) => e.preventDefault());
    }

    _sampleProgress() {
        // Sample auf grobem Grid (performance), nicht jedes Pixel.
        if (!this.cleaning) return;
        const c = this.cleaning.canvas;
        const ctx = this.cleaning.ctx;
        const step = 6;
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let dirty = 0;
        for (let y = 0; y < c.height; y += step) {
            for (let x = 0; x < c.width; x += step) {
                const idx = (y * c.width + x) * 4 + 3;
                if (data[idx] > 30) dirty++;
            }
        }
        // Sauberkeit = wieviel vom ursprünglichen Dreck weg ist.
        const cleanRatio = Math.max(0, Math.min(1, 1 - dirty / this.cleaning.initialDirty));
        this._updateProgress(cleanRatio);
        if (cleanRatio >= CLEAN_TOLERANCE && !this.cleaning.finished) {
            this.cleaning.finished = true;
            this._updateProgress(1);
            window.setTimeout(() => this._finishCleaning(), 400);
        }
    }

    _updateProgress(ratio) {
        const bar = this.cleanOverlay.querySelector("[data-karl-progress]");
        if (bar) bar.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
    }

    _finishCleaning() {
        // Erst die Erfolgs-Animation laufen lassen, dann Overlay schließen + Wheel öffnen.
        const card = this.cleanOverlay.querySelector(".karl-card");
        card?.classList.add("is-celebrating");
        // Dreck-Canvas ausblenden via CSS (siehe styles.css → .is-celebrating .karl-canvas)
        // Nach Animations-Ende (~1.4 s) schließen und Wheel mit kleiner Pause öffnen.
        window.setTimeout(() => {
            card?.classList.remove("is-celebrating");
            this.cleanOverlay.hidden = true;
            this.cleanOverlay.setAttribute("aria-hidden", "true");
            window.setTimeout(() => this._openWheel(), 420);
        }, 1400);
    }

    _closeCleaning(success) {
        this.cleanOverlay.hidden = true;
        this.cleanOverlay.setAttribute("aria-hidden", "true");
        this.cleaning = null;
        if (!success) {
            this.options.onClose?.();
        }
    }

    _openWheel() {
        this.wheelOverlay.hidden = false;
        this.wheelOverlay.setAttribute("aria-hidden", "false");
        const areaId = this.options.getCurrentArea?.() || "pond";
        const segments = KARL_REWARDS_BY_AREA[areaId] || KARL_REWARDS_BY_AREA.pond;
        this.wheelSegments = segments;
        this._renderWheel(segments);
        this.pendingReward = null;
        this.wheelOverlay.querySelector("[data-karl-spin]").hidden = false;
    }

    _renderWheel(segments) {
        const wheel = this.wheelOverlay.querySelector("[data-karl-wheel]");
        const totalWeight = segments.reduce((s, e) => s + e.weight, 0);
        // Neon-Palette mit kräftigen Farben für epicer Look.
        const colors = [
            { fill: "#0ea5e9", glow: "#7dd3fc" }, // cyan
            { fill: "#a855f7", glow: "#d8b4fe" }, // purple
            { fill: "#22c55e", glow: "#86efac" }, // green
            { fill: "#f59e0b", glow: "#fcd34d" }, // amber
            { fill: "#f43f5e", glow: "#fda4af" }, // rose
            { fill: "#06b6d4", glow: "#67e8f9" }, // teal
            { fill: "#eab308", glow: "#fde68a" }, // yellow
            { fill: "#ec4899", glow: "#f9a8d4" }, // pink
        ];
        // Conic-Gradient mit harten Übergängen — Sektoren klar abgegrenzt.
        let acc = 0;
        const stops = [];
        const segMeta = [];
        segments.forEach((seg, i) => {
            const start = (acc / totalWeight) * 360;
            acc += seg.weight;
            const end = (acc / totalWeight) * 360;
            const c = colors[i % colors.length];
            stops.push(`${c.fill} ${start}deg ${end}deg`);
            segMeta.push({ start, end, mid: (start + end) / 2, c, label: seg.wheelLabel || seg.label });
        });
        wheel.style.background = `conic-gradient(from 0deg, ${stops.join(", ")})`;
        wheel.style.transform = "rotate(0deg)";
        wheel.dataset.spinning = "false";

        // Labels über Trig korrekt im Sektor positionieren (~38% Radius vom Mittelpunkt).
        const labelLayer = document.createElement("div");
        labelLayer.className = "karl-wheel-labels";
        const radiusPct = 36; // % vom Wheel-Durchmesser, gemessen vom Zentrum
        segMeta.forEach((meta) => {
            // 0deg ist im conic-gradient oben → cos/sin müssen entsprechend rotiert sein.
            const rad = (meta.mid - 90) * Math.PI / 180;
            const x = 50 + radiusPct * Math.cos(rad);
            const y = 50 + radiusPct * Math.sin(rad);
            const label = document.createElement("span");
            label.className = "karl-wheel-label";
            label.style.left = `${x}%`;
            label.style.top = `${y}%`;
            // Text leicht in Richtung Sektor-Mitte drehen damit es radial wirkt.
            label.style.setProperty("--label-rot", `${meta.mid}deg`);
            label.style.setProperty("--label-glow", meta.c.glow);
            label.textContent = meta.label;
            labelLayer.append(label);
        });
        const oldLabels = wheel.querySelector(".karl-wheel-labels");
        if (oldLabels) oldLabels.remove();
        wheel.append(labelLayer);

        // Sektor-Trennlinien als SVG-Overlay für saubere Neon-Edges.
        const oldDividers = wheel.querySelector(".karl-wheel-dividers");
        if (oldDividers) oldDividers.remove();
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "-50 -50 100 100");
        svg.setAttribute("class", "karl-wheel-dividers");
        segMeta.forEach((meta) => {
            const angRad = (meta.start - 90) * Math.PI / 180;
            const x2 = 49 * Math.cos(angRad);
            const y2 = 49 * Math.sin(angRad);
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", "0");
            line.setAttribute("y1", "0");
            line.setAttribute("x2", String(x2));
            line.setAttribute("y2", String(y2));
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.78)");
            line.setAttribute("stroke-width", "0.4");
            line.setAttribute("stroke-linecap", "round");
            svg.append(line);
        });
        // Zentral-Hub
        const hub = document.createElementNS(svgNS, "circle");
        hub.setAttribute("cx", "0");
        hub.setAttribute("cy", "0");
        hub.setAttribute("r", "5");
        hub.setAttribute("fill", "#0a0703");
        hub.setAttribute("stroke", "#ffd166");
        hub.setAttribute("stroke-width", "1");
        svg.append(hub);
        wheel.append(svg);
    }

    _spinWheel() {
        const wheel = this.wheelOverlay.querySelector("[data-karl-wheel]");
        if (wheel.dataset.spinning === "true") return;
        wheel.dataset.spinning = "true";
        this.wheelOverlay.querySelector("[data-karl-spin]").hidden = true;

        const segments = this.wheelSegments;
        const picked = weightedPick(segments);
        const pickIndex = segments.indexOf(picked);
        const totalWeight = segments.reduce((s, e) => s + e.weight, 0);
        let acc = 0;
        for (let i = 0; i < pickIndex; i++) acc += segments[i].weight;
        const segStart = (acc / totalWeight) * 360;
        const segEnd = ((acc + picked.weight) / totalWeight) * 360;
        const segMid = (segStart + segEnd) / 2;
        // Pointer steht oben (0deg) — Sektor-Mitte muss auf 0deg landen.
        // Viel mehr Schwung als vorher: 16-20 Umdrehungen in 7.2 s = deutlich mehr Spannung.
        const fullSpins = 16 + Math.floor(Math.random() * 5); // 16-20 ganze Umdrehungen
        const segSpread = (segEnd - segStart) * 0.4;
        const finalOffset = segMid + (Math.random() - 0.5) * segSpread;
        const targetRotation = fullSpins * 360 + (360 - finalOffset);
        const durationSec = 7.2;
        const easing = "cubic-bezier(0.08, 0.88, 0.16, 1)";
        // Spin: dreht UND wächst gleichzeitig auf scale(1.1) — Spannungs-Build-up.
        wheel.style.transition = `transform ${durationSec}s ${easing}`;
        wheel.style.transform = `rotate(${targetRotation}deg) scale(1.1)`;

        // Labels werden mit der gleichen Transition entgegengesetzt rotiert →
        // sie bleiben immer aufrecht / lesbar während des Spins. Counter-Scale damit
        // die Schrift nicht mit dem Wheel mitwächst (Lesbarkeit > Spannung an der Stelle).
        const labels = wheel.querySelectorAll(".karl-wheel-label");
        labels.forEach((l) => {
            l.style.transition = `transform ${durationSec}s ${easing}`;
            l.style.transform = `translate(-50%, -50%) rotate(${-targetRotation}deg) scale(${1 / 1.1})`;
        });

        // Nach Spin-Ende: Wheel sanft zurück auf scale(1) — als „Atem-Pause" vor dem Popup.
        window.setTimeout(() => {
            wheel.style.transition = "transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1)";
            wheel.style.transform = `rotate(${targetRotation}deg) scale(1)`;
            labels.forEach((l) => {
                l.style.transition = "transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1)";
                l.style.transform = `translate(-50%, -50%) rotate(${-targetRotation}deg) scale(1)`;
            });
        }, durationSec * 1000);

        this.pendingReward = picked;
        // Popup öffnet erst nach Spin + Shrink-Back (~550 ms) + Mini-Pause.
        window.setTimeout(() => this._afterSpin(), durationSec * 1000 + 750);
    }

    _afterSpin() {
        // Wheel ist schon zurückgeschrumpft und steht still — Wheel-Overlay schließen
        // und episches Reward-Popup öffnen.
        this.wheelOverlay.hidden = true;
        this.wheelOverlay.setAttribute("aria-hidden", "true");
        this._openRewardPopup(this.pendingReward);
    }

    _openRewardPopup(reward) {
        if (!reward) return;
        const popup = this.rewardPopup;
        const card = popup.querySelector("[data-karl-reward-card]");
        const title = popup.querySelector("[data-karl-reward-title]");
        const sub = popup.querySelector("[data-karl-reward-sub]");

        // Rarity → Theme-Farbe für den Card-Glow
        let theme = "gold";
        if (reward.type === "spawn" && reward.rarity === "Epic") theme = "epic";
        if (reward.type === "spawn" && reward.rarity === "Legendary") theme = "legendary";
        card.dataset.theme = theme;

        // Titel + Subtitel je nach Reward-Typ
        if (reward.type === "spawn") {
            title.textContent = `${reward.rarity}-Fischstelle!`;
            sub.textContent = "Eine garantierte Top-Stelle taucht gleich auf — schnapp sie dir!";
        } else if (reward.type === "coins-fixed") {
            title.textContent = `+${reward.amount.toLocaleString("de-DE")} Coins`;
            sub.textContent = "Direkt im Geldbeutel.";
        } else {
            title.textContent = reward.label || "Belohnung";
            sub.textContent = "";
        }

        popup.hidden = false;
        popup.setAttribute("aria-hidden", "false");
        // Reset Animation-Class damit sie bei wiederholtem Öffnen feuert.
        card.classList.remove("is-popping");
        // Force reflow → erlaubt re-trigger der Animation
        void card.offsetWidth;
        card.classList.add("is-popping");
    }

    _claimReward() {
        const reward = this.pendingReward;
        this.wheelOverlay.hidden = true;
        this.wheelOverlay.setAttribute("aria-hidden", "true");
        if (this.rewardPopup) {
            this.rewardPopup.hidden = true;
            this.rewardPopup.setAttribute("aria-hidden", "true");
        }
        this.pendingReward = null;
        if (!reward) {
            this.options.onClose?.();
            return;
        }
        this.options.onReward?.(reward);
    }
}
