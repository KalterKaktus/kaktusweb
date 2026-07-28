import { fetchLeaderboard } from "./game-cloud.js";
import { fetchLeaderboard as fetchFishingLeaderboard } from "/games/MyFishingKaktus/js/systems/saveSystem.js";
import { formatNumber } from "/games/KaktusClicker/format.js";
import { renderLevelTag, renderPlayerName } from "./progression.js";
import { getSupabase, isConfigReady } from "./supabase-client.js";
import { t, onLanguageChange } from "./i18n.js";

const monthlyPlayers = document.getElementById("home-monthly-players");
const lastMonthPlayers = document.getElementById("home-last-month-players");
const fishingPlayers = document.getElementById("home-fishing-players");
const xpPlayers = document.getElementById("home-xp-players");

async function renderHomeLeaderboard() {
    if (!monthlyPlayers || !lastMonthPlayers) {
        return;
    }

    const { entries, previousTopThree, error } = await fetchLeaderboard(3);
    if (error) {
        renderPlayers(monthlyPlayers, [], t("home.board_offline"));
        renderPlayers(lastMonthPlayers, [], t("home.board_come_back"));
        return;
    }

    renderPlayers(monthlyPlayers, entries, t("home.board_first_place_open"));
    renderPlayers(lastMonthPlayers, previousTopThree || [], t("home.board_no_close"));
}

async function renderHomeFishingLeaderboard() {
    if (!fishingPlayers) {
        return;
    }

    const { entries, error } = await fetchFishingLeaderboard();
    if (error) {
        renderPlayers(fishingPlayers, [], t("home.board_offline"));
        return;
    }

    renderFishingPlayers(fishingPlayers, entries.slice(0, 3), t("home.board_no_angler"));
}

function renderPlayers(root, entries, emptyText) {
    root.innerHTML = entries.length
        ? entries.map((entry) => `
            <li>
                <b>#${entry.rank}</b>
                <span>${renderLevelTag(entry.level || 0, entry.equippedBadge || null)}${renderPlayerName(escapeHtml(entry.name), { vip: entry.vip, vipColor: entry.vipColor })}</span>
                <em>${escapeHtml(formatNumber(entry.totalEarned ?? entry.score))}</em>
            </li>
        `).join("")
        : `<li>${escapeHtml(emptyText)}</li>`;
}

function renderFishingPlayers(root, entries, emptyText) {
    root.innerHTML = entries.length
        ? entries.map((entry, index) => `
            <li>
                <b>#${entry.rank || index + 1}</b>
                <span>${renderLevelTag(entry.level || 0, entry.equippedBadge || null)}${renderPlayerName(escapeHtml(entry.name), { vip: entry.vip, vipColor: entry.vipColor })}</span>
                <em>${escapeHtml(t("home.board_prestige"))} ${escapeHtml(entry.prestige)} · ${escapeHtml(formatNumber(entry.totalCaught))} ${escapeHtml(t("home.board_catches"))}</em>
            </li>
        `).join("")
        : `<li>${escapeHtml(emptyText)}</li>`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function renderHomeXpLeaderboard() {
    if (!xpPlayers) return;
    if (!isConfigReady()) {
        xpPlayers.innerHTML = `<li>Rangliste offline</li>`;
        return;
    }
    const supabase = getSupabase();
    if (!supabase) {
        xpPlayers.innerHTML = `<li>Rangliste offline</li>`;
        return;
    }
    const { data, error } = await supabase
        .from("profiles_public")
        .select("id, username, total_xp, level, equipped_badge, vip, vip_color")
        .gt("total_xp", 0)
        .order("total_xp", { ascending: false })
        .limit(3);
    if (error) {
        xpPlayers.innerHTML = `<li>Rangliste offline</li>`;
        return;
    }
    renderXpPlayers(xpPlayers, data || [], t("home.board_no_xp"));
}

function renderXpPlayers(root, entries, emptyText) {
    root.innerHTML = entries.length
        ? entries.map((entry, index) => `
            <li>
                <b>#${index + 1}</b>
                <span>${renderLevelTag(entry.level || 0, entry.equipped_badge || null)}${renderPlayerName(escapeHtml(entry.username || "Spieler"), { vip: entry.vip, vipColor: entry.vip_color })}</span>
                <em>${formatNumber(entry.total_xp || 0)} XP</em>
            </li>
        `).join("")
        : `<li>${escapeHtml(emptyText)}</li>`;
}

function renderAll() {
    renderHomeLeaderboard();
    renderHomeFishingLeaderboard();
    renderHomeXpLeaderboard();
}

renderAll();
// Bei Sprach-Wechsel neu rendern damit fallback-Strings, "Prestige"/"Fänge" etc.
// mit übersetzten Texten erscheinen.
onLanguageChange(renderAll);
