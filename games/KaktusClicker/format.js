const NUMBER_TIERS = [
  { value: 1e60, suffix: "Dezo." },
  { value: 1e57, suffix: "Nonrd." },
  { value: 1e54, suffix: "Nono." },
  { value: 1e51, suffix: "Oktrd." },
  { value: 1e48, suffix: "Okto." },
  { value: 1e45, suffix: "Septrd." },
  { value: 1e42, suffix: "Septo." },
  { value: 1e39, suffix: "Sextrd." },
  { value: 1e36, suffix: "Sexto." },
  { value: 1e33, suffix: "Quinrd." },
  { value: 1e30, suffix: "Quinto." },
  { value: 1e27, suffix: "Quadrd." },
  { value: 1e24, suffix: "Quadro." },
  { value: 1e21, suffix: "Trd." },
  { value: 1e18, suffix: "Trio." },
  { value: 1e15, suffix: "Brd." },
  { value: 1e12, suffix: "Bio." },
  { value: 1e9, suffix: "Mrd." },
  { value: 1e6, suffix: "Mio." },
  { value: 1e3, suffix: "Tsd." },
];

const compactFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const normalFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 3,
});

export function formatNumber(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  const tier = NUMBER_TIERS.find((item) => absolute >= item.value);

  if (tier) {
    return `${sign}${compactFormatter.format(absolute / tier.value)} ${tier.suffix}`;
  }

  if (absolute >= 1e63) {
    return number.toLocaleString("de-DE", {
      notation: "scientific",
      maximumFractionDigits: 3,
    });
  }

  return normalFormatter.format(number);
}

export function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const restSeconds = totalSeconds % 60;

  if (hours) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(restSeconds).padStart(2, "0")}s`;
  }

  if (minutes) {
    return `${minutes}m ${String(restSeconds).padStart(2, "0")}s`;
  }

  return `${restSeconds}s`;
}
