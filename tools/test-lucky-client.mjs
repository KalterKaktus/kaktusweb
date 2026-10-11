import assert from 'node:assert/strict';
import {CasinoWallet} from '../games/LuckyLounge/js/wallet.js';
import {colorAt,motionPath,revealMotionPath,spinPosition,crossingTimes} from '../games/LuckyLounge/app/src/components/RouletteGame/rouletteMotion.js';

const storage=new Map();
globalThis.localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const snapshot=(chips,revision,extra={})=>({wallet:{chips,revision},server_now:new Date().toISOString(),...extra});
const wallet=new CasinoWallet();wallet.user={id:'test-user'};wallet.prefix='test:';
wallet.accept(snapshot(100,1));
wallet.client={rpc:(name,args)=>({abortSignal:async()=>{
 assert.equal(name,'casino_blackjack_action');
 // Another tab/refresh can observe the server's credit before our response.
 wallet.accept(snapshot(149,2));assert.equal(wallet.displayBalance,100);
 return {data:snapshot(149,2,{round:{id:'blackjack-round',status:'won',payout:50}}),error:null};
}})};
await wallet.blackjackAction('stand','blackjack-round',{version:1},{deferPayout:true});
assert.equal(wallet.displayBalance,99);assert.equal(storage.size,1); // sync key only; outbox removed
wallet.accept(snapshot(150,3));assert.equal(wallet.displayBalance,100);
wallet.releasePayout('blackjack-round');assert.equal(wallet.displayBalance,150);
wallet.releasePayout('blackjack-round');assert.equal(wallet.displayBalance,150);
wallet.accept(snapshot(100,1));assert.equal(wallet.displayBalance,150);
wallet.accept(snapshot(150,3,{roulette:{round:{id:'shared-round'}}}));
wallet.accept(snapshot(150,3));assert.equal(wallet.snapshot.roulette.round.id,'shared-round');

const counts={red:0,black:0,green:0};for(let i=0;i<200;i++)counts[colorAt(i)]++;
assert.deepEqual(counts,{red:99,black:99,green:2});
for(let target=0;target<200;target++){
 const path=motionPath({id:'next',landing_index:target},[{id:'previous',landing_index:37}]);
 assert.equal(Math.round(spinPosition(path.start,path.distance,8,8))%200,target);
 assert.equal(spinPosition(path.start,path.distance,1.9,8),spinPosition(path.start,400,1.9,8));
 let previous=path.start;for(let i=0;i<=80;i++){const position=spinPosition(path.start,path.distance,i/10,8);assert.ok(position>=previous);previous=position;}
 for(const time of crossingTimes(path.start,path.distance,8,3,3.05)){
  const position=spinPosition(path.start,path.distance,time,8);
  assert.ok(Math.abs(position-(Math.floor(position)+.5))<1e-6);
 }
}
const previousPath=motionPath({id:'next'},[{id:'previous',landing_index:37}]);
for(const target of [0,37,99,100,199])for(const delay of [2.1,5,7.8,7.99]){
 const next=motionPath({id:'next',landing_index:target},[{id:'previous',landing_index:37}]);
 const path=revealMotionPath(previousPath,next,delay,8),at=time=>spinPosition(path.start,path.distance,time,8,path.correction);
 assert.equal(at(delay),spinPosition(previousPath.start,previousPath.distance,delay,8),'late reveal must preserve position');
 assert.equal(at(delay-.03),spinPosition(previousPath.start,previousPath.distance,delay-.03,8),'already scheduled ticks must retain their original trajectory');
 const epsilon=1e-7,incoming=(at(delay)-at(delay-epsilon))/epsilon,outgoing=(at(delay+epsilon)-at(delay))/epsilon;
 // A last-moment reveal can require steep acceleration. Bound the finite-
 // difference error instead of mistaking that acceleration for a velocity jump.
 const derivativeTolerance=.01+6*(next.end-at(delay))*epsilon/(8-delay)**2;
 assert.ok(Math.abs(incoming-outgoing)<derivativeTolerance,'late reveal must preserve velocity');
 let last=at(delay);for(let step=1;step<=40;step++){const value=at(delay+(8-delay)*step/40);assert.ok(value>=last-1e-9);last=value;}
 assert.equal(Math.round(at(8))%200,target);
 for(const crossing of crossingTimes(path.start,path.distance,8,delay,Math.min(8,delay+.045),path.correction)){
  const value=at(crossing);assert.ok(Math.abs(value-(Math.floor(value)+.5))<1e-6,'late steering clicks must follow the corrected motion');
 }
 assert.equal(revealMotionPath(previousPath,next,1.9,8),next,'normal early reveal keeps original motion');
 assert.equal(revealMotionPath(previousPath,next,8.1,8),next,'settled reconnect needs no animation correction');
}
console.log('Client checks passed: delayed Blackjack payouts, cross-tab refresh, release/replay, Roulette cache, all 200 landing positions, continuous late reveals and movement-synchronized ticks.');
