import { getSupabase, isConfigReady } from "./supabase-client.js";
import { fetchProfile, getDisplayName } from "./profile.js";

export const KAKTUS_GAME_ID = "kaktus-clicker";
const LEADERBOARD_TIME_ZONE = "Europe/Berlin";
const DAY_MS = 24 * 60 * 60 * 1000;

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
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}-23`;
}

export function getWeeklyLeaderboardPeriod(now = new Date()) {
    const berlinWallNow = getBerlinWallEpoch(now);
    const berlinWallDate = new Date(berlinWallNow);
    const currentSundayResetWall = Date.UTC(
        berlinWallDate.getUTCFullYear(),
        berlinWallDate.getUTCMonth(),
        berlinWallDate.getUTCDate() - berlinWallDate.getUTCDay(),
        23
    );
    const resetWall = berlinWallNow < currentSundayResetWall
        ? currentSundayResetWall - (7 * DAY_MS)
        : currentSundayResetWall;
    const nextResetWall = resetWall + (7 * DAY_MS);

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
        .select("payload, total_earned, display_name, updated_at")
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
        updatedAt: data.updated_at ? Date.parse(data.updated_at) : 0,
    };
}

export async function pushCloudSave(user, state) {
    const supabase = getSupabase();
    if (!supabase || !user?.id) {
        return { error: new Error("Nicht eingeloggt.") };
    }

    const displayName = await resolveDisplayName(user);
    const totalEarned = Number(state.totalEarned) || 0;

    const { error } = await supabase
        .from("game_saves")
        .upsert({
            user_id: user.id,
            game_id: KAKTUS_GAME_ID,
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

export async function fetchLeaderboard(limit = 25) {
    const supabase = getSupabase();
    if (!supabase) {
        return { error: new Error("Rangliste ist gerade nicht verfügbar.") };
    }

    const period = getWeeklyLeaderboardPeriod();
    const { data, error } = await supabase
        .from("game_saves")
        .select("payload, display_name, updated_at")
        .eq("game_id", KAKTUS_GAME_ID)
        .limit(250);

    if (error) {
        return { error: new Error("Rangliste konnte nicht geladen werden.") };
    }

    return {
        period,
        entries: (data || [])
            .map((row) => ({
                name: row.display_name || "Spieler",
                score: Number(row.payload?.weeklyLeaderboard?.score) || 0,
                periodId: row.payload?.weeklyLeaderboard?.periodId,
                updatedAt: row.updated_at,
            }))
            .filter((entry) => entry.periodId === period.id && entry.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, limit)
            .map((entry, index) => ({
            rank: index + 1,
            name: entry.name,
            totalEarned: entry.score,
            updatedAt: entry.updatedAt,
        })),
    };
}

export function pickNewerSave(localState, cloudState) {
    if (!cloudState) {
        return localState;
    }

    if (!localState) {
        return cloudState;
    }

    const localTime = Number(localState.lastSavedAt) || 0;
    const cloudTime = Number(cloudState.lastSavedAt) || 0;
    return cloudTime > localTime ? cloudState : localState;
}
