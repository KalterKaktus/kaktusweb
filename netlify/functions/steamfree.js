const { fetchSteamOffers } = require("./lib/steamDeals");

exports.handler = async function () {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=900",
  };

  try {
    const { freeGames, discountDeals } = await fetchSteamOffers();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        active: freeGames,
        discounted: discountDeals,
        source: "Steam Store",
        sourceUrl: "https://store.steampowered.com/search/?maxprice=free&specials=1",
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
