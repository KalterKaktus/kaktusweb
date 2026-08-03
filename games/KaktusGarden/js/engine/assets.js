const cache = new Map();

export function loadImage(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Sheet fehlt: ${src}`));
      image.src = src;
    }));
  }
  return cache.get(src);
}

/** Lädt ein Objekt aus { schlüssel: pfad } und liefert { schlüssel: Image }. */
export async function loadSheets(sources) {
  const entries = Object.entries(sources);
  const images = await Promise.all(entries.map(([, src]) => loadImage(src)));
  return Object.fromEntries(entries.map(([key], index) => [key, images[index]]));
}
