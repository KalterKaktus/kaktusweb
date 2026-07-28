// i18n runtime for kaktusweb.
// Deutsch ist Default (bleibt im HTML als Fallback); Russisch wird beim Load
// überlagert. Persistenz: localStorage `kk-lang`, optional profiles.preferred_language.

const STORAGE_KEY = "kk-lang";
const SUPPORTED = ["de", "ru"];
const DEFAULT_LANG = "de";

const state = {
    lang: DEFAULT_LANG,
    dicts: { de: {}, ru: {} },
    loaded: false,
    listeners: new Set(),
};

function detectInitialLanguage() {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ru")) return "ru";
    return DEFAULT_LANG;
}

async function loadDict(lang) {
    try {
        const response = await fetch(`/js/i18n/${lang}.json`, { cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.dicts[lang] = await response.json();
    } catch (error) {
        console.warn(`i18n: could not load ${lang}.json`, error.message);
        state.dicts[lang] = {};
    }
}

function lookup(key, lang) {
    const dict = state.dicts[lang];
    if (!dict) return undefined;
    return key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict);
}

function interpolate(text, vars) {
    if (!vars || !text) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function t(key, vars) {
    const value = lookup(key, state.lang) ?? lookup(key, DEFAULT_LANG);
    if (typeof value !== "string") return key;
    return interpolate(value, vars);
}

export function getLanguage() {
    return state.lang;
}

export function isRTL() {
    return false;
}

export function onLanguageChange(callback) {
    state.listeners.add(callback);
    return () => state.listeners.delete(callback);
}

function notify() {
    state.listeners.forEach((cb) => {
        try { cb(state.lang); } catch (error) { console.error("i18n listener error:", error); }
    });
}

// Wendet alle data-i18n-Attribute unter `root` an. Default: gesamtes document.
// data-i18n="key" → textContent = t(key)
// data-i18n-attr="attr:key,attr2:key2" → element.setAttribute(attr, t(key))
// data-i18n-html="key" → innerHTML = t(key) (VORSICHT: nur für vertrauenswürdige Übersetzungen)
//
// Für data-i18n-html snapshotten wir das Original-HTML beim ersten Apply damit
// beim Zurück-Switchen auf die Fallback-Sprache (die den Key nicht kennt) das
// Original wiederhergestellt wird, statt die andere Sprache stehen zu lassen.
const originalHtmlCache = new WeakMap();

export function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;
        if (!originalHtmlCache.has(el)) {
            originalHtmlCache.set(el, el.textContent);
        }
        const value = lookup(key, state.lang);
        if (typeof value === "string") {
            el.textContent = value;
        } else {
            el.textContent = originalHtmlCache.get(el);
        }
    });

    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
        const key = el.getAttribute("data-i18n-html");
        if (!key) return;
        if (!originalHtmlCache.has(el)) {
            originalHtmlCache.set(el, el.innerHTML);
        }
        const value = lookup(key, state.lang);
        if (typeof value === "string") {
            el.innerHTML = value;
        } else {
            el.innerHTML = originalHtmlCache.get(el);
        }
    });

    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
        const spec = el.getAttribute("data-i18n-attr") || "";
        spec.split(",").forEach((pair) => {
            const [attr, key] = pair.split(":").map((s) => s.trim());
            if (!attr || !key) return;
            const value = lookup(key, state.lang);
            if (typeof value === "string") {
                el.setAttribute(attr, value);
            }
        });
    });

    document.documentElement.lang = state.lang;
}

export async function setLanguage(lang, options = {}) {
    if (!SUPPORTED.includes(lang) || lang === state.lang) return;
    state.lang = lang;
    if (!state.dicts[lang] || Object.keys(state.dicts[lang]).length === 0) {
        await loadDict(lang);
    }
    if (options.persist !== false) {
        window.localStorage.setItem(STORAGE_KEY, lang);
    }
    applyTranslations();
    notify();
}

export function getSupported() {
    return [...SUPPORTED];
}

export function formatNumber(value, opts = {}) {
    return new Intl.NumberFormat(state.lang === "ru" ? "ru-RU" : "de-DE", opts).format(value);
}

export function formatDate(value, opts = { dateStyle: "medium" }) {
    return new Intl.DateTimeFormat(state.lang === "ru" ? "ru-RU" : "de-DE", opts).format(value);
}

// Startup: Sprache detecten, beide Dicts laden (parallel), DOM anwenden.
// Muss vor DOMContentLoaded fertig sein damit Flash of German Content minimal ist.
const initialLang = detectInitialLanguage();
state.lang = initialLang;

export const ready = Promise.all([loadDict("de"), loadDict("ru")]).then(() => {
    state.loaded = true;
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => applyTranslations(), { once: true });
    } else {
        applyTranslations();
    }
    document.documentElement.lang = state.lang;
});
