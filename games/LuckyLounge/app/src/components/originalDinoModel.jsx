import {useEffect,useRef,useState} from 'react';
import useCasinoRound from './useCasinoRound';
import {useText} from '../i18n';
import {roundChips} from '../currency';
import Phaser from 'phaser';
import DinoGameInstance from './DinoGame/DinoGameInstance';
import CONFIG from './DinoGame/core/config/game';
import {useHistory} from './originalModels';
const CHANCES={easy:.85,medium:.65,hard:.45};

export function useOriginalDino(){
 const {t,number}=useText(),game=useCasinoRound('dino'),container=useRef(null),canvas=useRef(null),instance=useRef(null),scene=useRef(null),live=useRef(null),[ready,setReady]=useState(false),[waiting,setWaiting]=useState(false),[bet,setBetState]=useState(1),[difficulty,setDifficulty]=useState('medium'),[engineError,setEngineError]=useState('');
 const [resultVisible,setResultVisible]=useState(true);
 const {round,active,pending,available,run}=game;live.current={round,active,t};
 useEffect(()=>{
  let destroyed=false;
  const phaser=new DinoGameInstance({type:Phaser.AUTO,parent:canvas.current,backgroundColor:'#fff',render:{antialias:false},scale:{width:CONFIG.GAME.WIDTH.LANDSCAPE,height:CONFIG.GAME.HEIGHT,mode:Phaser.Scale.ScaleModes.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},fps:{target:60,forceSetTimeOut:true},audio:{noAudio:true}},{});
  instance.current=phaser;phaser.registry.set('luckyText',key=>live.current.t(key));
  const check=setInterval(()=>{
   if(destroyed)return;
   const current=phaser.scene.getScene('SCENE_GAME');
   if(!current?.player||!current?.horizon)return;
   clearInterval(check);scene.current=current;
   current.inputManager.update=()=>{};
   current.events.on(CONFIG.EVENTS.WAITING_FOR_JUMP,()=>{if(live.current.active)setWaiting(true);});
   current.events.on(CONFIG.EVENTS.GAME_OVER,()=>{setWaiting(false);if(!live.current.active)setResultVisible(true);});
   current.events.on('UI_RESTART_REQUEST',()=>{if(live.current.active)restart(current,live.current.round);});
   if(!destroyed)setReady(true);
  },100);
  const observer=new ResizeObserver(()=>{if(!destroyed)phaser.scale.refresh();});observer.observe(canvas.current);
  return()=>{destroyed=true;clearInterval(check);observer.disconnect();instance.current=null;scene.current=null;phaser.destroy(true);};
 },[]);
 function restart(current,r){if(!current?.player||!r)return;setWaiting(false);setResultVisible(false);current.events.emit(current.isInitialStart?CONFIG.EVENTS.GAME_START:CONFIG.EVENTS.GAME_RESTART);current.events.emit(CONFIG.EVENTS.BETTING_MODE_ON);current.obstaclesCleared=r.state.cleared;current.player.run();}
 useEffect(()=>{if(ready&&active)restart(scene.current,round);},[ready,active,round?.id]);
 useEffect(()=>{
  if(!ready||active||!scene.current?.isPlaying)return;
  const timer=setTimeout(()=>{if(scene.current?.isPlaying&&!live.current.active){scene.current.events.emit(CONFIG.EVENTS.GAME_OVER,scene.current.score,scene.current.highScore);scene.current.events.emit(CONFIG.EVENTS.BETTING_MODE_OFF);}setResultVisible(true);},1200);
  return()=>clearTimeout(timer);
 },[ready,active]);
 async function jump(){if(!waiting||pending||!scene.current)return;setWaiting(false);const result=await run('jump');if(!result){if(live.current.active)setWaiting(true);return;}scene.current?.events.emit(result.status==='lost'?CONFIG.EVENTS.JUMP_FAIL:CONFIG.EVENTS.JUMP_SUCCESS);}
 const cleared=round?.state.cleared||0,diff=active?round.params.difficulty:difficulty,p=CHANCES[diff];

 const setBet=value=>setBetState(old=>Math.max(1,Math.min(100000,roundChips(Number(typeof value==='function'?value(old):value)||1))));
 const history=useHistory(game),terminal=round&&['won','lost'].includes(round.status);
 const gamePhase=active?(waiting?'waiting':'running'):round?.status==='won'?'cashed_out':round?.status==='lost'?'crashed':'idle';
 return {...game,...history,error:game.error||engineError,betAmount:active?round.stake:bet,setBetAmount:setBet,difficulty:diff,setDifficulty,gamePhase,obstaclesCleared:cleared,currentMultiplier:Number(round?.state.multiplier||1),potentialWin:Number(round?.state.potential||0),lastResult:terminal&&resultVisible?{type:round.status==='won'?'win':'loss',obstaclesCleared:cleared,amount:Number(round.payout),multiplier:Number(round.state.multiplier||1)}:null,gameContainerRef:container,phaserContainerRef:canvas,gameRef:instance,gameSceneRef:scene,placeBet:()=>ready?run('start',{stake:bet,difficulty}):null,handleJump:jump,cashOut:()=>cleared&&!pending?run('cashout'):null,getMultiplierForCleared:k=>k===0?1:Math.floor(100*game.returnFactor/Math.pow(p,k))/100,isPlaying:active,canBet:!active,ready};

}
