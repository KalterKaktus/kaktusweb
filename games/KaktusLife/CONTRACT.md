# KaktusLife implementation contract

Isolated native ES-module game, static `/games/KaktusLife/`, no build dependency.
Pure shared rules engine runs in Netlify only for online play; a clearly labeled local two-person practice mode uses the exact same engine. No AI players.

## Engine (`shared/engine.mjs`, `shared/catalog.mjs`)

Exports: `createGame(players, rng)`, `applyAction(state, actorId, action, rng)`, `scorePlayer(player)`; rng is `() => number` in [0,1). Throws on illegal actions; returns a fresh JSON-serializable state, never mutates input. Players have `{id,name}` initially. `createGame` starts a two-player match.

State: `{version:1,status:'playing'|'finished',players:[...],turn:0|1,round:number,stage:'roll'|'choice'|'end',pending:null|{type,title,description,options:[{id,title,description,...}]},lastRoll:null|{value,playerId,from,to,id},log:[{id,playerId,type,key,amount?,...}],results?:[...]}`. All title/description/key fields are translation keys rooted at `life`. `lastRoll` value is 1–10, id is a monotonically increasing action serial. Position 0–80 inclusive. Mandatory milestones stop movement even on overshoot. Players: `{id,name,position,cash,debt,career:null|string,salary,education,partner:boolean,children:number,house:null|string,insurance:boolean,investments:number,happiness:number,retired:boolean,...}`.

Actions: `{type:'roll'}`, `{type:'choose',choice:string}`, `{type:'end'}`. Decisions are resolved before ending the turn. Setup begins with career/study decision for player 0, then normal turns. Finished players are skipped. Result entries `{playerId,total,cash,house,investments,family,debt,...}`. `scorePlayer` returns same breakdown. `catalog.mjs` exports `BOARD` (81 `{index,type}` entries), `CAREERS`, `HOUSES`, `EVENTS`, `MILESTONES`, and any useful constants. Translation data exported as `TRANSLATIONS={de:{...},ru:{...}}` nested inside `life` by integration. Shared catalog can be imported safely by browser. No server secrets in these files.

## Backend (`netlify/functions/kaktuslife.mjs`)

POST `/api/kaktuslife` JSON `{op:'create'|'join'|'snapshot'|'action'|'rematch'|'close',roomId?,code?,requestId?,revision?,action?}` with Authorization Bearer existing Supabase session. Response `{room:{id,code,hostId,guestId,hostName,guestName,guestReady,revision,closed,state:null|gameState},userId}`. Lobby state null until host action `{type:'start'}`. `join` exactly one guest; host starts only with two members and guest ready; names come from profiles. `rematch` returns same two-seat lobby only after finish, both approve new match through lobby start/ready. `close` requires host, lobby state null, UUID and revision. It expires the lobby, preserves rows/receipts and returns closed:true; exact receipt replays after closure, other snapshots/invites return404. Active/finished matches cannot be closed. Atomic compare-and-swap and UUID request receipts. Status409 => client must refresh. No direct authenticated browser DB writes/read; Netlify service role only. Session/user validated at Supabase `/auth/v1/user`. Server RNG from node:crypto. Poll snapshots every2.5s while active, backed off hidden. Authoritative snapshots mandatory. Current deployment/migration status is recorded in brain/Fortschritt.md.

## Client

`js/connection.js`: `getIdentity()`, `createRoom()`, `joinRoom(code)`, `loadRoom(id)`, `roomAction(room,action)`, `rematchRoom(room)`, `closeRoom(room)`, `forgetRoom(roomId?)`, `subscribeRoom(id,onRoom,onError)` returning cleanup; identity `{id,name}` or null. Scoped forgetting preserves other rooms/accounts' pending receipts. App owns local practice using engine; local state storage only for practice. Online remembers room id and durable exact action body/request UUID per account across reloads, revision refresh and tab switching; no optimistic authoritative state.

App/UI agent owns `index.html`, `styles.css`, `tokens.css`, `assets/`, `js/app.js`, `js/board.js`, `js/audio.js`, `js/text.js`. UI `text.js` calls existing `/js/i18n.js` `t/getLanguage/ready/onLanguageChange`; additional UI translation export in `js/translations.mjs` as `{de,ru}` under life. Root merges translations into both site dictionaries after engine/UI ready. All visible text uses `t('life...')`; no hardcoded UI strings. CSS color literals only in `tokens.css`, typography/radii use tokens. Existing auth-nav and i18n directly loaded. Client may catch unavailable backend and explain setup, never imply online tested.

## Ownership

Engine agent: shared/ and tests/engine.test.mjs + tests/balance.mjs.
Backend agent: Netlify function, SQL migration, tests/server.test.mjs, backend setup notes.
UI agent: HTML/CSS/assets and UI modules (excluding connection.js).
Root: integration, connection, site dictionaries, hub entry, Obsidian, QA.
