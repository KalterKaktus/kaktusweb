// WaterSystem — WebGL-Fragment-Shader für .water-stage.
//
// Mechanik adaptiert aus dem Lure-Shader-Referenzwallpaper:
//   - FBM-Noise base swell (Multi-Octave)
//   - Mouse-Hover-Ripple (kontinuierlich, sanft)
//   - Splash-Rings (expandierende Wellen vom Klick, mit Decay)
//   - Numerischer Gradient → gefaktes Normal → Caustics + Specular + Rim
//   - Sonnen-Glow + Mouse-Halo + Splash-Cores
//   - Tonemap + dezenter Filmgrain
//
// An dieses Spiel angepasst:
//   - Farben werden aus den CSS-Variablen --w-top/-mid/-deep/-floor gelesen
//     (Area-Switch via [data-area] funktioniert automatisch)
//   - Uniforms (waveIntensity, waterSpeed, glowIntensity, choppiness) lesen
//     die bestehenden --w-* Knobs → Presets bleiben funktional
//   - Canvas füllt nur .water-stage, nicht den Viewport
//   - pointer-events: none → fish-spot / coin-fish bleiben klickbar
//   - prefers-reduced-motion + body.reduce-fishing-motion: 1 Static-Frame, Loop stoppt
//   - Fallback: bei fehlendem WebGL bleibt der existierende CSS-Hintergrund sichtbar

const PRESETS = {
    calm: {
        waveIntensity: 1.0,
        rippleStrength: 1.0,
        stormMultiplier: 1.0,
        waterSpeed: 1.0,
        waveSize: 1.0,
        glowIntensity: 1.0,
        particleDensity: 1.0,
        lightRayIntensity: 1.0,
        shimmerStrength: 1.0,
        waterDistortion: 0.18,
        idleSplashes: false,
    },
    storm: {
        waveIntensity: 2.4,
        rippleStrength: 1.6,
        stormMultiplier: 2.0,
        waterSpeed: 2.1,
        waveSize: 0.8,
        glowIntensity: 0.7,
        particleDensity: 0.75,
        lightRayIntensity: 0.3,
        shimmerStrength: 1.4,
        waterDistortion: 0.75,
        idleSplashes: false,
    },
    deepsea: {
        waveIntensity: 0.55,
        rippleStrength: 0.85,
        stormMultiplier: 0.75,
        waterSpeed: 0.45,
        waveSize: 1.3,
        glowIntensity: 1.5,
        particleDensity: 1.5,
        lightRayIntensity: 0.18,
        shimmerStrength: 0.5,
        waterDistortion: 0.10,
        idleSplashes: false,
    },
    toxic: {
        waveIntensity: 1.1,
        rippleStrength: 1.1,
        stormMultiplier: 1.1,
        waterSpeed: 1.05,
        waveSize: 1.0,
        glowIntensity: 1.3,
        particleDensity: 1.4,
        lightRayIntensity: 0.65,
        shimmerStrength: 1.1,
        waterDistortion: 0.32,
        idleSplashes: false,
    },
    event: {
        waveIntensity: 1.3,
        rippleStrength: 1.4,
        stormMultiplier: 1.1,
        waterSpeed: 1.2,
        waveSize: 1.05,
        glowIntensity: 1.3,
        particleDensity: 1.2,
        lightRayIntensity: 1.2,
        shimmerStrength: 1.35,
        waterDistortion: 0.28,
        idleSplashes: false,
    },
    // Abyss: tiefer als deepsea, sehr langsam, fast kein Licht — fühlt sich
    // an wie ein bottomless trench. Visuell zusätzlich Night-Veil + Neon-Partikel.
    abyss: {
        waveIntensity: 0.42,
        rippleStrength: 0.85,
        stormMultiplier: 0.55,
        waterSpeed: 0.35,
        waveSize: 1.4,
        glowIntensity: 1.6,
        particleDensity: 1.8,
        lightRayIntensity: 0.08,
        shimmerStrength: 0.45,
        waterDistortion: 0.08,
        idleSplashes: false,
    },
};

