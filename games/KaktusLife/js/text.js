export { t, getLanguage, ready, onLanguageChange, setLanguage, formatNumber } from '/js/i18n.js';
import { t, formatNumber } from '/js/i18n.js';

export const money = value => t('life.ui.money', { amount: formatNumber(Math.round(Number(value) || 0)) });
export const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
export const label = (key, vars) => esc(t(key, vars));
export const icon = (name, className = '') => {
  const paths = {
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="m14 6-6 6 6 6"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    home: '<path d="m3 10 9-7 9 7m-16-1v12h14V9M9 21v-8h6v8"/>',
    heart: '<path d="M20.8 5.6a5.4 5.4 0 0 0-7.6 0L12 6.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
    coin: '<ellipse cx="12" cy="12" rx="9" ry="9"/><path d="M14.5 8h-4a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-4M12 6v12"/>',
    star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9Z"/>',
    graduate: '<path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v6c4 3 8 3 12 0v-6m4-3v10"/>',
    case: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 13c6 3 12 3 18 0m-9-1v5"/>',
    shield: '<path d="m12 3 9 4v5c0 5-5 8-9 10-4-2-9-5-9-10V7l9-4Zm-4 9 3 3 5-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V3H3v13h5"/>',
    link: '<path d="m9 15 6-6m-5-3 2-2a5 5 0 0 1 7 7l-3 3M8 10l-3 3a5 5 0 0 0 7 7l2-2"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    refresh: '<path d="M20 9a8 8 0 1 0 0 7m0-13v6h-6"/>',
    leaf: '<path d="M20 3C8 1 1 10 6 17s17 2 14-14ZM5 21 16 10"/>',
    flag: '<path d="M5 22V3c6-5 8 5 15 0v11c-7 5-9-5-15 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    route: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M5 17V8a4 4 0 0 1 8 0v8a3 3 0 0 0 6 0V7"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
    mountain: '<path d="m2 21 8-17 5 10 3-6 5 13H2Zm5-11 3 2 3-2"/>',
  };
  return `<svg class="icon ${esc(className)}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.star}</svg>`;
};
