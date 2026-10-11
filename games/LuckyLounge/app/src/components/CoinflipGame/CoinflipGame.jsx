import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Button,InputNumber,Modal} from 'antd';
import {SoundOutlined,SettingOutlined,SafetyCertificateOutlined} from '@ant-design/icons';
import {useWallet,errorKey} from '../../context/WalletContext';
import {useText} from '../../i18n';
import {roundChips,validBet} from '../../currency';
import {audio} from '../../audio';
import BetValidation from '../BetValidation';
import SourceAudioSettings from '../SourceAudioSettings';
import Coin from './Coin';
import {coinflipRules} from './coinflipRules';
import './CoinflipGame.css';

export default function CoinflipGame(){
 const wallet=useWallet(),{t,chips,number}=useText();
 const [stake,setStake]=useState(1),[position,setPosition]=useState(-50),[phase,setPhase]=useState('ready'),[result,setResult]=useState(null),[error,setError]=useState(''),[settings,setSettings]=useState(false),[rulesOpen,setRulesOpen]=useState(false),[sound,setSound]=useState(audio.enabled),[heldHistory,setHeldHistory]=useState([]);
 const coin=useRef(null),shadow=useRef(null),mounted=useRef(true),locked=useRef(false),animations=useRef([]),frame=useRef(0),held=useRef(null),seen=useRef(null);
 const rules=coinflipRules(position),busy=phase==='requesting'||phase==='spinning';
 const recent=busy?heldHistory:(wallet.snapshot?.recent||[]).filter(r=>r.game==='coinflip');
 const stored=wallet.snapshot?.latest_rounds?.find(r=>r.game==='coinflip');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelAnimationFrame(frame.current);for(const a of animations.current)a.cancel();if(held.current)wallet.releasePayout(held.current);};},[]);
 useEffect(()=>{if(locked.current||!stored||seen.current===stored.id)return;seen.current=stored.id;setResult(stored);setPhase('result');},[stored]);
 const toggleSound=async()=>{const enabled=!audio.enabled;audio.set(enabled,audio.volume);setSound(enabled);if(enabled)await audio.unlock();};
 async function flip(){
  if(locked.current||!wallet.available||!validBet(stake)||stake>wallet.balance)return;
  locked.current=true;setHeldHistory(recent);setPhase('requesting');setError('');setResult(null);
  try{
   await audio.unlock();if(!mounted.current)return;
   const response=await wallet.coinflip(Number(stake),rules.position,{deferPayout:true}),next=response.round;
   held.current=next.id;seen.current=next.id;
   if(!mounted.current){wallet.releasePayout(next.id);held.current=null;return;}
   const outcome=next.state.outcome,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   setPhase('spinning');audio.coinThrow();
   if(!reduced&&coin.current){
    const turns=2160+(outcome==='tails'?180:0),duration=2200;
    const movement=coin.current.animate([
     {offset:0,transform:'translateY(0) rotateX(0deg) rotateZ(-12deg)'},
     {offset:.12,transform:`translateY(-68px) rotateX(${turns*.16}deg) rotateZ(-8deg)`},
     {offset:.34,transform:`translateY(-112px) rotateX(${turns*.4}deg) rotateZ(7deg)`},
     {offset:.62,transform:`translateY(-54px) rotateX(${turns*.73}deg) rotateZ(-4deg)`},
     {offset:.8,transform:`translateY(0) rotateX(${turns-100}deg) rotateZ(3deg)`},
     {offset:.89,transform:`translateY(-13px) rotateX(${turns-26}deg) rotateZ(-2deg)`},
     {offset:1,transform:`translateY(0) rotateX(${turns}deg) rotateZ(0deg)`}
    ],{duration,easing:'linear',fill:'forwards'});
    const shade=shadow.current.animate([{transform:'scale(1)',opacity:.5},{offset:.34,transform:'scale(.46)',opacity:.16},{offset:.8,transform:'scale(1.05)',opacity:.65},{transform:'scale(1)',opacity:.5}],{duration,fill:'forwards'});
    animations.current=[movement,shade];let last=0;
    const spinSound=()=>{const elapsed=Number(movement.currentTime||0);if(elapsed<duration*.79&&elapsed-last>70+elapsed*.065){audio.coinSpin(elapsed/duration);last=elapsed;}if(mounted.current&&movement.playState==='running')frame.current=requestAnimationFrame(spinSound);};
    frame.current=requestAnimationFrame(spinSound);
    await movement.finished;
   }
   if(!mounted.current)return;
   setResult(next);setPhase('result');wallet.releasePayout(next.id);held.current=null;
   audio.coinLand(next.status==='won',Number(next.payout)/Number(next.stake));
   for(const a of animations.current)a.cancel();animations.current=[];
  }catch(failure){
   if(held.current){wallet.releasePayout(held.current);held.current=null;}
   if(mounted.current){setError(t(errorKey(failure)));setPhase('ready');await wallet.refresh().catch(()=>{});}
  }finally{locked.current=false;}
 }
 const outcome=result?.state?.outcome,won=result?.status==='won',net=Number(result?.payout||0)-Number(result?.stake||0);
 return <section className="coinflip-game"><div className="coinflip-heading"><Link to="/">← {t('back')}</Link><h1>{t('coinflip.name')}</h1><div className="coinflip-tools"><Button type="text" icon={<SoundOutlined/>} aria-label={t('sound')} aria-pressed={sound} onClick={toggleSound}/><Button type="text" icon={<SettingOutlined/>} aria-label={t('audio_settings')} onClick={()=>setSettings(true)}/><Button type="text" icon={<SafetyCertificateOutlined/>} onClick={()=>setRulesOpen(true)}>{t('fairness')}</Button></div></div>
  {error&&<div className="lucky-status" role="status">{error}</div>}
  <div className="coinflip-layout"><aside className="coinflip-controls"><div className="coinflip-control-title">{t('coinflip.name')} · {t('bet_short')}</div><label className="coinflip-bet-label" htmlFor="coinflip-stake">{t('bet')}</label><div className="coinflip-stake"><span aria-hidden="true">✦</span><InputNumber id="coinflip-stake" value={stake} onChange={setStake} changeOnBlur={false} controls={false} precision={2} step={.01} decimalSeparator="," disabled={busy}/><button disabled={busy} onClick={()=>setStake(v=>Math.max(1,roundChips(Number(v||0)/2)))}>½</button><button disabled={busy} onClick={()=>setStake(v=>Math.min(100000,roundChips(Number(v||0)*2)))}>2×</button></div><BetValidation value={stake} balance={wallet.balance}/>
   <div className="coinflip-selection"><label htmlFor="coinflip-position">{t('coinflip.choose')}</label><div className="coinflip-side-labels"><button className={rules.side==='heads'?'selected':''} onClick={()=>setPosition(-rules.chance)} disabled={busy}>{t('coinflip.heads')}</button><button className={rules.side==='tails'?'selected':''} onClick={()=>setPosition(rules.chance)} disabled={busy}>{t('coinflip.tails')}</button></div><div className="coinflip-slider"><div className="coinflip-slider-center" aria-hidden="true"/><input id="coinflip-position" type="range" min="-95" max="95" step="1" value={position} disabled={busy} onChange={e=>setPosition(Number(e.target.value))} aria-valuetext={t('coinflip.selection',{side:t('coinflip.'+rules.side),chance:number(rules.chance),multiplier:number(rules.multiplier,{maximumFractionDigits:4})})}/></div><small>{t('coinflip.slider_hint')}</small></div>
   <div className="coinflip-odds"><div><span>{t('chance')}</span><strong>{number(rules.chance)}<small>%</small></strong></div><div><span>{t('multiplier')}</span><strong>{number(rules.multiplier,{minimumFractionDigits:2,maximumFractionDigits:4})}<small>×</small></strong></div></div><div className="coinflip-potential"><span>{t('payout')}</span><strong>{chips(Number(stake||0)*rules.multiplier)} ✦</strong></div>
   <Button type="primary" size="large" className="coinflip-play bet-button" loading={phase==='requesting'} disabled={!wallet.available||busy||!validBet(stake)||stake>wallet.balance} onClick={flip}>{t(busy?'coinflip.flipping':phase==='result'?'coinflip.again':'coinflip.flip')}</Button>
  </aside><div className={`coinflip-stage ${phase==='spinning'?'is-spinning':''} ${phase==='result'?(won?'is-win':'is-loss'):''}`}><div className="coinflip-stage-brand"><span>Lucky Lounge</span><small>{t('coinflip.name')}</small></div><div className="coinflip-orbit" aria-hidden="true"/><div className="coinflip-perspective"><div className="coinflip-coin" ref={coin} style={{transform:phase==='result'&&outcome==='tails'?'rotateX(180deg)':'rotateX(0deg)'}}><div className="coinflip-face coinflip-heads"><Coin side="heads"/></div>{[-4,-2,0,2,4].map(z=><div className="coinflip-edge" key={z} style={{transform:`translateZ(${z}px)`}}/>)}<div className="coinflip-face coinflip-tails"><Coin side="tails"/></div></div><div className="coinflip-shadow" ref={shadow}/></div><div className="coinflip-result" role="status" aria-live="polite">{phase==='result'?<><span className="coinflip-outcome">{t('coinflip.'+outcome)}</span><strong>{t(won?'coinflip.win':'coinflip.loss')}</strong><span className={won?'positive':'negative'}>{net>0?'+':''}{chips(net)} ✦</span></>:<><span className="coinflip-outcome">{t('coinflip.'+rules.side)}</span><strong>{t(phase==='requesting'?'processing':phase==='spinning'?'coinflip.flipping':'coinflip.ready')}</strong><span>{t('coinflip.selection_short',{chance:number(rules.chance),multiplier:number(rules.multiplier,{maximumFractionDigits:4})})}</span></>}</div><div className="coinflip-stage-history" aria-label={t('recent')}>{recent.slice(0,10).reverse().map(r=><span className={Number(r.payout)>0?'won':'lost'} key={r.request_id} title={`${t('coinflip.'+r.path.outcome)} · ${chips(Number(r.payout)-Number(r.stake))} ✦`}>{r.path.outcome==='heads'?<span aria-hidden="true">♧</span>:<span aria-hidden="true">✦</span>}</span>)}</div></div></div>
  <Modal title={t('fairness')} open={rulesOpen} onCancel={()=>setRulesOpen(false)} footer={null} rootClassName="mobile-game-modal"><p>{t('coinflip.rules')}</p><p>{t('coinflip.selection',{side:t('coinflip.'+rules.side),chance:number(rules.chance),multiplier:number(rules.multiplier,{maximumFractionDigits:6})})}</p><p>{t('fair_rounding')}</p><p>{t('server_settlement')}</p></Modal><SourceAudioSettings open={settings} onClose={()=>setSettings(false)} enabled={sound} setEnabled={setSound}/>
 </section>;
}
