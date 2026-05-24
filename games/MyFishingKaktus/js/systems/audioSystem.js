const STORAGE_KEY = "my-fishing-kaktus-audio-v1";
const DEFAULTS = { musicMuted: false, sfxMuted: false, musicVolume: 0.55, sfxVolume: 0.7 };
const MUSIC_SRC = "assets/audio/meditation-music-4-96k.mp3";
const REEL_SRC = "assets/audio/fishing-reel.mp3";

function clamp01(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
}

function loadSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (raw && typeof raw === "object") {
            return {
                musicMuted: Boolean(raw.musicMuted),
                sfxMuted: Boolean(raw.sfxMuted),
                musicVolume: clamp01(raw.musicVolume ?? DEFAULTS.musicVolume),
                sfxVolume: clamp01(raw.sfxVolume ?? DEFAULTS.sfxVolume),
            };
        }
    } catch {
        // ignore corrupt storage
    }
    return { ...DEFAULTS };
}

export class AudioSystem {
    constructor() {
        this.settings = loadSettings();
        this.ctx = null;
        this.musicBus = null;
        this.sfxBus = null;
        this.musicFilter = null;
        this.musicEl = null;
        this.musicSource = null;
        this.reelEl = null;
        this.reelSource = null;
        this.rainSource = null;
        this.rainFilter = null;
        this.rainGain = null;
    }

    unlock() {
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) {
                return;
            }
            this.ctx = new Ctx();
            this.musicBus = this.ctx.createGain();
            this.sfxBus = this.ctx.createGain();

            this.musicFilter = this.ctx.createBiquadFilter();
            this.musicFilter.type = "lowpass";
            this.musicFilter.frequency.value = 22050;
            this.musicFilter.Q.value = 0.7;

            this.musicBus.connect(this.musicFilter);
            this.musicFilter.connect(this.ctx.destination);
            this.sfxBus.connect(this.ctx.destination);

