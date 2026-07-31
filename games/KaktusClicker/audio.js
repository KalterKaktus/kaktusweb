// Sound für KaktusClicker — komplett synthetisiert, keine Audio-Dateien.
//
// Warum synthetisiert statt Samples: der Klick-Sound feuert im Spitzenfall
// zehnmal pro Sekunde. Ein immer identisches Sample wird bei der Frequenz
// schnell zur Nervensäge, während sich synthetisierte Töne pro Klick minimal in
// Tonhöhe und Lautstärke unterscheiden lassen. Dazu kommt: die alten Audio-
// Dateien waren mit 5 MB das schwerste Asset des Spiels (siehe CLAUDE.md), und
// Netlify-Build-Credits sind knapp. Diese Datei wiegt ein paar Kilobyte.
//
// Klangbild passend zum Cozy-Look: nur Sinus und Dreieck (Sägezahn und Rechteck
// klingen hart), weiche Anschläge, alles durch ein Tiefpassfilter. Nichts soll
// schneiden.

const STORAGE_KEY = "kaktus-clicker-audio";
const MAX_VOICES = 14;
// Schneller als das kann ein Mensch nicht sinnvoll hören, und es deckelt das
// Stimmen-Budget bei Dauerklicken.
const CLICK_MIN_GAP_MS = 28;

const settings = { enabled: true, volume: 0.6 };

let ctx = null;
let master = null;
let activeVoices = 0;
let lastClickAt = 0;

// --- Einstellungen ---------------------------------------------------------

// Bewusst in localStorage und NICHT im Spielstand: Lautstärke ist eine
// Geräte-Einstellung, kein Spielfortschritt. Im Spielstand gelandet würde sie
// über die Cloud auf andere Geräte wandern und müsste durch die Server-Trigger.
function loadSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (typeof raw.enabled === "boolean") settings.enabled = raw.enabled;
        if (Number.isFinite(raw.volume)) settings.volume = Math.min(1, Math.max(0, raw.volume));
    } catch (error) {
        // Kaputter Eintrag: Voreinstellung behalten, nicht das Spiel aufhalten.
    }
}

function persistSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        // Privater Modus o.ä. — Ton funktioniert trotzdem, nur ohne Merken.
    }
}

loadSettings();

export function getAudioSettings() {
    return { ...settings };
}

function applyMasterGain() {
    if (!master || !ctx) return;
    const target = settings.enabled ? settings.volume : 0;
    // Kurze Rampe statt harter Sprung — sonst knackt es beim Stummschalten.
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
}

export function setAudioEnabled(enabled) {
    settings.enabled = Boolean(enabled);
    persistSettings();
    if (settings.enabled) unlockAudio();
    applyMasterGain();
}

export function setAudioVolume(volume) {
    settings.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    persistSettings();
    applyMasterGain();
}

// --- Audio-Graph -----------------------------------------------------------

function ensureContext() {
    if (ctx) return ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    try {
        ctx = new Ctx();
    } catch (error) {
        return null;
    }

    master = ctx.createGain();
    master.gain.value = settings.enabled ? settings.volume : 0;

    // Sanfter Begrenzer. Beim Dauerklicken überlappen sich bis zu einem Dutzend
    // Stimmen; ohne den würde die Summe übersteuern und krachen.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 24;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.18;

    master.connect(limiter);
    limiter.connect(ctx.destination);
    return ctx;
}

// Browser starten den AudioContext ausgesetzt, bis der Nutzer die Seite einmal
// angefasst hat. Wird aus game.js beim ersten Pointer-/Tastendruck gerufen.
export function unlockAudio() {
    const context = ensureContext();
    if (context && context.state === "suspended") {
        context.resume().catch(() => {});
    }
}

/**
 * Ein Ton. Alles andere in dieser Datei ist eine Kombination daraus.
 *
 * freq/toFreq  Grundton, optional gleitend
 * type         "sine" | "triangle"
 * attack       Anschlagzeit — unter ~3 ms klickt es hörbar
 * duration     Zeit bis zur Stille
 * cutoff       Tiefpass; nimmt den Obertönen die Schärfe
 */
function tone({
    freq,
    toFreq = 0,
    type = "sine",
    gain = 0.2,
    attack = 0.006,
    duration = 0.18,
    cutoff = 2600,
    delay = 0,
    detune = 0,
}) {
    if (!ctx || !master) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, start + duration);
    if (detune) osc.detune.setValueAtTime(detune, start);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, start);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(gain, start + attack);
    // Exponentiell klingt natürlicher als linear, darf aber nie exakt 0
    // erreichen — deshalb der Restwert und ein hartes Stop danach.
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);

    activeVoices += 1;
    osc.onended = () => {
        activeVoices -= 1;
        envelope.disconnect();
        filter.disconnect();
    };
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

