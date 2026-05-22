import { getSupabase, isConfigReady } from "./supabase-client.js";
import { fetchProfile, getDisplayName } from "./profile.js";

export const KAKTUS_GAME_ID = "kaktus-clicker";
const LEADERBOARD_TIME_ZONE = "Europe/Berlin";

const berlinDateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LEADERBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

function getBerlinWallEpoch(date) {
    const parts = Object.fromEntries(
        berlinDateParts.formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, Number(part.value)])
    );

    return Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
    );
}

function berlinWallEpochToInstant(wallEpoch) {
    let instantEpoch = wallEpoch;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const offset = getBerlinWallEpoch(new Date(instantEpoch)) - instantEpoch;
        instantEpoch = wallEpoch - offset;
    }

    return new Date(instantEpoch);
}

function formatPeriodId(wallEpoch) {
    const date = new Date(wallEpoch);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

export function getMonthlyLeaderboardPeriod(now = new Date()) {
    const berlinWallNow = getBerlinWallEpoch(now);
    const berlinWallDate = new Date(berlinWallNow);
    const resetWall = Date.UTC(
        berlinWallDate.getUTCFullYear(),
        berlinWallDate.getUTCMonth(),
        1
    );
    const nextResetWall = Date.UTC(
        berlinWallDate.getUTCFullYear(),
        berlinWallDate.getUTCMonth() + 1,
        1
    );

    return {
        id: formatPeriodId(resetWall),
        resetAt: berlinWallEpochToInstant(resetWall),
        nextResetAt: berlinWallEpochToInstant(nextResetWall),
    };
}

export async function getGameSession() {
    if (!isConfigReady()) {
        return null;
    }

    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function getGameProfile(user) {
    if (!user?.id) {
        return null;
    }

    return fetchProfile(user.id);
}

export async function signOutGameSession() {
    const supabase = getSupabase();
    if (supabase) {
        await supabase.auth.signOut();
    }
}

export async function resolveDisplayName(user) {
    const profile = await fetchProfile(user.id);
    return getDisplayName(user, profile);
}

export async function loadCloudSave(user) {
    const supabase = getSupabase();
    if (!supabase || !user?.id) {
        return null;
    }

    const { data, error } = await supabase
        .from("game_saves")
        .select("payload, total_earned, display_name, season_id, updated_at")
        .eq("user_id", user.id)
        .eq("game_id", KAKTUS_GAME_ID)
        .maybeSingle();

    if (error) {
        console.error("Cloud-Save laden fehlgeschlagen:", error.message);
        return null;
    }

    if (!data?.payload) {
        return null;
    }

    return {
        state: data.payload,
        totalEarned: Number(data.total_earned) || 0,
        displayName: data.display_name,
        seasonId: data.season_id,
        updatedAt: data.updated_at ? Date.parse(data.updated_at) : 0,
    };
}

export async function pushCloudSave(user, state) {
    const supabase = getSupabase();
    if (!supabase || !user?.id) {
        return { error: new Error("Nicht eingeloggt.") };
    }

    const period = getMonthlyLeaderboardPeriod();
    if (state.season?.id !== period.id) {
        return { error: new Error("Dieser Save gehört zu einer alten Saison. Bitte neu laden.") };
    }

    const displayName = await resolveDisplayName(user);
    const totalEarned = Number(state.totalEarned) || 0;

    const { error } = await supabase
        .from("game_saves")
        .upsert({
            user_id: user.id,
            game_id: KAKTUS_GAME_ID,
            season_id: period.id,
            payload: state,
            total_earned: totalEarned,
            display_name: displayName,
            updated_at: new Date().toISOString(),
        });

    if (error) {
        console.error("Cloud-Save fehlgeschlagen:", error.message);
        return { error: new Error(error.message) };
    }

    return { ok: true };
}

export async function ensureKaktusSeason() {
    try {
        const response = await fetch("/api/kaktus-clicker-season", {
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    } catch (error) {
        console.error("Monatssaison konnte nicht geprüft werden:", error.message);
        return null;
    }
}

export async function fetchLeaderboard(limit = 1000) {
    const supabase = getSupabase();
    if (!supabase) {
        return { error: new Error("Rangliste ist gerade nicht verfügbar.") };
    }

    await ensureKaktusSeason();
    const period = getMonthlyLeaderboardPeriod();
    const previousPeriod = getMonthlyLeaderboardPeriod(new Date(period.resetAt.getTime() - 1000));
    const [{ data, error }, { data: archive, error: archiveError }] = await Promise.all([
        supabase
            .from("game_saves")
            .select("total_earned, display_name, season_id, updated_at")
            .eq("game_id", KAKTUS_GAME_ID)
            .eq("season_id", period.id)
            .order("total_earned", { ascending: false })
            .limit(limit),
        supabase
            .from("game_season_archives")
            .select("top_entries")
            .eq("game_id", KAKTUS_GAME_ID)
            .eq("season_id", previousPeriod.id)
            .maybeSingle(),
    ]);

    if (error) {
        return { error: new Error("Rangliste konnte nicht geladen werden.") };
    }

    if (archiveError) {
        console.error("Letzter Monatsabschluss konnte nicht geladen werden:", archiveError.message);
    }

    const previousTopThree = Array.isArray(archive?.top_entries)
        ? archive.top_entries.map((entry, index) => ({
            rank: index + 1,
            name: entry.name || "Spieler",
            score: Number(entry.score) || 0,
            updatedAt: entry.updatedAt || null,
        }))
        : [];

    return {
        period,
        previousPeriod,
        previousTopThree,
        previousWinner: previousTopThree[0]
            ? {
                name: previousTopThree[0].name,
                score: previousTopThree[0].score,
                updatedAt: previousTopThree[0].updatedAt,
            }
            : null,
        entries: (data || [])
            .filter((entry) => Number(entry.total_earned) > 0)
            .map((entry, index) => ({
            rank: index + 1,
            name: entry.display_name || "Spieler",
            totalEarned: Number(entry.total_earned) || 0,
            updatedAt: entry.updated_at,
        })),
    };
}
