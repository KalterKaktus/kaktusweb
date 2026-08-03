import { t } from "/js/i18n.js";
import { CROPS, CROP_ORDER, cropIcon, cropValue } from "../data/crops.js";
import { harvestValue } from "../systems/garden.js";
import { nextRestockAt } from "../state.js";
import { coins, duration, weight } from "./format.js";

function iconStyle(cropId) {
  const icon = cropIcon(cropId);
  const position = icon.frames > 1 ? (icon.frame / (icon.frames - 1)) * 100 : 0;
  return `background-image:url('${icon.src}');background-size:${icon.frames * 100}% 100%;background-position:${position}% 0`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function cropName(cropId) {
  return t(`garden.plants.${cropId}.name`);
}

function harvestLine(crop) {
  return crop.harvest === "multi"
    ? t("garden.harvest_multi", { slots: crop.slots, time: duration(crop.regrowSeconds * 1000) })
    : t("garden.harvest_single");
}

/**
 * Samenladen. Es werden **alle** Sorten gelistet, auch die gerade nicht
 * lieferbaren — man soll durchscrollen und sehen können, worauf sich das
 * Warten lohnt. Ausverkauftes ist ausgegraut und nicht anklickbar.
 */
export function renderSeedShop(state, now = Date.now()) {
  const rows = CROP_ORDER.map((id) => {
    const crop = CROPS[id];
    const stock = state.shop.stock[id] || 0;
    const affordable = state.coins >= crop.seedPrice;
    // Manche Sorten gibt es im Original nur in den Wetter-Läden. Die stehen
    // zwar in der Liste, damit man sie kennt, sind hier aber nie lieferbar.
    const stockLine = stock
      ? `<small class="shop-stock">${escapeHtml(t("garden.stock", { value: stock }))}</small>`
      : `<small class="shop-out">${escapeHtml(t(crop.stockChance > 0 ? "garden.sold_out" : "garden.weather_only"))}</small>`;
    return `<article class="shop-row rarity-${crop.rarity}${stock ? "" : " is-out"}">
      <span class="shop-icon" style="${iconStyle(id)}" aria-hidden="true"></span>
      <div class="shop-info">
        <strong>${escapeHtml(cropName(id))}</strong>
        <small>${escapeHtml(duration(crop.growSeconds * 1000))} · ${escapeHtml(harvestLine(crop))}</small>
        ${stockLine}
      </div>
      <button class="shop-buy" type="button" data-buy="${id}" ${stock && affordable ? "" : "disabled"}>
        <span class="hud-coin icon-coin" aria-hidden="true"></span>${escapeHtml(coins(crop.seedPrice))}
      </button>
    </article>`;
  }).join("");

  return `<header class="shop-head">
      <h2>${escapeHtml(t("garden.shop_seeds"))}</h2>
      <span class="shop-timer" id="restock-timer">${escapeHtml(duration(nextRestockAt(state.shop.slot) - now))}</span>
    </header>
    <div class="shop-list">${rows}</div>`;
}

/** Läden, deren Inhalt noch nicht gebaut ist. */
export function renderPlaceholder(shopId) {
  return `<header class="shop-head"><h2>${escapeHtml(t(`garden.shop_${shopId}`))}</h2></header>
    <p class="shop-empty">${escapeHtml(t("garden.shop_soon_body"))}</p>`;
}

/** Verkaufsstand: Ernte nach Sorte, mit Gesamtgewicht und Erlös. */
export function renderSellShop(state, moneyMultiplier = 1) {
  const groups = CROP_ORDER.map((id) => {
    const items = state.harvest.filter((item) => item.cropId === id);
    if (!items.length) return "";
    const baseTotal = items.reduce((sum, item) => sum + cropValue(item.cropId, item.weight), 0);
    const total = Math.max(0, Math.round(baseTotal * Math.max(1, Number(moneyMultiplier) || 1)));
    const heaviest = items.reduce((best, item) => Math.max(best, item.weight), 0);
    return `<article class="shop-row">
      <span class="shop-icon" style="${iconStyle(id)}" aria-hidden="true"></span>
      <div class="shop-info">
        <strong>${escapeHtml(cropName(id))} ×${items.length}</strong>
        <small>${escapeHtml(t("garden.heaviest", { value: weight(heaviest) }))}</small>
      </div>
      <button class="shop-buy" type="button" data-sell="${id}">
        <span class="hud-coin icon-coin" aria-hidden="true"></span>${escapeHtml(coins(total))}
      </button>
    </article>`;
  }).join("");

  const total = harvestValue(state, null, moneyMultiplier);
  return `<header class="shop-head">
      <h2>${escapeHtml(t("garden.shop_crops"))}</h2>
      <span class="shop-timer">${escapeHtml(coins(total))}</span>
    </header>
    <div class="shop-list">${groups || `<p class="shop-empty">${escapeHtml(t("garden.no_harvest"))}</p>`}</div>
    ${groups ? `<button class="shop-sell-all" type="button" data-sell-all>${escapeHtml(t("garden.sell_all"))}</button>` : ""}`;
}
