import {useEffect,useRef,useState} from 'react';
import useCasinoRound from './useCasinoRound';
import {useHistory} from './originalModels';
import {useText} from '../i18n';
import {errorKey} from '../context/WalletContext';
import {audio} from '../audio';

export default function useSharedCrash(){
 const game=useCasinoRound('crash'),historyData=useHistory(game),{t,number}=useText();
 const [clock,tick]=useState(0),[pending,setPending]=useState(false),[error,setError]=useState('');
 const live=useRef(game),mounted=useRef(true),locked=useRef(false),seen=useRef(null);
 live.current=game;
 useEffect(()=>{
  let stopped=false,inFlight=false;
  const sync=async()=>{
   if(stopped||inFlight||document.hidden||!live.current.available)return;
   inFlight=true;
   try{await live.current.crashState();if(!stopped)setError('');}
   catch(e){if(!stopped)setError(t(/PGRST202|42883|schema cache/.test((e.message||'')+(e.code||''))?'shared_crash_migration':errorKey(e)));}
   finally{inFlight=false;}
  };
  mounted.current=true;sync();
  const timer=setInterval(sync,1000),animation=setInterval(()=>{if(!document.hidden)tick(v=>v+1);},50);
  document.addEventListener('visibilitychange',sync);
  return()=>{stopped=true;mounted.current=false;clearInterval(timer);clearInterval(animation);document.removeEventListener('visibilitychange',sync);};
 },[t]);
 const shared=game.snapshot?.crash,globalFlight=shared?.flight;
 const legacy=shared?.own_round?.status==='active'&&!shared.own_round.params.shared_id;
 const own=shared?.own_round||null;
 const feedback=own||game.round;
 const flight=legacy?{id:own.id,starts_at:own.state.starts_at}:globalFlight;
 const waiting=flight&&game.now()<Date.parse(flight.starts_at);
 const phase=flight?(waiting?'waiting':globalFlight?.phase==='crashed'&&!legacy?'crashed':'running'):'idle';
 const elapsed=phase==='crashed'?Math.log(Number(globalFlight.point))/.1:flight?Math.max(0,(game.now()-Date.parse(flight.starts_at))/1000):0;
 const multiplier=phase==='running'?Math.min(1000,Math.floor(Math.exp(.1*elapsed)*100)/100):phase==='crashed'?Number(globalFlight.point):1;
 const active=own?.status==='active';
 const latest=shared?.history?.at(-1);
 // Compatibility until the result-phase migration is applied. Updated servers
 // retain the actual crashed flight for five seconds instead of advancing it.
 const flash=latest&&(game.now()-Date.parse(latest.ended_at))<1100&&phase==='waiting'&&!legacy;
 useEffect(()=>{
  if(seen.current?.ownId===feedback?.id&&seen.current?.ownStatus==='active'&&feedback?.status==='won')audio.land(Number(feedback.payout)/Number(feedback.stake));
  if(seen.current&&latest?.id&&seen.current.flightId!==latest.id)audio.land(0);
  seen.current={ownId:feedback?.id,ownStatus:feedback?.status,flightId:latest?.id};
 },[feedback?.id,feedback?.status,latest?.id]);
 async function act(action,stake,auto){
  if(locked.current||!flight)return;
  locked.current=true;setPending(true);setError('');
  try{
   await audio.unlock();
   if(legacy){await game.run(action);return;}
   await game.crashAction(action,flight.id,action==='start'?{stake,auto}:{});
   if(action==='start')audio.drop();
  }catch(e){if(mounted.current)setError(t(errorKey(e)));await game.crashState().catch(()=>{});}
  finally{locked.current=false;if(mounted.current)setPending(false);}
 }
 const currency={symbol:'✦',color:'var(--primary)',name:t('chips')};
 const players=(shared?.players||[]).map(p=>({id:p.id,name:p.user_id===game.user?.id?t('you'):p.name,amount:Number(p.stake),currency,cashoutAt:p.status==='won'?number(Number(p.cashout),{minimumFractionDigits:2,maximumFractionDigits:2}):null,profit:p.status==='won'?number(Number(p.payout),{minimumFractionDigits:2,maximumFractionDigits:2}):null,payout:Number(p.payout),status:p.status}));
 const cashouts=(shared?.cashouts||[]).map(p=>({id:p.id,name:p.user_id===game.user?.id?t('you'):p.name,amount:number(Number(p.payout),{minimumFractionDigits:2,maximumFractionDigits:2}),currency,at:p.at}));
 let streak=0,maxStreak=0;for(const r of historyData.records){streak=r.profit>=0?streak+1:0;maxStreak=Math.max(maxStreak,streak);}
 return {...game,...historyData,round:own,phase,multiplier,payoutFactor:Number(own?.status==='active'?((Number(own.params.rtp)>=1)?own.params.rtp:1):(globalFlight?.payout_factor??1)),countdown:flight?Math.max(0,(Date.parse(flight.starts_at)-game.now())/1000):0,elapsedTime:elapsed,
  chartPhase:flash?'crashed':phase,chartMultiplier:flash?Number(latest.point):multiplier,chartElapsed:flash?Math.log(Number(latest.point))/.1:elapsed,
  history:(shared?.history||[]).map(h=>Number(h.point)),betPlaced:active,pending:pending||game.pending,available:game.available&&shared?.version===1,
  error:error||game.error,notice:legacy?t('crash_legacy'):null,onlineCount:shared?.online_count??0,players,playerCount:shared?.player_count??0,totalBet:Number(shared?.total_staked||0),
  playerCashouts:cashouts,userBetData:null,maxStreak,
  handleBet:(stake,auto)=>active&&phase==='waiting'?act('cancel'):!active&&phase==='waiting'?act('start',stake,auto):null,
  handleCashout:()=>active&&phase==='running'?act('cashout'):null,handlePlayerCashout:()=>{}};
}
