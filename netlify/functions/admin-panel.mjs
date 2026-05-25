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
    const [profiles, saves, presenceRows, badges] = await Promise.all([
        supabase("profiles", {}, "?select=id,username,is_banned,avatar_url,updated_at,total_xp,equipped_badge,vip,vip_color,referral_code,donation_total_cents,donation_count&order=updated_at.desc"),
        supabase("game_saves", {}, "?select=user_id,game_id,display_name,total_earned,season_id,payload,updated_at&order=updated_at.desc"),
        listPresence(),
        supabase("user_badges", {}, "?select=user_id,badge_id,awarded_at"),
    ]);
    const savesByUser = new Map();
    const presenceByUser = new Map((presenceRows || []).map((presence) => [presence.user_id, presence]));
    const badgesByUser = new Map();
    for (const badge of badges || []) {
        const userBadges = badgesByUser.get(badge.user_id) || [];
        userBadges.push(badge.badge_id);
        badgesByUser.set(badge.user_id, userBadges);
    }

    for (const save of saves || []) {
        const userSaves = savesByUser.get(save.user_id) || [];
        userSaves.push(save);
        savesByUser.set(save.user_id, userSaves);
    }

    return (profiles || []).map((profile) => ({
        ...profile,
        saves: savesByUser.get(profile.id) || [],
        presence: formatPresence(presenceByUser.get(profile.id)),
        badges: badgesByUser.get(profile.id) || [],
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

// Bekannte Badge-IDs — hier hardcoded statt Import aus dem Frontend wegen ESM/Bundle-Trennung.
// Muss in Sync mit /js/progression.js BADGES gehalten werden.
const KNOWN_BADGE_IDS = new Set([
    "lvl_25", "lvl_50", "lvl_75", "lvl_100",
    "tester", "vip", "supporter",
    "haunted_catch", "daily_streak_7", "referrer",
]);

function requireBadgeId(badgeId) {
    const safe = String(badgeId || "").trim();
    if (!KNOWN_BADGE_IDS.has(safe)) {
        throw httpError(`Badge "${safe}" ist nicht freigegeben.`, 400);
    }
    return safe;
}

async function awardBadge(userId, badgeId) {
    const safe = requireBadgeId(badgeId);
    await supabase("user_badges", {
        method: "POST",
        headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
        body: JSON.stringify({ user_id: userId, badge_id: safe }),
    });
    // Konvenienz: Klick auf das vip-Badge soll auch profiles.vip aktivieren (sonst
    // bleibt Namensfarbe + XP-Boost ohne Wirkung). Symmetrisch zur set-vip Action.
    if (safe === "vip") {
        await supabase(
            "profiles",
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ vip: true, updated_at: new Date().toISOString() }),
            },
            `?id=eq.${encodeURIComponent(userId)}`
        );
    }
}

async function revokeBadge(userId, badgeId) {
    const safe = requireBadgeId(badgeId);
    await supabase(
        "user_badges",
        { method: "DELETE" },
        `?user_id=eq.${encodeURIComponent(userId)}&badge_id=eq.${encodeURIComponent(safe)}`
    );
    // Falls dieses Badge gerade als equipped_badge gesetzt ist → unsetzen damit
    // auf Leaderboards/Profil kein „Geist-Badge" mehr angezeigt wird.
    await supabase(
        "profiles",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ equipped_badge: null, updated_at: new Date().toISOString() }),
        },
        `?id=eq.${encodeURIComponent(userId)}&equipped_badge=eq.${encodeURIComponent(safe)}`
    );
    // Konvenienz: Revoke des vip-Badges deaktiviert auch profiles.vip (Boost + Farbe weg).
    if (safe === "vip") {
        await supabase(
            "profiles",
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ vip: false, updated_at: new Date().toISOString() }),
            },
            `?id=eq.${encodeURIComponent(userId)}`
        );
    }
}

// ----- Cheat-Flags --------------------------------------------------------
// Flags werden von Postgres-Triggern / SECURITY-DEFINER-RPCs via
// public.log_cheat_flag(...) eingetragen. RLS auf cheat_flags ist enabled
// ohne Policies → nur service_role kommt dran. Hier holen wir die offenen
// (unresolved) Flags inkl. Username für die Anzeige im Adminpanel.
const CHEAT_FLAG_LIMIT = 250;
const RESOLUTION_VALUES = new Set(["ignored", "warned", "banned"]);

