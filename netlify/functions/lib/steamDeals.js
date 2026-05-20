const https = require("https");

const FREE_GAMES_URL =
  "https://store.steampowered.com/search/results/?query&start=0&count=25&dynamic_data=&sort_by=_ASC&force_infinite=1&maxprice=free&specials=1&infinite=1";

const DISCOUNT_DEALS_URL =
  "https://store.steampowered.com/search/results/?query&start=0&count=75&dynamic_data=&sort_by=_ASC&force_infinite=1&specials=1&infinite=1";

async function fetchSteamFreeGames() {
  const data = await fetchJson(FREE_GAMES_URL);
  return parseSteamResults(data.results_html || "", { exactDiscount: 100 });
}

async function fetchSteamDiscountDeals(minDiscount = 80) {
  const data = await fetchJson(DISCOUNT_DEALS_URL);
  return parseSteamResults(data.results_html || "", { minDiscount, maxDiscount: 99 });
}

async function fetchSteamOffers() {
  const [freeGames, discountDeals] = await Promise.all([
    fetchSteamFreeGames(),
    fetchSteamDiscountDeals(80),
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
      const discountPercent = parseDiscount(discount);

      if (!appId || !title || !matchesDiscount(discountPercent, options)) {
        return null;
      }

      return {
        id: appId,
        title,
        description: "",
        normalPrice: originalPrice,
        salePrice: finalPrice || "0,00 EUR",
        discount,
        discountPercent,
        releaseDate,
        image,
        url: `https://store.steampowered.com/app/${appId}/`,
        platforms: "Steam",
      };
    })
    .filter(Boolean);
}

function matchesDiscount(discountPercent, options) {
  if (!Number.isFinite(discountPercent)) {
    return false;
  }

  if (typeof options.exactDiscount === "number") {
    return discountPercent === options.exactDiscount;
  }

  const minDiscount = options.minDiscount ?? 0;
  const maxDiscount = options.maxDiscount ?? 100;
  return discountPercent >= minDiscount && discountPercent <= maxDiscount;
}

function parseDiscount(discount) {
  const value = String(discount || "").match(/-(\d+)%/);
  return value ? Number(value[1]) : NaN;
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
