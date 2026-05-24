// Progression — Shared Level-Math + Badge-Definitionen.
//
// Eine zentrale Quelle für: Level-Formel, Badge-Liste, Badge-Rendering.
// Wird von beiden Spielen + Profil-Seite + Leaderboards gleichermaßen importiert.

// Level-Formel: XP_to_reach(N) = N² × 8
//   → Lvl 25 = 5.000 XP · Lvl 50 = 20k · Lvl 75 = 45k · Lvl 100 = 80k
// Inverse: level(xp) = floor(sqrt(xp/8))
export const LEVEL_COEF = 8;

export function xpForLevel(level) {
    return Math.floor(level * level * LEVEL_COEF);
}
export function levelFromXp(xp) {
    return Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / LEVEL_COEF));
}
export function xpProgress(xp) {
    const n = Math.max(0, Number(xp) || 0);
    const level = levelFromXp(n);
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const gained = n - currentLevelXp;
    const needed = nextLevelXp - currentLevelXp;
    return {
        level,
        xp: n,
        gained,
        needed,
        percent: needed > 0 ? Math.min(100, (gained / needed) * 100) : 100,
        nextLevelAt: nextLevelXp,
    };
}

// Badges — id ist die Datenbank-Referenz (siehe user_badges.badge_id).
// Locked-Beschreibung steht beim Spieler im Profil wenn er das Badge noch nicht hat.
export const BADGES = {
    // === Auto-Award durch DB-Trigger ===
    lvl_25: {
        id: "lvl_25", name: "Level 25", icon: "⚡", color: "#65e2a2",
        desc: "Erreiche Level 25", auto: true,
        check: ({ level }) => level >= 25,
    },
    lvl_50: {
        id: "lvl_50", name: "Level 50", icon: "💎", color: "#9f9dff",
        desc: "Erreiche Level 50", auto: true,
        check: ({ level }) => level >= 50,
    },
    lvl_75: {
        id: "lvl_75", name: "Level 75", icon: "🌟", color: "#ff9966",
        desc: "Erreiche Level 75", auto: true,
        check: ({ level }) => level >= 75,
    },
    lvl_100: {
        id: "lvl_100", name: "Level 100", icon: "👑", color: "#ffd166",
        desc: "Erreiche Level 100 — das Maximum", auto: true,
        check: ({ level }) => level >= 100,
    },
    // === Manuell vergeben / besondere Trigger ===
    tester: {
        id: "tester", name: "Tester", icon: "🧪", color: "#ff6b6b",
        desc: "Pre-Release Spieler — vom Admin verliehen",
        manual: true,
    },
    vip: {
        id: "vip", name: "VIP", icon: "✨", color: "#ffd166",
        desc: "Unterstützer der Seite (+20 % XP-Boost, eigene Namensfarbe)",
        manual: true, vipExclusive: true,
    },
    first_catch: {
        id: "first_catch", name: "Erster Fang", icon: "🎣", color: "#7ec0ff",
        desc: "Fange deinen ersten Fisch in My Fishing Kaktus",
    },
    first_prestige: {
        id: "first_prestige", name: "Erstes Prestige", icon: "✨", color: "#a3ff8c",
        desc: "Erreiche dein erstes Prestige in einem der Spiele",
    },
    haunted_catch: {
        id: "haunted_catch", name: "Geisterjäger", icon: "👻", color: "#c8f5ff",
        desc: "Fange einen Fisch mit der HAUNTED-Mutation",
    },
    daily_streak_7: {
        id: "daily_streak_7", name: "Wochen-Pilger", icon: "📅", color: "#ffd166",
        desc: "Sammle 7 Tage Daily-Login-Streak",
    },
    referrer_3: {
        id: "referrer_3", name: "Werber", icon: "👥", color: "#d58cff",
        desc: "Wirb 3 verifizierte Freunde",
    },
};

export const BADGE_ORDER = [
    "tester", "vip",
    "lvl_25", "lvl_50", "lvl_75", "lvl_100",
    "first_catch", "first_prestige", "haunted_catch", "daily_streak_7", "referrer_3",
];

export function getBadge(id) {
    return BADGES[id] || null;
}

/**
 * Rendert ein Badge als kompakten Mini-Pill (für Leaderboard/Broadcast).
 * Pure HTML-String — keine DOM-Manipulation.
 */
export function renderBadgePill(badgeId) {
    const b = getBadge(badgeId);
    if (!b) return "";
    return `<span class="badge-pill" style="--badge-c:${b.color}" title="${b.name} — ${b.desc}">${b.icon}</span>`;
}

/**
 * Rendert Level + (optional) equipped Badge inline für Leaderboards.
 *   z.B. "[Lvl 27] 👻"
 */
export function renderLevelTag(level, equippedBadgeId = null) {
    const l = Math.max(0, Math.floor(Number(level) || 0));
    const badge = equippedBadgeId ? renderBadgePill(equippedBadgeId) : "";
    return `<span class="level-tag">Lvl ${l}</span>${badge}`;
}
