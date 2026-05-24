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
// Emojis sind bewusst alle unique — keine Dopplungen mit Mutationen / Wetter.
export const BADGES = {
    // === Auto-Award durch DB-Trigger (check_level_badges) ===
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
        id: "lvl_75", name: "Level 75", icon: "🏆", color: "#ff9966",
        desc: "Erreiche Level 75", auto: true,
        check: ({ level }) => level >= 75,
    },
    lvl_100: {
        id: "lvl_100", name: "Level 100", icon: "🎖", color: "#ffd166",
        desc: "Erreiche Level 100 — das Maximum", auto: true,
        check: ({ level }) => level >= 100,
    },
    // === Manuell / besondere Trigger ===
    tester: {
        id: "tester", name: "Tester", icon: "🧪", color: "#ff6b6b",
        desc: "Pre-Release Spieler — vom Admin verliehen",
        manual: true,
    },
    vip: {
        id: "vip", name: "VIP", icon: "👑", color: "#ffd166",
        desc: "VIP-Status mit +20 % XP-Boost und eigener Namensfarbe — auf Discord-Anfrage vergeben",
        manual: true, vipExclusive: true,
    },
    supporter: {
        id: "supporter", name: "Unterstützer", icon: "🌹", color: "#ff86c2",
        desc: "Hat die Seite unterstützt — auf Discord-Anfrage vergeben",
        manual: true,
    },
    haunted_catch: {
        id: "haunted_catch", name: "Geisterjäger", icon: "👻", color: "#c8f5ff",
        desc: "Fange einen Fisch mit der HAUNTED-Mutation",
    },
    daily_streak_7: {
        id: "daily_streak_7", name: "Wochen-Pilger", icon: "📅", color: "#ffd166",
        desc: "Sammle 7 Tage Daily-Login-Streak",
    },
    referrer: {
        id: "referrer", name: "Werber", icon: "❤️", color: "#ff6b9d",
        desc: "Wirb 1 Freund der Level 5 erreicht",
    },
};

export const BADGE_ORDER = [
    "vip", "supporter", "tester",
    "lvl_25", "lvl_50", "lvl_75", "lvl_100",
    "referrer", "haunted_catch", "daily_streak_7",
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

/**
 * Wickelt einen Spielernamen in einen Span mit VIP-Farbe wenn vorhanden.
 * Wird auf Leaderboards genutzt damit VIPs sich farblich abheben.
 * `name` muss bereits HTML-escaped sein!
 */
export function renderPlayerName(escapedName, { vip = false, vipColor = null } = {}) {
    if (vip && vipColor) {
        // Style direkt setzen — sicher weil vipColor nur Hex-Color sein darf (DB-seitig validierbar)
        const safeColor = String(vipColor).match(/^#[0-9a-fA-F]{3,8}$/) ? vipColor : "#ffd166";
        return `<span class="player-name is-vip" style="color:${safeColor}">${escapedName}</span>`;
    }
    return escapedName;
}
