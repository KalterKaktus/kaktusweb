const https = require("https");

const GIVEAWAYS_URL =
  "https://www.gamerpower.com/api/giveaways?platform=steam&type=game&sort-by=date";

exports.handler = async function () {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=900",
  };

  try {
    const giveaways = await fetchJson(GIVEAWAYS_URL);
    const active = normalizeGiveaways(giveaways);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        active,
        upcoming: [],
        source: "GamerPower",
        sourceUrl: "https://www.gamerpower.com/",
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

function normalizeGiveaways(giveaways) {
  if (!Array.isArray(giveaways)) {
    return [];
  }

  return giveaways.map((giveaway) => ({
    id: String(giveaway.id),
    title: giveaway.title,
    description: giveaway.description || "",
    normalPrice: giveaway.worth || "",
    salePrice: "0.00",
    endDate: giveaway.end_date || "",
    image: giveaway.thumbnail || giveaway.image || "",
    url: giveaway.open_giveaway_url || giveaway.gamerpower_url,
    platforms: giveaway.platforms || "Steam",
  }));
}
