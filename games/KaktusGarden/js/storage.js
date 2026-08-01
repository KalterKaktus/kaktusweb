import { t } from "/js/i18n.js";
import { farmSnapshot, normalizeState, createInitialState } from "./state.js";

export const GARDEN_GAME_ID = "kaktus-garden";
const LOCAL_KEY = "kaktus-garden-save-v1";

let adapter = null;
let activeUser = null;
let activeProfile = null;

class LocalStorageAdapter {
  async loadPlayerData() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(LOCAL_KEY)), "local-player");
    } catch {
      return createInitialState();
    }
  }

  async savePlayerData(state) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeState(state, "local-player")));
    return { ok: true, mode: "local" };
  }

  async saveFarmSnapshot(state) {
    return this.savePlayerData(state);
  }

  async loadFarmSnapshot() {
    return null;
  }

  async listFarmSnapshots() {
    return [];
  }
}

class SupabaseAdapter {
  constructor(client, user) {
    this.client = client;
    this.user = user;
  }

  async loadPlayerData() {
    const { data, error } = await this.client
      .from("game_saves")
      .select("payload")
      .eq("user_id", this.user.id)
      .eq("game_id", GARDEN_GAME_ID)
      .maybeSingle();
    if (error) throw error;
    return data?.payload
      ? normalizeState(data.payload, this.user.id)
      : createInitialState(this.user.id);
  }

  async savePlayerData(state) {
    const normalized = normalizeState(state, this.user.id);
    normalized.lastSavedAt = Date.now();
    const { error } = await this.client.from("game_saves").upsert({
      user_id: this.user.id,
      game_id: GARDEN_GAME_ID,
      payload: normalized,
      total_earned: normalized.stats.totalHarvested,
      display_name: "Spieler",
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true, mode: "cloud" };
  }

  async saveFarmSnapshot(state) {
    return this.savePlayerData(state);
  }

  async listFarmSnapshots() {
    const { data, error } = await this.client
      .from("kaktus_garden_farms")
      .select("user_id,display_name,avatar_url,level,updated_at,last_seen,is_online")
      .order("is_online", { ascending: false })
      .order("last_seen", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  }

  async loadFarmSnapshot(playerId) {
    const { data, error } = await this.client
      .from("kaktus_garden_farms")
      .select("user_id,display_name,avatar_url,level,updated_at,last_seen,is_online,farm_snapshot")
      .eq("user_id", playerId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
}

async function tryCloudAdapter() {
  try {
    const modulePromise = import("/js/supabase-client.js");
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4500));
    const { getSupabase, isConfigReady } = await Promise.race([modulePromise, timeout]);
    if (!isConfigReady()) return null;
    const client = getSupabase();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user?.id) return null;
    activeUser = session.user;
    const { data: profile } = await client
      .from("profiles")
      .select("id,username,avatar_url,total_xp")
      .eq("id", activeUser.id)
      .maybeSingle();
    activeProfile = profile || null;
    return new SupabaseAdapter(client, activeUser);
  } catch (error) {
    console.warn("KaktusGarden cloud unavailable, using local save:", error.message);
    return null;
  }
}

export async function initializeStorage() {
  adapter = await tryCloudAdapter() || new LocalStorageAdapter();
  try {
    const state = await adapter.loadPlayerData();
    return {
      state,
      user: activeUser,
      profile: activeProfile,
      mode: adapter instanceof SupabaseAdapter ? "cloud" : "local",
    };
  } catch (error) {
    console.error(t("garden.errors.load"), error);
    adapter = new LocalStorageAdapter();
    return { state: await adapter.loadPlayerData(), user: null, profile: null, mode: "local-error" };
  }
}

export async function savePlayerData(state) {
  if (!adapter) adapter = new LocalStorageAdapter();
  return adapter.savePlayerData(state);
}

export async function loadPlayerData() {
  if (!adapter) adapter = new LocalStorageAdapter();
  return adapter.loadPlayerData();
}

export async function saveFarmSnapshot(state) {
  if (!adapter) adapter = new LocalStorageAdapter();
  return adapter.saveFarmSnapshot(state);
}

export async function loadFarmSnapshot(playerId) {
  if (!adapter) return null;
  return adapter.loadFarmSnapshot(playerId);
}

export async function listFarmSnapshots() {
  if (!adapter) return [];
  return adapter.listFarmSnapshots();
}

export function createPublicSnapshot(state) {
  return farmSnapshot(state, activeUser?.id || state.playerId);
}
