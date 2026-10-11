import {useEffect,useRef} from 'react';
import {useText} from '../../i18n';
import {audio} from '../../audio';
import {colorAt,spinPosition,motionPath,revealMotionPath,crossingTimes} from './rouletteMotion';

export default function RouletteStrip({round,history,now}) {
 const canvas=useRef(null),live=useRef({round,history,now}),path=useRef(null),sound=useRef({id:null,scheduled:0,lastTick:0,started:false,stopped:false});
 const {t}=useText();live.current={round,history,now};
 useEffect(()=>{
  const el=canvas.current,ctx=el.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),palette={};
  let frame,box={width:0,height:0};
  const resize=()=>{const r=el.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);box={width:r.width,height:r.height};el.width=Math.round(r.width*dpr);el.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const css=getComputedStyle(el);for(const color of ['red','green','black'])palette[color]={top:css.getPropertyValue(`--roulette-${color}-top`).trim(),bottom:css.getPropertyValue(`--roulette-${color}-bottom`).trim()};palette.text=css.getPropertyValue('--text-primary').trim();palette.highlight=css.getPropertyValue('--ll-source-color-2').trim();};
  const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const draw=()=>{
   const {round:r,history:h,now:clock}=live.current,{width:w,height:height}=box;
   if(!w){frame=requestAnimationFrame(draw);return;}
   let position=Number(h?.at(-1)?.landing_index||0);
   if(r){
    const start=Date.parse(r.betting_ends_at),duration=Math.max(1,(Date.parse(r.spin_ends_at)-start)/1000),time=clock(),elapsed=Math.max(0,(time-start)/1000);
    if(path.current?.id!==r.id){path.current={id:r.id,...motionPath(r,h),target:r.landing_index};sound.current={id:r.id,scheduled:0,lastTick:0,started:false,stopped:false};}
    // The secret landing index only becomes public when betting closes.
    if(r.landing_index!==undefined&&r.landing_index!==null&&path.current.target!==r.landing_index){
     const next={id:r.id,...motionPath(r,h),target:r.landing_index};
     // Preserve the old curve through already scheduled clicks, then steer
     // continuously. A reconnect after the deadline shows the settled result.
     const join=Math.max(elapsed,sound.current.lastTick);
     path.current=revealMotionPath(path.current,next,join,duration);
     sound.current.scheduled=join;
    }
    const p=path.current,spinning=time>=start&&elapsed<duration;
    position=time<start?p.start:reduced.matches?p.end:spinPosition(p.start,p.distance,elapsed,duration,p.correction);
    if(spinning&&!document.hidden&&audio.enabled&&audio.context?.state==='running'&&!reduced.matches){
     const s=sound.current;if(!s.started){audio.rouletteStart();s.started=true;s.scheduled=elapsed;}
     const to=Math.min(duration,elapsed+.045),from=Math.max(elapsed,s.scheduled);
     for(const crossing of crossingTimes(p.start,p.distance,duration,from,to,p.correction)){audio.rouletteTick(crossing-elapsed,Math.sin(Math.PI*elapsed/duration));s.lastTick=crossing;}
     s.scheduled=to;
    }
    if(r.phase==='result'&&!sound.current.stopped){if(sound.current.started)audio.rouletteStop(r.outcome==='green');sound.current.stopped=true;}
   }
   ctx.clearRect(0,0,w,height);
   const cell=w<500?54:66,gap=6,tileWidth=cell-gap,tileHeight=Math.min(88,height-24),top=(height-tileHeight)/2;
   const first=Math.floor(position-w/(cell*2))-1,last=Math.ceil(position+w/(cell*2))+1;
   for(let i=first;i<=last;i++){
    const x=w/2+(i-position)*cell-tileWidth/2,c=colorAt(i),colors=palette[c];
    const gradient=ctx.createLinearGradient(0,top,0,top+tileHeight);gradient.addColorStop(0,colors.top);gradient.addColorStop(1,colors.bottom);
    ctx.fillStyle=colors.bottom;ctx.beginPath();ctx.roundRect(x,top+5,tileWidth,tileHeight,6);ctx.fill();
    ctx.fillStyle=gradient;ctx.beginPath();ctx.roundRect(x,top,tileWidth,tileHeight,6);ctx.fill();
    ctx.strokeStyle=palette.highlight;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=palette.text;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${c==='green'?17:14}px Inter, sans-serif`;ctx.fillText(c==='green'?'100×':'2.02×',x+tileWidth/2,top+tileHeight*.34);
    ctx.font='700 18px Inter, sans-serif';ctx.fillText(c==='green'?'✦':String(((i%200)+200)%200),x+tileWidth/2,top+tileHeight*.74);
   }
   frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[]);
 return <div className={`roulette-strip ${round?.phase==='result'?'is-result':''} ${round?.phase==='result'&&round.outcome==='green'?'green-jackpot':''}`}><canvas ref={canvas} aria-label={round?.phase==='result'?t('roulette.landed',{color:t('roulette.'+round.outcome)}):t('roulette.strip_label')}/><div className="roulette-marker" aria-hidden="true"/><div className="roulette-strip-shade" aria-hidden="true"/></div>;
}
