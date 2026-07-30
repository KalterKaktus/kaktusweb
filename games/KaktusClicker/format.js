import { getLanguage } from "/js/i18n.js";

// Kurz-Suffixe pro Sprache. Index-gleich, damit ein Tier-Treffer in beiden
// Sprachen dieselbe Größenordnung meint.
const TIER_VALUES = [
  1e60, 1e57, 1e54, 1e51, 1e48, 1e45, 1e42, 1e39, 1e36, 1e33,
  1e30, 1e27, 1e24, 1e21, 1e18, 1e15, 1e12, 1e9, 1e6, 1e3,
];

const TIER_SUFFIXES = {
  de: [
    "Dezo.", "Nonrd.", "Nono.", "Oktrd.", "Okto.", "Septrd.", "Septo.",
    "Sextrd.", "Sexto.", "Quinrd.", "Quinto.", "Quadrd.", "Quadro.",
    "Trd.", "Trio.", "Brd.", "Bio.", "Mrd.", "Mio.", "Tsd.",
  ],
  ru: [
    "дец.", "нонлрд.", "нонл.", "октлрд.", "октл.", "септлрд.", "септл.",
    "секстлрд.", "секстл.", "квинтлрд.", "квинтл.", "квадрлрд.", "квадрл.",
    "секст.", "квинт.", "квдрл.", "трлн", "млрд", "млн", "тыс.",
  ],
};

function locale() {
  return getLanguage() === "ru" ? "ru-RU" : "de-DE";
}

function suffixes() {
  return TIER_SUFFIXES[getLanguage()] || TIER_SUFFIXES.de;
}

// Formatter werden pro Locale gecacht — Intl.NumberFormat ist teuer zu bauen.
const formatterCache = new Map();
function getFormatter(kind) {
  const key = `${kind}:${locale()}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale(), kind === "compact"
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 2 }));
  }
  return formatterCache.get(key);
}

export function formatNumber(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  const tierIndex = TIER_VALUES.findIndex((tierValue) => absolute >= tierValue);

  if (tierIndex !== -1) {
    const tierValue = TIER_VALUES[tierIndex];
    return `${sign}${getFormatter("compact").format(absolute / tierValue)} ${suffixes()[tierIndex]}`;
  }

  if (absolute >= 1e63) {
    return number.toLocaleString(locale(), {
      notation: "scientific",
      maximumFractionDigits: 2,
    });
  }

  return getFormatter("normal").format(number);
}

export function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const restSeconds = totalSeconds % 60;

  const ru = getLanguage() === "ru";
  const h = ru ? "ч" : "h";
  const m = ru ? "м" : "m";
  const s = ru ? "с" : "s";

  if (hours) {
    return `${hours}${h} ${String(minutes).padStart(2, "0")}${m} ${String(restSeconds).padStart(2, "0")}${s}`;
  }

  if (minutes) {
    return `${minutes}${m} ${String(restSeconds).padStart(2, "0")}${s}`;
  }

  return `${restSeconds}${s}`;
}
