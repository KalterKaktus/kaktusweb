// The browser sends intentions only. All online state and randomness come from the server.
const ROOM_KEY = 'kk-life-room';
const PENDING_KEY = 'kk-life-pending-v1';
const defaultStorage = () => { try { return globalThis.localStorage; } catch { return null; } };
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const fingerprintFor = body => { const { revision, ...intent } = body; return JSON.stringify(stable(intent)); };

export class ConnectionError extends Error {
    constructor(key, status = 0) { super(key); this.key = key; this.status = status; }
}

export function createConnection({ getSession, fetchImpl = globalThis.fetch, storage = defaultStorage(),
    uuid = () => globalThis.crypto.randomUUID(), endpoint = '/api/kaktuslife', timeout = 15000 } = {}) {
    let inFlight = false, pendingReceipt = null, useStorage = Boolean(storage), currentActorId = null;
    const memory = new Map();
    const read = key => {
        if (useStorage) { try { const value = storage.getItem(key); if (value == null) memory.delete(key); else memory.set(key, value); return value; } catch { useStorage = false; } }
        return memory.get(key);
    };
    const write = (key, value) => { memory.set(key, value); if (useStorage) { try { storage.setItem(key, value); } catch { useStorage = false; } } };
    const remove = key => { memory.delete(key); if (useStorage) { try { storage.removeItem(key); } catch { useStorage = false; } } };
    const readReceipts = () => {
        try { const value = JSON.parse(read(PENDING_KEY) || 'null'); return Array.isArray(value?.receipts) ? value.receipts : value?.requestId ? [value] : []; }
        catch { return []; }
    };
    const persistReceipts = receipts => { if (receipts.length) write(PENDING_KEY, JSON.stringify({ version: 2, receipts })); else remove(PENDING_KEY); };
    function saveReceipt(receipt) {
        const others = readReceipts().filter(value => value?.requestId !== receipt.requestId && !(value?.actorId === receipt.actorId && value.fingerprint === receipt.fingerprint));
        persistReceipts([...others, receipt]);
    }
    function clearReceipt(receipt, room) {
        if (pendingReceipt?.requestId === receipt.requestId) pendingReceipt = null;
        // A second tab may have persisted a different request while this one was in flight.
        persistReceipts(readReceipts().filter(value => value?.requestId !== receipt.requestId &&
            !(room && value?.actorId === receipt.actorId && value.body?.roomId === room.id && value.body.revision < room.revision)));
    }
    async function sessionForRequest() {
        let timer;
        try {
            const session = await Promise.race([Promise.resolve().then(getSession), new Promise((_, reject) => {
                timer = setTimeout(() => reject(new ConnectionError('life.errors.network')), timeout);
            })]);
            if (!session?.access_token || !session.user?.id) throw new ConnectionError('life.errors.auth', 401);
            currentActorId = session.user.id;
            return session;
        } catch (error) {
            if (error instanceof ConnectionError) throw error;
            throw new ConnectionError('life.errors.network');
        } finally { clearTimeout(timer); }
    }

    async function request(body, { session, remember = true, signal } = {}) {
        session ||= await sessionForRequest();
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) controller.abort();
        else signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetchImpl(endpoint, {
                method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new ConnectionError(
                /^life\.errors\.[a-zA-Z_]+$/.test(data.error || '') ? data.error : 'life.errors.unavailable', response.status);
            if (!data.room?.id || !Number.isSafeInteger(data.room.revision)) throw new ConnectionError('life.errors.unavailable');
            if (remember) write(ROOM_KEY, data.room.id);
            return data.room;
        } catch (error) {
            if (error instanceof ConnectionError) throw error;
            throw new ConnectionError('life.errors.network');
        } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }

    async function mutate(body) {
        if (inFlight) throw new ConnectionError('life.errors.busy');
        inFlight = true;
        let receipt;
        try {
            const session = await sessionForRequest();
            const fingerprint = fingerprintFor(body);
            const actorId = session.user.id;
            receipt = [pendingReceipt, ...readReceipts()].find(value => value?.actorId === actorId && value.fingerprint === fingerprint && value.body && value.requestId);
            if (!receipt) receipt = { actorId, fingerprint, requestId: uuid(), body: JSON.parse(JSON.stringify(body)) };
            pendingReceipt = receipt;
            saveReceipt(receipt);
            // Retry the exact body, including its original revision, even after a newer snapshot arrives.
            const room = await request({ ...receipt.body, requestId: receipt.requestId }, { session, remember: body.op !== 'close' });
            clearReceipt(receipt, room);
            return room;
        } catch (error) {
            // Keep ambiguous network/5xx outcomes so a retry cannot apply an action twice.
            // An expired session does not prove that an earlier lost request was rejected.
            if (receipt && error.status >= 400 && error.status < 500 && error.status !== 401) clearReceipt(receipt);
            throw error;
        } finally { inFlight = false; }
    }

    return {
        async getIdentity() {
            try {
                const session = await sessionForRequest();
                const user = session?.user;
                return user ? { id: user.id, name: String(user.user_metadata?.username || user.user_metadata?.full_name || 'Kaktus').slice(0,40) } : null;
            } catch { return null; }
        },
        createRoom: () => mutate({ op: 'create' }),
        joinRoom: code => mutate({ op: 'join', code: String(code).trim().toUpperCase() }),
        loadRoom: roomId => request({ op: 'snapshot', roomId }),
        roomAction: (room, action) => mutate({ op: 'action', roomId: room.id, revision: room.revision, action }),
        rematchRoom: room => mutate({ op: 'rematch', roomId: room.id, revision: room.revision }),
        async closeRoom(room) {
            const closed = await mutate({ op: 'close', roomId: room.id, revision: room.revision });
            if (closed.closed && read(ROOM_KEY) === closed.id) remove(ROOM_KEY);
            return closed;
        },
        getSavedRoomId: () => read(ROOM_KEY),
        forgetRoom: roomId => {
            if (!roomId) { remove(ROOM_KEY); remove(PENDING_KEY); pendingReceipt = null; return; }
            if (read(ROOM_KEY) === roomId) remove(ROOM_KEY);
            if (currentActorId) {
                persistReceipts(readReceipts().filter(value => !(value?.actorId === currentActorId && value.body?.roomId === roomId)));
                if (pendingReceipt?.actorId === currentActorId && pendingReceipt.body?.roomId === roomId) pendingReceipt = null;
            }
        },
        subscribeRoom(roomId, onRoom, onError = () => {}) {
            let stopped = false, timer, failures = 0, lastRevision = -1, polling = false, wakeAfterPoll = false, controller;
            async function poll() {
                if (stopped || polling) return;
                polling = true;
                controller = new AbortController();
                try {
                    const room = await request({ op: 'snapshot', roomId }, { remember: false, signal: controller.signal });
                    if (stopped) return;
                    failures = 0;
                    if (room.revision >= lastRevision) { lastRevision = room.revision; onRoom(room); }
                } catch (error) {
                    if (stopped) return;
                    failures++;
                    onError(error);
                } finally {
                    polling = false;
                    if (!stopped) timer = setTimeout(poll, wakeAfterPoll ? 50 :
                        globalThis.document?.hidden ? 15000 : Math.min(2500 * 2 ** Math.min(failures, 3), 20000));
                    wakeAfterPoll = false;
                }
            }
            const wake = () => { if (!globalThis.document?.hidden && !stopped) { clearTimeout(timer); if (polling) wakeAfterPoll = true; else timer = setTimeout(poll, 50); } };
            globalThis.document?.addEventListener('visibilitychange', wake);
            timer = setTimeout(poll, 0);
            return () => { stopped = true; clearTimeout(timer); controller?.abort(); globalThis.document?.removeEventListener('visibilitychange', wake); };
        },
    };
}

let clientPromise;
async function siteSession() {
    // Lazy import lets the local two-person table work even when the auth CDN is unavailable.
    if (!clientPromise) clientPromise = import('/js/supabase-client.js').catch(error => { clientPromise = undefined; throw error; });
    let timer;
    try {
        const module = await Promise.race([clientPromise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('auth timeout')), 8000); })]);
        const client = module.getSupabase();
        if (!client) return null;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session;
    } finally { clearTimeout(timer); }
}
const connection = createConnection({ getSession: siteSession });
export const getIdentity = (...args) => connection.getIdentity(...args);
export const createRoom = (...args) => connection.createRoom(...args);
export const joinRoom = (...args) => connection.joinRoom(...args);
export const loadRoom = (...args) => connection.loadRoom(...args);
export const roomAction = (...args) => connection.roomAction(...args);
export const rematchRoom = (...args) => connection.rematchRoom(...args);
export const closeRoom = (...args) => connection.closeRoom(...args);
export const subscribeRoom = (...args) => connection.subscribeRoom(...args);
export const getSavedRoomId = () => connection.getSavedRoomId();
export const forgetRoom = (...args) => connection.forgetRoom(...args);
