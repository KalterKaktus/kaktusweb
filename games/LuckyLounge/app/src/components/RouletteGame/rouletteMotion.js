export const STRIP_SIZE=200;
export const colorAt=index=>{
 const i=((index%STRIP_SIZE)+STRIP_SIZE)%STRIP_SIZE;
 if(i===0||i===100)return 'green';
 return (i<100?i%2===1:i%2===0)?'red':'black';
};
export const spinProgress=t=>(1-Math.cos(Math.PI*Math.max(0,Math.min(1,t))))/2;
export const progressTime=p=>Math.acos(1-2*Math.max(0,Math.min(1,p)))/Math.PI;
// First two seconds are identical for every outcome. A delayed Realtime/RPC
// response therefore cannot teleport the belt when the secret becomes public.
export function spinPosition(start,distance,time,duration,correction) {
 if(correction){
  if(time<=correction.time)return spinPosition(start,correction.previousDistance,time,duration);
  const remaining=duration-correction.time,u=Math.max(0,Math.min(1,(time-correction.time)/remaining));
  const delta=start+distance-correction.position,slope=correction.velocity*remaining;
  // Monotone cubic Hermite segment: the same position/velocity at reveal,
  // exactly the authoritative endpoint at the deadline, zero ending velocity.
  return correction.position+delta*(3*u*u-2*u*u*u)+slope*(u*u*u-2*u*u+u);
 }
 const p=Math.max(0,Math.min(1,time/duration));
 return start+STRIP_SIZE*2*spinProgress(p)+(distance-STRIP_SIZE*2)*spinProgress((p-.25)/.75);
}
function spinVelocity(distance,time,duration){
 const p=Math.max(0,Math.min(1,time/duration)),q=Math.max(0,Math.min(1,(p-.25)/.75));
 return STRIP_SIZE*2*Math.PI/(2*duration)*Math.sin(Math.PI*p)+(distance-STRIP_SIZE*2)*Math.PI/(1.5*duration)*Math.sin(Math.PI*q);
}
export function revealMotionPath(previous,next,time,duration){
 if(time<=duration*.25||time>=duration)return next;
 const position=spinPosition(previous.start,previous.distance,time,duration),remaining=duration-time;
 const delta=next.start+next.distance-position;
 if(delta<=0)return next;
 const velocity=Math.min(spinVelocity(previous.distance,time,duration),3*delta/remaining);
 return {...next,correction:{time,position,velocity,previousDistance:previous.distance}};
}
function positionTime(start,distance,position,duration,correction) {
 let lo=0,hi=duration;
 for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(spinPosition(start,distance,mid,duration,correction)<position)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
export function motionPath(round,history=[]) {
 const previous=history.filter(h=>h.id!==round.id).at(-1);
 const start=Number(previous?.landing_index||0),end=Number(round.landing_index??start);
 const distance=STRIP_SIZE*2+(end-start+STRIP_SIZE)%STRIP_SIZE;
 return {start,distance,end:start+distance};
}
// Marker boundaries are halfway between slot centers. The inverse easing
// schedules the audible contact at the very same crossing the renderer uses.
export function crossingTimes(start,distance,duration,from,to,correction) {
 const a=spinPosition(start,distance,from,duration,correction),b=spinPosition(start,distance,to,duration,correction),times=[];
 for(let boundary=Math.floor(a+.5)+.5;boundary<=b;boundary+=1){
  const time=positionTime(start,distance,boundary,duration,correction);
  if(time>from&&time<=to)times.push(time);
 }
 return times;
}
