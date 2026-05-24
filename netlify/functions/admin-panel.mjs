const ADMIN_EMAILS_ENV = "ADMIN_EMAILS";
const FORCE_RELOAD_MESSAGE = "Dein Spielstand wurde aktualisiert. Die Seite wird neu geladen.";
const PRESENCE_ONLINE_WINDOW_MS = 90000;
const ADMIN_GAME_EVENT_TYPES = {
    "kaktus-clicker": new Set(["spawn-goldkaktus", "spawn-rubinkaktus", "force-reload"]),
    "my-fishing-kaktus": new Set([
        "weather-sunny",
        "weather-rain",
        "weather-storm",
        "weather-fog",
        "weather-night",
        "weather-abyss",
        "weather-polarlicht",
        "weather-glutsturm",
        "weather-blutmond",
        "weather-geistermeer",
        "weather-clear",
        "broadcast",
        "spawn-fish-small",
        "spawn-fish-big",
        "spawn-fish-sword",
        "spawn-fish-shark",
        "force-spawn-epic",
        "force-spawn-legendary",
        // Upgrade-sicher: bei neuer Rarity (z.B. "force-spawn-mythic") einfach hier
        // ergänzen + Client-Handler matched per Prefix automatisch.
        "spawn-karl",
        "force-reload",
    ]),
};

// Cross-Game-Events werden an alle Spiele dieser Liste gefannt.
const CROSS_GAME_EVENT_TYPES = new Set(["force-reload"]);

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
        supabase("game_saves", {}, "?select=user_id,game_id,display_name,total_earned,season_id,payload,updated_at&order=updated_at.desc"),
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

function requireGameEventType(gameId, eventType) {
    const safeGameId = requireGameId(gameId);
    const safeEventType = String(eventType || "").trim();
    if (!ADMIN_GAME_EVENT_TYPES[safeGameId]?.has(safeEventType)) {
        throw httpError("Adminabuse-Event ist für dieses Game nicht freigegeben.", 400);
    }

    return { gameId: safeGameId, eventType: safeEventType };
}

function sanitizeEventPayload(eventType, raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return {};
    }
    if (eventType === "broadcast") {
        const message = String(raw.message || "").trim().slice(0, 200);
        if (!message) {
            throw httpError("Broadcast-Text fehlt.", 400);
        }
        return { message };
    }
    return {};
}

async function triggerGameEvent(gameId, eventType, rawPayload) {
    const safeEvent = requireGameEventType(gameId, eventType);
    const payload = sanitizeEventPayload(safeEvent.eventType, rawPayload);
    await supabase("admin_game_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
            game_id: safeEvent.gameId,
            event_type: safeEvent.eventType,
            payload,
            expires_at: new Date(Date.now() + 60000).toISOString(),
        }),
    });
}

async function triggerCrossGameEvent(eventType, rawPayload) {
    const safeEventType = String(eventType || "").trim();
    if (!CROSS_GAME_EVENT_TYPES.has(safeEventType)) {
        throw httpError("Cross-Game-Event ist nicht freigegeben.", 400);
    }
    const payload = sanitizeEventPayload(safeEventType, rawPayload);
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    // Pro Spiel einzeln einfügen, damit die game-spezifischen Subscriber treffen.
    const rows = Object.keys(ADMIN_GAME_EVENT_TYPES)
        .filter((gameId) => ADMIN_GAME_EVENT_TYPES[gameId].has(safeEventType))
        .map((gameId) => ({
            game_id: gameId,
            event_type: safeEventType,
            payload,
            expires_at: expiresAt,
        }));
    if (!rows.length) {
        throw httpError("Kein Spiel akzeptiert dieses Event.", 400);
    }
    await supabase("admin_game_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(rows),
    });
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
        if (body.action === "trigger-game-event") {
            await triggerGameEvent(body.gameId, body.eventType, body.payload);
            return json({ ok: true });
        }

        if (body.action === "trigger-cross-game-event") {
            await triggerCrossGameEvent(body.eventType, body.payload);
            return json({ ok: true });
        }

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
