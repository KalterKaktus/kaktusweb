// Catch-Telemetrie — sendet anonyme Fang-Events an Supabase für Balance-Analyse.
//
// Fire-and-forget: Fehler werden geschluckt, das Spiel läuft auch bei Netzwerk-
// Problemen weiter. Nur eingeloggte Spieler senden (RLS-Policy verlangt user_id).
// Lokale Spieler ohne Account → kein Tracking.
//
// Batching: sammelt Events 5 Sekunden lang und schickt sie dann en bloc. Spart
// HTTP-Roundtrips bei schneller Klick-Folge ohne Daten zu verlieren.

import { getSupabase, isConfigReady } from "/js/supabase-client.js";
import { FISHING_GAME_ID } from "./saveSystem.js";

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;

let queue = [];
let flushTimer = 0;
let userIdCache = null;

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(flushNow, FLUSH_INTERVAL_MS);
}

async function flushNow() {
    flushTimer = 0;
    if (!queue.length) return;
    const batch = queue.splice(0, MAX_BATCH);
    if (!isConfigReady()) return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
        const { error } = await supabase.from("catch_events").insert(batch);
        if (error) {
            // Im Fehlerfall: erst loggen, dann verwerfen — wir wollen nicht den
            // Queue endlos vollstopfen wenn die Tabelle z.B. RLS-Probleme hat.
            console.debug("[telemetry] flush error:", error.message);
        }
    } catch (e) {
        console.debug("[telemetry] flush exception:", e?.message || e);
    }
    if (queue.length) scheduleFlush();
}

export function setTelemetryUser(user) {
    userIdCache = user?.id || null;
}

/**
 * Logged ein Catch-Event. Wird im Hintergrund batched verschickt.
 * `candidate` = der finale Catch (nach Mutations-Apply), `event` = aktuelles Wetter-Event.
 */
export function logCatch(candidate, event = null) {
    if (!userIdCache) return; // logged-out spieler tracken wir nicht
    if (!candidate || !candidate.fish) return;
    queue.push({
        user_id: userIdCache,
        game_id: FISHING_GAME_ID,
        area: candidate.fish.area || null,
        rarity: candidate.fish.rarity || null,
        fish_id: candidate.fishId || null,
        mutations: Array.isArray(candidate.mutations) ? candidate.mutations : [],
        value: Math.max(0, Math.floor(Number(candidate.value) || 0)),
        kg: Number(candidate.kg) || 0,
        weather: event?.type || null,
    });
    scheduleFlush();
}

// Beim Tab-Close: noch versuchen die Queue rauszuwerfen. Browser geben uns dafür
// einen kleinen Moment via beforeunload.
window.addEventListener("beforeunload", () => {
    if (queue.length) flushNow();
});
