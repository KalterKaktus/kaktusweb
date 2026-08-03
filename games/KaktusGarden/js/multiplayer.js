import { getSupabase, isConfigReady } from "/js/supabase-client.js";
import { MAP_COLS, MAP_ROWS, PLOT_CELLS, isWalkable } from "./data/world.js";

export const GARDEN_ROOM_PARAM = "room";
export const GARDEN_ROOM_TOPIC_PREFIX = "garden:room:";

export const GARDEN_MULTIPLAYER_RPCS = Object.freeze({
  join: "garden_join_room",
  heartbeat: "garden_room_heartbeat",
  leave: "garden_leave_room",
  snapshot: "garden_room_snapshot",
});

export const GARDEN_MULTIPLAYER_EVENTS = Object.freeze({
  movement: "player-move",
  farmChanged: "farm-changed",
});

const DEFAULT_HEARTBEAT_MS = 25_000;
const DEFAULT_SUBSCRIBE_TIMEOUT_MS = 12_000;
const DEFAULT_MOVEMENT_INTERVAL_MS = 80;
const DEFAULT_CONNECTION_LOCK_RETRY_MS = 1_500;
const CONNECTION_STORAGE_KEY = "kaktus-garden-connection-id-v1";
const CONNECTION_LOCK_PREFIX = "kaktus-garden-connection:";
const CONNECTION_CHANNEL_NAME = "kaktus-garden-connection-lock-v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FACING = new Set(["up", "down", "left", "right"]);

let pageConnectionId = null;

export class GardenMultiplayerError extends Error {
  constructor(code, message, { cause = null, retryable = false } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "GardenMultiplayerError";
    this.code = code;
    this.retryable = retryable;
    if (cause && !this.cause) this.cause = cause;
  }
}

function multiplayerError(code, message, cause = null, retryable = false) {
  return new GardenMultiplayerError(code, message, { cause, retryable });
}

function safeCallback(callback, value) {
  if (typeof callback !== "function") return;
  try {
    callback(value);
  } catch (error) {
    console.error("KaktusGarden Multiplayer-Callback fehlgeschlagen:", error);
  }
}

function randomUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sessionStorageOrNull(candidate = null) {
  if (candidate) return candidate;
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function storeConnectionId(connectionId, storage = null) {
  pageConnectionId = connectionId;
  try {
    sessionStorageOrNull(storage)?.setItem(CONNECTION_STORAGE_KEY, connectionId);
  } catch {}
  return connectionId;
}

/**
 * Reloads behalten ihre connection_id und damit Server/Plot. Ein dupliziertes
 * Tab kopiert zwar sessionStorage, wird aber vor dem Join zusätzlich per Web
 * Lock erkannt und bekommt dann eine neue ID.
 */
export function getGardenConnectionId(storage = null) {
  if (pageConnectionId) return pageConnectionId;
  try {
    const stored = sessionStorageOrNull(storage)?.getItem(CONNECTION_STORAGE_KEY);
    if (UUID_PATTERN.test(stored || "")) return storeConnectionId(stored, storage);
  } catch {}
  storeConnectionId(randomUuid(), storage);
  return pageConnectionId;
}

function wait(delayMs) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

/**
 * Hält den Web Lock bis release() aufgerufen oder das Dokument zerstört wird.
 * Das Promise von locks.request darf hier nicht awaited werden: es bleibt
 * absichtlich für die gesamte Lebenszeit der Verbindung offen.
 */
function tryClaimConnectionLock(lockManager, connectionId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let releaseHold = null;
    const hold = new Promise((release) => { releaseHold = release; });
    Promise.resolve(lockManager.request(
      `${CONNECTION_LOCK_PREFIX}${connectionId}`,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        settled = true;
        if (!lock) {
          resolve(null);
          return;
        }
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          releaseHold();
        });
        await hold;
      },
    )).catch((error) => {
      if (!settled) reject(error);
    });
  });
}

async function tryClaimBroadcastLock(BroadcastChannelClass, connectionId, settleMs = 90) {
  let channel;
  try {
    channel = new BroadcastChannelClass(CONNECTION_CHANNEL_NAME);
  } catch {
    return undefined;
  }

  const nonce = randomUuid();
  let active = false;
  let blocked = false;
  channel.onmessage = ({ data }) => {
    if (!data || data.connectionId !== connectionId || data.nonce === nonce) return;
    if (data.type === "candidate") {
      if (active) channel.postMessage({ type: "held", connectionId, nonce });
      else if (String(data.nonce) < nonce) blocked = true;
      else channel.postMessage({ type: "candidate", connectionId, nonce });
    } else if (data.type === "held") {
      blocked = true;
    }
  };
  channel.postMessage({ type: "candidate", connectionId, nonce });
  await wait(settleMs);
  if (blocked) {
    channel.close();
    return null;
  }

  active = true;
  channel.postMessage({ type: "held", connectionId, nonce });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active = false;
    channel.close();
  };
}

