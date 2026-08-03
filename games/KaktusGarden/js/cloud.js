import { getSupabase, isConfigReady } from "/js/supabase-client.js";
import { CROP_ORDER } from "./data/crops.js";
import { PLOT_CELLS } from "./data/world.js";
import { HOTBAR_SLOTS, SAVE_VERSION, createInitialState } from "./state.js";

export const GARDEN_GAME_ID = "kaktus-garden";

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_RETRY_DELAYS_MS = Object.freeze([1_000, 3_000, 10_000, 30_000]);
const MAX_PAYLOAD_BYTES = 1_000_000;
const MAX_SAVE_REVISION = Number.MAX_SAFE_INTEGER - 1;
const OUTBOX_PREFIX = "kaktus-garden-cloud-outbox-v1";
const CROP_IDS = new Set(CROP_ORDER);

export class GardenCloudError extends Error {
  constructor(code, message, { cause = null, retryable = false } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "GardenCloudError";
    this.code = code;
    this.retryable = retryable;
    if (cause && !this.cause) this.cause = cause;
  }
}

function cloudError(code, message, cause = null, retryable = false) {
  return new GardenCloudError(code, message, { cause, retryable });
}

function safeCallback(callback, value) {
  if (typeof callback !== "function") return;
  try {
    callback(value);
  } catch (error) {
    console.error("KaktusGarden Cloud-Callback fehlgeschlagen:", error);
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function payloadByteLength(json) {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(json).byteLength;
  return json.length;
}

/**
 * Erzeugt absichtlich eine reine JSON-Kopie. Dadurch landen weder Proxies noch
 * Funktionen oder zyklische UI-Objekte im Cloud-Save.
 */
function cloneJson(value) {
  let json;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    throw cloudError("invalid_state", "Der Garten-Spielstand ist nicht serialisierbar.", error);
  }

  if (!json || payloadByteLength(json) > MAX_PAYLOAD_BYTES) {
    throw cloudError("payload_too_large", "Der Garten-Spielstand ist zu groß für den Cloud-Save.");
  }

  return JSON.parse(json);
}

function isCell(value) {
  if (value === null) return true;
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && CROP_IDS.has(value.cropId)
    && Number.isFinite(value.plantedAt)
    && value.plantedAt >= 0
    && Number.isFinite(value.readyAt)
    && value.readyAt >= 0
    && Number.isInteger(value.harvested)
    && value.harvested >= 0
  );
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Die Datenbankmigration muss dieselben Grenzen erneut prüfen. Diese Prüfung
 * schützt vor kaputten lokalen Zuständen und verhindert versehentliche Wipes;
 * sie ist keine serverseitige Anti-Cheat-Grenze.
 */
export function validateGardenPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_payload", message: "Der Garten-Spielstand ist kein Objekt." };
  }
  if (value.version !== SAVE_VERSION) {
    return {
      ok: false,
      code: "unsupported_version",
      message: `Garden-Save-Version ${String(value.version)} wird nicht unterstützt.`,
    };
  }
  if (!Array.isArray(value.cells) || value.cells.length !== PLOT_CELLS || !value.cells.every(isCell)) {
    return {
      ok: false,
      code: "invalid_cells",
      message: `Der Garden-Save braucht genau ${PLOT_CELLS} gültige Pflanzenfelder.`,
    };
  }
  if (!Number.isFinite(value.coins) || value.coins < 0) {
    return { ok: false, code: "invalid_coins", message: "Der Münzstand ist ungültig." };
  }
  if (!value.seeds || typeof value.seeds !== "object" || Array.isArray(value.seeds)) {
    return { ok: false, code: "invalid_seeds", message: "Das Samen-Inventar ist ungültig." };
  }
  if (!Array.isArray(value.harvest)) {
    return { ok: false, code: "invalid_harvest", message: "Das Ernte-Inventar ist ungültig." };
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > MAX_SAVE_REVISION) {
    return { ok: false, code: "invalid_revision", message: "Die Save-Revision ist ungültig." };
  }
  if (!isNonNegativeInteger(value.coins)) {
    return { ok: false, code: "invalid_coins", message: "Der Muenzstand muss eine nichtnegative ganze Zahl sein." };
  }
  if (!isRecord(value.seeds) || Object.entries(value.seeds).some(
    ([cropId, amount]) => !CROP_IDS.has(cropId) || !Number.isInteger(amount) || amount <= 0,
  )) {
    return { ok: false, code: "invalid_seeds", message: "Das Samen-Inventar enthaelt ungueltige Stapel." };
  }
  if (!Array.isArray(value.harvest) || value.harvest.some((item) => (
    !isRecord(item)
    || !CROP_IDS.has(item.cropId)
    || !Number.isFinite(item.weight)
    || item.weight <= 0
  ))) {
    return { ok: false, code: "invalid_harvest", message: "Das Ernte-Inventar enthaelt ungueltige Gegenstaende." };
  }
  if (!isRecord(value.shop)
    || !isNonNegativeInteger(value.shop.slot)
    || !isRecord(value.shop.stock)
    || Object.keys(value.shop.stock).length !== CROP_ORDER.length
    || CROP_ORDER.some((cropId) => !isNonNegativeInteger(value.shop.stock[cropId]))
    || Object.keys(value.shop.stock).some((cropId) => !CROP_IDS.has(cropId))) {
    return { ok: false, code: "invalid_shop", message: "Der persoenliche Ladenbestand ist ungueltig." };
  }
  const stackCount = Object.keys(value.seeds).length
    + new Set(value.harvest.map((item) => item.cropId)).size;
  if (stackCount > HOTBAR_SLOTS) {
    return { ok: false, code: "invalid_inventory", message: "Der Garden-Save enthaelt zu viele Inventarstapel." };
  }
  if (!isNonNegativeInteger(value.selectedSlot) || value.selectedSlot >= HOTBAR_SLOTS) {
    return { ok: false, code: "invalid_selection", message: "Das ausgewaehlte Inventarfach ist ungueltig." };
  }
  if (!isNonNegativeInteger(value.lastSavedAt)) {
    return { ok: false, code: "invalid_saved_at", message: "Der Save-Zeitstempel ist ungueltig." };
  }
  return { ok: true };
}

