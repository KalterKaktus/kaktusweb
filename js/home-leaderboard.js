import { fetchLeaderboard } from "./game-cloud.js";

const weeklyPlayer = document.getElementById("home-weekly-player");
const lastWeekPlayer = document.getElementById("home-last-week-player");

function formatNumber(value) {
    return Intl.NumberFormat("de-DE", {
        maximumFractionDigits: Number(value) >= 10 ? 0 : 1,
    }).format(Number(value) || 0);
}

function setText(element, value) {
    if (element) {
        element.textContent = value;
    }
}

async function renderHomeLeaderboard() {
    if (!weeklyPlayer || !lastWeekPlayer) {
        return;
    }

    const { entries, previousWinner, error } = await fetchLeaderboard(1);
    if (error) {
        setText(weeklyPlayer, "Rangliste offline");
        setText(lastWeekPlayer, "Kommt wieder");
        return;
    }

    const weeklyWinner = entries[0];
    setText(
        weeklyPlayer,
        weeklyWinner
            ? `${weeklyWinner.name} · ${formatNumber(weeklyWinner.totalEarned)}`
            : "Platz 1 ist offen"
    );
    setText(
        lastWeekPlayer,
        previousWinner
            ? `${previousWinner.name} · ${formatNumber(previousWinner.score)}`
            : "Noch kein Sieger"
    );
}

renderHomeLeaderboard();
