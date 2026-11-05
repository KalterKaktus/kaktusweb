import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createHandler, secureRandom } from "../../../netlify/functions/kaktuslife.mjs";

const HOST = "11111111-1111-4111-8111-111111111111";
const GUEST = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const clone = (value) => structuredClone(value);
const fail = (code) => { throw new Error(`life.errors.${code}`); };

// Independent in-memory REST boundary. No network, real accounts, keys, or hosted mutations.
function fixture() {
    const rooms = new Map();
    const receipts = new Map();
    const profiles = new Map([[HOST, { name: "Alice", banned: false }], [GUEST, { name: "Bob", banned: false }], [OUTSIDER, { name: "Charlie", banned: false }]]);
    const calls = [];
    let queue = Promise.resolve();
    let failNext = null;
    const roomFor = (actor, id) => {
        const room = rooms.get(id);
        if (!room) fail("notFound");
        if (![room.hostId, room.guestId].includes(actor)) fail("forbidden");
        return room;
    };
    const prior = (args) => {
        const receipt = receipts.get(`${args.p_actor}/${args.p_request_id}`);
        if (!receipt) return null;
        if (JSON.stringify(receipt.intent) !== JSON.stringify(args.p_intent)) fail("requestConflict");
        if (args.p_room_id && args.p_room_id !== receipt.roomId) fail("requestConflict");
        return roomFor(args.p_actor, receipt.roomId);
    };
    const snapshot = (room, replayed = false) => ({ room: clone(room), replayed });
    const rpc = (name, args) => {
        const profile = profiles.get(args.p_actor);
        if (!profile) fail("auth");
        if (profile.banned) fail("banned");
        const replay = args.p_request_id && prior(args);
        if (replay) return snapshot(replay, true);
        if (name === "kaktuslife_snapshot") return snapshot(roomFor(args.p_actor, args.p_room_id));
        let room;
        if (name === "kaktuslife_lobby") {
            if (args.p_operation === "create") {
                if ([...rooms.values()].filter((r) => r.hostId === args.p_actor && r.state?.status !== "finished").length >= 3) fail("rateLimit");
                room = { id: randomUUID(), code: args.p_code, hostId: args.p_actor, guestId: null, hostName: profile.name, guestName: null, guestReady: false, revision: 0, state: null };
                rooms.set(room.id, room);
            } else if (args.p_operation === "join") {
                room = [...rooms.values()].find((r) => r.code === args.p_code);
                if (!room) fail("notFound");
                if (![room.hostId, room.guestId].includes(args.p_actor)) {
                    if (room.guestId) fail("full");
                    if (room.state) fail("alreadyStarted");
                    room.guestId = args.p_actor; room.guestName = profile.name; room.revision++;
                }
            } else {
                room = roomFor(args.p_actor, args.p_room_id);
                if (room.revision !== args.p_revision) fail("conflict");
                if (args.p_operation === "ready") {
                    if (args.p_actor !== room.guestId) fail("forbidden");
                    if (room.state) fail("alreadyStarted");
                    room.guestReady = args.p_ready; room.revision++;
                } else if (args.p_operation === "rematch") {
                    if (room.state?.status !== "finished") fail("notFinished");
                    room.state = null; room.guestReady = false; room.revision++;
                } else fail("invalidRequest");
            }
        } else if (name === "kaktuslife_commit") {
            room = roomFor(args.p_actor, args.p_room_id);
            if (room.revision !== args.p_revision) fail("conflict");
            if (args.p_intent.action.type === "start") {
                if (room.hostId !== args.p_actor) fail("forbidden");
                if (room.state) fail("alreadyStarted");
                if (!room.guestId || !room.guestReady) fail("notReady");
            } else if (room.state?.players[room.state.turn]?.id !== args.p_actor) fail("forbidden");
            room.state = clone(args.p_state); room.revision++;
        } else throw new Error("unknown RPC");
        receipts.set(`${args.p_actor}/${args.p_request_id}`, { intent: clone(args.p_intent), roomId: room.id });
        return snapshot(room);
    };
    const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        if (failNext) { const value = failNext; failNext = null; return value; }
        if (url.endsWith("/auth/v1/user")) {
            const actor = init.headers.Authorization.slice(7);
            return new Response(JSON.stringify(profiles.has(actor) ? { id: actor } : { message: "invalid JWT" }), { status: profiles.has(actor) ? 200 : 401 });
        }
        assert.equal(init.headers.Authorization, "Bearer test-service-key");
        assert.equal(init.headers.apikey, "test-service-key");
        const args = JSON.parse(init.body);
        const task = queue.then(() => {
            try { return new Response(JSON.stringify(rpc(url.split("/").at(-1), args))); }
            catch (error) { return new Response(JSON.stringify({ message: error.message, details: "private database diagnostic" }), { status: 400 }); }
        });
        queue = task.then(() => {}, () => {});
        return task;
    };
    const handler = createHandler({ fetchImpl, getEnv: (name) => ({ SUPABASE_URL: "https://offline.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service-key" })[name], rng: () => 0.2 });
    const send = async (actor, input) => {
        const response = await handler(new Request("https://site.invalid/api/kaktuslife", { method: "POST", headers: actor ? { Authorization: `Bearer ${actor}` } : {}, body: typeof input === "string" ? input : JSON.stringify(input) }));
        return { status: response.status, body: await response.json(), headers: response.headers };
    };
    const create = async () => {
        const response = await send(HOST, { op: "create", requestId: randomUUID() });
        assert.equal(response.status, 200);
        return response.body.room;
    };
    const action = (actor, room, value, requestId = randomUUID(), revision = room.revision) => send(actor, { op: "action", roomId: room.id, requestId, revision, action: value });
    const start = async () => {
        let room = await create();
        room = (await send(GUEST, { op: "join", code: room.code, requestId: randomUUID() })).body.room;
        room = (await action(GUEST, room, { type: "ready" })).body.room;
        room = (await action(HOST, room, { type: "start" })).body.room;
        assert.equal(room.state.status, "playing");
        return room;
    };
    return { send, create, action, start, rooms, receipts, profiles, calls, handler, setFailure: (value) => { failNext = value; } };
}

