import { PLOTS, SHOPS, plotAt, plotCellAt } from "../data/world.js";

/**
 * Was kann der Spieler auf seinem aktuellen Feld tun?
 *
 * Der Aktionsknopf unten in der Mitte liest ausschließlich hier — dadurch
 * beschriften Knopf und Tastendruck immer garantiert dieselbe Handlung.
 */
export function contextAt(tileX, tileY, { ownPlotIndex = null } = {}) {
  const shop = SHOPS.find((entry) => entry.door.x === tileX && entry.door.y === tileY);
  if (shop) {
    // Pet-Läden stehen schon im Dorf, ihr Inhalt kommt aber erst später.
    if (shop.closed) return { kind: "closedShop", id: shop.id, labelKey: "garden.shop_closed", enabled: false };
    return { kind: "shop", id: shop.id, labelKey: shop.labelKey, enabled: true };
  }

  const plot = plotAt(tileX, tileY);
  if (plot) {
    const cell = plotCellAt(plot, tileX, tileY);
    // Ohne eine vom Server bestätigte Slot-Zuweisung gehört dem Client kein
    // Grundstück. So bleibt die Interaktion auch während des Verbindungsaufbaus
    // konsequent read-only.
    const own = Number.isInteger(ownPlotIndex) && plot.index === ownPlotIndex;
    return { kind: own ? "plot" : "foreignPlot", plotIndex: plot.index, cell, enabled: own };
  }

  // Kein Kontext: der Aktionsknopf verschwindet ganz, statt leer dazustehen.
  return { kind: "none", enabled: false };
}

/** Zielfeld der drei Schnellreisen oben in der Mitte. */
export function teleportTarget(id, { ownPlotIndex = 0 } = {}) {
  if (id === "garden") {
    const plot = PLOTS[ownPlotIndex] || PLOTS[0];
    return { x: plot.spawn.x, y: plot.spawn.y };
  }
  const shop = SHOPS.find((entry) => entry.id === id);
  return shop ? { x: shop.door.x, y: shop.door.y } : null;
}

/** Läden, die noch keinen Inhalt haben. */
export function isShopClosed(id) {
  return Boolean(SHOPS.find((entry) => entry.id === id)?.closed);
}
