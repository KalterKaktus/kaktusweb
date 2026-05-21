const GAME_ID = "kaktus-clicker";
const ADMIN_EMAILS_ENV = "ADMIN_EMAILS";

function env(name) {
    return globalThis.Netlify?.env?.get(name) || process.env[name];
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

function restUrl(path, query = "") {
    return `${env("SUPABASE_URL")}/rest/v1/${path}${query}`;
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

function authUrl(path) {
    return `${env("SUPABASE_URL")}/auth/v1/${path}`;
}

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
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
    const [profiles, saves] = await Promise.all([
        supabase("profiles", {}, "?select=id,username,is_banned,avatar_url,updated_at&order=updated_at.desc"),
        supabase("game_saves", {}, `?select=user_id,display_name,total_earned,payload,updated_at&game_id=eq.${GAME_ID}`),
    ]);
    const savesByUser = new Map((saves || []).map((save) => [save.user_id, save]));

    return (profiles || []).map((profile) => {
        const save = savesByUser.get(profile.id);
        return {
            ...profile,
            save: save ? {
                display_name: save.display_name,
                total_earned: save.total_earned,
                cactus: Number(save.payload?.cactus) || 0,
                updated_at: save.updated_at,
            } : null,
        };
    });
}

async function deleteSave(userId) {
    await supabase("game_saves", { method: "DELETE" }, `?user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${GAME_ID}`);
}

async function setCurrency(userId, cactus) {
    const saves = await supabase(
        "game_saves",
        {},
        `?select=payload&user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${GAME_ID}&limit=1`
    );
    const current = saves?.[0];
    if (!current) {
        throw new Error("Für diesen User gibt es noch keinen Spielstand.");
    }

    const payload = { ...current.payload, cactus: Math.max(0, Number(cactus) || 0) };
    await supabase(
        "game_saves",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ payload, updated_at: new Date().toISOString() }),
        },
        `?user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${GAME_ID}`
    );
}

async function sendMessage(userId, message) {
    await supabase("admin_messages", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, message: String(message).slice(0, 500) }),
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
            await deleteSave(body.userId);
        } else if (body.action === "currency") {
            await setCurrency(body.userId, body.cactus);
        } else if (body.action === "message") {
            await sendMessage(body.userId, body.message);
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
