import { randomInt } from "node:crypto";
import { createGame, applyAction } from "../../games/KaktusLife/shared/engine.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-HJ-NP-Z2-9]{10}$/;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ERROR_STATUS = {
    auth: 401, invalidRequest: 400, invalidAction: 400, forbidden: 403, banned: 403,
    notFound: 404, full: 409, conflict: 409, requestConflict: 409, notReady: 409,
    alreadyStarted: 409, notFinished: 409, rateLimit: 429, unavailable: 503,
};

function failure(code) {
    const error = new Error(`life.errors.${code}`);
    error.status = ERROR_STATUS[code] || 503;
    return error;
}

function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}

function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value, keys) {
    return object(value) && Object.keys(value).every((key) => keys.includes(key));
}

function normalizeInput(value) {
    if (!onlyKeys(value, ["op", "roomId", "code", "requestId", "revision", "action"])) throw failure("invalidRequest");
    const { op } = value;
    if (!["create", "join", "snapshot", "action", "rematch", "close"].includes(op)) throw failure("invalidRequest");
    const fields = { create: ["op", "requestId"], join: ["op", "requestId", "code"], snapshot: ["op", "roomId"], action: ["op", "roomId", "requestId", "revision", "action"], rematch: ["op", "roomId", "requestId", "revision"], close: ["op", "roomId", "requestId", "revision"] };
    if (!onlyKeys(value, fields[op])) throw failure("invalidRequest");
    if (op !== "snapshot" && !UUID.test(value.requestId || "")) throw failure("invalidRequest");
    if (["snapshot", "action", "rematch", "close"].includes(op) && !UUID.test(value.roomId || "")) throw failure("invalidRequest");
    if (["action", "rematch", "close"].includes(op) && (!Number.isSafeInteger(value.revision) || value.revision < 0)) throw failure("invalidRequest");
    const normalized = { op, roomId: value.roomId?.toLowerCase() || null, requestId: value.requestId?.toLowerCase() || null, revision: value.revision ?? null };
    if (op === "join") {
        normalized.code = typeof value.code === "string" ? value.code.trim().toUpperCase() : "";
        if (!CODE.test(normalized.code)) throw failure("invalidRequest");
    }
    if (op === "action") {
        const action = value.action;
        if (!object(action)) throw failure("invalidAction");
        if (["start", "roll", "end"].includes(action.type) && onlyKeys(action, ["type"])) normalized.action = { type: action.type };
        else if (action.type === "choose" && onlyKeys(action, ["type", "choice"]) && typeof action.choice === "string" && action.choice.length > 0 && action.choice.length <= 80) normalized.action = { type: "choose", choice: action.choice };
        else if (action.type === "ready" && onlyKeys(action, ["type", "ready"]) && (action.ready === undefined || typeof action.ready === "boolean")) normalized.action = { type: "ready", ready: action.ready !== false };
        else throw failure("invalidAction");
    }
    return normalized;
}

function intentFor(input) {
    if (input.op === "create") return { op: "create" };
    if (input.op === "join") return { op: "join", code: input.code };
    if (["rematch", "close"].includes(input.op)) return { op: input.op, roomId: input.roomId };
    return { op: "action", roomId: input.roomId, action: input.action };
}

/** Secure integer hook avoids modulo/floating-point bias in the ten-sided die. */
export function secureRandom() {
    return randomInt(0, 2 ** 48 - 1) / (2 ** 48 - 1);
}
secureRandom.int = (min, max) => randomInt(min, max);

function inviteCode() {
    return Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Dependencies are injectable for offline integration tests; production always uses Supabase Auth. */
export function createHandler({ fetchImpl = globalThis.fetch, getEnv = (name) => globalThis.Netlify?.env?.get(name) || process.env[name], rng = secureRandom } = {}) {
    return async function handler(request) {
        try {
            if (request.method !== "POST") return json({ error: "life.errors.invalidRequest" }, 405);
            const url = getEnv("SUPABASE_URL");
            const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
            if (!url || !key) throw failure("unavailable");
            const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
            if (!token || token.length > 8192) throw failure("auth");
            const auth = await fetchImpl(`${url.replace(/\/$/, "")}/auth/v1/user`, {
                headers: { apikey: key, Authorization: `Bearer ${token}` },
            });
            if (!auth.ok) throw failure(auth.status === 401 || auth.status === 403 ? "auth" : "unavailable");
            const user = await auth.json();
            if (!UUID.test(user?.id || "")) throw failure("auth");
            if (Number(request.headers.get("content-length")) > 4096) throw failure("invalidRequest");
            // Limit the streamed body as well: Content-Length can be absent or forged.
            const reader = request.body?.getReader();
            if (!reader) throw failure("invalidRequest");
            const decoder = new TextDecoder();
            let body = "";
            let bytes = 0;
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                bytes += value.byteLength;
                if (bytes > 4096) { await reader.cancel(); throw failure("invalidRequest"); }
                body += decoder.decode(value, { stream: true });
            }
            body += decoder.decode();
            let parsed;
            try { parsed = JSON.parse(body); } catch { throw failure("invalidRequest"); }
            const input = normalizeInput(parsed);
            const rpc = async (name, args) => {
                const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
                    method: "POST",
                    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ p_actor: user.id, ...args }),
                });
                let data;
                try { data = await response.json(); } catch { throw failure("unavailable"); }
                if (!response.ok) {
                    const publicCode = /^life\.errors\.([A-Za-z]+)$/.exec(data?.message || "")?.[1];
                    throw failure(publicCode && ERROR_STATUS[publicCode] ? publicCode : "unavailable");
                }
                return data;
            };
            let result;
            if (["create", "join", "rematch", "close"].includes(input.op) || input.action?.type === "ready") {
                const intent = intentFor(input);
                result = await rpc("kaktuslife_lobby", {
                    p_operation: input.op === "action" ? "ready" : input.op,
                    p_request_id: input.requestId, p_intent: intent, p_room_id: input.roomId,
                    p_code: input.op === "create" ? inviteCode() : input.code || null,
                    p_revision: input.revision, p_ready: input.action?.ready ?? false,
                });
            } else {
                const intent = input.op === "action" ? intentFor(input) : null;
                result = await rpc("kaktuslife_snapshot", { p_room_id: input.roomId, p_request_id: input.requestId, p_intent: intent });
                if (input.op === "action" && !result.replayed) {
                    const room = result.room;
                    if (room.revision !== input.revision) throw failure("conflict");
                    let state;
                    if (input.action.type === "start") {
                        if (room.hostId !== user.id) throw failure("forbidden");
                        if (room.state) throw failure("alreadyStarted");
                        if (!room.guestId || !room.guestReady) throw failure("notReady");
                        state = createGame([{ id: room.hostId, name: room.hostName }, { id: room.guestId, name: room.guestName }], rng);
                    } else {
                        if (!room.state) throw failure("notReady");
                        try { state = applyAction(room.state, user.id, input.action, rng); }
                        catch { throw failure("invalidAction"); }
                    }
                    result = await rpc("kaktuslife_commit", { p_room_id: input.roomId, p_request_id: input.requestId, p_intent: intent, p_revision: input.revision, p_state: state });
                }
            }
            return json({ room: result.room, userId: user.id });
        } catch (error) {
            // Never expose Auth, PostgREST, SQL, engine, or network internals to a browser.
            const message = /^life\.errors\.[A-Za-z]+$/.test(error?.message || "") ? error.message : "life.errors.unavailable";
            return json({ error: message }, error?.status || 503);
        }
    };
}

export default createHandler();
export const config = { path: "/api/kaktuslife" };