const VERTEX_SRC = `
attribute vec2 a_pos;
void main(){
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;
uniform vec2  u_mouseVel;
uniform float u_hold;

uniform int   u_splashCount;
uniform vec3  u_splashes[12];   // xy = position px, z = startTime
uniform float u_splashAmp;

// Spiel-spezifisch
uniform float u_waveIntensity;
uniform float u_glowIntensity;
uniform float u_choppiness;
uniform float u_shimmer;
uniform float u_rain;          // 0..1 Regenstärke
uniform vec3  u_colSurface;    // --w-top, hellster Ton
uniform vec3  u_colShallow;    // --w-mid
uniform vec3  u_colMid;        // --w-deep
uniform vec3  u_colDeep;       // --w-floor, dunkelster Ton

// ---------- Noise ----------
vec2 hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float noise(in vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix( mix( dot(hash22(i+vec2(0.,0.)), f-vec2(0.,0.)),
                   dot(hash22(i+vec2(1.,0.)), f-vec2(1.,0.)), u.x),
              mix( dot(hash22(i+vec2(0.,1.)), f-vec2(0.,1.)),
                   dot(hash22(i+vec2(1.,1.)), f-vec2(1.,1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  mat2 r = mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<5;i++){
    v += a*noise(p);
    p = r*p*2.05;
    a *= 0.5;
  }
  return v;
}

// Liefert (posX, posY, age) für Regentropfen-Slot i.
// Jeder Slot hat eigene Periode und Phase → Tropfen treffen unregelmäßig ein.
vec3 rainDrop(int i, float t){
  float fi = float(i);
  float period = 1.4 + fract(sin(fi*12.9898)*43758.5453) * 0.9;
  float offset = fract(sin(fi*78.233)*43758.5453) * 4.0;
  float ts     = t + offset;
  float age    = mod(ts, period);
  float cycle  = floor(ts / period);
  vec2 hashIn  = vec2(fi, cycle);
  vec2 pos = vec2(
    fract(sin(dot(hashIn, vec2(127.1, 311.7))) * 43758.5453),
    fract(sin(dot(hashIn, vec2(269.5, 183.3))) * 43758.5453)
  ) * u_res;
  return vec3(pos, age);
}

// Höhenfeld h(x,y,t)
float height(vec2 p, float t){
  float h = 0.0;
  vec2 q = p*0.0022;
  h += fbm(q + vec2(t*0.05, t*0.03)) * 0.55;
  h += fbm(q*2.3 - vec2(t*0.08, -t*0.04)) * 0.30;
  h += fbm(q*5.0 + vec2(-t*0.02, t*0.07)) * 0.18;
  h *= u_waveIntensity;

  // Mouse-Hover-Ripple deaktiviert — nur Klicks erzeugen Effekte (siehe Splash-Loop).
  // (Variablen bleiben deklariert weil später im Frag für sun/halo verwendet.)
  vec2 md = p - u_mouse;
  float mr = length(md);
  float velMag = 0.0;
  float hoverAmp = 0.0;

  // Splashes — expandierende Ringe
  for(int i=0;i<12;i++){
    if(i>=u_splashCount) break;
    vec3 s = u_splashes[i];
    float age = t - s.z;
    if(age < 0.0 || age > 6.0) continue;
    vec2 d = p - s.xy;
    float r = length(d);
    float wave = r - age*340.0;
    float env  = exp(-age*0.55) * exp(-abs(wave)*0.012);
    float ring = sin(wave*0.10) * env;
    h += ring * 2.6 * u_splashAmp;
    h += exp(-r*0.02) * exp(-age*4.0) * 1.6 * u_splashAmp;
  }

  // Rain — wenige mittelgroße Tropfen statt vieler kleiner. Spart massiv GPU,
  // besonders im Sturm-Event. Loop-Count 22 → 8, dafür größere Ringe.
  if (u_rain > 0.001) {
    for (int i = 0; i < 8; i++) {
      vec3 drop = rainDrop(i, t);
      if (drop.z > 0.85) continue;
      vec2 dd = p - drop.xy;
      float dr = length(dd);
      float waveR = dr - drop.z * 190.0;
      float envR  = exp(-drop.z * 1.9) * exp(-abs(waveR) * 0.04);
      h += sin(waveR * 0.32) * envR * 0.55 * u_rain;
      h += exp(-dr * 0.07) * exp(-drop.z * 8.0) * 0.45 * u_rain;
    }
  }
  return h;
}

void main(){
  vec2 p = gl_FragCoord.xy;
  float t = u_time;

  // Choppiness verstärkt die Steigungs-Auflösung (= Sample-Distanz kleiner → schärfere Normalen).
  float e = mix(2.4, 1.0, clamp(u_choppiness, 0.0, 1.0));
  float h  = height(p, t);
  float hx = height(p + vec2(e,0.0), t);
  float hy = height(p + vec2(0.0,e), t);
  vec2 grad = vec2(hx - h, hy - h) / e;

  vec3 n = normalize(vec3(-grad*1.4, 1.0));

  // ----- Tiefen-Gradient aus den Area-Farben -----
  vec2 uv = p / u_res;
  // uv.y: 0 = unten (Tiefe), 1 = oben (Oberfläche)
  float depthMix = smoothstep(0.0, 1.0, uv.y*0.7 + 0.15);
  vec3 base = mix(u_colDeep, u_colMid, depthMix);
  base = mix(base, u_colShallow, smoothstep(0.45, 1.0, uv.y) * 0.6);
  base = mix(base, u_colSurface, smoothstep(0.82, 1.0, uv.y) * 0.35);

  // Sanfte Vignette zum Rand
  vec2 cc = uv - 0.5;
  float vig = smoothstep(0.95, 0.2, length(cc*vec2(1.4,1.0)));
  base *= mix(0.6, 1.0, vig);

  // ----- Caustics (Lichtnetz von oben) -----
  vec2 cuv = p*0.004 + grad*8.0;
  float c1 = fbm(cuv + vec2(t*0.18, -t*0.10));
  float c2 = fbm(cuv*1.7 - vec2(t*0.12, t*0.08));
  float caustic = pow( max(0.0, 1.0 - abs(c1 - c2)*3.2), 4.0 );
  vec3 causticCol = vec3(0.55, 0.95, 1.0) * caustic * 0.5 * u_shimmer;

  // ----- Specular / Himmel-Reflex -----
  vec3 lightDir = normalize(vec3(-0.35, -0.55, 0.85));
  float spec = pow(max(0.0, dot(n, lightDir)), 28.0);
  vec3 specCol = vec3(0.85, 0.97, 1.0) * spec * 1.1 * u_shimmer;

  // ----- Fresnel-artiger Rim aus Steigung -----
  float slope = clamp(length(grad)*1.8, 0.0, 1.0);
  vec3 rim = vec3(0.45, 0.80, 0.95) * slope * 0.32;

  // ----- Sonne oben-links als Ambient -----
  vec2 sunUV = uv - vec2(0.18, 0.85);
  float sunGlow = exp(-dot(sunUV,sunUV)*5.0) * 0.18 * u_glowIntensity;
  vec3 sun = vec3(1.0, 0.92, 0.75) * sunGlow;

  // ----- Mouse-Halo -----
  // Maus-Halo deaktiviert
  float halo = 0.0;
  vec3 haloCol = vec3(0.0);

  // ----- Splash-Cores -----
  vec3 splashGlow = vec3(0.0);
  for(int i=0;i<12;i++){
    if(i>=u_splashCount) break;
    vec3 s = u_splashes[i];
    float age = t - s.z;
    if(age < 0.0 || age > 1.6) continue;
    float r = length(p - s.xy);
    float core = exp(-r*0.025) * exp(-age*3.0);
    float ring = exp(-abs(r - age*340.0)*0.018) * exp(-age*0.9);
    splashGlow += vec3(0.8,0.97,1.0) * (core*0.7 + ring*0.35) * u_splashAmp;
  }

  // Rain splash cores — wenige große, helle Köpfchen. Matching auf die 8-Drop-Variante oben.
  if (u_rain > 0.001) {
    for (int i = 0; i < 8; i++) {
      vec3 drop = rainDrop(i, t);
      if (drop.z > 0.40) continue;
      float dr = length(p - drop.xy);
      float core = exp(-dr * 0.06) * exp(-drop.z * 7.5);
      splashGlow += vec3(0.7, 0.93, 1.0) * core * 0.34 * u_rain;
    }
  }

  vec3 col = base + causticCol + specCol + rim + sun + haloCol + splashGlow;

  // Höhen-Shading
  col += vec3(0.10,0.18,0.22) * clamp(h*0.32, -0.6, 0.6);

  // Filmgrain (sehr dezent)
  float g = (fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453) - 0.5) * 0.022;
  col += g;

  // Tonemap
  col = col / (1.0 + col*0.7);
  col = pow(col, vec3(0.92));

  gl_FragColor = vec4(col, 1.0);
}
`;

