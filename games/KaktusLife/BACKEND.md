# KaktusLife online setup

The production migration was applied to the existing Supabase project on 2026-11-05 as `20261105214557_kaktuslife` (source: `supabase/migrations/20261105120000_kaktuslife.sql`). Table/RPC privileges and a rolled-back production lobby smoke test passed. PR2 was merged as `428963fe25f7e1a612eecac4a0b06aff3e25422f`; Netlify production deploy `6aecf9d6988ea08038ae537b` is published and ready. Live URL: https://kalterkaktus.de/games/KaktusLife/ . Release verification is recorded in `brain/Fortschritt.md`. Local practice also works independently.

1. On a fresh database, review and apply `supabase/migrations/20261105120000_kaktuslife.sql` to the existing Supabase project. It is already applied in production; do not reapply it merely to repeat the completed release. Reapplying preserves rooms and request receipts when intentionally needed.
2. Netlify uses the existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Never add the service-role key to static JavaScript or browser configuration. No new secret is needed.
3. Deploy the reviewed branch when authorized. `netlify/functions/kaktuslife.mjs` exposes `POST /api/kaktuslife` through its Netlify `config.path`; no redirect rule or frontend build step is required.
4. Verify with two different logged-in site accounts: create, invite, join, guest ready, host start, play, reload both clients, complete the match, request rematch, guest ready, host start. Check an unrelated account cannot read or change the room.

## API and consent

Send `Authorization: Bearer <existing Supabase access_token>` and JSON. Auth is checked with Supabase `/auth/v1/user` on every call; payloads cannot supply a user ID, name, die, state or outcome. Names come from `profiles`, capped at 40 characters with control characters removed. Banned accounts are rejected in SQL.

| Operation | Required fields besides `op` |
| --- | --- |
| `create` | `requestId` UUID |
| `join` | `requestId` UUID, `code` (10-character invite, case insensitive) |
| `snapshot` | `roomId` UUID |
| `action` | `roomId`, `requestId`, `revision`, `action` |
| `rematch` | `roomId`, `requestId`, `revision` |
| `close` | `roomId`, `requestId`, `revision` |

Success is `{room:{id,code,hostId,guestId,hostName,guestName,guestReady,revision,state,closed},userId}`. `state` is `null` in the lobby. Exactly one guest can join. Guest action `{type:'ready',ready:true}` consents to play; `{type:'ready',ready:false}` withdraws readiness. Only the host can `{type:'start'}` after the guest is ready. Active-game actions are `{type:'roll'}`, `{type:'choose',choice:'…'}` and `{type:'end'}`. Either member can request `rematch` after the game finishes; it resets the same seats to a lobby with readiness cleared. A fresh guest ready and host start are required.

The host can `close` an abandoned lobby while `state` is `null`. Closing requires the current revision, increments it once, sets `closed_at`, and expires the room immediately. It retains the row and all receipts; it never deletes or changes an active or finished game. Success returns `room.closed:true`. Normal snapshots and joining that room then return 404. Only an exact matching successful close receipt can replay its closed-room response after expiry, so a lost close response is safe to retry. Closing releases its unfinished-room capacity, while the ten-creations-per-hour abuse limit still applies. Client `closeRoom(room)` clears the saved room only if it matches; `forgetRoom(roomId)` scopes cleanup to that room and the current account.

Persist a UUID before sending any mutation and reuse it when retrying that same intent. A receipt is checked before the revision, so a lost response can be retried even after later turns; the response contains the current room. Reusing a UUID for a different action returns `life.errors.requestConflict`. A different action against a stale revision returns HTTP 409. Fetch a snapshot before deciding the next action. Never change a request's action when retrying it. All mutations and receipts commit in one SQL transaction.

Errors are `{error:'life.errors.<code>'}`. Public codes: `auth` (401), `invalidRequest` / `invalidAction` (400), `forbidden` / `banned` (403), `notFound` (404), `full` / `conflict` / `requestConflict` / `notReady` / `alreadyStarted` / `notFinished` (409), `rateLimit` (429), `unavailable` (503). Upstream diagnostics and secrets are never returned. All responses use `Cache-Control: no-store`.

## Security and persistence

The two tables have RLS enabled with no browser policies. All table privileges and all helper/RPC function privileges are revoked from `anon` and `authenticated`. Only `service_role` can execute the three entry RPCs. Helpers use fixed empty `search_path` and explicit schema names. A server-authenticated actor ID is required for every snapshot and mutation; knowing a room UUID grants no access. Invite codes contain 50 bits from `node:crypto.randomInt` and are the only way to claim an empty guest seat.

The Netlify function runs the shared engine and supplies cryptographic randomness. Its `rng.int(1,11)` hook gives an unbiased ten-sided die. The database locks the actor profile and room, enforces membership, turn ownership and revision compare-and-swap, validates exact seat IDs in the next state, then stores state and the UUID receipt atomically. Client-submitted state never reaches the engine or SQL.

A host can maintain at most three unfinished rooms, create at most ten rooms per hour, and each account can join at most five unfinished rooms as guest. Writes are limited to 60 accepted new requests per minute per account; receipt retries do not consume the limit. Rooms expire 30 days after creation or the last active game action/rematch. Expired rows are retained for deliberate administrator cleanup; no background job or recurring function is introduced. Deleting either account deletes its rooms and dependent receipts.

## Offline verification

Run `node --test games/KaktusLife/tests/server.test.mjs` for mocked Auth/REST integration coverage, including auth, outsiders, two-seat races, host/guest consent, invalid actions, concurrent revisions, retry idempotency after later turns, reconnect, rematch, bans, limits and public errors. These tests never contact Supabase. Shared engine tests exercise game rules separately.

For actual local PostgreSQL verification, install the pinned dev dependencies with `pnpm install` in `games/KaktusLife`, then run `pnpm test:sql` there, or `node games/KaktusLife/tests/sql.integration.mjs` from the repository root. The PGlite harness creates stub `auth.users` / `profiles` tables and the three Supabase roles, applies the migration twice, exercises the RPCs, checks stale-revision receipt replay, and verifies browser table/RPC privileges are denied. `tests/fixtures/integration-server.mjs` connects the real handler to the real local SQL functions for browser integration; only Supabase Auth is stubbed. These harnesses never contact or mutate the hosted production database.