async function listCheatFlags() {
    const flags = await supabase(
        "cheat_flags",
        {},
        `?select=id,user_id,flag_type,severity,details,created_at,resolved_at,resolved_by,resolution&resolved_at=is.null&order=created_at.desc&limit=${CHEAT_FLAG_LIMIT}`
    );

    const userIds = [...new Set((flags || []).map((flag) => flag.user_id).filter(Boolean))];
    let profileLookup = new Map();
    if (userIds.length) {
        const inList = userIds.map((id) => `"${id}"`).join(",");
        const profiles = await supabase(
            "profiles",
            {},
            `?select=id,username,is_banned&id=in.(${encodeURIComponent(inList)})`
        );
        profileLookup = new Map((profiles || []).map((p) => [p.id, p]));
    }

    // Aggregat: pro User Counts + neueste Flags. Reihenfolge bleibt nach
    // created_at desc damit jüngste User-Aktivität ganz oben steht.
    const userMap = new Map();
    for (const flag of flags || []) {
        const userId = flag.user_id;
        if (!userMap.has(userId)) {
            const profile = profileLookup.get(userId);
            userMap.set(userId, {
                user_id: userId,
                username: profile?.username || "(unbekannt)",
                is_banned: Boolean(profile?.is_banned),
                flags: [],
                count: 0,
                worstSeverity: "warn",
            });
        }
        const entry = userMap.get(userId);
        entry.flags.push(flag);
        entry.count += 1;
        if (flag.severity === "critical") entry.worstSeverity = "critical";
    }

    return [...userMap.values()];
}

async function resolveCheatFlag(flagId, resolution, adminUserId) {
    const id = Number(flagId);
    if (!Number.isInteger(id) || id <= 0) {
        throw httpError("Flag-ID ungültig.", 400);
    }
    if (!RESOLUTION_VALUES.has(resolution)) {
        throw httpError("Resolution muss ignored|warned|banned sein.", 400);
    }
    await supabase(
        "cheat_flags",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                resolved_at: new Date().toISOString(),
                resolved_by: adminUserId,
                resolution,
            }),
        },
        `?id=eq.${encodeURIComponent(id)}`
    );
}

async function resolveAllUserFlags(userId, resolution, adminUserId) {
    if (!RESOLUTION_VALUES.has(resolution)) {
        throw httpError("Resolution muss ignored|warned|banned sein.", 400);
    }
    await supabase(
        "cheat_flags",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                resolved_at: new Date().toISOString(),
                resolved_by: adminUserId,
                resolution,
            }),
        },
        `?user_id=eq.${encodeURIComponent(userId)}&resolved_at=is.null`
    );
}

async function setVipStatus(userId, isVip) {
    await supabase(
        "profiles",
        {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ vip: Boolean(isVip), updated_at: new Date().toISOString() }),
        },
        `?id=eq.${encodeURIComponent(userId)}`
    );
    // Konvenienz: VIP-Status setzt/entfernt auch den 'vip' Badge automatisch.
    if (isVip) {
        await awardBadge(userId, "vip");
    } else {
        await revokeBadge(userId, "vip");
    }
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
        const adminUser = await requireAdmin(req);

        if (req.method === "GET") {
            // listCheatFlags ist optional — wenn PostgREST das neue Schema noch
            // nicht kennt oder etwas schiefläuft, soll wenigstens die User-Liste
            // funktionieren (Adminpanel sonst komplett tot).
            const [users, cheatFlags] = await Promise.all([
                listUsers(),
                listCheatFlags().catch((error) => {
                    console.error("Cheat-Flags konnten nicht geladen werden:", error.message);
                    return [];
                }),
            ]);
            return json({ users, cheatFlags });
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

        if (body.action === "resolve-cheat-flag") {
            await resolveCheatFlag(body.flagId, body.resolution, adminUser?.id || null);
            return json({ ok: true });
        }

        if (body.action === "resolve-user-flags") {
            if (!body.userId) {
                return json({ error: "User fehlt." }, 400);
            }
            await resolveAllUserFlags(body.userId, body.resolution, adminUser?.id || null);
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
        } else if (body.action === "award-badge") {
            await awardBadge(body.userId, body.badgeId);
        } else if (body.action === "revoke-badge") {
            await revokeBadge(body.userId, body.badgeId);
        } else if (body.action === "set-vip") {
            await setVipStatus(body.userId, body.vip);
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
