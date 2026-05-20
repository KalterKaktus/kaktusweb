import { getSupabase, isConfigReady } from "./supabase-client.js";
import { fetchProfile, getDisplayName } from "./profile.js";

export const KAKTUS_GAME_ID = "kaktus-clicker";

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
        return { error: new Error("Supabase nicht konfiguriert.") };
    }

    const { data, error } = await supabase
        .from("game_saves")
        .select("total_earned, display_name, updated_at")
        .eq("game_id", KAKTUS_GAME_ID)
        .order("total_earned", { ascending: false })
        .limit(limit);

    if (error) {
        return { error: new Error(error.message) };
    }

    return {
        entries: (data || []).map((row, index) => ({
            rank: index + 1,
            name: row.display_name || "Spieler",
            totalEarned: Number(row.total_earned) || 0,
            updatedAt: row.updated_at,
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
