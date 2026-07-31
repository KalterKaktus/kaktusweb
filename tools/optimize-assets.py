#!/usr/bin/env python3
"""
Rohbilder für den Cozy-Look aufbereiten.

Legt die Originale nach `tools/raw/` und ruft dieses Skript auf. Es schreibt
optimierte Varianten nach `games/KaktusClicker/assets/…`.

    python3 tools/optimize-assets.py

`tools/raw/` ist gitignored — nur die optimierten Varianten gehören ins Repo.

Warum WebP und KEIN PNG-Fallback:
  Die Illustrationen sind flächige Cartoon-Grafiken mit weichen Verläufen — genau
  das, wo WebP gegenüber PNG deutlich gewinnt (oft 70-85 % kleiner bei gleichem
  Aussehen). Ein PNG-Fallback wäre totes Repo-Gewicht: die Seite setzt ohnehin
  ES-Module, color-mix() und die rgb()-Slash-Syntax voraus — jeder Browser, der
  das kann, kann auch WebP. `<picture>` wird nur für die Wahl zwischen Desktop-
  und Mobile-Hintergrund benutzt, nicht für Formate.

Warum getrimmt wird:
  Die Rohbilder mit Transparenz (Kaktus, Coin, Nopal) haben breite leere Ränder.
  Ungetrimmt landet ein Drittel des Pixelbudgets in Luft, und das CSS müsste den
  Versatz mit Magic-Numbers ausgleichen. `trim_alpha` schneidet auf die sichtbare
  Bounding-Box und lässt nur ein paar Prozent Sicherheitsrand für den Schatten.

Größenbudget (Richtwert, Summe pro Seitenaufruf):
  Kaktus       ≤ 110 kB
  Hintergrund  ≤ 180 kB je Variante (es lädt immer nur eine)
  Währungen    ≤  20 kB je Stück
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow fehlt:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw"
OUT = ROOT / "games" / "KaktusClicker" / "assets"

# quelle → (zielordner, zielname, maximale breite, transparenz?, qualität)
#
# Die Hintergründe liegen nativ bei 1672 px bzw. 941 px Breite. Der max_w-Wert
# liegt bewusst darüber: hochskaliert wird nie, das Limit greift nur nach unten.
JOBS = [
    ("cactus.png",             "cactus",     "cactus",         1024, True,  86),
    ("background-desktop.png", "background", "desert-desktop", 1920, False, 78),
    ("background-mobile.png",  "background", "desert-mobile",  1080, False, 78),
    ("coin.png",               "currencies", "coin",            256, True,  82),
    ("nopal.png",              "currencies", "nopal",           256, True,  82),
]


def trim_alpha(img: Image.Image, padding: float = 0.02) -> Image.Image:
    """Schneidet vollständig transparente Ränder weg, mit etwas Rest-Rand."""
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img

    pad = round(max(img.width, img.height) * padding)
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(img.width, bbox[2] + pad)
    bottom = min(img.height, bbox[3] + pad)
    return img.crop((left, top, right, bottom))


def process(src: Path, folder: str, name: str, max_w: int, alpha: bool, quality: int) -> None:
    img = Image.open(src)
    img = img.convert("RGBA" if alpha else "RGB")
    original = img.size

    if alpha:
        img = trim_alpha(img)

    if img.width > max_w:
        height = round(img.height * max_w / img.width)
        img = img.resize((max_w, height), Image.LANCZOS)

    target = OUT / folder
    target.mkdir(parents=True, exist_ok=True)
    webp = target / f"{name}.webp"
    img.save(webp, "WEBP", quality=quality, method=6)

    size_kb = webp.stat().st_size / 1024
    # Bewusst ASCII: die Windows-Konsole läuft auf cp1252 und wirft bei Pfeilen.
    print(f"  {name:16} {original[0]}x{original[1]} -> {img.width}x{img.height}"
          f"{'  (getrimmt)' if alpha else '':<13}  {size_kb:6.1f} kB")
    return size_kb


def main() -> None:
    if not RAW.is_dir():
        RAW.mkdir(parents=True, exist_ok=True)
        sys.exit(f"Lege die Originale nach {RAW.relative_to(ROOT)}/ und starte erneut.\n"
                 f"Erwartete Dateinamen: " + ", ".join(job[0] for job in JOBS))

    missing, sizes = [], []
    for filename, folder, name, max_w, alpha, quality in JOBS:
        src = RAW / filename
        if not src.exists():
            missing.append(filename)
            continue
        sizes.append(process(src, folder, name, max_w, alpha, quality))

    if missing:
        print("\nNicht gefunden (übersprungen): " + ", ".join(missing))
    if sizes:
        # Der Desktop- und der Mobile-Hintergrund werden nie zusammen geladen,
        # deshalb zählt für "pro Seitenaufruf" nur der größere von beiden.
        print(f"\n{len(sizes)} Bild(er) -> {OUT.relative_to(ROOT)}/")
        print(f"Summe aller Dateien: {sum(sizes):.1f} kB")


if __name__ == "__main__":
    main()
