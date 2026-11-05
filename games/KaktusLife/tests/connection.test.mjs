import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from '../js/connection.js';

function harness(responses, { blockedStorage = false } = {}) {
    const values = new Map(), calls = [];
    let ids = 0;
    let session = { access_token: 'test-session', user: { id:'a',user_metadata:{username:'A'} } };
    const options = {
        storage: blockedStorage ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } }
            : { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) },
        uuid: () => `request-${++ids}`,
        getSession: async () => session,
        fetchImpl: async (url, options) => {
            calls.push({url,body:JSON.parse(options.body),headers:options.headers});
            const next = responses.shift();
            if (next instanceof Error) throw next;
            return new Response(JSON.stringify(next?.body ?? {room:{id:'room-a',revision:1,state:null}}), {status:next?.status ?? 200});
        },
    };
    const client = createConnection(options);
    return { client,values,calls,reload:()=>createConnection(options),setSession:value=>{session=value;} };
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

test('ambiguous action retry after reload and newer revision preserves exact body and UUID', async () => {
    const {client,calls,reload} = harness([new Error('lost response'),{}]);
    const room={id:'r',revision:4};
    await assert.rejects(client.roomAction(room,{type:'choose',choice:'study'}),{key:'life.errors.network'});
    await reload().roomAction({...room,revision:9},{choice:'study',type:'choose'});
    assert.deepEqual(calls[1].body,calls[0].body);
    assert.equal(calls[1].body.revision,4);
});

test('restricted localStorage retains ambiguous UUIDs in memory', async () => {
    const {client,calls} = harness([new Error('lost response'),{}],{blockedStorage:true});
    await assert.rejects(client.createRoom(),{key:'life.errors.network'});
    await client.createRoom();
    assert.equal(calls[0].body.requestId,calls[1].body.requestId);
    assert.equal(client.getSavedRoomId(),'room-a');
    client.forgetRoom();assert.equal(client.getSavedRoomId(),undefined);
});

test('session expiration does not discard an earlier ambiguous accepted request', async () => {
    const {client,calls} = harness([new Error('lost response'),{status:401,body:{error:'life.errors.auth'}},{}]);
    await assert.rejects(client.createRoom(),{key:'life.errors.network'});
    await assert.rejects(client.createRoom(),{status:401});
    await client.createRoom();
    assert.equal(new Set(calls.map(call=>call.body.requestId)).size,1);
});

test('a different account cannot reuse the previous account receipt', async () => {
    const {client,calls,setSession,reload} = harness([new Error('lost response'),{},{}]);
    await assert.rejects(client.createRoom());
    setSession({access_token:'other-session',user:{id:'b'}});
    await client.createRoom();
    assert.notEqual(calls[0].body.requestId,calls[1].body.requestId);
    assert.equal(calls[1].headers.Authorization,'Bearer other-session');
    setSession({access_token:'test-session',user:{id:'a'}});
    await reload().createRoom();
    assert.equal(calls[2].body.requestId,calls[0].body.requestId);
});

test('completing one tab request cannot erase another tab pending receipt', async () => {
    const {client,calls,reload,values}=harness([new Error('lost create'),new Error('lost join'),{},{}]);
    const other=reload();
    await assert.rejects(client.createRoom());
    await assert.rejects(other.joinRoom('ABCDEFGH23'));
    const otherId=calls[1].body.requestId;
    await client.createRoom();
    assert.equal(JSON.parse(values.get('kk-life-pending-v1')).receipts[0].requestId,otherId);
    await other.joinRoom('ABCDEFGH23');
    assert.equal(calls[3].body.requestId,otherId);
    assert.equal(calls[2].body.requestId,calls[0].body.requestId);
});

test('a successful newer action retires obsolete pending actions from the same room', async () => {
    const {client,calls,values}=harness([new Error('lost roll'),{body:{room:{id:'r',revision:6}}},{body:{room:{id:'r',revision:10}}}]);
    await assert.rejects(client.roomAction({id:'r',revision:4},{type:'roll'}));
    await client.roomAction({id:'r',revision:5},{type:'choose',choice:'event_option'});
    assert.equal(values.has('kk-life-pending-v1'),false);
    await client.roomAction({id:'r',revision:9},{type:'roll'});
    assert.notEqual(calls[2].body.requestId,calls[0].body.requestId);
    assert.equal(calls[2].body.revision,9);
});

test('a stalled session lookup times out and releases the mutation lock', async () => {
    let lookups=0;
    const client=createConnection({storage:null,timeout:10,uuid:()=> 'request',getSession:()=>++lookups===1?new Promise(()=>{}):Promise.resolve({access_token:'token',user:{id:'a'}}),fetchImpl:async()=>Response.json({room:{id:'r',revision:1}})});
    const first=client.createRoom();
    await assert.rejects(client.createRoom(),{key:'life.errors.busy'});
    await assert.rejects(first,{key:'life.errors.network'});
    assert.equal((await client.createRoom()).id,'r');
});

test('identity lookup also recovers from a stalled session provider', async () => {
    const client=createConnection({storage:null,timeout:10,getSession:()=>new Promise(()=>{})});
    assert.equal(await client.getIdentity(),null);
});

test('visibility wake never overlaps polling and stopped stale polls cannot restore an old room', async () => {
    const previousDocument=globalThis.document;
    const document=new EventTarget();document.hidden=false;globalThis.document=document;
    let startPoll,finishPoll,pollSignal,stop;
    const started=new Promise(resolve=>{startPoll=resolve;});
    const pending=new Promise(resolve=>{finishPoll=resolve;});
    const values=new Map();let polls=0,callbacks=0;
    const client=createConnection({storage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},getSession:async()=>({access_token:'token',user:{id:'a'}}),uuid:()=> 'request',fetchImpl:async(url,options)=>{
        const body=JSON.parse(options.body);
        if(body.op==='snapshot'){polls++;pollSignal=options.signal;startPoll();return pending;}
        return Response.json({room:{id:'new-room',revision:1}});
    }});
    try{
        stop=client.subscribeRoom('old-room',()=>{callbacks++;});
        await started;
        document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('visibilitychange'));
        await new Promise(resolve=>setTimeout(resolve,65));
        assert.equal(polls,1);
        await client.createRoom();assert.equal(client.getSavedRoomId(),'new-room');
        stop();assert.equal(pollSignal.aborted,true);
        // A fetch adapter can complete after cancellation; the connection must still ignore it.
        finishPoll(Response.json({room:{id:'old-room',revision:99}}));
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(callbacks,0);assert.equal(client.getSavedRoomId(),'new-room');
    }finally{
        stop?.();finishPoll(Response.json({room:{id:'old-room',revision:99}}));globalThis.document=previousDocument;
    }
});
