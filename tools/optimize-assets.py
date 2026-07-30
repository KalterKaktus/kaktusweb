#!/usr/bin/env python3
"""
Rohbilder für den Cozy-Look aufbereiten.

Legt die Originale nach `tools/raw/` und ruft dieses Skript auf. Es schreibt
optimierte Varianten nach `games/KaktusClicker/assets/…`.

    python3 tools/optimize-assets.py

Warum WebP statt PNG:
  Die Illustrationen sind flächige Cartoon-Grafiken mit weichen Verläufen — genau
  das, wo WebP gegenüber PNG deutlich gewinnt (oft 70-85 % kleiner bei gleichem
  Aussehen). Als Fallback wird zusätzlich ein optimiertes PNG geschrieben; ein
  <picture>-Element nimmt automatisch das kleinere Format.

Größenbudget (Richtwert, Summe pro Seitenaufruf):
  Kaktus       ≤  80 kB
  Hintergrund  ≤ 120 kB je Variante (mobil/desktop, es lädt nur eine)
  Icons        SVG, ≤ 2 kB je Stück
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow fehlt:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw"
OUT = ROOT / "games" / "KaktusClicker" / "assets"

# quelle → (zielordner, zielname, maximale breite, transparenz?)
JOBS = [
    ("cactus.png",            "cactus",     "cactus",        1024, True),
    ("background-desktop.png", "background", "desert-desktop", 1920, False),
    ("background-mobile.png",  "background", "desert-mobile",  1080, False),
]


def process(src: Path, folder: str, name: str, max_w: int, alpha: bool) -> None:
    img = Image.open(src)
    img = img.convert("RGBA" if alpha else "RGB")

    if img.width > max_w:
        h = round(img.height * max_w / img.width)
        img = img.resize((max_w, h), Image.LANCZOS)

    target = OUT / folder
    target.mkdir(parents=True, exist_ok=True)

    webp = target / f"{name}.webp"
    img.save(webp, "WEBP", quality=82, method=6)

    png = target / f"{name}.png"
    if alpha:
        # Palette-Quantisierung schrumpft flächige Cartoon-PNGs stark, ohne dass
        # man den Unterschied sieht. RGBA bleibt erhalten.
        img.quantize(colors=256, method=Image.FASTOCTREE).save(png, "PNG", optimize=True)
    else:
        img.save(png, "PNG", optimize=True)

    print(f"  {name:18} {img.width}×{img.height}   "
          f"webp {webp.stat().st_size/1024:6.1f} kB   "
          f"png {png.stat().st_size/1024:6.1f} kB")


def main() -> None:
    if not RAW.is_dir():
        RAW.mkdir(parents=True, exist_ok=True)
        sys.exit(f"Lege die Originale nach {RAW.relative_to(ROOT)}/ und starte erneut.\n"
                 f"Erwartete Dateinamen: " + ", ".join(j[0] for j in JOBS))

    missing, done = [], 0
    for filename, folder, name, max_w, alpha in JOBS:
        src = RAW / filename
        if not src.exists():
            missing.append(filename)
            continue
        process(src, folder, name, max_w, alpha)
        done += 1

    if missing:
        print("\nNicht gefunden (übersprungen): " + ", ".join(missing))
    if done:
        print(f"\n{done} Bild(er) aufbereitet nach {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
