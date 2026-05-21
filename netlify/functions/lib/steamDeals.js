const https = require("https");

const FREE_GAMES_URL =
  "https://store.steampowered.com/search/results/?query&start=0&count=25&dynamic_data=&sort_by=_ASC&force_infinite=1&maxprice=free&specials=1&infinite=1&cc=DE&l=german";

const DISCOUNT_PAGE_SIZE = 200;
const DISCOUNT_SEARCH_WINDOWS = [
  { sortBy: "_ASC", start: 0 },
  { sortBy: "Reviews_DESC", start: 0 },
  { sortBy: "Reviews_DESC", start: DISCOUNT_PAGE_SIZE },
  { sortBy: "Reviews_DESC", start: DISCOUNT_PAGE_SIZE * 2 },
];

const MIN_JUICY_DISCOUNT = 70;
const MIN_JUICY_REVIEW_COUNT = 3000;
const MIN_JUICY_REVIEW_PERCENT = 50;
const EXCLUDED_DISCOUNT_DEAL_IDS = new Set([
  "1424330", // Wobbledogs
  "1093910", // Tales of the Black Forest
  "2181930", // DR LIVESEY ROM AND DEATH EDITION
]);

async function fetchSteamFreeGames() {
  const data = await fetchJson(FREE_GAMES_URL);
  return parseSteamResults(data.results_html || "", { exactDiscount: 100 });
}

async function fetchSteamDiscountDeals(minDiscount = MIN_JUICY_DISCOUNT) {
  const pages = await Promise.all(
    DISCOUNT_SEARCH_WINDOWS.map((window) => fetchJson(getDiscountDealsUrl(window)))
  );

  const deals = pages.flatMap((data) => parseSteamResults(data.results_html || "", {
    minDiscount,
    maxDiscount: 99,
    minReviewCount: MIN_JUICY_REVIEW_COUNT,
    minReviewPercent: MIN_JUICY_REVIEW_PERCENT,
  }));

  return keepBestDealPerSeries(deals).sort(compareDealQuality);
}

async function fetchSteamOffers() {
  const [freeGames, discountDeals] = await Promise.all([
    fetchSteamFreeGames(),
    fetchSteamDiscountDeals(MIN_JUICY_DISCOUNT),
  ]);

  return { freeGames, discountDeals };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            fetchJson(res.headers.location).then(resolve).catch(reject);
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }

          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(error);
            }
          });
        }
      )
      .on("error", reject);
  });
}

function getDiscountDealsUrl({ sortBy, start }) {
  return `https://store.steampowered.com/search/results/?query&start=${start}&count=${DISCOUNT_PAGE_SIZE}&dynamic_data=&sort_by=${sortBy}&force_infinite=1&specials=1&infinite=1&cc=DE&l=german`;
}