async function claimBroadcastConnection(BroadcastChannelClass, connectionId, retryMs) {
  const deadline = Date.now() + Math.max(0, Number(retryMs) || 0);
  do {
    const release = await tryClaimBroadcastLock(BroadcastChannelClass, connectionId);
    if (release === undefined) return undefined;
    if (release) return release;
    if (Date.now() >= deadline) return null;
    await wait(Math.min(100, Math.max(1, deadline - Date.now())));
  } while (Date.now() <= deadline);
  return null;
}

/**
 * Erkennt sessionStorage-Kopien in parallelen Tabs. Kurzes Retry erlaubt dem
 * alten Dokument bei einem Reload zuerst seinen Lock freizugeben. Falls Web
 * Locks fehlen, bleibt die DB-Sperre aktiv; nur die Clone-Erkennung entfällt.
 */
export async function claimGardenTabConnection({
  connectionId = getGardenConnectionId(),
  storage = null,
  lockManager = globalThis.navigator?.locks || null,
  BroadcastChannelClass = globalThis.BroadcastChannel || null,
  retryMs = DEFAULT_CONNECTION_LOCK_RETRY_MS,
} = {}) {
  let claimedId = UUID_PATTERN.test(connectionId || "") ? connectionId : randomUuid();
  storeConnectionId(claimedId, storage);
  if (!lockManager?.request) {
    if (BroadcastChannelClass) {
      const release = await claimBroadcastConnection(BroadcastChannelClass, claimedId, retryMs);
      if (release) {
        return { connectionId: claimedId, release, webLock: false, broadcastLock: true, rotated: false };
      }
      if (release !== undefined) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          claimedId = storeConnectionId(randomUuid(), storage);
          const rotatedRelease = await claimBroadcastConnection(BroadcastChannelClass, claimedId, 0);
          if (rotatedRelease) {
            return { connectionId: claimedId, release: rotatedRelease, webLock: false, broadcastLock: true, rotated: true };
          }
        }
        throw multiplayerError("connection_lock_failed", "Die lokale Verbindung konnte nicht reserviert werden.", null, true);
      }
    }

    // Sehr alte Browser ohne Web Locks und BroadcastChannel bekommen pro
    // Dokument zwingend eine neue ID. Dann blockiert wenigstens die DB ein
    // zweites Tab sicher, auch wenn ein Reload kurz auf die Lease warten muss.
    claimedId = storeConnectionId(randomUuid(), storage);
    return { connectionId: claimedId, release: null, webLock: false, broadcastLock: false, rotated: true };
  }

  const deadline = Date.now() + Math.max(0, Number(retryMs) || 0);
  do {
    const release = await tryClaimConnectionLock(lockManager, claimedId);
    if (release) return { connectionId: claimedId, release, webLock: true, rotated: false };
    if (Date.now() >= deadline) break;
    await wait(Math.min(100, Math.max(1, deadline - Date.now())));
  } while (Date.now() <= deadline);

  // Der gleiche sessionStorage-Wert ist noch in einem anderen Dokument aktiv.
  // Eine neue ID sorgt dafür, dass die serverseitige Account-Sperre greift.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    claimedId = storeConnectionId(randomUuid(), storage);
    const release = await tryClaimConnectionLock(lockManager, claimedId);
    if (release) return { connectionId: claimedId, release, webLock: true, rotated: true };
  }
  throw multiplayerError("connection_lock_failed", "Die lokale Verbindung konnte nicht reserviert werden.", null, true);
}

export function gardenRoomCodeFromUrl(value = globalThis.location?.href || "") {
  try {
    const code = new URL(value, globalThis.location?.origin || "https://kalterkaktus.de")
      .searchParams.get(GARDEN_ROOM_PARAM);
    return code?.trim() || null;
  } catch {
    return null;
  }
}

