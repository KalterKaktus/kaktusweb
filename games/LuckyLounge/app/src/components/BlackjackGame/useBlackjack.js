import {useEffect,useRef,useState} from 'react';
import {useWallet,errorKey} from '../../context/WalletContext';
import {useText} from '../../i18n';
import {audio} from '../../audio';

export function visibleTotal(cards=[]){let total=0,aces=0;for(const card of cards){if(!card||card.hidden)continue;const rank=card.rank;if(rank==='A'){total+=11;aces++;}else total+=['J','Q','K'].includes(rank)?10:Number(rank);}while(total>21&&aces){total-=10;aces--;}return {total,soft:aces>0};}
const emptyState={player_cards:[],dealer_cards:[],player_total:0,dealer_total:0,outcome:null};
export default function useBlackjack(){
 const wallet=useWallet(),{t}=useText(),[round,setRound]=useState(null),[shown,setShown]=useState(emptyState),[pending,setPending]=useState(false),[animating,setAnimating]=useState(false),[error,setError]=useState(''),[resultShown,setResultShown]=useState(false);
 const mounted=useRef(true),lock=useRef(false),timers=useRef(new Set()),presentations=useRef(new Set()),holds=useRef(new Set()),roundRef=useRef(null),shownRef=useRef(emptyState);
 const server=wallet.snapshot?.latest_rounds?.find(item=>item.game==='blackjack');
 const show=value=>{shownRef.current=value;if(mounted.current)setShown(value);};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const timer of timers.current)clearTimeout(timer);timers.current.clear();for(const resolve of presentations.current)resolve();presentations.current.clear();for(const id of holds.current)wallet.releasePayout(id);holds.current.clear();};},[]);
 useEffect(()=>{
  if(!server||lock.current)return;
  const current=roundRef.current;
  if(!current||server.id!==current.id||server.version>current.version){roundRef.current=server;setRound(server);show(server.state);setResultShown(server.status!=='active');}
 },[server,pending]);
 const later=(callback,delay)=>{const timer=setTimeout(()=>{timers.current.delete(timer);if(mounted.current)callback();},delay);timers.current.add(timer);};
 function present(next,action){
  const final=next.state,previous=action==='start'?emptyState:shownRef.current;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){show(final);setResultShown(next.status!=='active');wallet.releasePayout(next.id);holds.current.delete(next.id);return Promise.resolve();}
  setAnimating(true);setResultShown(false);
  let player=[...(previous.player_cards||[])],dealer=[...(previous.dealer_cards||[])],delay=0;
  const publish=()=>{const playerValue=visibleTotal(player),dealerValue=visibleTotal(dealer);show({...final,player_cards:[...player],dealer_cards:[...dealer],player_total:playerValue.total,player_soft:playerValue.soft,dealer_total:dealerValue.total,dealer_soft:dealerValue.soft,outcome:null});};
  if(action==='start'){
   player=[];dealer=[];publish();
   [()=>player.push(final.player_cards[0]),()=>dealer.push(final.dealer_cards[0]),()=>player.push(final.player_cards[1]),()=>dealer.push({hidden:true})].forEach((deal,index)=>later(()=>{deal();publish();audio.cardDeal?.();},index*180));
   delay=790;
  }else if(final.player_cards.length>player.length){
   for(let index=player.length;index<final.player_cards.length;index++){const card=final.player_cards[index];later(()=>{player.push(card);publish();audio.cardDeal?.();},delay);delay+=240;}
   delay+=150;
  }
  if(next.status!=='active'){
   if((final.dealer_cards[1]&&dealer[1]?.hidden)||action==='start'){
    later(()=>{dealer[1]=final.dealer_cards[1];publish();audio.cardFlip?.();},delay);delay+=430;
   }
   const starting=action==='start'?2:Math.max(2,dealer.length);
   for(let index=starting;index<final.dealer_cards.length;index++){const card=final.dealer_cards[index];later(()=>{dealer.push(card);publish();audio.cardDeal?.();},delay);delay+=300;}
   delay+=240;
  }
  return new Promise(resolve=>{
   presentations.current.add(resolve);
   later(()=>{
    show(final);setResultShown(next.status!=='active');setAnimating(false);
    if(next.status!=='active'){wallet.releasePayout(next.id);holds.current.delete(next.id);if(final.outcome==='blackjack'||final.outcome==='win')audio.blackjackWin?.(final.outcome==='blackjack');else audio.land(final.outcome==='push'?1:0);}
    presentations.current.delete(resolve);resolve();
   },Math.max(delay,340));
  });
 }
 async function run(action,payload={}){
  if(lock.current||!wallet.available)return;
  lock.current=true;setPending(true);setError('');
  try{
   await audio.unlock();if(!mounted.current)return;const current=roundRef.current;
   const result=await wallet.blackjackAction(action,action==='start'?null:current?.id,action==='start'?payload:{version:current?.version,...payload},{deferPayout:true});
   const next=result.round;
   if(!mounted.current){wallet.releasePayout(next?.id);return;}
   if(next.status!=='active')holds.current.add(next.id);
   roundRef.current=next;setRound(next);await present(next,action);
  }catch(failure){
   for(const id of holds.current)wallet.releasePayout(id);holds.current.clear();
   if(mounted.current){setError(t(errorKey(failure)));setAnimating(false);await wallet.refresh().catch(()=>{});}
  }finally{lock.current=false;if(mounted.current)setPending(false);}
 }
 return {...wallet,round,shown,active:round?.status==='active',pending,animating,resultShown,error,run};
}
