const { fetchSteamOffers } = require("./lib/steamDeals");

const OFFERS_PAGE_URL = process.env.STEAM_OFFERS_PAGE_URL || "/steam-deals/";
const MAX_OFFERS_PER_CATEGORY = 10;
const STORE_NAME = "steam-free-games";
const SEEN_KEY = "seen-offer-ids";

exports.handler = async function () {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("DISCORD_WEBHOOK_URL is not configured.");
    return json({ ok: false, error: "Missing DISCORD_WEBHOOK_URL" }, 200);
  }

  const { freeGames, discountDeals } = await fetchSteamOffers();
  const store = await getBlobStore();
  const seen = await getSeenState(store);

  const newFreeGames = freeGames.filter((game) => !seen.freeIds.includes(game.id));
  const newDiscountDeals = discountDeals.filter((deal) => !seen.discountIds.includes(deal.id));

  await store.setJSON(SEEN_KEY, {
    freeIds: freeGames.map((game) => game.id),
    discountIds: discountDeals.map((deal) => deal.id),
    updatedAt: new Date().toISOString(),
  });

  if (newFreeGames.length === 0 && newDiscountDeals.length === 0) {
    console.log(`No new Steam offers. Free: ${freeGames.length}, deals: ${discountDeals.length}`);
    return json({
      ok: true,
      newFreeGames: 0,
      newDiscountDeals: 0,
      currentFreeGames: freeGames.length,
      currentDiscountDeals: discountDeals.length,
    }, 200);
  }

  await sendDiscordMessage(webhookUrl, { newFreeGames, newDiscountDeals });
  console.log(`Posted ${newFreeGames.length} free game(s) and ${newDiscountDeals.length} deal(s) to Discord.`);

  return json({
    ok: true,
    newFreeGames: newFreeGames.length,
    newDiscountDeals: newDiscountDeals.length,
    currentFreeGames: freeGames.length,
    currentDiscountDeals: discountDeals.length,
  }, 200);
};

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");

  return getStore(STORE_NAME, {
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
  });
}

async function getSeenState(store) {
  const state = await store.get(SEEN_KEY, { type: "json" });

  return {
    freeIds: Array.isArray(state?.freeIds) ? state.freeIds : legacyIds(state),
    discountIds: Array.isArray(state?.discountIds) ? state.discountIds : [],
  };
}

function legacyIds(state) {
  return Array.isArray(state?.ids) ? state.ids : [];
}

async function sendDiscordMessage(webhookUrl, { newFreeGames, newDiscountDeals }) {
  const pageUrl = getOffersPageUrl();
  const parts = [`Steam-Angebote ansehen: <${pageUrl}>`];

  if (newFreeGames.length) {
    parts.push(formatSection("Neue kostenlose Steam-Spiele", newFreeGames));
  }

  if (newDiscountDeals.length) {
    parts.push(formatSection("Neue beliebte Steam-Deals ab 70% Rabatt", newDiscountDeals));
  }

  parts.push(`Alle Angebote: <${pageUrl}>`);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "KalterKaktus Steam Deals",
      content: parts.join("\n\n"),
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: HTTP ${response.status}`);
  }
}

function formatOffers(offers) {
  return offers
    .slice(0, MAX_OFFERS_PER_CATEGORY)
    .map((offer) => {
      return `**${offer.title}** (${formatPriceLine(offer)})\n<${offer.url}>`;
    })
    .join("\n\n");
}

function formatPriceLine(offer) {
  const parts = [offer.discount];

  if (offer.salePrice) {
    parts.push(`jetzt ${offer.salePrice}`);
  }

  if (offer.normalPrice) {
    parts.push(`statt ${offer.normalPrice}`);
  }

  return parts.join(", ");
}

function formatSection(title, offers) {
  const hiddenCount = Math.max(offers.length - MAX_OFFERS_PER_CATEGORY, 0);
  const moreText = hiddenCount > 0
    ? `\n\n...und ${hiddenCount} weitere auf der Website.`
    : "";

  return `**${title}:**\n\n${formatOffers(offers)}${moreText}`;
}

function getOffersPageUrl() {
  const offersPageUrl = normalizeOffersPageUrl(OFFERS_PAGE_URL);
  if (/^https?:\/\//.test(offersPageUrl)) {
    return offersPageUrl;
  }

  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
  return siteUrl ? `${siteUrl}${offersPageUrl}` : offersPageUrl;
}

function normalizeOffersPageUrl(url) {
  return String(url || "/steam-deals/")
    .replace(/\/free-games(?:\.html)?\/?$/, "/steam-deals/");
}

function json(body, statusCode) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
