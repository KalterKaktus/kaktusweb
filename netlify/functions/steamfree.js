const https = require("https");

const CHEAPSHARK_URL =
  "https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=0&pageSize=24&sortBy=DealRating";

exports.handler = async function () {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=900",
  };

  try {
    const deals = await fetchJson(CHEAPSHARK_URL);
    const active = deals
      .filter((deal) => Number(deal.salePrice) === 0)
      .map((deal) => ({
        id: deal.dealID,
        title: deal.title,
        normalPrice: deal.normalPrice,
        salePrice: deal.salePrice,
        savings: Math.round(Number(deal.savings || 0)),
        steamAppId: deal.steamAppID || null,
        image: deal.thumb || "",
        url: deal.steamAppID
          ? `https://store.steampowered.com/app/${deal.steamAppID}/`
          : `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        active,
        upcoming: [],
        source: "CheapShark Steam deals",
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Kostenlose Steam-Spiele konnten gerade nicht geladen werden.",
        details: error.message,
      }),
    };
  }
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "KalterKaktus/1.0" } }, (res) => {
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
      })
      .on("error", reject);
  });
}
