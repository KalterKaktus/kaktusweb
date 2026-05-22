import { fetchLeaderboard } from "./game-cloud.js";
import { formatNumber } from "/games/KaktusClicker/format.js";

const monthlyPlayers = document.getElementById("home-monthly-players");
const lastMonthPlayers = document.getElementById("home-last-month-players");

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

function renderPlayers(root, entries, emptyText) {
    root.innerHTML = entries.length
        ? entries.map((entry) => `
            <li>
                <b>#${entry.rank}</b>
                <span>${escapeHtml(entry.name)}</span>
                <em>${escapeHtml(formatNumber(entry.totalEarned ?? entry.score))}</em>
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
