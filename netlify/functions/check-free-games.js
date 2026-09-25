const { fetchSteamOffers } = require("./lib/steamDeals");

const OFFERS_PAGE_URL = process.env.STEAM_OFFERS_PAGE_URL || "/steam-deals/";
const MAX_DISCORD_DEALS = 5;
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

  const newFreeGames = freeGames.filter(
    (game) => !seen.freeIds.includes(game.id)
  );

  const newDiscountDeals = discountDeals
    .filter((deal) => !seen.discountIds.includes(deal.id))
    .slice(0, MAX_DISCORD_DEALS);

  await store.setJSON(SEEN_KEY, {
    freeIds: mergeSeenIds(seen.freeIds, freeGames),
    discountIds: mergeSeenIds(seen.discountIds, discountDeals),
    updatedAt: new Date().toISOString(),
  });

  if (newFreeGames.length === 0 && newDiscountDeals.length === 0) {
    console.log(
      `No new Steam offers. Free: ${freeGames.length}, deals: ${discountDeals.length}`
    );

    return json({
      ok: true,
      newFreeGames: 0,
      newDiscountDeals: 0,
      currentFreeGames: freeGames.length,
      currentDiscountDeals: discountDeals.length,
    }, 200);
  }

  await sendDiscordMessage(webhookUrl, {
    newFreeGames,
    newDiscountDeals,
  });

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
    freeIds: Array.isArray(state?.freeIds)
      ? state.freeIds
      : legacyIds(state),

    discountIds: Array.isArray(state?.discountIds)
      ? state.discountIds
      : [],
  };
}

function legacyIds(state) {
  return Array.isArray(state?.ids) ? state.ids : [];
}

function mergeSeenIds(ids, offers) {
  return [
    ...new Set([
      ...(Array.isArray(ids) ? ids : []),
      ...offers.map((offer) => offer.id),
    ]),
  ];
}

async function sendDiscordMessage(webhookUrl, {
  newFreeGames,
  newDiscountDeals,
}) {
  const pageUrl = getOffersPageUrl();

  const parts = [
    "## 🌵 STEAM DEALS",
    "",
    "**Neue Angebote entdeckt**",
  ];

  if (newFreeGames.length) {
    parts.push(
      "",
      "### 🆓 Kostenlos",
      formatOffers(newFreeGames)
    );
  }

  if (newDiscountDeals.length) {
    parts.push(
      "",
      "### 🔥 Top Deals",
      formatOffers(newDiscountDeals)
    );
  }

  parts.push(
    "",
    "---",
    `**KalterKaktus Steam Deals**`,
    "Neue Deals: **4× täglich** · 06:00 · 12:00 · 18:00 · 00:00",
    "",
    `[Alle Steam Deals ansehen](${pageUrl})`
  );

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "KalterKaktus Steam Deals",
      content: parts.join("\n"),
      flags: 4,
      allowed_mentions: {
        parse: [],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Discord webhook failed: HTTP ${response.status}`
    );
  }
}

function formatOffers(offers) {
  return offers
    .map((offer) => {
      const lines = [
        `> **${offer.title}**`,
        `> ${formatPriceLine(offer)}`,
      ];

      if (offer.reviewCount > 0) {
        lines.push(
          `> ⭐ ${offer.reviewPercent}% positiv · ${formatReviewCount(offer.reviewCount)} Bewertungen`
        );
      }

      if (offer.offerType) {
        lines.push(`> ⏳ ${offer.offerType}`);
      }

      if (offer.isHistoricLow) {
        lines.push("> 📉 Historischer Tiefstpreis");
      } else if (offer.isUnusualSale) {
        lines.push("> 📉 Ungewöhnlich hoher Rabatt");
      }

      lines.push(`> [Steam öffnen](${offer.url})`);

      return lines.join("\n");
    })
    .join("\n\n");
}

function formatPriceLine(offer) {
  const parts = [];

  if (offer.discount) {
    parts.push(`🔥 **${offer.discount}**`);
  }

  if (offer.salePrice) {
    parts.push(`~~${offer.normalPrice || ""}~~ → **${offer.salePrice}**`);
  }

  if (!offer.salePrice && offer.normalPrice) {
    parts.push(`**${offer.normalPrice}**`);
  }

  return parts.join(" · ");
}

function formatReviewCount(count) {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)} Mio.`;
  }

  if (count >= 1000) {
    return `${Math.round(count / 1000)}k`;
  }

  return String(count);
}

function getOffersPageUrl() {
  const offersPageUrl = normalizeOffersPageUrl(OFFERS_PAGE_URL);

  if (/^https?:\/\//.test(offersPageUrl)) {
    return offersPageUrl;
  }

  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";

  return siteUrl
    ? `${siteUrl}${offersPageUrl}`
    : offersPageUrl;
}

function normalizeOffersPageUrl(url) {
  return String(url || "/steam-deals/")
    .replace(
      /\/free-games(?:\.html)?\/?$/,
      "/steam-deals/"
    );
}

function json(body, statusCode) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}
