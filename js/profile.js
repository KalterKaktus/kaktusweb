import { getSupabase } from "./supabase-client.js";

const KAKTUS_GAME_ID = "kaktus-clicker";

export async function fetchProfile(userId) {
    const supabase = getSupabase();
    if (!supabase || !userId) {
        return null;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, updated_at")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("Profile laden fehlgeschlagen:", error.message);
        return null;
    }

    return data;
}

export async function ensureProfile(userId) {
    const existing = await fetchProfile(userId);
    if (existing) {
        return existing;
    }

    const supabase = getSupabase();
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select("id, username, updated_at")
        .single();

    if (error) {
        console.error("Profile anlegen fehlgeschlagen:", error.message);
        return null;
    }

    return data;
}

export function getDisplayName(user, profile) {
    const username = String(profile?.username || "").trim();
    if (username) {
        return username;
    }

    return user?.email || "Account";
}

export function normalizeUsername(value) {
    return String(value || "").trim();
}

export function validateUsername(username) {
    if (!username) {
        return "Bitte einen Benutzernamen eingeben.";
    }

    if (username.length < 3 || username.length > 24) {
        return "Der Benutzername braucht 3–24 Zeichen.";
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return "Nur Buchstaben, Zahlen und Unterstriche sind erlaubt.";
    }

    return null;
}

export async function saveUsername(userId, username) {
    const supabase = getSupabase();
    if (!supabase) {
        return { error: new Error("Profil ist gerade nicht verfügbar.") };
    }

    await ensureProfile(userId);

    const { data, error } = await supabase
        .from("profiles")
        .upsert({
            id: userId,
            username,
            updated_at: new Date().toISOString(),
        })
        .select("id, username, updated_at")
        .single();

    if (error) {
        if (error.code === "23505") {
            return { error: new Error("Dieser Benutzername ist schon vergeben.") };
        }

        return { error: new Error("Profil konnte nicht gespeichert werden.") };
    }

    await supabase
        .from("game_saves")
        .update({ display_name: username })
        .eq("user_id", userId)
        .eq("game_id", KAKTUS_GAME_ID);

    return { data };
}
