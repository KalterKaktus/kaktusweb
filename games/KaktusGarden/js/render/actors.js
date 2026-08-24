import { loadImage } from "../engine/assets.js";
import { DIRECTION_ROW, isMoving, playerFrame, playerWorldPosition } from "../systems/player.js";

/** Charaktere sind 32 × 32, vier Zeilen (unten, links, rechts, oben). */
export const ACTOR_SIZE = 32;

/**
 * Im 32er-Frame steht die Figur nicht mittig: gezeichnet ist nur Zeile 4 bis
 * 24, darunter sind 8 Pixel leer. Ohne diese Messung säße die Figur sichtbar
 * zu hoch über ihrem Feld.
 */
const CONTENT_BOTTOM = 24;
/** Wie weit die Füße unter der Feldmitte stehen. Größer = tiefer im Feld. */
const FOOT_OFFSET = 4;

const SHEETS = Object.freeze({
  male: "assets/characters/males/male_01/walk/male_01_walk_32x32_3frames.png",
  female: "assets/characters/females/female_01/walk/female_01_hat_walk_32x32_3frames.png",
});

const sheets = {};

export async function loadActorSheets() {
  const entries = Object.entries(SHEETS);
  const images = await Promise.all(entries.map(([, src]) => loadImage(src)));
  entries.forEach(([key], index) => { sheets[key] = images[index]; });
  return sheets;
}

/** Zwei Aussehen, fest aus der Spieler-ID abgeleitet, damit es stabil bleibt. */
export function skinFor(playerId) {
  let hash = 0;
  for (const char of String(playerId)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 2 === 0 ? "male" : "female";
}

/** Linke obere Ecke des Sprites in Weltpixeln. */
export function actorDrawOrigin(player) {
  const { x, y } = playerWorldPosition(player);
  return {
    x: x - ACTOR_SIZE / 2,
    y: y + FOOT_OFFSET - CONTENT_BOTTOM,
    centerX: x,
    centerY: y,
  };
}

export function drawActor(ctx, player, skin, camera) {
  const image = sheets[skin] || sheets.male;
  if (!image) return;
  const origin = actorDrawOrigin(player);
  const column = playerFrame(player);
  const row = DIRECTION_ROW[player.facing] ?? 0;
  ctx.drawImage(
    image,
    column * ACTOR_SIZE, row * ACTOR_SIZE, ACTOR_SIZE, ACTOR_SIZE,
    Math.round(origin.x - camera.x),
    Math.round(origin.y - camera.y),
    ACTOR_SIZE, ACTOR_SIZE,
  );
}

/**
 * Namensschild über dem Kopf. Wird bewusst **außerhalb** der Zoom-Transformation
 * gezeichnet: hochskalierter Text wäre bei Zoom 3 oder 4 ein Klotz. So bleibt
 * die Schrift in Gerätepixeln scharf, während die Welt pixelig bleibt.
 */
export function drawNameTag(ctx, text, screenX, screenY, scale = 1, palette = NAMETAG_PALETTE, baseFontSize = 11) {
  if (!text) return;
  const fontSize = Math.round(baseFontSize * scale);
  const padX = Math.round(6 * scale);
  const padY = Math.round(3 * scale);
  const radius = Math.round(4 * scale);

  ctx.save();
  ctx.font = `800 ${fontSize}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const width = ctx.measureText(text).width + padX * 2;
  const height = fontSize + padY * 2;
  const left = Math.round(screenX - width / 2);
  const top = Math.round(screenY - height);

  ctx.beginPath();
  ctx.roundRect(left, top, width, height, radius);
  ctx.fillStyle = palette.background;
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.round(scale));
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  ctx.fillStyle = palette.text;
  ctx.fillText(text, left + width / 2, top + height / 2 + Math.round(scale * 0.5));
  ctx.restore();
}

/**
 * Die Canvas-Farben kommen aus denselben Tokens wie das restliche Spiel, damit
 * ein Theme-Wechsel nicht am Namensschild vorbeigeht.
 */
export const NAMETAG_PALETTE = { background: "#000", border: "#fff", text: "#fff" };

export function readNameTagPalette(element = document.body) {
  const styles = getComputedStyle(element);
  const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  const textRgb = token("--text-rgb", "56 47 43");
  const onAccentRgb = token("--on-accent-rgb", "255 248 232");
  NAMETAG_PALETTE.background = `rgb(${textRgb} / 0.82)`;
  NAMETAG_PALETTE.border = `rgb(${onAccentRgb} / 0.5)`;
  NAMETAG_PALETTE.text = token("--on-accent", "#fff8e8");
  return NAMETAG_PALETTE;
}

export { isMoving };
