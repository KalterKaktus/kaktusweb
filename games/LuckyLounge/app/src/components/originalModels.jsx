import {useEffect,useRef,useState} from 'react';
import useCasinoRound from './useCasinoRound';
import {useText} from '../i18n';
function useBet(initial=1){return useState(initial);}
// The source dashboards show only persisted, actual results in the server's
// recent-result window. Their reset controls clear this view, never the wallet.
export function useHistory(game){
 const [hidden,hide]=useState([]);
 const rows=(game.snapshot?.recent||[]).filter(r=>(r.game||r.kind||'plinko')===game.gameName&&!hidden.includes(r.request_id)).slice().reverse();
 const reset=()=>hide((game.snapshot?.recent||[]).map(r=>r.request_id));
 const records=rows.map(r=>({id:r.request_id,bet:Number(r.stake),profit:Number(r.payout)-Number(r.stake),multiplier:r.payout/r.stake,cashedOutAt:r.payout?r.payout/r.stake:null,created_at:r.created_at,cleared:r.path?.cleared||0}));
 const profits=records.map(r=>r.profit);
 return {records,winRecords:profits,setWinRecords:reset,gameRecords:records,setGameRecords:reset,totalProfit:profits.reduce((a,b)=>a+b,0),winsCount:profits.filter(x=>x>=0).length,lossesCount:profits.filter(x=>x<0).length,setTotalProfit:reset,setWinsCount:reset,setLossesCount:reset,gamesPlayed:records.length,totalWagered:records.reduce((a,r)=>a+r.bet,0),highScore:Math.max(0,...records.map(r=>r.cleared))};
}
export function useOriginalMines(){
 const game=useCasinoRound('mines'),[bet,setBet]=useBet(),[count,setCount]=useState(3),{round,active,run}=game;
 const revealed=round?.state.revealed||[],mines=round?.mines||[],history=useHistory(game);
 const tile=i=>{if(active&&!game.pending&&!revealed.includes(i))return run('reveal',{tile:i});};
 return {...game,...history,isPlaying:active,betAmount:active?round.stake:bet,setBetAmount:setBet,minesCount:active?round.params.mines:count,setMinesCount:v=>setCount(Math.max(1,Math.min(24,Number(v)||1))),revealedTiles:revealed,mineLocations:mines,gameOverState:round?.status==='lost'?'lost':round?.status==='won'?'won':null,currentMultiplier:Number(round?.state.multiplier||1),potentialWin:Number(round?.state.potential||0),startGame:()=>run('start',{stake:bet,mines:count}),cashout:()=>round?.state.cleared?run('cashout'):null,handleTileClick:tile,pickRandom:()=>{const choices=Array.from({length:25},(_,i)=>i).filter(i=>!revealed.includes(i));if(choices.length){const values=new Uint32Array(1);crypto.getRandomValues(values);return tile(choices[values[0]%choices.length]);}}};
}
