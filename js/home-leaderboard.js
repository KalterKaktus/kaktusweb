import { fetchLeaderboard } from "./game-cloud.js";
import { fetchLeaderboard as fetchFishingLeaderboard } from "/games/MyFishingKaktus/js/systems/saveSystem.js";
import { formatNumber } from "/games/KaktusClicker/format.js";
import { renderLevelTag, renderPlayerName } from "./progression.js";

const monthlyPlayers = document.getElementById("home-monthly-players");
const lastMonthPlayers = document.getElementById("home-last-month-players");
const fishingPlayers = document.getElementById("home-fishing-players");

async function renderHomeLeaderboard() {
    if (!monthlyPlayers || !lastMonthPlayers) {
        return;
    }

    const { entries, previousTopThree, error } = await fetchLeaderboard(3);
    if (error) {
        renderPlayers(monthlyPlayers, [], "Rangliste offline");
        renderPlayers(lastMonthPlayers, [], "Kommt wieder");
        return;
    }

    renderPlayers(monthlyPlayers, entries, "Platz 1 ist offen");
    renderPlayers(lastMonthPlayers, previousTopThree || [], "Noch kein Abschluss");
}

async function renderHomeFishingLeaderboard() {
    if (!fishingPlayers) {
        return;
    }

    const { entries, error } = await fetchFishingLeaderboard();
    if (error) {
        renderPlayers(fishingPlayers, [], "Rangliste offline");
        return;
    }

    renderFishingPlayers(fishingPlayers, entries.slice(0, 3), "Noch kein Angler");
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
                <em>Prestige ${escapeHtml(entry.prestige)} · ${escapeHtml(formatNumber(entry.totalCaught))} Fänge</em>
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

renderHomeLeaderboard();
renderHomeFishingLeaderboard();
