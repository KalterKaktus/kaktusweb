import { TILE, isWalkable } from "../data/world.js";

/** Zeilenreihenfolge in allen Charakter-Sheets. */
export const DIRECTION_ROW = Object.freeze({ down: 0, left: 1, right: 2, up: 3 });

const STEP_OFFSETS = Object.freeze({
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
});

/** Millisekunden für einen Schritt von Feldmitte zu Feldmitte. */
export const STEP_MS = 180;

/** Bildwechsel der Laufanimation. */
const WALK_FRAME_MS = 90;
const WALK_CYCLE = [0, 1, 2, 1];

export function createPlayer(tileX, tileY) {
  return {
    tileX,
    tileY,
    // Feld, auf das gerade zugelaufen wird; gleich tileX/tileY wenn still.
    fromX: tileX,
    fromY: tileY,
    facing: "down",
    stepProgress: 1,
    walkTime: 0,
  };
}

export function isMoving(player) {
  return player.stepProgress < 1;
}

export function setPlayerTile(player, tileX, tileY) {
  player.tileX = tileX;
  player.tileY = tileY;
  player.fromX = tileX;
  player.fromY = tileY;
  player.stepProgress = 1;
}

/**
 * Bewegt den Spieler streng im Raster: ein begonnener Schritt wird immer zu
 * Ende geführt, erst danach kann die nächste Richtung greifen. Dadurch steht
 * der Spieler nie zwischen zwei Feldern und Interagieren trifft immer genau
 * das Feld, auf dem er steht.
 */
export function updatePlayer(player, direction, deltaMs, canEnter = isWalkable) {
  // Die Zeit wird portionsweise verbraucht: Wird ein Schritt mitten im Frame
  // fertig, fließt der Rest sofort in den nächsten. Ohne das gäbe es zwischen
  // zwei Schritten je ein Bild Stillstand — der Charakter zuckte sichtbar.
  let remaining = deltaMs;
  let guard = 8;

  while (remaining > 0 && guard > 0) {
    guard -= 1;

    if (isMoving(player)) {
      const needed = (1 - player.stepProgress) * STEP_MS;
      const used = Math.min(needed, remaining);
      player.stepProgress += used / STEP_MS;
      player.walkTime += used;
      remaining -= used;
      if (player.stepProgress >= 1) {
        player.stepProgress = 1;
        player.fromX = player.tileX;
        player.fromY = player.tileY;
      }
      continue;
    }

    if (!direction) {
      player.walkTime = 0;
      return;
    }

    player.facing = direction;
    const [dx, dy] = STEP_OFFSETS[direction];
    const nextX = player.tileX + dx;
    const nextY = player.tileY + dy;
    if (!canEnter(nextX, nextY)) {
      // Gegen die Wand laufen dreht nur, das kostet keine Zeit.
      player.walkTime = 0;
      return;
    }

    player.fromX = player.tileX;
    player.fromY = player.tileY;
    player.tileX = nextX;
    player.tileY = nextY;
    player.stepProgress = 0;
  }
}

/** Position in Weltpixeln, Mitte des Feldes, während des Schritts interpoliert. */
export function playerWorldPosition(player) {
  const t = player.stepProgress;
  const x = player.fromX + (player.tileX - player.fromX) * t;
  const y = player.fromY + (player.tileY - player.fromY) * t;
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

/**
 * Spalte im Walk-Sheet. Im Stand wird bewusst Frame 1 gezeigt — das ist die
 * neutrale Standpose, dadurch kommen wir mit einem einzigen Sheet aus.
 */
export function playerFrame(player) {
  if (!isMoving(player)) return 1;
  return WALK_CYCLE[Math.floor(player.walkTime / WALK_FRAME_MS) % WALK_CYCLE.length];
}