function parseSteamResults(html, options = {}) {
  const rows = html.match(/<a\b[\s\S]*?class="search_result_row[\s\S]*?<\/a>/g) || [];

  return rows
    .map((row) => {
      const appId = match(row, /data-ds-appid="(\d+)"/);
      const title = decodeHtml(match(row, /<span class="title">([\s\S]*?)<\/span>/));
      const image = decodeHtml(match(row, /<img src="([^"]+)"/));
      const originalPrice = decodeHtml(match(row, /<div class="discount_original_price">([\s\S]*?)<\/div>/));
      const finalPrice = decodeHtml(match(row, /<div class="discount_final_price">([\s\S]*?)<\/div>/));
      const discount = decodeHtml(match(row, /<div class="discount_pct">([\s\S]*?)<\/div>/));
      const releaseDate = decodeHtml(match(row, /<div class="search_released responsive_secondrow">\s*([\s\S]*?)\s*<\/div>/));
      const reviewSummary = decodeHtml(match(row, /data-tooltip-html="([^"]+)"/));
      const discountPercent = parseDiscount(discount);
      const reviewStats = parseReviewSummary(reviewSummary);

      if (
        !appId ||
        !title ||
        isExcludedDiscountDeal(appId, options) ||
        !matchesDealFilters(discountPercent, reviewStats, options)
      ) {
        return null;
      }

      return {
        id: appId,
        title,
        description: "",
        normalPrice: originalPrice,
        normalPriceAmount: parseEuroPrice(originalPrice),
        salePrice: finalPrice || "0,00 EUR",
        salePriceAmount: parseEuroPrice(finalPrice || "0,00 EUR"),
        discount,
        discountPercent,
        reviewPercent: reviewStats.percent,
        reviewCount: reviewStats.count,
        reviewSummary,
        releaseDate,
        image,
        url: `https://store.steampowered.com/app/${appId}/`,
        platforms: "Steam",
      };
    })
    .filter(Boolean);
}

function isExcludedDiscountDeal(appId, options) {
  return typeof options.exactDiscount !== "number" && EXCLUDED_DISCOUNT_DEAL_IDS.has(appId);
}

function matchesDealFilters(discountPercent, reviewStats, options) {
  if (!Number.isFinite(discountPercent)) {
    return false;
  }

  if (typeof options.exactDiscount === "number") {
    return discountPercent === options.exactDiscount;
  }

  const minDiscount = options.minDiscount ?? 0;
  const maxDiscount = options.maxDiscount ?? 100;
  const minReviewCount = options.minReviewCount ?? 0;
  const minReviewPercent = options.minReviewPercent ?? 0;

  return discountPercent >= minDiscount
    && discountPercent <= maxDiscount
    && reviewStats.count >= minReviewCount
    && reviewStats.percent >= minReviewPercent;
}

function parseDiscount(discount) {
  const value = String(discount || "").match(/-(\d+)%/);
  return value ? Number(value[1]) : NaN;
}

function parseEuroPrice(price) {
  const value = String(price || "").match(/([\d.,]+)\s*(?:€|EUR)/i);
  if (!value) {
    return NaN;
  }

  return Number(value[1].replace(/\./g, "").replace(",", "."));
}

function parseReviewSummary(summary) {
  const percent = String(summary || "").match(/(\d+)\s*%/);
  const count = String(summary || "").match(/([\d.,\s]+)\s+(?:Nutzerrezensionen|user reviews)/i);

  return {
    percent: percent ? Number(percent[1]) : 0,
    count: count ? Number(count[1].replace(/[^\d]/g, "")) : 0,
  };
}

function keepBestDealPerSeries(deals) {
  const bestDeals = new Map();

  for (const deal of deals) {
    const key = getDealSeriesKey(deal.title);
    const current = bestDeals.get(key);

    if (!current || compareDealQuality(deal, current) < 0) {
      bestDeals.set(key, deal);
    }
  }

  return [...bestDeals.values()];
}

function getDealSeriesKey(title) {
  const baseTitle = String(title || "")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .split(/\s*[:|-]\s*/)[0]
    .replace(/\b(?:deluxe|complete|definitive|ultimate|gold|special|standard|edition|bundle|upgrade|pack|hd|remaster(?:ed)?|collection)\b/g, "")
    .replace(/\b(?:[ivxlcdm]+|\d+)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return baseTitle || String(title || "").toLowerCase();
}

function compareDealQuality(left, right) {
  const leftScore = getDealQualityScore(left);
  const rightScore = getDealQualityScore(right);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  if (right.reviewCount !== left.reviewCount) {
    return right.reviewCount - left.reviewCount;
  }

  return right.discountPercent - left.discountPercent;
}

function getDealQualityScore(deal) {
  const popularity = Math.log10(Math.max(deal.reviewCount || 0, 1)) * 28;
  const reviewQuality = (deal.reviewPercent || 0) * 1.15;
  const discountBonus = (deal.discountPercent || 0) * 0.6;
  return popularity + reviewQuality + discountBonus;
}

function match(value, regex) {
  const result = value.match(regex);
  return result ? result[1].trim() : "";
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  fetchSteamDiscountDeals,
  fetchSteamFreeGames,
  fetchSteamOffers,
};
