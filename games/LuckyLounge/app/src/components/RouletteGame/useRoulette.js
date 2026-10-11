import {useEffect,useRef,useState} from 'react';
import {useWallet,errorKey} from '../../context/WalletContext';
import {useText} from '../../i18n';
import {audio} from '../../audio';
export default function useRoulette() {
 const wallet=useWallet(),{t}=useText(),live=useRef(wallet),locked=useRef(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[,tick]=useState(0);
 live.current=wallet;
 useEffect(()=>{
  let stopped=false,inFlight=false,debounce;
  const sync=async()=>{if(stopped||inFlight||document.hidden||!live.current.available)return;inFlight=true;try{await live.current.rouletteState();if(!stopped)setError('');}catch(e){if(!stopped)setError(t(errorKey(e)));}finally{inFlight=false;}};
  const changed=()=>{clearTimeout(debounce);debounce=setTimeout(sync,100);};
  sync();const timer=setInterval(sync,1000),clock=setInterval(()=>{if(!document.hidden)tick(n=>n+1);},200);
  const unsubscribe=wallet.available?wallet.subscribeRoulette(changed):()=>{};
  document.addEventListener('visibilitychange',sync);window.addEventListener('online',sync);
  return()=>{stopped=true;clearTimeout(debounce);clearInterval(timer);clearInterval(clock);unsubscribe();document.removeEventListener('visibilitychange',sync);window.removeEventListener('online',sync);};
 },[wallet.available,t]);
 const state=wallet.snapshot?.roulette,round=state?.round;
 const open=wallet.available&&state?.version===1&&round?.phase==='waiting'&&wallet.now()<Date.parse(round.betting_ends_at);
 const bet=async(color,stake)=>{
  if(locked.current||!open)return;
  locked.current=true;setPending(true);setError('');
  try{await audio.unlock();await wallet.rouletteAction(round.id,color,stake);audio.ui();}
  catch(e){setError(t(errorKey(e)));await wallet.rouletteState().catch(()=>{});}
  finally{locked.current=false;setPending(false);}
 };
 return {...wallet,state,round,open,pending,error,bet};
}