export function gardenRoomLabel(ordinal) {
  let value = Math.max(1, Math.floor(Number(ordinal) || 1));
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function roomTopic(roomId) {
  return `${GARDEN_ROOM_TOPIC_PREFIX}${roomId}`;
}

function valueFrom(raw, ...keys) {
  for (const key of keys) {
    if (raw?.[key] !== undefined && raw?.[key] !== null) return raw[key];
  }
  return null;
}

function firstRpcValue(data) {
  if (Array.isArray(data)) {
    if (data.length === 1) return data[0]?.result ?? data[0]?.snapshot ?? data[0];
    return data;
  }
  return data?.result ?? data?.snapshot ?? data;
}

function parseTimestamp(value) {
  if (!value) return 0;
  if (Number.isFinite(Number(value))) return Number(value);
  return Date.parse(value) || 0;
}

function normalizeAssignment(data, connectionId) {
  const raw = firstRpcValue(data);
  if (!raw || Array.isArray(raw) || typeof raw !== "object") {
    throw multiplayerError("invalid_join_response", "Die Raumzuweisung der Datenbank ist ungültig.");
  }
  const roomId = String(valueFrom(raw, "room_id", "roomId") || "");
  const slotIndex = Number(valueFrom(raw, "slot_index", "slotIndex"));
  const roomOrdinal = Math.max(1, Math.floor(Number(valueFrom(raw, "room_ordinal", "roomOrdinal", "ordinal")) || 1));
  if (!roomId || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 5) {
    throw multiplayerError("invalid_join_response", "Raum oder Plot der Datenbankantwort ist ungültig.");
  }
  const channelTopic = String(valueFrom(raw, "channel_topic", "channelTopic") || roomTopic(roomId));
  if (channelTopic !== roomTopic(roomId)) {
    throw multiplayerError("invalid_join_response", "Der Realtime-Topic passt nicht zur Raumzuweisung.");
  }
  return Object.freeze({
    roomId,
    roomOrdinal,
    roomLabel: String(valueFrom(raw, "room_label", "roomLabel") || gardenRoomLabel(roomOrdinal)),
    roomCode: String(valueFrom(raw, "invite_code", "room_code", "roomCode", "inviteCode") || ""),
    slotIndex,
    connectionId: String(valueFrom(raw, "connection_id", "connectionId") || connectionId),
    leaseExpiresAt: parseTimestamp(valueFrom(raw, "lease_expires_at", "leaseExpiresAt")),
    serverNow: parseTimestamp(valueFrom(raw, "server_now", "serverNow")),
    occupancy: Math.max(1, Math.min(6, Math.floor(Number(valueFrom(raw, "occupancy", "player_count", "playerCount")) || 1))),
    topic: channelTopic,
  });
}

function isRetryableError(error) {
  const status = Number(error?.status || error?.statusCode);
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return /network|fetch|timeout|timed out|connection|offline/.test(message);
}

function fromRpcError(error, fallbackCode = "multiplayer_failed") {
  const combined = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  if (combined.includes("garden_already_connected") || combined.includes("already_connected")) {
    return multiplayerError("already_connected", "Dieser Account ist bereits in einem anderen Tab oder Gerät verbunden.", error);
  }
  if (combined.includes("garden_room_full") || combined.includes("room_full")) {
    return multiplayerError("room_full", "Dieser Server ist bereits voll.", error);
  }
  if (combined.includes("garden_lease_expired") || combined.includes("lease_expired")) {
    return multiplayerError("lease_expired", "Die Server-Zuweisung ist abgelaufen.", error);
  }
  if (combined.includes("garden_account_banned") || combined.includes("account_banned")) {
    return multiplayerError("account_banned", "Dieser Account ist gesperrt.", error);
  }
  if (combined.includes("garden_room_not_found") || combined.includes("room_not_found")) {
    return multiplayerError("room_not_found", "Der Einladungs-Server wurde nicht gefunden.", error);
  }
  if (combined.includes("garden_login_required") || /jwt|not authenticated|auth session/.test(combined)) {
    return multiplayerError("login_required", "Für KaktusGarden Multiplayer ist eine Anmeldung nötig.", error);
  }
  return multiplayerError(fallbackCode, String(error?.message || "Multiplayer-Anfrage fehlgeschlagen."), error, isRetryableError(error));
}

function assertRealtimeOk(result, code, message) {
  const status = String(typeof result === "string" ? result : result?.status || "ok").toLowerCase();
  if (status === "ok") return result;
  throw multiplayerError(code, `${message} (${status})`, result, true);
}

async function requireSession(client = null) {
  if (!client && !isConfigReady()) {
    throw multiplayerError("config_unavailable", "Supabase ist nicht konfiguriert.", null, true);
  }
  const supabase = client || getSupabase();
  if (!supabase) throw multiplayerError("config_unavailable", "Supabase ist nicht verfügbar.", null, true);
  let result;
  try {
    result = await supabase.auth.getSession();
  } catch (error) {
    throw multiplayerError("auth_unavailable", "Die Anmeldung konnte nicht geprüft werden.", error, true);
  }
  const { data, error } = result || {};
  if (error) throw fromRpcError(error, "auth_unavailable");
  if (!data?.session?.user?.id) {
    throw multiplayerError("login_required", "Für KaktusGarden Multiplayer ist eine Anmeldung nötig.");
  }
  return { client: supabase, session: data.session, user: data.session.user };
}

function safeText(value, maxLength = 32) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePresence(raw) {
  const userId = safeText(valueFrom(raw, "userId", "user_id"), 64);
  const connectionId = safeText(valueFrom(raw, "connectionId", "connection_id"), 64);
  const movementEpoch = safeText(valueFrom(raw, "movementEpoch", "movement_epoch"), 64);
  const slotIndex = Number(valueFrom(raw, "slotIndex", "slot_index"));
  if (!userId || !connectionId || !movementEpoch
    || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 5) return null;
  return {
    userId,
    connectionId,
    movementEpoch,
    slotIndex,
    displayName: safeText(valueFrom(raw, "displayName", "display_name") || "Spieler", 32),
    level: Math.max(1, Math.min(9999, Math.floor(Number(raw.level) || 1))),
    skin: safeText(raw.skin || "", 32),
    onlineAt: parseTimestamp(valueFrom(raw, "onlineAt", "online_at")) || Date.now(),
  };
}

function normalizeMember(raw) {
  if (!raw || typeof raw !== "object") return null;
  const userId = safeText(valueFrom(raw, "userId", "user_id", "playerId", "player_id"), 64);
  const connectionId = safeText(valueFrom(raw, "connectionId", "connection_id"), 64);
  const slotIndex = Number(valueFrom(raw, "slotIndex", "slot_index"));
  if (!userId || !connectionId || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 5) return null;
  const farm = valueFrom(raw, "farm", "farm_snapshot") || {};
  const rawCells = valueFrom(raw, "cells") ?? valueFrom(farm, "cells", "fields");
  return {
    userId,
    connectionId,
    slotIndex,
    displayName: safeText(valueFrom(raw, "displayName", "display_name") || "Spieler", 32),
    level: Math.max(1, Math.min(9999, Math.floor(Number(raw.level) || 1))),
    avatarUrl: safeText(valueFrom(raw, "avatarUrl", "avatar_url"), 500) || null,
    skin: safeText(raw.skin || "", 32),
    // null bedeutet „kein gültiger Snapshot erhalten“, nicht „leere Farm“.
    cells: Array.isArray(rawCells) && rawCells.length === PLOT_CELLS ? rawCells : null,
    updatedAt: parseTimestamp(valueFrom(raw, "updatedAt", "updated_at", "saveUpdatedAt", "save_updated_at")),
  };
}

function normalizeSnapshot(data, assignment) {
  const raw = firstRpcValue(data);
  let room = null;
  let rows = null;
  let capturedAt = 0;

  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === "object") {
    room = raw.room || null;
    rows = raw.members || raw.players || raw.slots || [];
    capturedAt = parseTimestamp(valueFrom(raw, "capturedAt", "captured_at")) || capturedAt;
  }
  if (!Array.isArray(rows)) {
    throw multiplayerError("invalid_snapshot", "Der Server-Snapshot ist ungültig.");
  }

  const members = rows.map(normalizeMember).filter(Boolean).sort((a, b) => a.slotIndex - b.slotIndex);
  return Object.freeze({
    room: Object.freeze({
      id: String(valueFrom(room, "id", "room_id", "roomId") || assignment.roomId),
      ordinal: Math.max(1, Math.floor(Number(valueFrom(room, "ordinal", "room_ordinal", "roomOrdinal")) || assignment.roomOrdinal)),
      label: String(valueFrom(room, "label", "room_label", "roomLabel") || assignment.roomLabel),
      inviteCode: String(valueFrom(room, "inviteCode", "invite_code", "room_code") || assignment.roomCode),
    }),
    members: Object.freeze(members),
    capturedAt,
  });
}

