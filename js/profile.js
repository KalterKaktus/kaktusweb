import { getSupabase } from "./supabase-client.js";

const KAKTUS_GAME_ID = "kaktus-clicker";

export async function fetchProfile(userId) {
    const supabase = getSupabase();
    if (!supabase || !userId) {
        return null;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_banned, avatar_url, updated_at, total_xp, equipped_badge, vip, vip_color")
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
    if (existing?.username) {
        return existing;
    }

    const supabase = getSupabase();
    if (!supabase) {
        return null;
    }

    // WICHTIG: INSERT statt UPSERT — sonst würde bei jedem fetchProfile()-Fehler
    // (Netzwerk, RLS-Glitch, etc.) der existing username mit einem frischen
    // createKaktusUsername() überschrieben. INSERT failt mit 23505 wenn row
    // schon existiert → wir refetchen einfach und ändern garantiert nichts.
    const { data, error } = await supabase
        .from("profiles")
        .insert({
            id: userId,
            username: createKaktusUsername(),
            updated_at: new Date().toISOString(),
        })
        .select("id, username, is_banned, avatar_url, updated_at")
        .maybeSingle();

    if (error) {
        if (error.code === "23505") {
            // Profile existiert schon — nur fetch zurückgeben, kein Overwrite
            return await fetchProfile(userId);
        }
        console.error("Profile anlegen fehlgeschlagen:", error.message);
        return null;
    }

    return data;
}

// Default-Username für neue Accounts. Bewusst "User_xxxx" damit es nach
// generischer Platzhalter aussieht — motiviert den Spieler den Namen aktiv
// zu setzen statt den Default zu behalten.
function createKaktusUsername() {
    const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `User_${suffix}`;
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

    if (username.length < 2 || username.length > 24) {
        return "Der Benutzername braucht 2–24 Zeichen.";
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
        if (error.code === "23514") {
            return { error: new Error("Username erfüllt nicht die Format-Regeln (nur a-Z, 0-9, _ erlaubt, 2-24 Zeichen).") };
        }
        // Echten Supabase-Fehler durchreichen damit man im Status sieht was kaputt ist
        return { error: new Error(`Profil-Speichern fehlgeschlagen: ${error.message || error.code || "unbekannt"}`) };
    }

    await supabase
        .from("game_saves")
        .update({ display_name: username })
        .eq("user_id", userId)
        .eq("game_id", KAKTUS_GAME_ID);

    return { data };
}