test("Supabase session is mandatory and user identity cannot be supplied by payload", async () => {
    const f = fixture();
    assert.equal((await f.send(null, { op: "create", requestId: randomUUID() })).status, 401);
    assert.equal((await f.send("expired-token", { op: "create", requestId: randomUUID() })).status, 401);
    assert.equal((await f.send(HOST, { op: "create", requestId: randomUUID(), userId: GUEST })).status, 400);
    const room = await f.create();
    assert.equal(room.hostId, HOST); assert.equal(room.hostName, "Alice");
    assert.equal(f.calls.filter((call) => call.url.includes("/auth/v1/user")).at(-1).init.headers.Authorization, `Bearer ${HOST}`);
});

test("private two-seat lobby rejects outsiders and competing third guests", async () => {
    const f = fixture();
    const room = await f.create();
    assert.match(room.code, /^[A-HJ-NP-Z2-9]{10}$/);
    assert.equal((await f.send(OUTSIDER, { op: "snapshot", roomId: room.id })).status, 403);
    const race = await Promise.all([GUEST, OUTSIDER].map((actor) => f.send(actor, { op: "join", requestId: randomUUID(), code: room.code.toLowerCase() })));
    assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]);
    assert.equal(f.rooms.get(room.id).revision, 1);
    assert.equal(f.rooms.get(room.id).state, null);
});

test("only host can start, and guest must first explicitly ready", async () => {
    const f = fixture(); let room = await f.create();
    assert.equal((await f.action(HOST, room, { type: "start" })).body.error, "life.errors.notReady");
    room = (await f.send(GUEST, { op: "join", requestId: randomUUID(), code: room.code })).body.room;
    assert.equal((await f.action(GUEST, room, { type: "start" })).status, 403);
    assert.equal((await f.action(HOST, room, { type: "ready" })).status, 403);
    assert.equal((await f.action(HOST, room, { type: "start" })).body.error, "life.errors.notReady");
    room = (await f.action(GUEST, room, { type: "ready" })).body.room;
    room = (await f.action(HOST, room, { type: "start" })).body.room;
    assert.equal(room.state.players.length, 2);
    assert.deepEqual(room.state.players.map((player) => player.name), ["Alice", "Bob"]);
});

test("invalid/out-of-turn actions cannot mutate authoritative state", async () => {
    const f = fixture(); const room = await f.start(); const before = clone(f.rooms.get(room.id));
    assert.equal((await f.action(GUEST, room, { type: "roll" })).status, 400);
    assert.equal((await f.action(HOST, room, { type: "choose", choice: "client-forged-choice" })).status, 400);
    assert.equal((await f.action(HOST, room, { type: "roll", value: 10 })).status, 400);
    assert.equal((await f.action(HOST, room, { type: "setCash", cash: 999999999 })).status, 400);
    assert.deepEqual(f.rooms.get(room.id), before);
});

test("concurrent revisions commit once and return 409 for the stale action", async () => {
    const f = fixture(); const room = await f.start(); const choice = room.state.pending.options[0].id;
    const responses = await Promise.all([1, 2].map(() => f.action(HOST, room, { type: "choose", choice })));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(f.rooms.get(room.id).revision, room.revision + 1);
});

