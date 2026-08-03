import { TILE } from "../data/world.js";

/**
 * Autotiles im 1×6-Format: Zeile 0 = freistehend, 1 = senkrechter Streifen,
 * 2 = waagerechter Streifen, 3 = Innenecken, 4 = Füllung, 5 = Hintergrund.
 *
 * Eine Zelle wird aus vier 8×8-Vierteln zusammengesetzt. Für jedes Viertel
 * entscheidet allein, ob der waagerechte, der senkrechte und der diagonale
 * Nachbar zum selben Terrain gehören — daraus ergibt sich jeder Randfall.
 */
export function drawAutotileCell(ctx, strip, inside, cx, cy) {
  const half = TILE / 2;
  for (let qy = 0; qy < 2; qy += 1) {
    for (let qx = 0; qx < 2; qx += 1) {
      const nx = cx + (qx === 0 ? -1 : 1);
      const ny = cy + (qy === 0 ? -1 : 1);
      const horizontal = inside(nx, cy);
      const vertical = inside(cx, ny);
      let row;
      if (!horizontal && !vertical) row = 0;
      else if (!horizontal && vertical) row = 1;
      else if (horizontal && !vertical) row = 2;
      else row = inside(nx, ny) ? 4 : 3;
      ctx.drawImage(
        strip,
        qx * half, row * TILE + qy * half, half, half,
        cx * TILE + qx * half, cy * TILE + qy * half, half, half,
      );
    }
  }
}

/** Zeichnet ein ganzes Terrain über einen Rechteckbereich. */
export function drawAutotileArea(ctx, strip, inside, rect) {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (inside(x, y)) drawAutotileCell(ctx, strip, inside, x, y);
    }
  }
}