function normalizeMovement(raw) {
  if (!raw || typeof raw !== "object") return null;
  const userId = safeText(valueFrom(raw, "userId", "user_id"), 64);
  const connectionId = safeText(valueFrom(raw, "connectionId", "connection_id"), 64);
  const movementEpoch = safeText(valueFrom(raw, "movementEpoch", "movement_epoch"), 64);
  const slotIndex = Number(valueFrom(raw, "slotIndex", "slot_index"));
  const tileX = Math.floor(Number(valueFrom(raw, "tileX", "tile_x")));
  const tileY = Math.floor(Number(valueFrom(raw, "tileY", "tile_y")));
  const fromX = Math.floor(Number(valueFrom(raw, "fromX", "from_x", "tileX", "tile_x")));
  const fromY = Math.floor(Number(valueFrom(raw, "fromY", "from_y", "tileY", "tile_y")));
  const facing = FACING.has(raw.facing) ? raw.facing : "down";
  const sequence = Math.max(0, Math.floor(Number(valueFrom(raw, "sequence", "seq")) || 0));
  if (!userId || !connectionId || !movementEpoch
    || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 5) return null;
  if (![tileX, tileY, fromX, fromY].every(Number.isFinite)) return null;
  if (tileX < 0 || tileX >= MAP_COLS || tileY < 0 || tileY >= MAP_ROWS || !isWalkable(tileX, tileY)) return null;
  if (fromX < 0 || fromX >= MAP_COLS || fromY < 0 || fromY >= MAP_ROWS || !isWalkable(fromX, fromY)) return null;
  return {
    userId,
    connectionId,
    movementEpoch,
    slotIndex,
    tileX,
    tileY,
    fromX,
    fromY,
    facing,
    sequence,
    stepMs: Math.max(1, Math.min(1_000, Math.floor(Number(valueFrom(raw, "stepMs", "step_ms")) || 180))),
    sentAt: Math.max(0, Number(valueFrom(raw, "sentAt", "sent_at")) || Date.now()),
  };
}

