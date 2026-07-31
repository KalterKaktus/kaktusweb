// i18n runtime for kaktusweb.
// Deutsch ist Default (bleibt im HTML als Fallback); Russisch wird beim Load
// überlagert. Persistenz: localStorage `kk-lang`, optional profiles.preferred_language.

const STORAGE_KEY = "kk-lang";
const SUPPORTED = ["de", "ru"];
const DEFAULT_LANG = "de";

// Cache-Buster für die Dictionaries. `cache: "force-cache"` unten nimmt einen
// vorhandenen Cache-Eintrag OHNE Rückfrage — egal wie alt er ist. Ohne diesen
// Parameter behalten wiederkehrende Besucher nach einem Deploy ihr altes
// Wörterbuch und sehen neue oder korrigierte Strings nie.
//
// ⚠️ Bei JEDER Änderung an de.json/ru.json hochzählen. Eine neue URL ist ein
// neuer Cache-Eintrag — das ist genau der Zweck.
const DICT_VERSION = "2026-08-01c";

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
        const response = await fetch(`/js/i18n/${lang}.json?v=${DICT_VERSION}`, { cache: "force-cache" });
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
    // Zusätzlich als DOM-Event, damit klassische (nicht-Modul) Scripts wie
    // wiki/wiki.js reagieren können — die können onLanguageChange nicht importieren.
    try {
        document.dispatchEvent(new CustomEvent("kk:languagechange", { detail: { lang: state.lang } }));
    } catch (error) {
        console.error("i18n event dispatch failed:", error);
    }
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

// ---------------------------------------------------------------------------
// Language-Switcher (Flaggen-Buttons)
// ---------------------------------------------------------------------------
// Lebt bewusst HIER und nicht in auth-nav.js: auth-nav.js hängt über
// supabase-client.js an einem statischen Import von https://esm.sh/. Ist das
// CDN langsam oder blockiert, wird auth-nav.js nie evaluiert — der Switcher
// wäre dann unsichtbar. i18n.js hat keine externen Abhängigkeiten, also
// erscheinen die Flaggen immer.
//
// Das Speichern der Sprache im Profil (braucht Supabase) registriert
// auth-nav.js separat über onLanguageChange().

const FLAG_SVG = {
    de: `<svg viewBox="0 0 5 3" aria-hidden="true"><rect width="5" height="1" y="0" fill="#000"/><rect width="5" height="1" y="1" fill="#dd0000"/><rect width="5" height="1" y="2" fill="#ffce00"/></svg>`,
    ru: `<svg viewBox="0 0 5 3" aria-hidden="true"><rect width="5" height="1" y="0" fill="#fff"/><rect width="5" height="1" y="1" fill="#0039a6"/><rect width="5" height="1" y="2" fill="#d52b1e"/></svg>`,
};

function syncSwitcherActiveState() {
    document.querySelectorAll(".lang-switch .lang-btn").forEach((btn) => {
        const isActive = btn.dataset.lang === state.lang;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
    });
}

function buildLanguageSwitcher() {
    const wrap = document.createElement("div");
    wrap.className = "lang-switch";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("data-i18n-attr", "aria-label:nav.language");
    wrap.setAttribute("aria-label", "Sprache");
    SUPPORTED.forEach((lang) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lang-btn" + (state.lang === lang ? " is-active" : "");
        btn.dataset.lang = lang;
        btn.setAttribute("aria-pressed", String(state.lang === lang));
        btn.setAttribute("data-i18n-attr", `aria-label:nav.switch_to_${lang}`);
        btn.setAttribute("aria-label", lang === "de" ? "Auf Deutsch umschalten" : "Auf Russisch umschalten");
        btn.innerHTML = FLAG_SVG[lang];
        btn.addEventListener("click", () => {
            setLanguage(lang).catch((error) => console.error("setLanguage failed:", error));
        });
        wrap.append(btn);
    });
    return wrap;
}

export function mountLanguageSwitchers() {
    document.querySelectorAll(".nav").forEach((nav) => {
        const links = nav.querySelector(".nav-links");
        if (!links || links.querySelector(".lang-switch")) return;
        const switcher = buildLanguageSwitcher();
        const authNode = links.querySelector("#auth-nav");
        if (authNode) links.insertBefore(switcher, authNode);
        else links.append(switcher);
        applyTranslations(switcher);
    });
    syncSwitcherActiveState();
}

// Aktiv-Zustand der Flaggen nachziehen, egal wer setLanguage() aufgerufen hat.
onLanguageChange(syncSwitcherActiveState);

// Startup: Sprache detecten, beide Dicts laden (parallel), DOM anwenden.
// Muss vor DOMContentLoaded fertig sein damit Flash of German Content minimal ist.
const initialLang = detectInitialLanguage();
state.lang = initialLang;

export const ready = Promise.all([loadDict("de"), loadDict("ru")]).then(() => {
    state.loaded = true;
    const boot = () => {
        applyTranslations();
        mountLanguageSwitchers();
        // WICHTIG: Scripts die schon vor dem Laden der Dictionaries gerendert
        // haben, zeigen dort noch rohe Keys (t() kann ohne Dict nichts
        // auflösen). Ein notify() lässt alle onLanguageChange-Listener neu
        // rendern — dieselbe Logik wie beim echten Sprachwechsel.
        notify();
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
    document.documentElement.lang = state.lang;
});
