// Daily-Login-Reward-Tabelle.
//
// Belohnungen skalieren mit dem Streak-Tag. Innerhalb einer Woche steigen die Coins,
// Tag 7 ist immer der "Special": Woche 1 = Epic-Spawn, Woche 2 = 2× Epic, ab Woche 3 = Legendary.
//
// Cash-Werte sind bewusst moderat: Daily soll aktives Spielen NICHT ersetzen, sondern ergänzen.
// Ein Legendary-Spawn (gespielt: ~25-40k Coins Wert) ist die "echte" Belohnung an Tag 7 ab Woche 3.

const DAY_MULTIPLIERS = [1, 1.5, 2.2, 3.2, 4.5, 6.0, 8.0]; // Tag 1..7 innerhalb der Woche
const CAP_BASE = 2500; // Wochen-Basis kappt hier — verhindert ewige Inflation

function baseCoinsForWeek(weekNum) {
    if (weekNum <= 1) return 50;
    if (weekNum === 2) return 90;
    if (weekNum === 3) return 140;
    // Ab Woche 4: 12 % Wachstum pro Woche, gedeckelt
    return Math.min(CAP_BASE, Math.round(140 * Math.pow(1.12, weekNum - 3)));
}

/**
 * Liefert die Reward-Daten für einen bestimmten Streak-Tag (1-basiert).
 * Tag 1 = erster Login der Streak, Tag 8 = erster Tag von Woche 2, etc.
 */
export function getDailyReward(streakDay) {
    const safeDay = Math.max(1, Math.floor(streakDay));
    const dayInWeek = ((safeDay - 1) % 7) + 1;
    const weekNum = Math.ceil(safeDay / 7);
    const baseCoins = baseCoinsForWeek(weekNum);
    const coins = Math.round(baseCoins * DAY_MULTIPLIERS[dayInWeek - 1]);

    let spawn = null;
    if (dayInWeek === 7) {
        if (weekNum === 1) spawn = { rarity: "Epic", count: 1 };
        else if (weekNum === 2) spawn = { rarity: "Epic", count: 2 };
        else spawn = { rarity: "Legendary", count: 1 };
    }

    return { coins, spawn, weekNum, dayInWeek, streakDay: safeDay };
}

/**
 * Liefert die Vorschau der nächsten 7 Tage für die UI (was kommt morgen, übermorgen, …).
 */
export function getWeekPreview(streakDay) {
    return Array.from({ length: 7 }, (_, i) => getDailyReward(streakDay + i));
}

/**
 * Lokales Datum als YYYY-MM-DD (für Streak-Tracking).
 * Bewusst lokales Datum statt UTC damit Spieler bei Mitternacht ihrer Zeitzone den neuen Tag bekommen.
 */
export function localDayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Differenz in Tagen zwischen zwei YYYY-MM-DD Strings. NaN wenn ungültig.
 */
export function daysBetween(fromKey, toKey) {
    if (!fromKey || !toKey) return NaN;
    const a = new Date(`${fromKey}T00:00:00`);
    const b = new Date(`${toKey}T00:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Berechnet den nächsten Streak-State basierend auf dem letzten Claim-Tag.
 *   - Selber Tag → null (schon abgeholt)
 *   - Gestern → streak + 1
 *   - Sonst (oder noch nie) → 1 (Reset)
 */
export function nextStreakState(prevStreak, lastClaimedDay, today = localDayKey()) {
    if (lastClaimedDay === today) {
        return { eligible: false, newStreak: prevStreak };
    }
    const gap = daysBetween(lastClaimedDay, today);
    if (Number.isFinite(gap) && gap === 1) {
        return { eligible: true, newStreak: (prevStreak || 0) + 1 };
    }
    return { eligible: true, newStreak: 1 };
}
