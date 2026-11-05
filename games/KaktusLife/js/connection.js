// The browser sends intentions only. All online state and randomness come from the server.
const ROOM_KEY = 'kk-life-room';
const PENDING_KEY = 'kk-life-pending-v1';

export class ConnectionError extends Error {
    constructor(key, status = 0) { super(key); this.key = key; this.status = status; }
}

export function createConnection({ getSession, fetchImpl = globalThis.fetch, storage = globalThis.localStorage,
    uuid = () => globalThis.crypto.randomUUID(), endpoint = '/api/kaktuslife', timeout = 15000 } = {}) {
    let inFlight = false;
    const read = key => { try { return storage?.getItem(key); } catch { return null; } };
    const write = (key, value) => { try { storage?.setItem(key, value); } catch { /* restricted browser */ } };
    const remove = key => { try { storage?.removeItem(key); } catch { /* restricted browser */ } };

    async function request(body) {
        const session = await getSession();
        if (!session?.access_token) throw new ConnectionError('life.errors.auth', 401);
        const controller = new AbortController();
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
            write(ROOM_KEY, data.room.id);
            return data.room;
        } catch (error) {
            if (error instanceof ConnectionError) throw error;
            throw new ConnectionError('life.errors.network');
        } finally { clearTimeout(timer); }
    }

    async function mutate(body) {
        if (inFlight) throw new ConnectionError('life.errors.busy');
        inFlight = true;
        const fingerprint = JSON.stringify(body);
        let receipt;
        try { receipt = JSON.parse(read(PENDING_KEY) || 'null'); } catch { /* discard corrupted receipt */ }
        if (receipt?.fingerprint !== fingerprint) receipt = { fingerprint, requestId: uuid() };
        write(PENDING_KEY, JSON.stringify(receipt));
        try {
            const room = await request({ ...body, requestId: receipt.requestId });
            remove(PENDING_KEY);
            return room;
        } catch (error) {
            // Keep ambiguous network/5xx outcomes so a retry cannot apply an action twice.
            if (error.status >= 400 && error.status < 500) remove(PENDING_KEY);
            throw error;
        } finally { inFlight = false; }
    }

    return {
        async getIdentity() {
            try {
                const session = await getSession();
                const user = session?.user;
                return user ? { id: user.id, name: String(user.user_metadata?.username || user.user_metadata?.full_name || 'Kaktus').slice(0,40) } : null;
            } catch { return null; }
        },
        createRoom: () => mutate({ op: 'create' }),
        joinRoom: code => mutate({ op: 'join', code: String(code).trim().toUpperCase() }),
        loadRoom: roomId => request({ op: 'snapshot', roomId }),
        roomAction: (room, action) => mutate({ op: 'action', roomId: room.id, revision: room.revision, action }),
        rematchRoom: room => mutate({ op: 'rematch', roomId: room.id, revision: room.revision }),
        getSavedRoomId: () => read(ROOM_KEY),
        forgetRoom: () => { remove(ROOM_KEY); remove(PENDING_KEY); },
        subscribeRoom(roomId, onRoom, onError = () => {}) {
            let stopped = false, timer, failures = 0, lastRevision = -1;
            async function poll() {
                if (stopped) return;
                try {
                    const room = await request({ op: 'snapshot', roomId });
                    if (stopped) return;
                    failures = 0;
                    if (room.revision >= lastRevision) { lastRevision = room.revision; onRoom(room); }
                } catch (error) {
                    if (stopped) return;
                    failures++;
                    onError(error);
                }
                if (!stopped) timer = setTimeout(poll,
                    globalThis.document?.hidden ? 15000 : Math.min(2500 * 2 ** Math.min(failures, 3), 20000));
            }
            const wake = () => { if (!globalThis.document?.hidden && !stopped) { clearTimeout(timer); timer = setTimeout(poll, 50); } };
            globalThis.document?.addEventListener('visibilitychange', wake);
            timer = setTimeout(poll, 0);
            return () => { stopped = true; clearTimeout(timer); globalThis.document?.removeEventListener('visibilitychange', wake); };
        },
    };
}

let clientPromise;
async function siteSession() {
    // Lazy import lets the local two-person table work even when the auth CDN is unavailable.
    if (!clientPromise) clientPromise = import('/js/supabase-client.js').then(module => module.getSupabase());
    let timer;
    try {
        const client = await Promise.race([clientPromise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('auth timeout')), 8000); })]);
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
export const subscribeRoom = (...args) => connection.subscribeRoom(...args);
export const getSavedRoomId = () => connection.getSavedRoomId();
export const forgetRoom = () => connection.forgetRoom();
