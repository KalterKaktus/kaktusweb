import { getSupabase, isConfigReady } from "/js/supabase-client.js";
import { fetchProfile, getDisplayName } from "/js/profile.js";
import { AREA_ORDER } from "../data/areas.js";
import { FISH_BY_ID } from "../data/fish.js";
import { UPGRADE_ORDER } from "../data/upgrades.js";
import { resetUpgrades } from "./upgradeSystem.js";

export const FISHING_GAME_ID = "my-fishing-kaktus";
const LOCAL_KEY = "my-fishing-kaktus-save-v1";

function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function cleanFishMap(map, normalizer) {
    if (!map || typeof map !== "object" || Array.isArray(map)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(map)
            .filter(([fishId]) => FISH_BY_ID[fishId])
            .map(([fishId, entry]) => [fishId, normalizer(entry)])
    );
}

export function createInitialState() {
    return {
        version: 1,
        coins: 0,
        currentArea: "pond",
        unlockedAreas: ["pond"],
        prestige: 0,
        upgrades: resetUpgrades(),
        inventory: {},
        index: {},
        stats: {
            totalCaught: 0,
            totalSold: 0,
            totalCoinsEarned: 0,
            bestCatchValue: 0,
            bestWeightKg: 0,
        },
        settings: {
            reducedMotion: false,
        },
        daily: {
            streak: 0,
            lastClaimedDay: null,
            totalClaimed: 0,
            bestStreak: 0,
        },
    };
}

export function normalizeState(raw) {
    const initial = createInitialState();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return initial;
    }

    const prestige = Math.max(0, Math.min(AREA_ORDER.length - 1, Math.floor(number(raw.prestige))));
    const unlockedAreas = Array.isArray(raw.unlockedAreas)
        ? raw.unlockedAreas.filter((areaId) => AREA_ORDER.includes(areaId))
        : [];
    AREA_ORDER.slice(0, prestige + 1).forEach((areaId) => {
        if (!unlockedAreas.includes(areaId)) {
            unlockedAreas.push(areaId);
        }
    });

    const upgrades = Object.fromEntries(UPGRADE_ORDER.map((upgradeId) => [
        upgradeId,
        Math.max(0, Math.floor(number(raw.upgrades?.[upgradeId]))),
    ]));
    const currentArea = unlockedAreas.includes(raw.currentArea) ? raw.currentArea : unlockedAreas.at(-1) || "pond";

    return {
        ...initial,
        coins: Math.max(0, Math.floor(number(raw.coins))),
        currentArea,
        prestige,
        unlockedAreas: unlockedAreas.length ? unlockedAreas : ["pond"],
        upgrades,
        inventory: cleanFishMap(raw.inventory, (entry = {}) => ({
            count: Math.max(0, Math.floor(number(entry.count))),
            totalKg: Math.max(0, number(entry.totalKg)),
            totalValue: Math.max(0, Math.floor(number(entry.totalValue))),
            bestKg: Math.max(0, number(entry.bestKg)),
        })),
        index: cleanFishMap(raw.index, (entry = {}) => ({
            count: Math.max(0, Math.floor(number(entry.count))),
            bestKg: Math.max(0, number(entry.bestKg)),
        })),
        stats: {
            totalCaught: Math.max(0, Math.floor(number(raw.stats?.totalCaught))),
            totalSold: Math.max(0, Math.floor(number(raw.stats?.totalSold))),
            totalCoinsEarned: Math.max(0, Math.floor(number(raw.stats?.totalCoinsEarned))),
            bestCatchValue: Math.max(0, Math.floor(number(raw.stats?.bestCatchValue))),
            bestWeightKg: Math.max(0, number(raw.stats?.bestWeightKg)),
        },
        settings: {
            reducedMotion: Boolean(raw.settings?.reducedMotion),
        },
        daily: {
            streak: Math.max(0, Math.floor(number(raw.daily?.streak))),
            lastClaimedDay: typeof raw.daily?.lastClaimedDay === "string" ? raw.daily.lastClaimedDay : null,
            totalClaimed: Math.max(0, Math.floor(number(raw.daily?.totalClaimed))),
            bestStreak: Math.max(0, Math.floor(number(raw.daily?.bestStreak))),
        },
    };
}

function loadLocalState() {
    try {
        return normalizeState(JSON.parse(localStorage.getItem(LOCAL_KEY)));
    } catch {
        return createInitialState();
    }
}

function saveLocalState(state) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

async function getSession() {
    if (!isConfigReady()) {
        return null;
    }

    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

async function displayNameFor(user) {
    const profile = await fetchProfile(user.id);
    return getDisplayName(user, profile);
}

export async function loadState() {
    const session = await getSession();
    if (!session?.user?.id) {
        return {
            state: loadLocalState(),
            user: null,
            mode: "local",
        };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("game_saves")
        .select("payload")
        .eq("user_id", session.user.id)
        .eq("game_id", FISHING_GAME_ID)
        .maybeSingle();

    if (error) {
        console.error("Fishing Cloud-Save konnte nicht geladen werden:", error.message);
        return { state: createInitialState(), user: session.user, mode: "cloud-error" };
    }

    return {
        state: data?.payload ? normalizeState(data.payload) : createInitialState(),
        user: session.user,
        mode: "cloud",
    };
}

export async function saveState(state, user) {
    const normalized = normalizeState(state);

    if (!user?.id) {
        saveLocalState(normalized);
        return { mode: "local", ok: true };
    }

    const supabase = getSupabase();
    if (!supabase) {
        return { mode: "cloud", error: new Error("Cloud-Save ist gerade nicht verfügbar.") };
    }

    const { error } = await supabase
        .from("game_saves")
        .upsert({
            user_id: user.id,
            game_id: FISHING_GAME_ID,
            payload: normalized,
            total_earned: normalized.stats.totalCaught,
            display_name: await displayNameFor(user),
            updated_at: new Date().toISOString(),
        });

    if (error) {
        console.error("Fishing Cloud-Save fehlgeschlagen:", error.message);
        return { mode: "cloud", error };
    }

    return { mode: "cloud", ok: true };
}

export function clearLocalState() {
    localStorage.removeItem(LOCAL_KEY);
}

export async function fetchLeaderboard(limit = 1000) {
    const supabase = getSupabase();
    if (!supabase) {
        return { entries: [], error: new Error("Rangliste ist gerade nicht verfügbar.") };
    }

    const { data, error } = await supabase
        .from("game_saves")
        .select("display_name,total_earned,payload,updated_at")
        .eq("game_id", FISHING_GAME_ID)
        .limit(limit);

    if (error) {
        return { entries: [], error: new Error("Fishing-Rangliste braucht noch die Supabase-Freigabe.") };
    }

    const entries = (data || [])
        .map((entry) => ({
            name: entry.display_name || "Spieler",
            prestige: Math.max(0, Math.floor(number(entry.payload?.prestige))),
            totalCaught: Math.max(0, Math.floor(number(entry.total_earned || entry.payload?.stats?.totalCaught))),
            updatedAt: entry.updated_at,
        }))
        .filter((entry) => entry.prestige > 0 || entry.totalCaught > 0)
        .sort((left, right) => right.prestige - left.prestige || right.totalCaught - left.totalCaught)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { entries };
}
