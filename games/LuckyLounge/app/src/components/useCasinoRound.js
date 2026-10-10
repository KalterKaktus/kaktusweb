import {useEffect,useRef,useState} from 'react';
import {useWallet,errorKey} from '../context/WalletContext';
import {useText} from '../i18n';
import {audio} from '../audio';

// Stateful games submit decisions, never balances, mine maps or multipliers.
export default function useCasinoRound(gameName){
 const wallet=useWallet(),{t}=useText(),lock=useRef(false),[pending,setPending]=useState(false),[local,setLocal]=useState(null),[error,setError]=useState('');
 const server=wallet.snapshot?.latest_rounds?.find(r=>r.game===gameName);
 const round=server&&(!local||server.id!==local.id||server.version>=local.version)?server:local;
 const roundRef=useRef(round);roundRef.current=round;
 const mounted=useRef(true);useEffect(()=>()=>{mounted.current=false;},[]);
 const run=async(action,payload={})=>{
  if(lock.current||!wallet.available)return null;
  lock.current=true;setPending(true);setError('');
  try{
   await audio.unlock();
   const current=roundRef.current;
   const result=await wallet.game(gameName,action,action==='start'?null:current?.id,action==='start'?payload:{version:current?.version,...payload});
   if(mounted.current)setLocal(result.round);
   if(action==='start')audio.drop();
   else if(result.round.status==='won')audio.land(result.round.payout/result.round.stake);
   else if(result.round.status==='lost')audio.land(0);
   else audio.pin(result.round.state.cleared||0,.5,0);
   return result.round;
  }catch(e){if(mounted.current)setError(t(errorKey(e)));await wallet.refresh().catch(()=>{});return null;}
  finally{lock.current=false;if(mounted.current)setPending(false);}
 };
 const returnFactor=Number(round?.status==='active'?(round.params.rtp??.99):(wallet.snapshot?.rules?.target_rtp??.99));
 return {...wallet,gameName,round,returnFactor,active:round?.status==='active',run,pending,error};
}