test("UUID receipt makes concurrent retries and stale-version retries exactly once", async () => {
    const f = fixture(); let room = await f.start(); const id = randomUUID(); const choice = room.state.pending.options[0].id;
    const responses = await Promise.all([1, 2].map(() => f.action(HOST, room, { type: "choose", choice }, id)));
    assert(responses.every((response) => response.status === 200));
    assert.equal(f.rooms.get(room.id).revision, room.revision + 1);
    const firstRevision = f.rooms.get(room.id).revision;
    room = clone(f.rooms.get(room.id));
    // Move beyond the receipt's original revision before retrying the old request.
    const next = room.state.stage === "choice" ? { type: "choose", choice: room.state.pending.options[0].id } : room.state.stage === "roll" ? { type: "roll" } : { type: "end" };
    const advanced = await f.action(HOST, room, next);
    assert.equal(advanced.status, 200);
    const retry = await f.action(HOST, room, { type: "choose", choice }, id, 0);
    assert.equal(retry.status, 200); assert.equal(retry.body.room.revision, firstRevision + 1);
    assert.equal((await f.action(HOST, room, { type: "end" }, id)).body.error, "life.errors.requestConflict");
});

test("create/join are idempotent and UUID reuse for another operation conflicts", async () => {
    const f = fixture(); const requestId = randomUUID();
    const first = await f.send(HOST, { op: "create", requestId });
    const repeated = await f.send(HOST, { op: "create", requestId });
    assert.equal(repeated.body.room.id, first.body.room.id); assert.equal(f.rooms.size, 1);
    const joinId = randomUUID(); const join = { op: "join", requestId: joinId, code: first.body.room.code };
    assert.equal((await f.send(GUEST, join)).body.room.revision, 1);
    assert.equal((await f.send(GUEST, join)).body.room.revision, 1);
    assert.equal((await f.send(GUEST, { op: "create", requestId: joinId })).body.error, "life.errors.requestConflict");
});

test("reconnection returns saved state and rematch requires finished game plus new consent", async () => {
    const f = fixture(); const room = await f.start();
    const restored = await f.send(GUEST, { op: "snapshot", roomId: room.id });
    assert.deepEqual(restored.body.room, room);
    assert.equal((await f.send(HOST, { op: "rematch", roomId: room.id, revision: room.revision, requestId: randomUUID() })).body.error, "life.errors.notFinished");
    f.rooms.get(room.id).state.status = "finished";
    const reset = await f.send(GUEST, { op: "rematch", roomId: room.id, revision: room.revision, requestId: randomUUID() });
    assert.equal(reset.status, 200); assert.equal(reset.body.room.state, null); assert.equal(reset.body.room.guestReady, false);
    assert.equal((await f.action(HOST, reset.body.room, { type: "start" })).body.error, "life.errors.notReady");
});

test("bans, room abuse limit, malformed JSON, invalid versions and oversized bodies fail closed", async () => {
    const f = fixture();
    f.profiles.get(GUEST).banned = true;
    assert.equal((await f.send(GUEST, { op: "create", requestId: randomUUID() })).body.error, "life.errors.banned");
    await f.create(); await f.create(); await f.create();
    assert.equal((await f.send(HOST, { op: "create", requestId: randomUUID() })).status, 429);
    assert.equal((await f.send(HOST, "{" )).status, 400);
    assert.equal((await f.send(HOST, { op: "create", requestId: "123" })).status, 400);
    assert.equal((await f.send(HOST, " ".repeat(4097))).status, 400);
    assert.equal((await f.send(HOST, { op: "action", roomId: randomUUID(), requestId: randomUUID(), revision: -1, action: { type: "roll" } })).status, 400);
});

test("responses never expose upstream secrets/errors and disable caching", async () => {
    const f = fixture();
    f.setFailure(new Response(JSON.stringify({ message: "test-service-key SQL secret" }), { status: 500 }));
    const response = await f.send(HOST, { op: "create", requestId: randomUUID() });
    assert.deepEqual(response.body, { error: "life.errors.unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.status, 503);
    const missing = createHandler({ getEnv: () => null });
    assert.equal((await missing(new Request("https://site.invalid/api/kaktuslife", { method: "POST", body: "{}" }))).status, 503);
});

test("server randomness uses crypto integer dice hook with exact inclusive/exclusive bounds", () => {
    for (let i = 0; i < 100; i++) {
        const value = secureRandom(); assert(value >= 0 && value < 1);
        const die = secureRandom.int(1, 11); assert(Number.isInteger(die) && die >= 1 && die <= 10);
    }
});
