const ADMIN_EMAILS_ENV = "ADMIN_EMAILS";
const FORCE_RELOAD_MESSAGE = "Dein Spielstand wurde aktualisiert. Die Seite wird neu geladen.";
const PRESENCE_ONLINE_WINDOW_MS = 90000;

function env(name) {
    return globalThis.Netlify?.env?.get(name) || process.env[name];
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function restUrl(path, query = "") {
    return `${env("SUPABASE_URL")}/rest/v1/${path}${query}`;
}

function authUrl(path) {
    return `${env("SUPABASE_URL")}/auth/v1/${path}`;
}

function supabaseHeaders(extra = {}) {
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...extra,
    };
}

function getBearerToken(req) {
    const authorization = req.headers.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

function getAdminEmails() {
    return new Set(
        String(env(ADMIN_EMAILS_ENV) || "")
            .split(/[,\s]+/)
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
    );
}

async function getUserFromToken(token) {
    const response = await fetch(authUrl("user"), {
        headers: {
            apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw httpError("Bitte zuerst einloggen.", 401);
    }

    return response.json();
}

async function requireAdmin(req) {
    const adminEmails = getAdminEmails();
    if (!adminEmails.size) {
        throw httpError(`Admin-API ist ohne ${ADMIN_EMAILS_ENV} gesperrt.`, 503);
    }

    const token = getBearerToken(req);
    if (!token) {
        throw httpError("Bitte zuerst einloggen.", 401);
    }

    const user = await getUserFromToken(token);
    const email = String(user?.email || "").toLowerCase();
    if (!email || !adminEmails.has(email)) {
        throw httpError("Dieser Account ist nicht als Admin freigeschaltet.", 403);
    }

    return user;
}

async function supabase(path, options = {}, query = "") {
    const response = await fetch(restUrl(path, query), {
        ...options,
        headers: supabaseHeaders(options.headers),
    });
    const body = await response.text();
    const data = body ? JSON.parse(body) : null;
    if (!response.ok) {
        throw new Error(data?.message || `Supabase HTTP ${response.status}`);
    }
    return data;
}

async function listUsers() {
    const [profiles, saves, presenceRows] = await Promise.all([
        supabase("profiles", {}, "?select=id,username,is_banned,avatar_url,updated_at&order=updated_at.desc"),
        supabase("game_saves", {}, "?select=user_id,game_id,display_name,total_earned,payload,updated_at&order=updated_at.desc"),
        listPresence(),
    ]);
    const savesByUser = new Map();
    const presenceByUser = new Map((presenceRows || []).map((presence) => [presence.user_id, presence]));

    for (const save of saves || []) {
        const userSaves = savesByUser.get(save.user_id) || [];
        userSaves.push(save);
        savesByUser.set(save.user_id, userSaves);
    }

    return (profiles || []).map((profile) => ({
        ...profile,
        saves: savesByUser.get(profile.id) || [],
        presence: formatPresence(presenceByUser.get(profile.id)),
    }));
}

async function listPresence() {
    try {
        return await supabase("user_presence", {}, "?select=user_id,path,last_seen");
    } catch (error) {
        console.error("Presence konnte nicht geladen werden:", error.message);
        return [];
    }
}

function formatPresence(presence) {
    const lastSeen = presence?.last_seen ? Date.parse(presence.last_seen) : 0;
    return {
        online: Boolean(lastSeen && Date.now() - lastSeen <= PRESENCE_ONLINE_WINDOW_MS),
        path: presence?.path || "",
        last_seen: presence?.last_seen || null,
    };
}

function requireGameId(gameId) {
    const value = String(gameId || "").trim();
    if (!value || value.length > 120) {
        throw httpError("Game fehlt.", 400);
    }

    return value;
}

function normalizePayload(payload) {
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
        throw httpError("Payload muss ein JSON-Objekt sein.", 400);
    }

    return payload;
}

async function deleteSave(userId, gameId) {
    await supabase(
        "game_saves",
        { method: "DELETE" },
        `?user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${encodeURIComponent(requireGameId(gameId))}`
    );
}

async function updateSave(userId, gameId, body) {
    const totalEarned = Number(body.totalEarned);
    if (!Number.isFinite(totalEarned)) {
        throw httpError("total_earned muss eine Zahl sein.", 400);
    }

    await supabase(
        "game_saves",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                display_name: String(body.displayName || "Spieler").slice(0, 120),
                payload: normalizePayload(body.payload),
                total_earned: totalEarned,
                updated_at: new Date().toISOString(),
            }),
        },
        `?user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${encodeURIComponent(requireGameId(gameId))}`
    );
}

async function sendMessage(userId, message) {
    const value = String(message || "").trim().slice(0, 500);
    if (!value) {
        throw httpError("Nachricht fehlt.", 400);
    }

    await supabase("admin_messages", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, message: value }),
    });
}

async function setBan(userId, isBanned) {
    await supabase(
        "profiles",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ is_banned: Boolean(isBanned), updated_at: new Date().toISOString() }),
        },
        `?id=eq.${encodeURIComponent(userId)}`
    );
}

export default async (req) => {
    if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) {
        return json({ error: "Admin-API ist nicht konfiguriert." }, 503);
    }

    try {
        await requireAdmin(req);

        if (req.method === "GET") {
            return json({ users: await listUsers() });
        }

        if (req.method !== "POST") {
            return json({ error: "Methode nicht erlaubt." }, 405);
        }

        const body = await req.json();
        if (!body.userId) {
            return json({ error: "User fehlt." }, 400);
        }

        if (body.action === "delete-save") {
            await deleteSave(body.userId, body.gameId);
        } else if (body.action === "update-save") {
            await updateSave(body.userId, body.gameId, body);
        } else if (body.action === "message") {
            await sendMessage(body.userId, body.message);
        } else if (body.action === "reload") {
            await sendMessage(body.userId, FORCE_RELOAD_MESSAGE);
        } else if (body.action === "ban") {
            await setBan(body.userId, body.isBanned);
        } else {
            return json({ error: "Aktion unbekannt." }, 400);
        }

        return json({ ok: true });
    } catch (error) {
        return json({ error: error.message || "Admin-Aktion fehlgeschlagen." }, error.status || 500);
    }
};

export const config = {
    path: "/adminpanel/api",
};
