"""Build the small KaktusGarden-specific pixel assets from Super Retro Ranch sheets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "games" / "KaktusGarden" / "assets"
OUTPUT = SOURCE / "pixel"


def crop_cell(source: Path, column: int, row: int, cell: int = 16) -> Image.Image:
    with Image.open(source) as image:
        return image.convert("RGBA").crop((column * cell, row * cell, (column + 1) * cell, (row + 1) * cell))


def save_grass_tile() -> None:
    source = SOURCE / "tiles" / "ground_01_16x16.png"
    output = Image.new("RGBA", (32, 32))
    cells = ((3, 8), (4, 8), (3, 9), (5, 9))
    for index, (column, row) in enumerate(cells):
        output.alpha_composite(crop_cell(source, column, row), ((index % 2) * 16, (index // 2) * 16))
    output.save(OUTPUT / "grass_tile.png", optimize=True)


def save_field_tiles() -> None:
    source_dir = SOURCE / "autotiles" / "06_field"
    for index in range(1, 5):
        source = source_dir / f"0{index}_field_0{index}.png"
        with Image.open(source) as image:
            rgba = image.convert("RGBA")
            rgba.crop((0, rgba.height - 16, 16, rgba.height)).save(OUTPUT / f"field_{index}.png", optimize=True)


def save_shop_icon() -> None:
    source = SOURCE / "buildings" / "building_01_16x16.png"
    with Image.open(source) as image:
        crop = image.convert("RGBA").crop((0, 0, 96, 64))
        bounds = crop.getbbox()
        if bounds:
            crop = crop.crop(bounds)
        crop.save(OUTPUT / "shop.png", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    save_grass_tile()
    save_field_tiles()
    save_shop_icon()


if __name__ == "__main__":
    main()