export function prepareGardenPayload(state, now = Date.now()) {
  const payload = cloneJson(state);
  const validation = validateGardenPayload(payload);
  if (!validation.ok) throw cloudError(validation.code, validation.message);
  payload.lastSavedAt = now;
  return payload;
}

function storageOrNull(candidate) {
  if (candidate) return candidate;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRetryableSupabaseError(error) {
  const status = Number(error?.status || error?.statusCode);
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  const code = String(error?.code || "");
  if (["PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(code)) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return /network|fetch|timeout|timed out|connection|offline/.test(message);
}

function fromSupabaseError(error, fallbackCode = "cloud_failed") {
  const message = String(error?.message || "Cloud-Save fehlgeschlagen.");
  const details = `${message} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  if (details.includes("garden_save_stale_revision")) {
    return cloudError("stale_revision", "Ein neuerer Garden-Spielstand liegt bereits in der Cloud.", error);
  }
  if (details.includes("garden_save_revision_conflict")) {
    return cloudError("revision_conflict", "Diese Save-Revision enthält widersprüchliche Daten.", error);
  }
  if (/jwt|not authenticated|auth session|permission denied/i.test(message)) {
    return cloudError("login_required", "Für den Garden-Cloud-Save ist eine Anmeldung nötig.", error);
  }
  return cloudError(fallbackCode, message, error, isRetryableSupabaseError(error));
}

/** Login ist für den Multiplayer absichtlich zwingend; es gibt keinen anon-RLS-Fallback. */
export async function requireGardenSession(client = null) {
  if (!client && !isConfigReady()) {
    throw cloudError("config_unavailable", "Supabase ist nicht konfiguriert.", null, true);
  }

  const supabase = client || getSupabase();
  if (!supabase) throw cloudError("config_unavailable", "Supabase ist nicht verfügbar.", null, true);

  let result;
  try {
    result = await supabase.auth.getSession();
  } catch (error) {
    throw cloudError("auth_unavailable", "Die Anmeldung konnte nicht geprüft werden.", error, true);
  }
  if (result?.error) throw fromSupabaseError(result.error, "auth_unavailable");

  const session = result?.data?.session;
  if (!session?.user?.id) {
    throw cloudError("login_required", "Für KaktusGarden Multiplayer ist eine Anmeldung nötig.");
  }

  return { client: supabase, session, user: session.user };
}

function unwrapOutbox(raw, expectedUserId) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.gameId !== GARDEN_GAME_ID || raw.userId !== expectedUserId) return null;
  const validation = validateGardenPayload(raw.payload);
  if (!validation.ok) return null;
  return {
    sequence: Math.max(1, Math.floor(finiteNumber(raw.sequence, 1))),
    payload: cloneJson(raw.payload),
    totalEarned: Math.max(0, finiteNumber(raw.totalEarned)),
    queuedAt: Math.max(0, finiteNumber(raw.queuedAt, Date.now())),
    reason: String(raw.reason || "restored"),
    attempts: Math.max(0, Math.floor(finiteNumber(raw.attempts))),
  };
}

/**
 * Ein Store pro angemeldetem User. schedule() darf bei jeder kaufenden,
 * pflanzenden oder erntenden Aktion aufgerufen werden: der jeweils neueste
 * Zustand ersetzt ältere noch nicht versendete Zustände, aber niemals einen
 * laufenden Request. Netzwerkfehler bleiben zusätzlich im lokalen Outbox-Key.
 */
export class GardenCloudStore {
  constructor({
    client,
    user,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    storage = null,
    onStatus = null,
    onError = null,
  }) {
    if (!client || !user?.id) throw cloudError("login_required", "GardenCloudStore braucht eine Anmeldung.");
    this.client = client;
    this.user = user;
    this.debounceMs = Math.max(0, Number(debounceMs) || 0);
    this.retryDelaysMs = Array.from(retryDelaysMs || DEFAULT_RETRY_DELAYS_MS, (value) => Math.max(0, Number(value) || 0));
    this.storage = storageOrNull(storage);
    this.onStatus = onStatus;
    this.onError = onError;

    this.pending = null;
    this.inFlight = null;
    this.timer = null;
    this.retryBlocked = false;
    this.closed = false;
    this.sequence = 0;
    this.lastKnownRevision = 0;
    this.lastKnownTotalEarned = 0;
    this.lastCloudUpdatedAt = 0;
    this.lifecycleCleanup = null;
    this.outboxKey = `${OUTBOX_PREFIX}:${user.id}`;
  }

  emitStatus(status, extra = {}) {
    safeCallback(this.onStatus, { status, ...extra });
  }

  emitError(error) {
    safeCallback(this.onError, error);
  }

  readOutbox() {
    if (!this.storage) return null;
    try {
      return unwrapOutbox(JSON.parse(this.storage.getItem(this.outboxKey)), this.user.id);
    } catch (error) {
      this.emitError(cloudError("outbox_read_failed", "Die lokale Save-Outbox konnte nicht gelesen werden.", error));
      return null;
    }
  }

  persistOutbox(entry = this.pending) {
    if (!this.storage) return false;
    try {
      // Den letzten erfolgreich gesendeten Stand als dauerhaften Checkpoint
      // behalten. localStorage hat kein atomares compare-and-delete; ein altes
      // Tab koennte sonst eine neuere Aktion des aktiven Tabs entfernen.
      if (!entry) return true;
      const current = unwrapOutbox(JSON.parse(this.storage.getItem(this.outboxKey)), this.user.id);
      const currentRevision = Number(current?.payload?.revision ?? -1);
      const nextRevision = Number(entry.payload?.revision ?? -1);
      if (currentRevision > nextRevision
        || (currentRevision === nextRevision && current?.queuedAt !== entry.queuedAt)) {
        return false;
      }
      this.storage.setItem(this.outboxKey, JSON.stringify({
        gameId: GARDEN_GAME_ID,
        userId: this.user.id,
        ...entry,
      }));
      return true;
    } catch (error) {
      this.emitError(cloudError("outbox_write_failed", "Der ausstehende Save konnte nicht lokal gesichert werden.", error));
      return false;
    }
  }

  async load() {
    if (this.closed) throw cloudError("store_closed", "Der Garden-Cloud-Store ist geschlossen.");
    this.emitStatus("loading");

    const { data, error } = await this.client
      .from("game_saves")
      .select("payload,total_earned,updated_at")
      .eq("user_id", this.user.id)
      .eq("game_id", GARDEN_GAME_ID)
      .maybeSingle();

    if (error) {
      const wrapped = fromSupabaseError(error, "load_failed");
      this.emitStatus("error", { error: wrapped });
      throw wrapped;
    }

    this.lastKnownTotalEarned = Math.max(0, finiteNumber(data?.total_earned));
    this.lastCloudUpdatedAt = data?.updated_at ? Date.parse(data.updated_at) || 0 : 0;

    let cloudState = null;
    let cloudPayloadError = null;
    let invalidCloudRevision = 0;
    if (data?.payload) {
      const validation = validateGardenPayload(data.payload);
      if (!validation.ok) {
        cloudPayloadError = cloudError(validation.code, validation.message);
        const rawRevision = data.payload?.revision;
        if (Number.isSafeInteger(rawRevision) && rawRevision >= 0 && rawRevision < MAX_SAVE_REVISION) {
          invalidCloudRevision = rawRevision;
        }
      } else {
        cloudState = cloneJson(data.payload);
        this.lastKnownRevision = Math.max(0, Math.floor(finiteNumber(cloudState.revision)));
      }
    }

    const restored = this.readOutbox();
    const outboxRevision = Math.max(0, Math.floor(finiteNumber(restored?.payload?.revision, -1)));
    const cloudRevision = Math.max(0, Math.floor(finiteNumber(cloudState?.revision, -1)));
    if (restored && (!cloudState || outboxRevision > cloudRevision)) {
      restored.totalEarned = Math.max(restored.totalEarned, this.lastKnownTotalEarned);
      this.pending = restored;
      this.sequence = Math.max(this.sequence, restored.sequence);
      this.lastKnownRevision = Math.max(this.lastKnownRevision, outboxRevision);
      this.lastKnownTotalEarned = Math.max(this.lastKnownTotalEarned, restored.totalEarned);
      this.emitStatus("pending", { source: "outbox", queuedAt: restored.queuedAt });
      this.armTimer(0);
      return {
        state: cloneJson(restored.payload),
        source: "outbox",
        hasPendingUpload: true,
        cloudUpdatedAt: this.lastCloudUpdatedAt,
        queuedAt: restored.queuedAt,
        totalEarned: restored.totalEarned,
      };
    }

    // Gleiche oder ältere Revisionen sind bereits in der Cloud enthalten oder
    // wurden von einer neueren Sitzung überholt. Sie dürfen diese nicht wieder
    // überschreiben.
    if (cloudPayloadError) {
      // Alte Test-Saves (v2/v3 bzw. frühe v4 ohne Revision) sind nicht mit dem
      // aktuellen 8×8-Format kompatibel. Sie werden bewusst einmalig ersetzt;
      // total_earned bleibt dabei monoton erhalten.
      const resetState = createInitialState();
      resetState.revision = invalidCloudRevision + 1;
      this.lastKnownRevision = invalidCloudRevision;
      this.schedule(resetState, {
        totalEarned: this.lastKnownTotalEarned,
        reason: "legacy-reset",
        immediate: true,
      });
      this.emitStatus("pending", { source: "legacy-reset", resetError: cloudPayloadError });
      return {
        state: cloneJson(resetState),
        source: "legacy-reset",
        hasPendingUpload: true,
        cloudUpdatedAt: this.lastCloudUpdatedAt,
        queuedAt: this.pending?.queuedAt || Date.now(),
        totalEarned: this.lastKnownTotalEarned,
        resetError: cloudPayloadError,
      };
    }

    this.emitStatus("ready", { source: cloudState ? "cloud" : "empty" });
    return {
      state: cloudState,
      source: cloudState ? "cloud" : "empty",
      hasPendingUpload: false,
      cloudUpdatedAt: this.lastCloudUpdatedAt,
      queuedAt: 0,
      totalEarned: this.lastKnownTotalEarned,
    };
  }

  schedule(state, { totalEarned = this.lastKnownTotalEarned, reason = "action", immediate = false } = {}) {
    if (this.closed) throw cloudError("store_closed", "Der Garden-Cloud-Store ist geschlossen.");
    const payload = prepareGardenPayload(state);
    const revision = Math.max(0, Math.floor(finiteNumber(payload.revision)));
    if (revision < this.lastKnownRevision) {
      throw cloudError(
        "stale_revision",
        `Save-Revision ${revision} ist älter als der bekannte Cloudstand ${this.lastKnownRevision}.`,
      );
    }
    const entry = {
      sequence: ++this.sequence,
      payload,
      // total_earned ist im alten Garden der kumulative Ertrag. Nie Coins
      // verwenden: Käufe würden sonst fälschlich einen Save-Verlust auslösen.
      totalEarned: Math.max(this.lastKnownTotalEarned, finiteNumber(totalEarned)),
      queuedAt: Date.now(),
      reason: String(reason || "action").slice(0, 48),
      attempts: 0,
    };

    this.pending = entry;
    this.retryBlocked = false;
    this.persistOutbox(entry);
    this.emitStatus("pending", { reason: entry.reason, sequence: entry.sequence });
    this.armTimer(immediate ? 0 : this.debounceMs);
    return entry.sequence;
  }

  armTimer(delayMs) {
    if (this.closed || !this.pending) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.flush().catch((error) => this.emitError(error));
    }, Math.max(0, Number(delayMs) || 0));
  }

  retryDelay(attempts) {
    if (!this.retryDelaysMs.length) return null;
    return this.retryDelaysMs[Math.min(Math.max(0, attempts - 1), this.retryDelaysMs.length - 1)];
  }

  async write(entry) {
    const { error } = await this.client.from("game_saves").upsert({
      user_id: this.user.id,
      game_id: GARDEN_GAME_ID,
      payload: entry.payload,
      total_earned: entry.totalEarned,
      // Der vorhandene DB-Trigger ersetzt diesen Wert durch profiles.username.
      display_name: "Spieler",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,game_id" });

    if (error) throw fromSupabaseError(error, "save_failed");
  }

  async drain() {
    while (this.pending && !this.closed) {
      const entry = this.pending;
      this.emitStatus("saving", { sequence: entry.sequence, reason: entry.reason });
      try {
        await this.write(entry);
      } catch (error) {
        const wrapped = error instanceof GardenCloudError ? error : fromSupabaseError(error, "save_failed");
        // Ein neuerer Zustand ersetzt den fehlgeschlagenen, weil er sämtliche
        // bis dahin ausgeführten Aktionen enthält. Sonst bleibt exakt dieser
        // Eintrag erhalten und wird nicht still verworfen.
        if (this.pending?.sequence === entry.sequence) {
          entry.attempts += 1;
          this.persistOutbox(entry);
          const retryInMs = wrapped.retryable ? this.retryDelay(entry.attempts) : null;
          this.retryBlocked = retryInMs === null;
          this.emitStatus("error", { error: wrapped, sequence: entry.sequence, retryInMs });
          if (retryInMs !== null) this.armTimer(retryInMs);
        }
        throw wrapped;
      }

      this.lastKnownTotalEarned = Math.max(this.lastKnownTotalEarned, entry.totalEarned);
      this.retryBlocked = false;
      this.lastKnownRevision = Math.max(this.lastKnownRevision, Math.floor(finiteNumber(entry.payload.revision)));
      this.lastCloudUpdatedAt = Date.now();
      if (this.pending?.sequence === entry.sequence) {
        this.pending = null;
      } else {
        this.persistOutbox(this.pending);
      }
      this.emitStatus("saved", { sequence: entry.sequence, savedAt: this.lastCloudUpdatedAt });
    }

    return { ok: true, pending: Boolean(this.pending) };
  }

  flush() {
    if (this.closed) return Promise.reject(cloudError("store_closed", "Der Garden-Cloud-Store ist geschlossen."));
    window.clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending && !this.inFlight) return Promise.resolve({ ok: true, pending: false });
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.drain().finally(() => {
      this.inFlight = null;
      // schedule() kann genau zwischen dem letzten while-Check und finally()
      // aufgerufen worden sein.
      if (this.pending && !this.timer && !this.closed && !this.retryBlocked) this.armTimer(this.debounceMs);
    });
    return this.inFlight;
  }

  async flushBestEffort() {
    try {
      return await this.flush();
    } catch (error) {
      this.emitError(error);
      return { ok: false, pending: Boolean(this.pending), error };
    }
  }

  /**
   * Muss von der Integration einmal aufgerufen werden. pagehide kann Requests
   * nicht garantiert beenden; die synchrone Outbox davor stellt aber sicher,
   * dass der nächste Seitenaufruf den ausstehenden Zustand erneut sendet.
   */
  bindLifecycle({ pageDocument = document, pageWindow = window } = {}) {
    this.lifecycleCleanup?.();
    const onVisibility = () => {
      if (pageDocument.visibilityState === "hidden") this.flushBestEffort();
    };
    const onPageHide = () => this.flushBestEffort();
    const onOnline = () => {
      if (this.pending) this.armTimer(0);
    };
    pageDocument.addEventListener("visibilitychange", onVisibility);
    pageWindow.addEventListener("pagehide", onPageHide);
    pageWindow.addEventListener("online", onOnline);
    this.lifecycleCleanup = () => {
      pageDocument.removeEventListener("visibilitychange", onVisibility);
      pageWindow.removeEventListener("pagehide", onPageHide);
      pageWindow.removeEventListener("online", onOnline);
      this.lifecycleCleanup = null;
    };
    return this.lifecycleCleanup;
  }

  async close({ flush = true } = {}) {
    if (this.closed) return { ok: true };
    let result = { ok: true };
    if (flush) result = await this.flushBestEffort();
    this.closed = true;
    window.clearTimeout(this.timer);
    this.timer = null;
    this.lifecycleCleanup?.();
    return result;
  }
}

export async function createGardenCloudStore(options = {}) {
  const auth = options.client && options.user
    ? { client: options.client, session: options.session || null, user: options.user }
    : await requireGardenSession(options.client || null);
  return new GardenCloudStore({ ...options, client: auth.client, user: auth.user });
}