// --- Die Sounds ------------------------------------------------------------

// Klick: ein weiches Holz-"tok". Muss dezent bleiben, er kommt am häufigsten.
// Die Tonhöhe streut leicht, damit Dauerklicken nicht wie ein Maschinengewehr
// klingt, und ein tieferer Körper darunter gibt ihm Gewicht ohne Schärfe.
function playClick() {
    const wobble = 0.94 + Math.random() * 0.12;
    tone({ freq: 660 * wobble, type: "sine", gain: 0.075, duration: 0.07, cutoff: 2400 });
    tone({ freq: 220 * wobble, type: "triangle", gain: 0.045, duration: 0.1, cutoff: 900 });
}

// Gebäude gekauft: aufsteigende Quinte, warm und rund.
function playBuyBuilding() {
    tone({ freq: 392, type: "sine", gain: 0.13, duration: 0.14, cutoff: 2200 });
    tone({ freq: 587.33, type: "sine", gain: 0.12, duration: 0.2, cutoff: 2400, delay: 0.06 });
    tone({ freq: 196, type: "triangle", gain: 0.06, duration: 0.24, cutoff: 800 });
}

// Upgrade gekauft: heller als der Gebäude-Kauf, damit man die beiden
// auseinanderhält — Dur-Dreiklang aufwärts.
function playBuyUpgrade() {
    [523.25, 659.25, 783.99].forEach((freq, index) => {
        tone({ freq, type: "sine", gain: 0.1, duration: 0.16, cutoff: 3000, delay: index * 0.05 });
    });
}

// Menü-Navigation: der leiseste Sound im Spiel. Nur eine kurze Bestätigung.
function playTab() {
    tone({ freq: 523.25, type: "sine", gain: 0.05, duration: 0.05, cutoff: 2000 });
}

// Goldkaktus erscheint: glockiges Arpeggio aufwärts, klingt lange nach.
function playGoldenSpawn() {
    [783.99, 987.77, 1318.51].forEach((freq, index) => {
        tone({ freq, type: "sine", gain: 0.11, attack: 0.01, duration: 0.5, cutoff: 4200, delay: index * 0.07 });
        // Leiser Oberton eine Oktave höher — das macht den Glockencharakter.
        tone({ freq: freq * 2, type: "sine", gain: 0.025, attack: 0.012, duration: 0.36, cutoff: 5200, delay: index * 0.07 });
    });
}

// Rubinkaktus erscheint: tiefer, langsamer, seltener — soll sich nach etwas
// Besonderem anfühlen statt nach "Goldkaktus, nur anders".
function playRubySpawn() {
    tone({ freq: 110, type: "sine", gain: 0.09, attack: 0.05, duration: 0.9, cutoff: 600 });
    [329.63, 493.88, 659.25].forEach((freq, index) => {
        tone({ freq, type: "triangle", gain: 0.1, attack: 0.03, duration: 0.7, cutoff: 1800, delay: index * 0.1 });
    });
    tone({ freq: 987.77, type: "sine", gain: 0.045, attack: 0.02, duration: 0.6, cutoff: 4000, delay: 0.3 });
}

const SOUNDS = {
    click: playClick,
    "buy-building": playBuyBuilding,
    "buy-upgrade": playBuyUpgrade,
    tab: playTab,
    "golden-spawn": playGoldenSpawn,
    "ruby-spawn": playRubySpawn,
};

// Klick und Menü sind verzichtbar, wenn gerade viel los ist. Die
// Erscheinen-Sounds nicht — die sind der Grund, warum man hinschaut.
const LOW_PRIORITY = new Set(["click", "tab"]);

export function playSound(name) {
    if (!settings.enabled || settings.volume <= 0) return;
    // Kein Ton aus einem Hintergrund-Tab. Die Autoklicker laufen dort ohnehin
    // nicht, aber Server-Events könnten sonst aus dem Nichts Krach machen.
    if (document.hidden) return;

    const sound = SOUNDS[name];
    if (!sound) return;

    if (name === "click") {
        const now = performance.now();
        if (now - lastClickAt < CLICK_MIN_GAP_MS) return;
        lastClickAt = now;
    }

    if (activeVoices >= MAX_VOICES && LOW_PRIORITY.has(name)) return;

    const context = ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
        // Erster Ton vor der ersten Geste: anstoßen und diesen einen auslassen.
        unlockAudio();
        return;
    }

    try {
        sound();
    } catch (error) {
        console.warn("Sound fehlgeschlagen:", error);
    }
}
