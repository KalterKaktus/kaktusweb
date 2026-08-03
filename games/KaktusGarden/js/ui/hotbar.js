import { cropIcon } from "../data/crops.js";
import { HOTBAR_SLOTS, inventoryStacks } from "../state.js";

/**
 * Die Leiste unten ist immer sichtbar, auch leer — sie ist der einzige Weg,
 * einen Samen auszuwählen. Gepflanzt wird danach mit dem Aktionsknopf, es
 * öffnet sich bewusst kein Menü.
 */
export function createHotbar(root, { onSelect }) {
  const slots = Array.from({ length: HOTBAR_SLOTS }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hotbar-slot";
    button.dataset.slot = String(index);

    const icon = document.createElement("span");
    icon.className = "hotbar-icon";
    const count = document.createElement("span");
    count.className = "hotbar-count";
    const key = document.createElement("span");
    key.className = "hotbar-key";
    key.textContent = String(index + 1);

    button.append(icon, count, key);
    root.append(button);
    return { button, icon, count };
  });

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slot]");
    if (button) onSelect(Number(button.dataset.slot));
  });

  return function renderHotbar(state) {
    const stacks = inventoryStacks(state);
    slots.forEach((slot, index) => {
      const stack = stacks[index];
      slot.button.classList.toggle("is-selected", index === state.selectedSlot);
      slot.button.classList.toggle("is-empty", !stack);
      if (!stack) {
        slot.icon.removeAttribute("style");
        slot.count.textContent = "";
        slot.button.removeAttribute("aria-label");
        return;
      }
      const icon = cropIcon(stack.id);
      const position = icon.frames > 1 ? (icon.frame / (icon.frames - 1)) * 100 : 0;
      slot.icon.setAttribute(
        "style",
        `background-image:url('${icon.src}');background-size:${icon.frames * 100}% 100%;background-position:${position}% 0`,
      );
      slot.icon.classList.toggle("is-seed", stack.kind === "seed");
      slot.count.textContent = stack.count > 1 ? String(stack.count) : "";
      slot.button.setAttribute("aria-label", `${stack.id} ×${stack.count}`);
    });

    // Was nicht mehr in die Leiste passt, wird nur gezählt — die Tasche mit
    // Sortieren und Suchen kommt später.
    const overflow = Math.max(0, stacks.length - HOTBAR_SLOTS);
    root.dataset.overflow = overflow ? String(overflow) : "";
    return overflow;
  };
}
