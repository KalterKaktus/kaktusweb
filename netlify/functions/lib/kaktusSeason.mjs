const GAME_ID = "kaktus-clicker";
const TIME_ZONE = "Europe/Berlin";

function env(name) {
    return globalThis.Netlify?.env?.get(name) || process.env[name];
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

function getBerlinMonthParts(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]));

    return { year: values.year, month: values.month };
}

export function getCurrentSeasonId(now = new Date()) {
    const { year, month } = getBerlinMonthParts(now);
    return `${year}-${month}`;
}

function createResetPayload(seasonId, now = Date.now()) {
    return {
        version: 2,
        season: { id: seasonId },
        lastOnlineTimestamp: now,
        lastSavedAt: now,
    };
}

function toTopEntries(rows) {
    return rows
        .filter((row) => Number(row.total_earned) > 0)
        .sort((left, right) => Number(right.total_earned) - Number(left.total_earned))
        .slice(0, 3)
        .map((row) => ({
            name: row.display_name || "Spieler",
            score: Number(row.total_earned) || 0,
            updatedAt: row.updated_at || null,
        }));
}

async function archiveSeason(seasonId, rows) {
    if (!seasonId) {
        return;
    }

    await supabase(
        "game_season_archives",
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({
                game_id: GAME_ID,
                season_id: seasonId,
                top_entries: toTopEntries(rows),
                archived_at: new Date().toISOString(),
            }),
        },
        "?on_conflict=game_id,season_id"
    );
}

async function resetStaleSaves(seasonId) {
    const payload = {
        season_id: seasonId,
        payload: createResetPayload(seasonId),
        total_earned: 0,
        updated_at: new Date().toISOString(),
    };

    await Promise.all([
        supabase(
            "game_saves",
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify(payload),
            },
            `?game_id=eq.${GAME_ID}&season_id=neq.${encodeURIComponent(seasonId)}`
        ),
        supabase(
            "game_saves",
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify(payload),
            },
            `?game_id=eq.${GAME_ID}&season_id=is.null`
        ),
    ]);
}

export async function ensureCurrentKaktusSeason() {
    if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) {
        throw new Error("Season-Reset ist nicht konfiguriert.");
    }

    const currentSeasonId = getCurrentSeasonId();
    const rows = await supabase(
        "game_saves",
        {},
        `?select=season_id,display_name,total_earned,updated_at&game_id=eq.${GAME_ID}`
    );
    const staleRows = (rows || []).filter((row) => row.season_id !== currentSeasonId);
    const staleBySeason = new Map();

    for (const row of staleRows) {
        const seasonId = row.season_id || "legacy";
        const seasonRows = staleBySeason.get(seasonId) || [];
        seasonRows.push(row);
        staleBySeason.set(seasonId, seasonRows);
    }

    for (const [seasonId, seasonRows] of staleBySeason.entries()) {
        if (seasonId !== "legacy") {
            await archiveSeason(seasonId, seasonRows);
        }
    }

    if (staleRows.length) {
        await resetStaleSaves(currentSeasonId);
    }

    return {
        seasonId: currentSeasonId,
        resetCount: staleRows.length,
        archivedSeasonIds: [...staleBySeason.keys()].filter((seasonId) => seasonId !== "legacy"),
    };
}