export class GardenMultiplayer {
  constructor({
    client,
    session,
    user,
    connectionId = null,
    connectionStorage = null,
    connectionLockManager = globalThis.navigator?.locks || null,
    connectionLockRetryMs = DEFAULT_CONNECTION_LOCK_RETRY_MS,
    rpcNames = GARDEN_MULTIPLAYER_RPCS,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    subscribeTimeoutMs = DEFAULT_SUBSCRIBE_TIMEOUT_MS,
    movementIntervalMs = DEFAULT_MOVEMENT_INTERVAL_MS,
    onStatus = null,
    onRoster = null,
    onMovement = null,
    onSnapshot = null,
    onError = null,
  }) {
    if (!client || !user?.id) throw multiplayerError("login_required", "GardenMultiplayer braucht eine Anmeldung.");
    this.client = client;
    this.session = session || null;
    this.user = user;
    this.connectionId = connectionId || getGardenConnectionId(connectionStorage);
    // Anders als connectionId wechselt diese Kennung bei jedem Dokument. Ein
    // Reload darf dadurch seine Bewegungssequenz wieder bei 1 beginnen.
    this.movementEpoch = randomUuid();
    this.connectionStorage = connectionStorage;
    this.connectionLockManager = connectionLockManager;
    this.connectionLockRetryMs = Math.max(0, Number(connectionLockRetryMs) || 0);
    this.tabLockRelease = null;
    this.rpcNames = { ...GARDEN_MULTIPLAYER_RPCS, ...rpcNames };
    this.heartbeatMs = Math.max(5_000, Number(heartbeatMs) || DEFAULT_HEARTBEAT_MS);
    this.subscribeTimeoutMs = Math.max(2_000, Number(subscribeTimeoutMs) || DEFAULT_SUBSCRIBE_TIMEOUT_MS);
    this.movementIntervalMs = Math.max(30, Number(movementIntervalMs) || DEFAULT_MOVEMENT_INTERVAL_MS);
    this.callbacks = { onStatus, onRoster, onMovement, onSnapshot, onError };

    this.status = "idle";
    this.assignment = null;
    this.channel = null;
    this.localPresence = null;
    this.roster = Object.freeze([]);
    this.rosterByUser = new Map();
    this.authoritativeMembers = new Map();
    this.snapshot = null;
    this.heartbeatTimer = null;
    this.heartbeatInFlight = null;
    this.snapshotInFlight = null;
    this.snapshotAgain = false;
    this.snapshotTimer = null;
    this.movementTimer = null;
    this.reconnectTimer = null;
    this.queuedMovement = null;
    this.lastMovementSentAt = 0;
    this.movementSequence = 0;
    this.remoteSequences = new Map();
    this.serverClockOffsetMs = 0;
    this.hasServerClock = false;
    this.lifecycleCleanup = null;
    this.connectPromise = null;
  }

  setStatus(status, extra = {}) {
    this.status = status;
    safeCallback(this.callbacks.onStatus, { status, assignment: this.assignment, ...extra });
  }

  updateServerClock(serverNow, requestStartedAt = Date.now(), receivedAt = Date.now()) {
    if (!Number.isFinite(serverNow) || serverNow <= 0) return false;
    const midpoint = requestStartedAt + Math.max(0, receivedAt - requestStartedAt) / 2;
    this.serverClockOffsetMs = serverNow - midpoint;
    this.hasServerClock = true;
    return true;
  }

  now() {
    return Math.round(Date.now() + (this.hasServerClock ? this.serverClockOffsetMs : 0));
  }

