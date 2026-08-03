import { getLanguage, t } from "/js/i18n.js";

/**
 * Die übernommene Wirtschaft reicht bis in die Millionen — ausgeschriebene
 * Zahlen sprengen jede Schaltfläche. Deshalb wird ab Tausend abgekürzt.
 */
export function coins(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (amount < 1000) return String(amount);
  const units = [
    [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (amount < size) continue;
    const scaled = amount / size;
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return `${Number(scaled.toFixed(digits))}${suffix}`;
  }
  return String(amount);
}

export function weight(kilograms) {
  const value = Number(kilograms) || 0;
  const locale = getLanguage() === "ru" ? "ru-RU" : "de-DE";
  if (value < 1) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)} kg`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} kg`;
}

export function duration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds < 60) return t("garden.time_seconds", { value: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = seconds % 60;
    return rest ? t("garden.time_minutes_seconds", { minutes, seconds: rest }) : t("garden.time_minutes", { value: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? t("garden.time_hours_minutes", { hours, minutes: restMinutes }) : t("garden.time_hours", { value: hours });
}
