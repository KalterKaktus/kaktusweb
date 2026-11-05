import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startIntegrationServer,PEOPLE} from './fixtures/integration-server.mjs';

const fixture=await startIntegrationServer({port:0});
let calls=0;
async function api(person,payload){
 const body=payload.op==='snapshot'?payload:{requestId:randomUUID(),...payload};
 const response=await fixture.handler(new Request('http://localhost/api/kaktuslife',{
  method:'POST',headers:{Authorization:`Bearer ${person.token}`,'Content-Type':'application/json'},body:JSON.stringify(body),
 }));
 const result=await response.json();calls++;
 return {status:response.status,...result};
}
const choose=(state)=>{
 const ids=state.pending.options.map(option=>option.id);
 const preferences=state.turn===0?['study','career_engineer','safe','partner','house_townhouse','children1','promotion','invest60','memories']:
  ['career','career_maker','adventure','solo','house_cottage','children2','sabbatical','repay','community'];
 return preferences.find(id=>ids.includes(id))||ids[0];
};
try {
 let result=await api(PEOPLE[0],{op:'create'});assert.equal(result.status,200);
 let room=result.room;
 result=await api(PEOPLE[1],{op:'join',code:room.code});assert.equal(result.status,200);room=result.room;
 result=await api(PEOPLE[2],{op:'snapshot',roomId:room.id});assert.equal(result.status,403);
 result=await api(PEOPLE[1],{op:'action',roomId:room.id,revision:room.revision,action:{type:'ready',ready:true}});assert.equal(result.status,200);room=result.room;
 result=await api(PEOPLE[0],{op:'action',roomId:room.id,revision:room.revision,action:{type:'start'}});assert.equal(result.status,200);room=result.room;
 let actions=0;const decisions=new Set();
 while(room.state.status!=='finished'){
  assert.ok(actions<600,'game must terminate');
  const state=room.state;
  const person=PEOPLE.find(person=>person.id===state.players[state.turn].id);
  const action=state.stage==='choice'?{type:'choose',choice:choose(state)}:{type:state.stage==='roll'?'roll':'end'};
  if(state.pending)decisions.add(state.pending.type);
  const revision=room.revision;
  result=await api(person,{op:'action',roomId:room.id,revision,action});
  assert.equal(result.status,200,JSON.stringify(result));
  room=result.room;assert.equal(room.revision,revision+1);actions++;
  for(const player of room.state.players){assert.ok(player.cash>=0);assert.ok(player.debt>=0);}
  if(actions%13===0){
   const other=PEOPLE.find(who=>who.id!==person.id);
   const snapshot=await api(other,{op:'snapshot',roomId:room.id});
   assert.deepEqual(snapshot.room,room,'reconnected opponent sees exact authoritative state');
  }
 }
 assert.equal(room.state.results.length,2);
 assert.ok(room.state.players.every(player=>player.retired&&player.position===80));
 for(const score of room.state.results){assert.equal(score.total,score.cash+score.house+score.investments+score.family+score.happiness-score.debt);}
 const finishedRevision=room.revision;
 result=await api(PEOPLE[1],{op:'rematch',roomId:room.id,revision:finishedRevision});assert.equal(result.status,200);room=result.room;
 assert.equal(room.state,null);assert.equal(room.guestReady,false);
 result=await api(PEOPLE[0],{op:'action',roomId:room.id,revision:room.revision,action:{type:'start'}});assert.equal(result.status,409);
 console.log(JSON.stringify({pass:true,actions,calls,decisionTypes:[...decisions],finalRevision:finishedRevision,realSQL:true,realHandler:true,auth:'isolated fixture',rematchConsent:true},null,2));
}finally{await fixture.close();}
