// XP-Service — Client-seitige XP-Verwaltung.
//
// Pattern: Events werden lokal aggregiert (z.B. mehrere Catches in kurzer Zeit),
// dann gebündelt per RPC public.add_xp() an Supabase geschickt. Heartbeat tickt
// alle 60 Sekunden während der Tab aktiv ist + letzte Interaktion < 2 min her.
//
// Server-Cap (in level_system.sql):
//   - heartbeat: max 2 XP pro Call, max 1 Call pro 50 s
//   - sonstige: max 1000 XP pro Call (Safety-Cap gegen extreme Manipulation)

import { getSupabase, isConfigReady } from "/js/supabase-client.js";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const INACTIVITY_THRESHOLD_MS = 2 * 60 * 1000;
const FLUSH_INTERVAL_MS = 30 * 1000;
const MAX_BATCH_XP = 1000;

let userId = null;
let pendingXp = 0;
let lastInteraction = Date.now();
let heartbeatTimer = 0;
let flushTimer = 0;
let onXpChange = null;

function noteInteraction() { lastInteraction = Date.now(); }
window.addEventListener("pointerdown", noteInteraction, { passive: true });
window.addEventListener("keydown", noteInteraction, { passive: true });
window.addEventListener("focus", noteInteraction);

export function setXpUser(user, options = {}) {
    userId = user?.id || null;
    onXpChange = typeof options.onXpChange === "function" ? options.onXpChange : null;
    if (userId) {
        startTimers();
    } else {
        stopTimers();
    }
}

function startTimers() {
    stopTimers();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    flushTimer = window.setInterval(flushPending, FLUSH_INTERVAL_MS);
}
function stopTimers() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = 0; }
    if (flushTimer) { clearInterval(flushTimer); flushTimer = 0; }
}

// Single-flight Lock: verhindert dass Heartbeat (60s-Timer) und Flush
// (30s-Timer) parallel feuern. Ohne den Lock können 2 XP-RPCs <10ms
// auseinander rausgehen — der server-side xp_rate_limit-Trigger flagged
// das dann als verdächtig, obwohl es legit Client-Verhalten ist.
let inFlightXpCall = null;

async function callAddXp(amount, reason) {
    if (!userId || amount <= 0) return null;
    if (!isConfigReady()) return null;
    const supabase = getSupabase();
    if (!supabase) return null;

    // Wenn schon ein add_xp Call läuft: erst auf den warten, damit der server
    // den ersten verbucht hat bevor wir den zweiten schicken.
    if (inFlightXpCall) {
        try { await inFlightXpCall; } catch {}
    }

    inFlightXpCall = (async () => {
        try {
            const { data, error } = await supabase.rpc("add_xp", {
                amount: Math.min(amount, MAX_BATCH_XP),
                reason,
            });
            if (error) {
                console.debug("[xp] add_xp error:", error.message);
                return null;
            }
            supabase.rpc("check_level_badges").then(() => {}).catch(() => {});
            if (typeof onXpChange === "function" && data != null) {
                try { onXpChange(Number(data)); } catch {}
            }
            return Number(data);
        } catch (e) {
            console.debug("[xp] add_xp exception:", e?.message || e);
            return null;
        } finally {
            inFlightXpCall = null;
        }
    })();

    return inFlightXpCall;
}

async function sendHeartbeat() {
    if (!userId) return;
    if (document.hidden) return;
    if (Date.now() - lastInteraction > INACTIVITY_THRESHOLD_MS) return;
    await callAddXp(2, "heartbeat");
}

async function flushPending() {
    if (!userId || pendingXp <= 0) return;
    const amount = pendingXp;
    pendingXp = 0;
    await callAddXp(amount, "gameplay");
}

/**
 * Fügt XP zum Pending-Counter dazu. Wird beim nächsten Flush (alle 30s) gebündelt
 * an den Server geschickt. Bei Tab-Close (beforeunload) wird die Queue noch versucht
 * zu leeren via sendBeacon-Fallback unmöglich → einfacher RPC-Call.
 */
export function addPendingXp(amount, reason = "gameplay") {
    if (!userId) return;
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n) return;
    pendingXp += n;
    // Bei großen Batches sofort flushen, statt zu warten.
    if (pendingXp >= MAX_BATCH_XP) {
        flushPending();
    }
}

// XP-Werte pro Catch-Rarity (Fishing).
const FISHING_RARITY_XP = {
    Common: 1, Uncommon: 3, Rare: 10, Epic: 30, Legendary: 100,
};
// Bonus für Event-Mutationen ab ×3.
const FISHING_MUTATION_BONUS = {
    shiny: 10, aurora: 15, abyssal: 20, ember: 25, crimson: 35, haunted: 50,
};

export function xpForCatch(candidate) {
    let xp = FISHING_RARITY_XP[candidate?.fish?.rarity] || 1;
    for (const id of (candidate?.mutations || [])) {
        xp += FISHING_MUTATION_BONUS[id] || 0;
    }
    return xp;
}

// Beim Tab-Close noch versuchen zu flushen
window.addEventListener("beforeunload", () => {
    if (pendingXp > 0) flushPending();
});

// Bei sichtbar-Werden: einmal Heartbeat sofort (statt 60s zu warten)
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        noteInteraction();
        sendHeartbeat();
    }
});
