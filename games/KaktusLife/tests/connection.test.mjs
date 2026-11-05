import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from '../js/connection.js';

function harness(responses) {
    const values = new Map(), calls = [];
    let ids = 0;
    const client = createConnection({
        storage: { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) },
        uuid: () => `request-${++ids}`,
        getSession: async () => ({ access_token: 'test-session', user: { id:'a',user_metadata:{username:'A'} } }),
        fetchImpl: async (url, options) => {
            calls.push({url,body:JSON.parse(options.body),headers:options.headers});
            const next = responses.shift();
            if (next instanceof Error) throw next;
            return new Response(JSON.stringify(next?.body ?? {room:{id:'room-a',revision:1,state:null}}), {status:next?.status ?? 200});
        },
    });
    return { client,values,calls };
}

test('network retry reuses the persisted request UUID and sends session bearer', async () => {
    const {client,calls,values} = harness([new Error('lost response'),{}]);
    await assert.rejects(client.createRoom(), {key:'life.errors.network'});
    assert.ok(values.has('kk-life-pending-v1'));
    const room = await client.createRoom();
    assert.equal(calls[0].body.requestId,calls[1].body.requestId);
    assert.equal(calls[1].headers.Authorization,'Bearer test-session');
    assert.equal(room.id,client.getSavedRoomId());
    assert.ok(!values.has('kk-life-pending-v1'));
});

test('definitive stale state drops request so refreshed action uses a new UUID', async () => {
    const {client,calls} = harness([{status:409,body:{error:'life.errors.conflict'}},{}]);
    const room = {id:'r',revision:4};
    await assert.rejects(client.roomAction(room,{type:'roll'}),{status:409,key:'life.errors.conflict'});
    await client.roomAction({...room,revision:5},{type:'roll'});
    assert.notEqual(calls[0].body.requestId,calls[1].body.requestId);
    assert.equal(calls[1].body.revision,5);
});

test('server codes pass through, raw internal errors are hidden', async () => {
    const {client} = harness([{status:409,body:{error:'life.errors.notReady'}},{status:500,body:{error:'secret database detail'}}]);
    await assert.rejects(client.createRoom(),{key:'life.errors.notReady'});
    await assert.rejects(client.createRoom(),{key:'life.errors.unavailable'});
});

test('join normalizes invite and identity does not expose email', async () => {
    const {client,calls} = harness([{}]);
    await client.joinRoom(' abCD1234 ');
    assert.equal(calls[0].body.code,'ABCD1234');
    assert.deepEqual(await client.getIdentity(),{id:'a',name:'A'});
    client.forgetRoom();
    assert.equal(client.getSavedRoomId(),undefined);
});

test('signed-out users cannot send mutations', async () => {
    let called = false;
    const client = createConnection({ getSession: async()=>null,uuid:()=> 'r',fetchImpl:async()=>{called=true;} });
    await assert.rejects(client.createRoom(),{status:401});
    assert.equal(called,false);
});
