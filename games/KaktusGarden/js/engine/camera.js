import { MAP_HEIGHT, MAP_WIDTH } from "../data/world.js";

/**
 * Kamera in Weltpixeln. Sie folgt dem Spieler weich und bleibt innerhalb der
 * Karte; ist die Karte in einer Achse kleiner als der Ausschnitt, wird dort
 * zentriert statt geklemmt.
 */
export function createCamera() {
  return { x: 0, y: 0, w: 0, h: 0 };
}

export function resizeCamera(camera, viewWidth, viewHeight) {
  camera.w = viewWidth;
  camera.h = viewHeight;
}

function clampAxis(value, view, world) {
  if (view >= world) return (world - view) / 2;
  return Math.max(0, Math.min(world - view, value));
}

export function focusCamera(camera, targetX, targetY, smoothing = 1) {
  const wantX = clampAxis(targetX - camera.w / 2, camera.w, MAP_WIDTH);
  const wantY = clampAxis(targetY - camera.h / 2, camera.h, MAP_HEIGHT);
  camera.x += (wantX - camera.x) * smoothing;
  camera.y += (wantY - camera.y) * smoothing;
}
