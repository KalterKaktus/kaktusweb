const {PGlite} = await import(process.env.KAKTUSLIFE_PGLITE_MODULE || '@electric-sql/pglite');
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key);
 create table profiles(id uuid primary key references auth.users(id),username text,is_banned boolean default false);`);
 const migration=await readFile(new URL('../../../supabase/migrations/20261105120000_kaktuslife.sql',import.meta.url),'utf8');
 await db.exec(migration);
 await db.exec(migration);
 const ids=['10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003'];
 for(let i=0;i<ids.length;i++){await db.query('insert into auth.users values($1)',[ids[i]]);await db.query('insert into profiles(id,username) values($1,$2)',[ids[i],['Mila','Noah','Outsider'][i]]);}
 const rpc=async(name,args)=>(await db.query(`select public.${name}(${Object.keys(args).map((k,i)=>`${k} := $${i+1}`).join(',')}) as r`,Object.values(args))).rows[0].r;
 const request=randomUUID(),intent={op:'create'};
 let result=await rpc('kaktuslife_lobby',{p_actor:ids[0],p_operation:'create',p_request_id:request,p_intent:intent,p_code:'ABCDEFGH23'});
 const room=result.room;
 assert.equal(room.hostName,'Mila');assert.equal(room.guestId,null);
 result=await rpc('kaktuslife_lobby',{p_actor:ids[0],p_operation:'create',p_request_id:request,p_intent:intent,p_code:'ZZZZZZZZ23'});
 assert.equal(result.replayed,true);assert.equal(result.room.id,room.id);
 await assert.rejects(rpc('kaktuslife_snapshot',{p_actor:ids[2],p_room_id:room.id}),/forbidden/);
 result=await rpc('kaktuslife_lobby',{p_actor:ids[1],p_operation:'join',p_request_id:randomUUID(),p_intent:{op:'join',code:room.code},p_code:room.code});
 assert.equal(result.room.guestName,'Noah');assert.equal(result.room.revision,1);
 await assert.rejects(rpc('kaktuslife_lobby',{p_actor:ids[2],p_operation:'join',p_request_id:randomUUID(),p_intent:{op:'join',code:room.code},p_code:room.code}),/full/);
 await assert.rejects(rpc('kaktuslife_lobby',{p_actor:ids[1],p_operation:'ready',p_request_id:randomUUID(),p_intent:{op:'action',roomId:room.id,action:{type:'ready',ready:true}},p_room_id:room.id,p_revision:0,p_ready:true}),/conflict/);
 result=await rpc('kaktuslife_lobby',{p_actor:ids[1],p_operation:'ready',p_request_id:randomUUID(),p_intent:{op:'action',roomId:room.id,action:{type:'ready',ready:true}},p_room_id:room.id,p_revision:1,p_ready:true});
 assert.equal(result.room.guestReady,true);
 let current=result.room;
 const startRequest=randomUUID(),startIntent={op:'action',roomId:room.id,action:{type:'start'}};
 // SQL defense-in-depth is tested with small server-state fixtures; engine rules have their own suite.
 let state={version:1,status:'playing',players:[{id:ids[0],name:'Mila'},{id:ids[1],name:'Noah'}],turn:0,stage:'roll',round:1,pending:null,lastRoll:null,log:[]};
 const commit=(actor,requestId,revision,action,nextState)=>rpc('kaktuslife_commit',{p_actor:actor,p_room_id:room.id,p_request_id:requestId,p_intent:{op:'action',roomId:room.id,action},p_revision:revision,p_state:nextState});
 await assert.rejects(commit(ids[1],randomUUID(),current.revision,{type:'start'},state),/forbidden/);
 result=await commit(ids[0],startRequest,current.revision,{type:'start'},state);
 current=result.room;assert.equal(current.revision,3);assert.equal(current.state.status,'playing');
 result=await commit(ids[0],randomUUID(),current.revision,{type:'roll'},{...state,stage:'end'});
 current=result.room;assert.equal(current.revision,4);
 // Response loss plus a subsequent turn: the old request must replay before checking stale revision.
 result=await rpc('kaktuslife_commit',{p_actor:ids[0],p_room_id:room.id,p_request_id:startRequest,p_intent:startIntent,p_revision:2,p_state:state});
 assert.equal(result.replayed,true);assert.equal(result.room.revision,4);assert.equal(result.room.state.stage,'end');
 await assert.rejects(commit(ids[0],startRequest,2,{type:'end'},state),/requestConflict/);
 await assert.rejects(commit(ids[1],randomUUID(),current.revision,{type:'roll'},state),/forbidden/);
 await assert.rejects(commit(ids[0],randomUUID(),current.revision,{type:'roll'},{...state,players:[{id:ids[0]},{id:ids[2]}]}),/invalidAction/);
 // Two writers that read the same version: only one can advance it.
 const writes=await Promise.allSettled([1,2].map(()=>commit(ids[0],randomUUID(),current.revision,{type:'end'},state)));
 assert.equal(writes.filter(value=>value.status==='fulfilled').length,1);
 assert.match(writes.find(value=>value.status==='rejected').reason.message,/conflict/);
 current=writes.find(value=>value.status==='fulfilled').value.room;
 const rematch=()=>rpc('kaktuslife_lobby',{p_actor:ids[1],p_operation:'rematch',p_request_id:randomUUID(),p_intent:{op:'rematch',roomId:room.id},p_room_id:room.id,p_revision:current.revision});
 await assert.rejects(rematch(),/notFinished/);
 result=await commit(ids[0],randomUUID(),current.revision,{type:'roll'},{...state,status:'finished'});current=result.room;
 result=await rematch();current=result.room;
 assert.equal(current.state,null);assert.equal(current.guestReady,false);assert.equal(current.guestId,ids[1]);
 await assert.rejects(commit(ids[0],randomUUID(),current.revision,{type:'start'},state),/notReady/);

 // Three unfinished rooms per host; even finished rooms still count toward ten creations per hour.
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const createFor=(index)=>rpc('kaktuslife_lobby',{p_actor:ids[2],p_operation:'create',p_request_id:randomUUID(),p_intent:{op:'create'},p_code:'ZZZZZZZZZ'+alphabet[index]});
 await createFor(0);await createFor(1);await createFor(2);
 await assert.rejects(createFor(3),/rateLimit/);
 await db.query('update public.kaktuslife_rooms set state=$1::jsonb where host_id=$2',[{status:'finished'},ids[2]]);
 for(let index=3;index<10;index++){
  const created=await createFor(index);
  await db.query('update public.kaktuslife_rooms set state=$1::jsonb where id=$2',[{status:'finished'},created.room.id]);
 }
 await assert.rejects(createFor(10),/rateLimit/);

 // Accepted requests, not retries or rejected actions, consume the per-minute write allowance.
 const initialCount=Number((await db.query("select count(*) n from public.kaktuslife_requests where actor_id=$1 and created_at>clock_timestamp()-interval '1 minute'",[ids[1]])).rows[0].n);
 for(let index=initialCount;index<60;index++){
  const ready=index%2===0;
  result=await rpc('kaktuslife_lobby',{p_actor:ids[1],p_operation:'ready',p_request_id:randomUUID(),p_intent:{op:'action',roomId:room.id,action:{type:'ready',ready}},p_room_id:room.id,p_revision:current.revision,p_ready:ready});
  current=result.room;
 }
 await assert.rejects(rpc('kaktuslife_lobby',{p_actor:ids[1],p_operation:'ready',p_request_id:randomUUID(),p_intent:{op:'action',roomId:room.id,action:{type:'ready',ready:true}},p_room_id:room.id,p_revision:current.revision,p_ready:true}),/rateLimit/);
 result=await rpc('kaktuslife_commit',{p_actor:ids[0],p_room_id:room.id,p_request_id:startRequest,p_intent:startIntent,p_revision:2,p_state:state});assert.equal(result.replayed,true);
 await db.query('update public.profiles set is_banned=true where id=$1',[ids[1]]);
 await assert.rejects(rpc('kaktuslife_snapshot',{p_actor:ids[1],p_room_id:room.id}),/banned/);
 await assert.rejects(rpc('kaktuslife_snapshot',{p_actor:randomUUID(),p_room_id:room.id}),/auth/);

 const beforeRows=(await db.query('select id,revision,state from public.kaktuslife_rooms order by id')).rows;
 const beforeReceipts=(await db.query('select actor_id,request_id,intent from public.kaktuslife_requests order by actor_id,request_id')).rows;
 await db.exec(migration); // Applying twice must preserve actual saved rooms and receipts, not only schema.
 assert.deepEqual((await db.query('select id,revision,state from public.kaktuslife_rooms order by id')).rows,beforeRows);
 assert.deepEqual((await db.query('select actor_id,request_id,intent from public.kaktuslife_requests order by actor_id,request_id')).rows,beforeReceipts);
 for(const role of ['anon','authenticated']){
  const permissions=(await db.query(`select has_table_privilege($1,'public.kaktuslife_rooms','select') as rooms,has_table_privilege($1,'public.kaktuslife_requests','select') as receipts,has_function_privilege($1,'public.kaktuslife_snapshot(uuid,uuid,uuid,jsonb)','execute') as snapshot,has_function_privilege($1,'public.kaktuslife_commit(uuid,uuid,uuid,jsonb,bigint,jsonb)','execute') as commit,has_function_privilege($1,'public.kaktuslife_lobby(uuid,text,uuid,jsonb,uuid,text,bigint,boolean)','execute') as lobby`,[role])).rows[0];
  assert.deepEqual(permissions,{rooms:false,receipts:false,snapshot:false,commit:false,lobby:false});
 }
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from public.kaktuslife_rooms'),/permission denied/);
 await assert.rejects(db.query('select public.kaktuslife_snapshot($1,$2)',[ids[0],room.id]),/permission denied/);
 await db.exec('reset role');
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select * from public.kaktuslife_rooms'),/permission denied/);
 await assert.rejects(db.query('select public.kaktuslife_snapshot($1,$2)',[ids[0],room.id]),/permission denied/);
 await db.exec('reset role;set role service_role');
 await assert.rejects(db.query('select * from public.kaktuslife_rooms'),/permission denied/);
 result=await rpc('kaktuslife_snapshot',{p_actor:ids[0],p_room_id:room.id});assert.equal(result.room.id,room.id);
 console.log('SQL migration PASS: data-preserving reapply, create/replay, two seats, readiness/host start, CAS writer race, stale-version replay, UUID intent conflict, turn/seat checks, rematch consent, create/write limits, bans, outsider isolation, anon/authenticated table+RPC deny, service-role RPC-only.');
}finally{await db.close();}
