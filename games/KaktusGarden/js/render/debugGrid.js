import { MAP_COLS, MAP_ROWS, TILE } from "../data/world.js";

/**
 * Hilfsraster zum Bearbeiten der Karte. Nur aktiv mit ?debug in der Adresse.
 *
 * Zeigt jedes Tile, beschriftet alle vier Felder die Koordinate und hebt das
 * Feld unter dem Mauszeiger hervor. Ein Klick schreibt die Koordinate in die
 * Konsole — von dort lässt sie sich direkt in GRASS_PATCHES oder DECOR
 * übernehmen.
 */
export function createDebugGrid(canvas, getCamera, getZoom) {
  const hover = { x: -1, y: -1 };

  function toTile(event) {
    const rect = canvas.getBoundingClientRect();
    const camera = getCamera();
    const zoom = getZoom();
    const scale = canvas.width / rect.width;
    const worldX = camera.x + ((event.clientX - rect.left) * scale) / zoom;
    const worldY = camera.y + ((event.clientY - rect.top) * scale) / zoom;
    return { x: Math.floor(worldX / TILE), y: Math.floor(worldY / TILE) };
  }

  canvas.addEventListener("pointermove", (event) => {
    const tile = toTile(event);
    hover.x = tile.x;
    hover.y = tile.y;
  });

  canvas.addEventListener("click", (event) => {
    const tile = toTile(event);
    console.log(`Tile ${tile.x},${tile.y}   →   P("tile", ${tile.x}, ${tile.y})   |   { x: ${tile.x}, y: ${tile.y}, w: 1, h: 1, style: "meadow" }`);
  });

  return function drawDebugGrid(ctx, camera) {
    const firstX = Math.max(0, Math.floor(camera.x / TILE));
    const lastX = Math.min(MAP_COLS, Math.ceil((camera.x + camera.w) / TILE));
    const firstY = Math.max(0, Math.floor(camera.y / TILE));
    const lastY = Math.min(MAP_ROWS, Math.ceil((camera.y + camera.h) / TILE));

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    for (let x = firstX; x <= lastX; x += 1) {
      ctx.moveTo(x * TILE, firstY * TILE);
      ctx.lineTo(x * TILE, lastY * TILE);
    }
    for (let y = firstY; y <= lastY; y += 1) {
      ctx.moveTo(firstX * TILE, y * TILE);
      ctx.lineTo(lastX * TILE, y * TILE);
    }
    ctx.stroke();

    ctx.font = "5px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    for (let y = firstY; y < lastY; y += 4) {
      for (let x = firstX; x < lastX; x += 4) {
        ctx.fillText(`${x},${y}`, x * TILE + 1, y * TILE + 6);
      }
    }

    if (hover.x >= 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(hover.x * TILE, hover.y * TILE, TILE, TILE);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * TILE + 0.5, hover.y * TILE + 0.5, TILE - 1, TILE - 1);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.font = "6px monospace";
      ctx.fillText(`${hover.x},${hover.y}`, hover.x * TILE, hover.y * TILE - 2);
    }
    ctx.restore();
  };
}
