/**
 * Eingabe. Liefert nur zwei Dinge: die aktuell gewünschte Laufrichtung und ob
 * Interagieren ausgelöst wurde. Die Bewegungslogik selbst steckt im Spieler.
 */

const KEY_DIRECTIONS = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

const INTERACT_KEYS = new Set(["Space", "Enter", "KeyE"]);

function uiBlocksGameInput() {
  return Boolean(document.querySelector(".garden-sheet:not([hidden]), dialog[open], .garden-access:not([hidden])"));
}

export function createInput(target = window) {
  const held = [];
  const state = { direction: null, interact: false };

  function press(direction) {
    if (!held.includes(direction)) held.push(direction);
    state.direction = held[held.length - 1];
  }

  function release(direction) {
    const index = held.indexOf(direction);
    if (index >= 0) held.splice(index, 1);
    state.direction = held.length ? held[held.length - 1] : null;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (uiBlocksGameInput()) {
      onBlur();
      return;
    }
    if (INTERACT_KEYS.has(event.code)) {
      state.interact = true;
      event.preventDefault();
      return;
    }
    const direction = KEY_DIRECTIONS[event.code];
    if (!direction) return;
    press(direction);
    event.preventDefault();
  }

  function onKeyUp(event) {
    const direction = KEY_DIRECTIONS[event.code];
    if (direction) release(direction);
  }

  function onBlur() {
    held.length = 0;
    state.direction = null;
    state.interact = false;
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    state,
    /** Interagieren wird nur einmal pro Druck gemeldet. */
    consumeInteract() {
      const value = state.interact;
      state.interact = false;
      return value;
    },
    /** Für die Bildschirmsteuerung auf dem Handy. */
    setDirection(direction) {
      held.length = 0;
      if (uiBlocksGameInput()) {
        state.direction = null;
        return;
      }
      if (direction) held.push(direction);
      state.direction = direction;
    },
    triggerInteract() {
      if (uiBlocksGameInput()) return;
      state.interact = true;
    },
    clear: onBlur,
    destroy() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}