            this.initMusicLoop();
            this.initReelLoop();
            this.applyVolumes();
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
        this.playMusicIfAllowed();
    }

    initMusicLoop() {
        if (this.musicEl || !this.ctx) {
            return;
        }
        this.musicEl = new Audio(MUSIC_SRC);
        this.musicEl.loop = true;
        this.musicEl.preload = "metadata";
        this.musicSource = this.ctx.createMediaElementSource(this.musicEl);
        this.musicSource.connect(this.musicBus);
    }

    initReelLoop() {
        if (this.reelEl || !this.ctx) {
            return;
        }
        this.reelEl = new Audio(REEL_SRC);
        this.reelEl.loop = true;
        this.reelEl.preload = "metadata";
        this.reelSource = this.ctx.createMediaElementSource(this.reelEl);
        this.reelSource.connect(this.sfxBus);
    }

    playAudioElement(el) {
        if (!el) {
            return;
        }
        const play = el.play();
        if (play && typeof play.catch === "function") {
            play.catch(() => {});
        }
    }

    playMusicIfAllowed() {
        if (this.settings.musicMuted) {
            return;
        }
        this.playAudioElement(this.musicEl);
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch {
            // ignore storage failures
        }
    }

    applyVolumes() {
        if (!this.ctx) {
            return;
        }
        const music = this.settings.musicMuted ? 0 : this.settings.musicVolume * 0.46;
        const sfx = this.settings.sfxMuted ? 0 : this.settings.sfxVolume * 0.9;
        this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.06);
        this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
    }

    setMusicMuted(muted) {
        this.settings.musicMuted = Boolean(muted);
        this.applyVolumes();
        if (this.settings.musicMuted) {
            this.musicEl?.pause();
        } else {
            this.playMusicIfAllowed();
        }
        this.save();
    }

    setSfxMuted(muted) {
        this.settings.sfxMuted = Boolean(muted);
        this.applyVolumes();
        if (this.settings.sfxMuted) {
            this.pauseReel();
        }
        this.save();
    }

    setMusicVolume(value) {
        this.settings.musicVolume = clamp01(value);
        this.applyVolumes();
        this.playMusicIfAllowed();
        this.save();
    }

    setSfxVolume(value) {
        this.settings.sfxVolume = clamp01(value);
        this.applyVolumes();
        this.save();
    }

    playReel() {
        this.unlock();
        if (this.settings.sfxMuted) {
            return;
        }
        this.playAudioElement(this.reelEl);
    }

    pauseReel() {
        this.reelEl?.pause();
    }

    blip({ type = "sine", from, to, peak, attack = 0.014, duration, delay = 0 }) {
        if (!this.ctx) {
            return;
        }
        const time = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(from, time);
        if (to && to !== from) {
            osc.frequency.exponentialRampToValueAtTime(to, time + duration);
        }
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(peak, time + attack);
        gain.gain.exponentialRampToValueAtTime(0.0006, time + duration);
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(time);
        osc.stop(time + duration + 0.05);
    }

    playCast() {
        this.blip({ type: "sine", from: 720, to: 200, peak: 0.5, duration: 0.26 });
        this.blip({ type: "sine", from: 1500, to: 900, peak: 0.12, duration: 0.1, delay: 0.005 });
    }

    playCatch() {
        [523.25, 659.25, 783.99].forEach((freq, index) => {
            this.blip({ type: "sine", from: freq, to: freq, peak: 0.42, duration: 0.5, delay: index * 0.1 });
        });
    }

    playEscape() {
        this.blip({ type: "sine", from: 392.0, to: 392.0, peak: 0.34, duration: 0.34 });
        this.blip({ type: "sine", from: 311.13, to: 311.13, peak: 0.32, duration: 0.42, delay: 0.14 });
    }

    playSell() {
        [784.0, 1046.5, 1318.5].forEach((freq, index) => {
            this.blip({ type: "triangle", from: freq, to: freq, peak: 0.32, duration: 0.26, delay: index * 0.07 });
        });
    }

    playUiClick() {
        this.blip({ type: "triangle", from: 1320, to: 880, peak: 0.22, duration: 0.08, attack: 0.004 });
    }

    playUiToggle() {
        this.blip({ type: "sine", from: 660, to: 990, peak: 0.2, duration: 0.1, attack: 0.005 });
    }

    playBuy() {
        this.blip({ type: "triangle", from: 988, to: 988, peak: 0.32, duration: 0.18, attack: 0.006 });
        this.blip({ type: "triangle", from: 1318, to: 1318, peak: 0.3, duration: 0.34, attack: 0.008, delay: 0.07 });
        this.blip({ type: "sine", from: 1976, to: 1976, peak: 0.14, duration: 0.5, attack: 0.012, delay: 0.07 });
    }

    playSpotEmerge() {
        this.blip({ type: "sine", from: 240, to: 480, peak: 0.26, duration: 0.18, attack: 0.005 });
        this.blip({ type: "sine", from: 900, to: 1200, peak: 0.10, duration: 0.10, attack: 0.004, delay: 0.02 });
    }

    playSplash() {
        this.playSpotEmerge();
    }

    setEventMood(type) {
        if (!this.ctx || !this.musicFilter) {
            return;
        }
        const cutoff = {
            sunny: 22050,
            rain: 5200,
            storm: 3000,
            fog: 3600,
            night: 1800,
        };
        const target = (type && cutoff[type] != null) ? cutoff[type] : 22050;
        this.musicFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    }

    _initRainAmbient() {
        if (this.rainSource || !this.ctx) {
            return;
        }
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * 2));
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.rainSource = this.ctx.createBufferSource();
        this.rainSource.buffer = buffer;
        this.rainSource.loop = true;
        this.rainFilter = this.ctx.createBiquadFilter();
        this.rainFilter.type = "bandpass";
        this.rainFilter.frequency.value = 3600;
        this.rainFilter.Q.value = 0.6;
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0;
        this.rainSource.connect(this.rainFilter);
        this.rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.sfxBus);
        this.rainSource.start();
    }

    setRainAmbient(intensity) {
        if (!this.ctx) {
            return;
        }
        this._initRainAmbient();
        if (!this.rainGain) {
            return;
        }
        const v = Math.max(0, Math.min(1, Number(intensity) || 0)) * 0.22;
        this.rainGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.7);
    }

    playPrestige() {
        [392.0, 523.25, 659.25, 783.99].forEach((freq, index) => {
            this.blip({ type: "triangle", from: freq, to: freq, peak: 0.44, duration: 0.66, delay: index * 0.13 });
        });
        [1046.5, 1318.5, 1568.0].forEach((freq) => {
            this.blip({ type: "sine", from: freq, to: freq, peak: 0.3, duration: 1.5, delay: 0.56 });
        });
        this.blip({ type: "sine", from: 196.0, to: 196.0, peak: 0.34, duration: 1.7, delay: 0.5 });
    }
}