const MAX_SPLASHES = 12;

function camelToKebab(s) { return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()); }

function parseColor(str) {
    str = (str || "").trim();
    if (str.startsWith("#")) {
        if (str.length === 7) {
            return [
                parseInt(str.slice(1, 3), 16) / 255,
                parseInt(str.slice(3, 5), 16) / 255,
                parseInt(str.slice(5, 7), 16) / 255,
            ];
        }
        if (str.length === 4) {
            return [
                parseInt(str[1] + str[1], 16) / 255,
                parseInt(str[2] + str[2], 16) / 255,
                parseInt(str[3] + str[3], 16) / 255,
            ];
        }
    }
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const parts = m[1].split(",").map((s) => parseFloat(s));
        return [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255];
    }
    return [0.05, 0.2, 0.4];
}

function isMotionReduced() {
    return (
        document.body.classList.contains("reduce-fishing-motion") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export class WaterSystem {
    constructor(root, options = {}) {
        this.root = root;
        this.options = options;
        this._stopped = false;
        this._staticDone = false;
        this._lastFrame = 0;
        this._t0 = performance.now();

        // Pointer state
        this.mx = 0;
        this.my = 0;
        this.mvx = 0;
        this.mvy = 0;
        this.hold = 0;
        this.holding = false;

        // Splash-Ringpuffer.
        // Wichtig: jede Slot-Zeit (z) auf -1000 vorinitialisieren, sonst rendert
        // der Shader unbefüllte Slots an Position (0,0) als „Geister-Welle aus
        // der Ecke unten-links" beim ersten echten Splash.
        this.splashes = new Float32Array(MAX_SPLASHES * 3);
        for (let i = 0; i < MAX_SPLASHES; i++) {
            this.splashes[i * 3 + 2] = -1000;
        }
        this.splashHead = 0;
        this.splashesActive = false;

        // Idle-Splash-Steuerung (per Preset oder Runtime-Toggle)
        this._idleSplashesEnabled = false;

        // Weather
        this.rain = 0;

        // Idle-Splash-Timer
        this.lastInteract = performance.now();

        this._build();
        const ok = this._initGL();
        if (!ok) {
            // Kein WebGL → CSS-Hintergrund bleibt sichtbar; FX-Wrap raus.
            this.wrap.remove();
            this.wrap = null;
            return;
        }
        this._resize();
        this._readUniformsFromCSS();
        this._observeAttrs();
        this._bindEvents();
        this.setPreset("calm");

        this._frame = this._frame.bind(this);
        this._raf = requestAnimationFrame(this._frame);

        this._idleTimer = window.setInterval(() => this._idleSplashTick(), 1400);
    }

    /* ============================================================
       SETUP
       ============================================================ */

    _build() {
        this.root.querySelectorAll(":scope > .water-fx").forEach((el) => el.remove());

        const wrap = document.createElement("div");
        wrap.className = "water-fx";
        wrap.setAttribute("aria-hidden", "true");
        wrap.innerHTML = `<canvas class="water-fx-ocean"></canvas>`;
        this.root.prepend(wrap);
        this.wrap = wrap;
        this.canvas = wrap.querySelector(".water-fx-ocean");
    }

    _initGL() {
        const gl = this.canvas.getContext("webgl", {
            antialias: true,
            premultipliedAlpha: false,
            alpha: false,
            preserveDrawingBuffer: false,
        });
        if (!gl) return false;
        this.gl = gl;

        const compile = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                console.error("[WaterSystem] shader compile:", gl.getShaderInfoLog(sh));
                gl.deleteShader(sh);
                return null;
            }
            return sh;
        };

        const vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
        if (!vs || !fs) return false;

        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error("[WaterSystem] link:", gl.getProgramInfoLog(prog));
            return false;
        }
        this.prog = prog;
        gl.useProgram(prog);

        // Fullscreen quad
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );
        const a_pos = gl.getAttribLocation(prog, "a_pos");
        gl.enableVertexAttribArray(a_pos);
        gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

        this.u = {
            res: gl.getUniformLocation(prog, "u_res"),
            time: gl.getUniformLocation(prog, "u_time"),
            mouse: gl.getUniformLocation(prog, "u_mouse"),
            mouseVel: gl.getUniformLocation(prog, "u_mouseVel"),
            hold: gl.getUniformLocation(prog, "u_hold"),
            splashCount: gl.getUniformLocation(prog, "u_splashCount"),
            splashes: gl.getUniformLocation(prog, "u_splashes"),
            splashAmp: gl.getUniformLocation(prog, "u_splashAmp"),
            waveIntensity: gl.getUniformLocation(prog, "u_waveIntensity"),
            glowIntensity: gl.getUniformLocation(prog, "u_glowIntensity"),
            choppiness: gl.getUniformLocation(prog, "u_choppiness"),
            shimmer: gl.getUniformLocation(prog, "u_shimmer"),
            rain: gl.getUniformLocation(prog, "u_rain"),
            colSurface: gl.getUniformLocation(prog, "u_colSurface"),
            colShallow: gl.getUniformLocation(prog, "u_colShallow"),
            colMid: gl.getUniformLocation(prog, "u_colMid"),
            colDeep: gl.getUniformLocation(prog, "u_colDeep"),
        };

        // Init mouse position grob in der Mitte
        this.mx = this.canvas.width * 0.5;
        this.my = this.canvas.height * 0.5;

        return true;
    }

    _resize() {
        if (!this.gl) return;
        const rect = this.root.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        // dpr cappen, sonst killt's Mobile
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const W = Math.max(1, Math.floor(rect.width * dpr));
        const H = Math.max(1, Math.floor(rect.height * dpr));
        if (W === this.W && H === this.H) return;
        this.W = W;
        this.H = H;
        this.dpr = dpr;
        this.canvas.width = W;
        this.canvas.height = H;
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.gl.viewport(0, 0, W, H);
    }

    _readUniformsFromCSS() {
        const cs = getComputedStyle(this.root);
        const num = (name, fb) => {
            const v = parseFloat(cs.getPropertyValue(name));
            return Number.isFinite(v) ? v : fb;
        };
        this.knobs = {
            waveIntensity: num("--w-wave-intensity", 1) * num("--w-storm-multiplier", 1),
            waterSpeed: num("--w-water-speed", 1),
            glowIntensity: num("--w-glow-intensity", 1) * num("--w-light-ray-intensity", 1),
            choppiness: num("--w-water-distortion", 0.18),
            shimmer: num("--w-shimmer-strength", 1),
            rippleStrength: num("--w-ripple-strength", 1),
        };
        this.cols = {
            surface: parseColor(cs.getPropertyValue("--w-top")),
            shallow: parseColor(cs.getPropertyValue("--w-mid")),
            mid: parseColor(cs.getPropertyValue("--w-deep")),
            deep: parseColor(cs.getPropertyValue("--w-floor")),
        };
    }

    _observeAttrs() {
        let pending = false;
        const mo = new MutationObserver(() => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                this._readUniformsFromCSS();
                this._staticDone = false;
            });
        });
        mo.observe(this.root, {
            attributes: true,
            attributeFilter: ["data-area", "data-water-state", "style", "class"],
        });
        this._mo = mo;
    }

    _bindEvents() {
        const r = this.root;
        // PointerEvents kommen via Bubbling auch durch, wenn .fish-spot etc. zuerst getroffen wurden.
        r.addEventListener("pointermove", (e) => this._onPointerMove(e), { passive: true });
        r.addEventListener("pointerdown", (e) => this._onPointerDown(e), { passive: true });
        r.addEventListener("pointerup", () => this._onPointerUp(), { passive: true });
        r.addEventListener("pointerleave", () => this._onPointerLeave(), { passive: true });
        r.addEventListener("pointercancel", () => this._onPointerUp(), { passive: true });

        if (typeof ResizeObserver !== "undefined") {
            this._ro = new ResizeObserver(() => this._resize());
            this._ro.observe(this.root);
        } else {
            window.addEventListener("resize", () => this._resize());
        }
    }

    /* ============================================================
       POINTER
       ============================================================ */

    _stagePixels(clientX, clientY) {
        const rect = this.root.getBoundingClientRect();
        const dpr = this.dpr || 1;
        // WebGL: y from bottom
        const x = (clientX - rect.left) * dpr;
        const y = (rect.height - (clientY - rect.top)) * dpr;
        return { x, y };
    }

    _onPointerMove(event) {
        const { x, y } = this._stagePixels(event.clientX, event.clientY);
        this.mvx = (x - this.mx);
        this.mvy = (y - this.my);
        this.mx = x;
        this.my = y;
        this.lastInteract = performance.now();
    }

    _onPointerDown(event) {
        this._onPointerMove(event);
        this.holding = true;
        this._addSplash();
    }

    _onPointerUp() {
        this.holding = false;
    }

    _onPointerLeave() {
        this.holding = false;
        // Maus „weit weg" parken, damit das Hover-Ripple (exp(-mr * …)) auf 0 abklingt.
        this.mx = -100000;
        this.my = -100000;
        this.mvx = 0;
        this.mvy = 0;
    }

    _addSplash() {
        const t = (performance.now() - this._t0) / 1000;
        const i = this.splashHead * 3;
        this.splashes[i] = this.mx;
        this.splashes[i + 1] = this.my;
        this.splashes[i + 2] = t;
        this.splashHead = (this.splashHead + 1) % MAX_SPLASHES;
        this.splashesActive = true;
    }

    _idleSplashTick() {
        if (!this._idleSplashesEnabled) return;
        if (isMotionReduced()) return;
        if (!this.gl) return;
        if (performance.now() - this.lastInteract < 5500) return;
        if (Math.random() > 0.4) return;
        const t = (performance.now() - this._t0) / 1000;
        const i = this.splashHead * 3;
        this.splashes[i] = Math.random() * this.W;
        this.splashes[i + 1] = Math.random() * this.H;
        this.splashes[i + 2] = t;
        this.splashHead = (this.splashHead + 1) % MAX_SPLASHES;
    }

    /* ============================================================
       LOOP
       ============================================================ */

    _frame(now) {
    if (this._stopped) return;

    this._raf = requestAnimationFrame(this._frame);

    if (document.hidden) return;

    if (document.querySelector(WaterSystem.COVERING_SELECTOR)) {
        return;
    }

    if (isMotionReduced()) {
        if (!this._staticDone) {
            this._draw(0, 0, 0);
            this._staticDone = true;
        }

        return;
    }

    this._staticDone = false;

    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    const targetFps = isMobile ? 10 : 30;
    const frameInterval = 1000 / targetFps;

    if (!this._lastRenderedFrame) {
        this._lastRenderedFrame = now;
    }

    const elapsed = now - this._lastRenderedFrame;

    if (elapsed < frameInterval) {
        return;
    }

    this._lastRenderedFrame =
        now - (elapsed % frameInterval);

    const t =
        ((now - this._t0) / 1000) *
        this.knobs.waterSpeed;

    const dt = Math.max(
        0.001,
        (now - this._lastFrame) / 1000
    );

    this._lastFrame = now;

    const vx = this.mvx / dt;
    const vy = this.mvy / dt;
    const decay = Math.pow(0.001, dt);

    this.mvx *= decay;
    this.mvy *= decay;

    if (this.holding) {
        this.hold = Math.min(
            1,
            this.hold + dt * 1.2
        );
    } else {
        this.hold = Math.max(
            0,
            this.hold - dt * 1.5
        );
    }

    this._draw(t, vx, vy);
}

    _draw(t, vx, vy) {
        const gl = this.gl;
        const u = this.u;
        const k = this.knobs;
        const c = this.cols;

        gl.useProgram(this.prog);
        gl.uniform2f(u.res, this.W, this.H);
        gl.uniform1f(u.time, t);
        gl.uniform2f(u.mouse, this.mx, this.my);
        gl.uniform2f(u.mouseVel, vx, vy);
        gl.uniform1f(u.hold, this.hold);
        gl.uniform1i(u.splashCount, this.splashesActive ? MAX_SPLASHES : 0);
        gl.uniform3fv(u.splashes, this.splashes);
        gl.uniform1f(u.splashAmp, k.rippleStrength);

        gl.uniform1f(u.waveIntensity, k.waveIntensity);
        gl.uniform1f(u.glowIntensity, k.glowIntensity);
        gl.uniform1f(u.choppiness, k.choppiness);
        gl.uniform1f(u.shimmer, k.shimmer);
        gl.uniform1f(u.rain, this.rain);

        gl.uniform3fv(u.colSurface, c.surface);
        gl.uniform3fv(u.colShallow, c.shallow);
        gl.uniform3fv(u.colMid, c.mid);
        gl.uniform3fv(u.colDeep, c.deep);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */

    setPreset(name) {
        const preset = PRESETS[name] || PRESETS.calm;
        for (const [key, value] of Object.entries(preset)) {
            if (key === "idleSplashes") continue; // separat behandeln, nicht als CSS-Var
            this.root.style.setProperty("--w-" + camelToKebab(key), String(value));
        }
        if (Object.prototype.hasOwnProperty.call(preset, "idleSplashes")) {
            this.setIdleSplashes(preset.idleSplashes);
        }
        this.root.dataset.waterState = name;
    }

    /** Idle-Splashes (zufällige automatische Ploppen) ein-/ausschalten. */
    setIdleSplashes(enabled) {
        this._idleSplashesEnabled = !!enabled;
        return this._idleSplashesEnabled;
    }

    /** Regenstärke 0..1 setzen (geht direkt in den Shader). */
    setRain(value) {
        this.rain = Math.max(0, Math.min(1, Number(value) || 0));
        this._staticDone = false; // bei reduced-motion neu zeichnen
    }

    /** Convenience: setWeather({ rain }). Fog wird vom WeatherSystem behandelt. */
    setWeather(opts) {
        if (!opts) return;
        if (typeof opts.rain === "number") this.setRain(opts.rain);
    }

    set(varName, value) {
        this.root.style.setProperty("--w-" + camelToKebab(varName), String(value));
    }

    getCurrent() {
        const cs = getComputedStyle(this.root);
        const out = {};
        for (const key of Object.keys(PRESETS.calm)) {
            if (key === "idleSplashes") {
                out[key] = String(this._idleSplashesEnabled);
                continue;
            }
            out[key] = cs.getPropertyValue("--w-" + camelToKebab(key)).trim();
        }
        out.rain = String(this.rain);
        return out;
    }

    /** Programmatisch einen Splash auslösen — z.B. wenn ein Schwarm vorbeischwimmt. */
    pulseAt(x, y, strength = 0.8) {
        if (!this.gl) return;
        const rect = this.root.getBoundingClientRect();
        if (rect.width <= 0) return;
        const dpr = this.dpr || 1;
        this.mx = x * dpr;
        this.my = (rect.height - y) * dpr;
        this._addSplash();
    }

    destroy() {
        this._stopped = true;
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this._idleTimer) clearInterval(this._idleTimer);
        if (this._mo) this._mo.disconnect();
        if (this._ro) this._ro.disconnect();
        if (this.wrap) this.wrap.remove();
    }
}

export const WATER_PRESETS = Object.keys(PRESETS);

// Voll-deckende UI-Overlays die das Wasser visuell komplett verdecken — während
// eines davon offen ist pausiert der Shader. Spart massiv GPU auf Mobile.
WaterSystem.COVERING_SELECTOR = [
    ".game-window:not([hidden])",
    "#fishing-overlay:not([hidden])",
    "#daily-overlay:not([hidden])",
    "#karl-overlay:not([hidden])",
    "#karl-wheel-overlay:not([hidden])",
    "#karl-reward-popup:not([hidden])",
].join(",");