  startReconnectDeadline() {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      if (this.status !== "reconnecting") return;
      const error = multiplayerError("reconnect_timeout", "Realtime konnte nicht wiederverbunden werden.", null, true);
      this.setStatus("error", { error });
      this.emitError(error);
      this.disconnect().catch((disconnectError) => this.emitError(disconnectError));
    }, this.subscribeTimeoutMs);
  }

  emitError(error) {
    safeCallback(this.callbacks.onError, error);
  }

  async rpc(name, args = {}) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw fromRpcError(error);
    return data;
  }

  async connect({ roomCode = null, presence = {} } = {}) {
    if (this.status === "connected") return this.assignment;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connectInternal({ roomCode, presence }).finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  async connectInternal({ roomCode, presence }) {
    this.setStatus("joining");
    let joined = false;
    try {
      const tabClaim = await claimGardenTabConnection({
        connectionId: this.connectionId,
        storage: this.connectionStorage,
        lockManager: this.connectionLockManager,
        retryMs: this.connectionLockRetryMs,
      });
      this.connectionId = tabClaim.connectionId;
      this.tabLockRelease = tabClaim.release;
      const joinStartedAt = Date.now();
      const joinData = await this.rpc(this.rpcNames.join, {
        p_connection_id: this.connectionId,
        p_invite_code: roomCode || null,
      });
      const joinReceivedAt = Date.now();
      // Ab hier existiert serverseitig bereits eine Lease. Auch eine kaputte
      // Antwort muss deshalb im Catch per leave aufgeraeumt werden.
      joined = true;
      this.assignment = normalizeAssignment(joinData, this.connectionId);
      this.updateServerClock(this.assignment.serverNow, joinStartedAt, joinReceivedAt);
      this.localPresence = {
        userId: this.user.id,
        connectionId: this.connectionId,
        movementEpoch: this.movementEpoch,
        slotIndex: this.assignment.slotIndex,
        displayName: safeText(presence.displayName || this.user.email?.split("@")[0] || "Spieler", 32),
        level: Math.max(1, Math.min(9999, Math.floor(Number(presence.level) || 1))),
        skin: safeText(presence.skin || "", 32),
        onlineAt: this.now(),
      };

      if (this.session?.access_token && this.client.realtime?.setAuth) {
        await this.client.realtime.setAuth(this.session.access_token);
      }
      this.createChannel();
      this.setStatus("subscribing");
      await this.subscribeChannel();
      assertRealtimeOk(await this.channel.track(this.localPresence), "presence_failed", "Die Anwesenheit konnte nicht veröffentlicht werden.");
      this.startHeartbeat();
      await this.refreshSnapshot();
      this.syncRoster();
      this.setStatus("connected");
      return this.assignment;
    } catch (error) {
      const wrapped = error instanceof GardenMultiplayerError ? error : fromRpcError(error);
      this.setStatus("error", { error: wrapped });
      this.emitError(wrapped);
      await this.removeChannel();
      if (joined) await this.releaseLeaseBestEffort();
      this.assignment = null;
      this.releaseTabLock();
      throw wrapped;
    }
  }

  createChannel() {
    const channel = this.client.channel(this.assignment.topic, {
      config: {
        private: true,
        broadcast: { self: false, ack: false },
        presence: { key: this.user.id },
      },
    });
    channel
      .on("presence", { event: "sync" }, () => this.syncRoster())
      .on("presence", { event: "join" }, () => {
        this.syncRoster();
        this.scheduleSnapshotRefresh(0);
      })
      .on("presence", { event: "leave" }, () => {
        this.syncRoster();
        this.scheduleSnapshotRefresh(0);
      })
      .on("broadcast", { event: GARDEN_MULTIPLAYER_EVENTS.movement }, ({ payload }) => this.receiveMovement(payload))
      .on("broadcast", { event: GARDEN_MULTIPLAYER_EVENTS.farmChanged }, () => this.scheduleSnapshotRefresh());
    this.channel = channel;
  }

  subscribeChannel() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(multiplayerError("subscribe_timeout", "Die Server-Verbindung hat zu lange gebraucht.", null, true));
      }, this.subscribeTimeoutMs);

      this.channel.subscribe((status, error) => {
        if (!settled && status === "SUBSCRIBED") {
          settled = true;
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        if (!settled && ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          settled = true;
          window.clearTimeout(timeout);
          reject(multiplayerError("subscribe_failed", error?.message || `Realtime: ${status}`, error, true));
          return;
        }
        if (settled && ["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          const wrapped = multiplayerError("channel_error", error?.message || "Realtime-Verbindung unterbrochen.", error, true);
          this.setStatus("reconnecting", { error: wrapped });
          this.emitError(wrapped);
          this.startReconnectDeadline();
        }
        if (settled && status === "CLOSED"
          && !["error", "disconnecting", "disconnected"].includes(this.status)) {
          const wrapped = multiplayerError("channel_closed", "Realtime-Verbindung wurde geschlossen.", error, true);
          this.setStatus("error", { error: wrapped });
          this.emitError(wrapped);
          Promise.resolve().then(() => this.disconnect()).catch((disconnectError) => this.emitError(disconnectError));
        }
        if (settled && status === "SUBSCRIBED" && this.status === "reconnecting") {
          window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
          Promise.resolve(this.channel.track(this.localPresence))
            .then((result) => assertRealtimeOk(result, "presence_failed", "Die Anwesenheit konnte nicht veröffentlicht werden."))
            .catch((trackError) => this.emitError(trackError instanceof GardenMultiplayerError
              ? trackError
              : fromRpcError(trackError, "presence_failed")));
          this.refreshSnapshot().catch((snapshotError) => this.emitError(snapshotError));
          this.setStatus("connected");
        }
      });
    });
  }

  syncRoster() {
    if (!this.channel) return;
    const seen = new Map();
    const state = this.channel.presenceState() || {};
    for (const presences of Object.values(state)) {
      for (const raw of Array.isArray(presences) ? presences : []) {
        const presence = normalizePresence(raw);
        if (!presence) continue;
        const member = this.authoritativeMembers.get(presence.userId);
        if (!member
          || member.connectionId !== presence.connectionId
          || member.slotIndex !== presence.slotIndex) continue;
        const verifiedPresence = {
          ...presence,
          slotIndex: member.slotIndex,
          displayName: member.displayName,
          level: member.level,
        };
        const current = seen.get(presence.userId);
        if (!current || verifiedPresence.onlineAt >= current.onlineAt) {
          seen.set(presence.userId, verifiedPresence);
        }
      }
    }
    this.roster = Object.freeze(Array.from(seen.values()).sort((a, b) => a.slotIndex - b.slotIndex));
    this.rosterByUser = seen;
    safeCallback(this.callbacks.onRoster, this.roster);
  }

  async updatePresence(patch = {}) {
    if (!this.channel || !this.localPresence) return false;
    this.localPresence = {
      ...this.localPresence,
      displayName: safeText(patch.displayName ?? this.localPresence.displayName, 32),
      level: Math.max(1, Math.min(9999, Math.floor(Number(patch.level ?? this.localPresence.level) || 1))),
      skin: safeText(patch.skin ?? this.localPresence.skin, 32),
    };
    assertRealtimeOk(await this.channel.track(this.localPresence), "presence_failed", "Die Anwesenheit konnte nicht aktualisiert werden.");
    return true;
  }

  startHeartbeat() {
    window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      this.heartbeat().catch((error) => this.emitError(error));
    }, this.heartbeatMs);
  }

  heartbeat() {
    if (!this.assignment || this.heartbeatInFlight) return this.heartbeatInFlight || Promise.resolve(null);
    const requestStartedAt = Date.now();
    this.heartbeatInFlight = this.rpc(this.rpcNames.heartbeat, {
      p_connection_id: this.connectionId,
    }).then((data) => {
      const receivedAt = Date.now();
      const raw = firstRpcValue(data);
      const expires = parseTimestamp(valueFrom(raw, "lease_expires_at", "leaseExpiresAt") ?? raw);
      const serverNow = parseTimestamp(valueFrom(raw, "server_now", "serverNow"));
      this.updateServerClock(serverNow, requestStartedAt, receivedAt);
      if (expires) {
        this.assignment = Object.freeze({ ...this.assignment, leaseExpiresAt: expires, serverNow });
      }
      if (this.status === "degraded") this.setStatus("connected");
      return this.assignment;
    }).catch(async (error) => {
      if (error.code === "lease_expired") {
        this.setStatus("expired", { error });
        await this.disconnect({ release: false });
      } else if (error.retryable) {
        this.setStatus("degraded", { error });
      }
      throw error;
    }).finally(() => {
      this.heartbeatInFlight = null;
    });
    return this.heartbeatInFlight;
  }

  async refreshSnapshot() {
    if (!this.assignment) throw multiplayerError("not_connected", "Es gibt noch keine Server-Zuweisung.");
    if (this.snapshotInFlight) {
      this.snapshotAgain = true;
      return this.snapshotInFlight;
    }

    this.snapshotInFlight = (async () => {
      do {
        this.snapshotAgain = false;
        const requestStartedAt = Date.now();
        const data = await this.rpc(this.rpcNames.snapshot);
        const receivedAt = Date.now();
        const snapshot = normalizeSnapshot(data, this.assignment);
        this.updateServerClock(snapshot.capturedAt, requestStartedAt, receivedAt);
        if (snapshot.room.id !== this.assignment.roomId) {
          throw multiplayerError("snapshot_room_mismatch", "Der Snapshot gehört zu einem anderen Server.");
        }
        this.snapshot = snapshot;
        this.authoritativeMembers = new Map(snapshot.members.map((member) => [member.userId, member]));
        safeCallback(this.callbacks.onSnapshot, snapshot);
        this.syncRoster();
      } while (this.snapshotAgain);
      return this.snapshot;
    })().finally(() => {
      this.snapshotInFlight = null;
    });
    return this.snapshotInFlight;
  }

  scheduleSnapshotRefresh(delayMs = 100) {
    window.clearTimeout(this.snapshotTimer);
    this.snapshotTimer = window.setTimeout(() => {
      this.snapshotTimer = null;
      this.refreshSnapshot().catch((error) => this.emitError(error));
    }, Math.max(0, Number(delayMs) || 0));
  }

  movementPayload(position) {
    const tileX = Math.floor(Number(position?.tileX));
    const tileY = Math.floor(Number(position?.tileY));
    const fromX = Math.floor(Number(position?.fromX ?? tileX));
    const fromY = Math.floor(Number(position?.fromY ?? tileY));
    if (![tileX, tileY, fromX, fromY].every(Number.isFinite)) return null;
    if (tileX < 0 || tileX >= MAP_COLS || tileY < 0 || tileY >= MAP_ROWS || !isWalkable(tileX, tileY)) return null;
    if (fromX < 0 || fromX >= MAP_COLS || fromY < 0 || fromY >= MAP_ROWS || !isWalkable(fromX, fromY)) return null;
    return {
      userId: this.user.id,
      connectionId: this.connectionId,
      movementEpoch: this.movementEpoch,
      slotIndex: this.assignment.slotIndex,
      tileX,
      tileY,
      fromX,
      fromY,
      facing: FACING.has(position.facing) ? position.facing : "down",
      stepMs: Math.max(1, Math.min(1_000, Math.floor(Number(position.stepMs) || 180))),
      sequence: ++this.movementSequence,
      sentAt: this.now(),
    };
  }

  sendMovement(position) {
    if (this.status !== "connected" || !this.channel || !this.assignment) return false;
    const payload = this.movementPayload(position);
    if (!payload) return false;
    this.queuedMovement = payload;
    const elapsed = performance.now() - this.lastMovementSentAt;
    if (elapsed >= this.movementIntervalMs && !this.movementTimer) {
      this.flushMovement();
    } else if (!this.movementTimer) {
      this.movementTimer = window.setTimeout(() => {
        this.movementTimer = null;
        this.flushMovement();
      }, Math.max(0, this.movementIntervalMs - elapsed));
    }
    return true;
  }

  flushMovement() {
    window.clearTimeout(this.movementTimer);
    this.movementTimer = null;
    const payload = this.queuedMovement;
    this.queuedMovement = null;
    if (!payload || !this.channel || this.status !== "connected") return Promise.resolve(false);
    this.lastMovementSentAt = performance.now();
    return Promise.resolve(this.channel.send({
      type: "broadcast",
      event: GARDEN_MULTIPLAYER_EVENTS.movement,
      payload,
    })).then((result) => {
      assertRealtimeOk(result, "movement_failed", "Bewegung konnte nicht gesendet werden.");
      return true;
    }).catch((error) => {
      this.emitError(error instanceof GardenMultiplayerError
        ? error
        : multiplayerError("movement_failed", "Bewegung konnte nicht gesendet werden.", error, true));
      return false;
    });
  }

  receiveMovement(raw) {
    const movement = normalizeMovement(raw);
    if (!movement || movement.userId === this.user.id) return;
    const presence = this.rosterByUser.get(movement.userId);
    if (!presence
      || presence.connectionId !== movement.connectionId
      || presence.movementEpoch !== movement.movementEpoch
      || presence.slotIndex !== movement.slotIndex) return;
    const key = `${movement.userId}:${movement.connectionId}:${movement.movementEpoch}`;
    if (movement.sequence <= (this.remoteSequences.get(key) || -1)) return;
    this.remoteSequences.set(key, movement.sequence);
    safeCallback(this.callbacks.onMovement, { ...movement, presence });
  }

  inviteUrl(base = globalThis.location?.href || "https://kalterkaktus.de/games/KaktusGarden/") {
    if (!this.assignment?.roomCode) return null;
    const url = new URL(base, globalThis.location?.origin || "https://kalterkaktus.de");
    url.searchParams.set(GARDEN_ROOM_PARAM, this.assignment.roomCode);
    return url.toString();
  }

  bindLifecycle({ pageDocument = document, pageWindow = window } = {}) {
    this.lifecycleCleanup?.();
    const onVisibility = () => {
      if (pageDocument.visibilityState === "visible" && this.assignment) {
        this.heartbeat().then(() => this.refreshSnapshot()).catch((error) => this.emitError(error));
      }
    };
    const onOnline = () => {
      if (this.assignment) this.heartbeat().then(() => this.refreshSnapshot()).catch((error) => this.emitError(error));
    };
    const onPageHide = () => {
      // Die Lease absichtlich nicht freigeben: Reload/kurzer Abbruch darf mit
      // derselben connection_id wieder auf denselben Plot kommen.
      this.flushMovement();
    };
    pageDocument.addEventListener("visibilitychange", onVisibility);
    pageWindow.addEventListener("online", onOnline);
    pageWindow.addEventListener("pagehide", onPageHide);
    this.lifecycleCleanup = () => {
      pageDocument.removeEventListener("visibilitychange", onVisibility);
      pageWindow.removeEventListener("online", onOnline);
      pageWindow.removeEventListener("pagehide", onPageHide);
      this.lifecycleCleanup = null;
    };
    return this.lifecycleCleanup;
  }

  async releaseLeaseBestEffort() {
    try {
      await this.rpc(this.rpcNames.leave, { p_connection_id: this.connectionId });
      return true;
    } catch (error) {
      this.emitError(error);
      return false;
    }
  }

  async removeChannel() {
    const channel = this.channel;
    this.channel = null;
    if (!channel) return;
    try { await channel.untrack(); } catch {}
    try { await this.client.removeChannel(channel); } catch {}
  }

  releaseTabLock() {
    const release = this.tabLockRelease;
    this.tabLockRelease = null;
    try { release?.(); } catch {}
  }

  async disconnect({ release = true } = {}) {
    if (this.status === "disconnected" || this.status === "idle") return;
    this.setStatus("disconnecting");
    window.clearInterval(this.heartbeatTimer);
    window.clearTimeout(this.snapshotTimer);
    window.clearTimeout(this.movementTimer);
    window.clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.snapshotTimer = null;
    this.movementTimer = null;
    this.reconnectTimer = null;
    this.queuedMovement = null;
    this.lifecycleCleanup?.();
    await this.removeChannel();
    if (release && this.assignment) await this.releaseLeaseBestEffort();
    this.assignment = null;
    this.snapshot = null;
    this.roster = Object.freeze([]);
    this.rosterByUser.clear();
    this.authoritativeMembers.clear();
    this.remoteSequences.clear();
    this.releaseTabLock();
    this.setStatus("disconnected");
  }
}

export async function createGardenMultiplayer(options = {}) {
  const auth = options.client && options.user
    ? { client: options.client, session: options.session || null, user: options.user }
    : await requireSession(options.client || null);
  return new GardenMultiplayer({ ...options, ...auth });
}

export async function connectGardenMultiplayer(options = {}) {
  const multiplayer = await createGardenMultiplayer(options);
  await multiplayer.connect({
    roomCode: options.roomCode ?? gardenRoomCodeFromUrl(),
    presence: options.presence || {},
  });
  return multiplayer;
}
