import {roundChips,validBet} from '../../currency';
import {useState,useRef,useCallback,useEffect} from 'react';
import {Button,Space,Tooltip,Modal,Slider,Switch} from 'antd';
import {SettingOutlined,ExpandOutlined,BarChartOutlined,SafetyCertificateOutlined,SoundOutlined,FullscreenExitOutlined,ThunderboltOutlined,RightOutlined} from '@ant-design/icons';
import {Link} from 'react-router-dom';
import Plinko from './Plinko';
import Sidebar from './Sidebar';
import MobileBetSheet from '../MobileBetSheet';
import {useWallet,errorKey} from '../../context/WalletContext';
import {useText} from '../../i18n';
import {audio} from '../../audio';
import {getBinColors,MAX_ACTIVE_BALLS,PLINKO_MODES,BIN_PAYOUTS,binProbabilities} from './constants';
import {StatsHistory} from '../CasinoExtras';
import {SKINS,skinUnlocked,winningsTotal} from './skins';
import './PlinkoGame.css';
export default function PlinkoGame(){
 const {balance,available,play,snapshot}=useWallet(),{t,number}=useText();
 const [betAmount,setBetAmount]=useState(10),[records,setRecords]=useState([]),[ballType,setBallType]=useState('normal'),[settings,setSettings]=useState(false),[stats,setStats]=useState(false),[fairness,setFairness]=useState(false),[fullscreen,setFullscreen]=useState(false),[sound,setSound]=useState(audio.enabled),[volume,setVolume]=useState(audio.volume),[error,setError]=useState(''),[active,setActive]=useState(0);
 const [difficulty,setDifficulty]=useState('normal'),[queued,setQueued]=useState(0);
 const profile=PLINKO_MODES[difficulty],multipliers=BIN_PAYOUTS[profile.rows][profile.risk],probabilities=binProbabilities(profile.rows);
 const engineRef=useRef(null),pending=useRef(0),reserved=useRef(0),dispatch=useRef(Promise.resolve()),mounted=useRef(true),rounds=useRef(new Map()),display=useRef(null);
 const earned=winningsTotal(snapshot?.wallet);
 const ballTypes=Object.fromEntries(Object.entries(SKINS).map(([id,{file,goal}])=>[id,{id,name:t('ball_'+id),unlocked:skinUnlocked(id,snapshot?.wallet),description:t(goal===0?'skin_standard':earned>=goal?'skin_unlocked':'skin_locked',{amount:number(goal)}),color:'var(--primary)',image:`/games/LuckyLounge/images/coins/${file}.svg`}]));
 useEffect(()=>{if(!skinUnlocked(ballType,snapshot?.wallet))setBallType('normal');},[ballType,earned]);
 useEffect(()=>()=>{mounted.current=false;},[]);
 useEffect(()=>{const listener=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',listener);return()=>document.removeEventListener('fullscreenchange',listener);},[]);
 const land=useCallback(data=>{
  const round=rounds.current.get(data.ballType);
  if(!round)return;
  rounds.current.delete(data.ballType);
  if(data.binIndex!==round.slot){setError(t('engine_error'));requestAnimationFrame(()=>setActive(engineRef.current?.getActiveBallCount()||0));return;}
  const multiplier=round.path.multiplier;
  const record={...data,id:round.request_id,betAmount:round.stake,payout:{multiplier,value:round.payout},profit:round.payout-round.stake};
  setRecords(prev=>[...prev,record].slice(-30));audio.land(multiplier);
  requestAnimationFrame(()=>setActive(engineRef.current?.getActiveBallCount()||0));
 },[t]);
 const drop=(isCancelled=()=>false)=>{
  const engine=engineRef.current;
  if(!engine||pending.current+engine.getActiveBallCount()>=MAX_ACTIVE_BALLS||document.hidden)return Promise.resolve('busy');
  if(!available)return Promise.resolve('insufficient-funds');
  if(!validBet(betAmount)||betAmount<1||betAmount>100000){setError(t('invalid_bet'));return Promise.resolve('insufficient-funds');}
  if(betAmount>balance-reserved.current){setError(t('insufficient'));return Promise.resolve('insufficient-funds');}
  if(isCancelled())return 'cancelled';
  // Capture every click's stake, skin and mode; queue while the prior RPC is
  // pending. Queued stakes reserve UI funds only, never write a local wallet.
  pending.current++;reserved.current+=betAmount;setQueued(pending.current);setError('');
  const skin=ballTypes[ballType]?.unlocked?ballTypes[ballType]:ballTypes.normal;
  const task=dispatch.current.catch(()=>{}).then(async()=>{
   try{
   if(!mounted.current||isCancelled())return 'cancelled';
   await audio.unlock();
   const data=await play(betAmount,difficulty); // ONE authoritative transaction before animation.
   if(!mounted.current||!engineRef.current)return 'dropped';
   const round=data.round;
   if(round.path?.difficulty!==difficulty||round.path?.rows!==profile.rows||round.path?.risk!==profile.risk
      ||round.path?.multiplier!==multipliers[round.slot])throw new Error('casino_engine');
   rounds.current.set(round.request_id,round);
   engine.updateRowCount(profile.rows);engine.updateRiskLevel(profile.risk);
   engine.updateBetAmount(round.stake);engine.updateBallStyle('var(--primary)',skin.image);
   const ball=engine.dropBall(round.slot,round.request_id);
   if(!ball)throw new Error('casino_engine');
   const original=ball.onCollidePin;let lastContact=0;
   ball.onCollidePin=id=>{original?.(id);const now=performance.now();if(now-lastContact>35){lastContact=now;audio.pin(Number(id.split('_')[1]),Math.hypot(ball.vx,ball.vy)/10000,ball.x/10000*600/760);}};
   audio.drop();setActive(engine.getActiveBallCount());return 'dropped';
   }catch(e){if(mounted.current)setError(t(/casino_engine/.test(e.message)?'engine_error':errorKey(e)));return 'insufficient-funds';}
   finally{pending.current--;reserved.current-=betAmount;if(mounted.current)setQueued(pending.current);}
  });
  dispatch.current=task;
  return task;
 };
 const changeDifficulty=mode=>{if(!pending.current&&!engineRef.current?.getActiveBallCount()){setDifficulty(mode);setError('');}};
 const toggleSound=async()=>{audio.set(!audio.enabled,volume);setSound(audio.enabled);await audio.unlock();audio.ui();};
 const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await display.current.requestFullscreen();}catch{setError(t('fullscreen_unavailable'));}};
 return <div className="plinko-page"><div className="plinko-main" ref={display}>
 <div className="lucky-game-top"><Link to="/">← {t('back')}</Link><span>{t('active_balls')}: {number(active)} / {MAX_ACTIVE_BALLS}{queued>0?` · ${t('queued_balls',{count:number(queued)})}`:''}</span></div>
 {error&&<div className="lucky-status" role="status">{error}</div>}
 <div className="plinko-container"><MobileBetSheet title={t('bet_controls')} className="plinko-bet-sheet"><div className="plinko-sidebar-wrapper"><Sidebar balance={balance} unavailable={!available} betAmount={betAmount} setBetAmount={setBetAmount} rowCount={profile.rows} difficulty={difficulty} setDifficulty={changeDifficulty} boardFull={active+queued>=MAX_ACTIVE_BALLS} hasOutstandingBalls={active+queued>0} onDropBall={drop} onSettingsClick={()=>setSettings(!settings)} onStatsClick={()=>setStats(true)} isSettingsOpen={settings} isStatsOpen={stats} selectedBallType={ballType} setSelectedBallType={setBallType} ballTypes={ballTypes} currentBall={ballTypes[ballType]} winRecords={records} lastWin={records.at(-1)} currentStreak={0} maxStreak={0}/></div></MobileBetSheet>
 <div className="plinko-game-wrapper"><Plinko rowCount={profile.rows} riskLevel={profile.risk} betAmount={betAmount} winRecords={records} onBallEnterBin={land} onBalanceChange={()=>{}} engineRef={engineRef} onEngineError={()=>setError(t('engine_error'))}/>
 <div className="plinko-controls"><Space><Tooltip title={t('settings')}><Button type="text" icon={<SettingOutlined/>} className="control-btn" onClick={()=>setSettings(!settings)} aria-label={t('settings')}/></Tooltip><Tooltip title={t('fullscreen')}><Button type="text" icon={fullscreen?<FullscreenExitOutlined/>:<ExpandOutlined/>} className="control-btn" onClick={toggleFullscreen} aria-label={t('fullscreen')}/></Tooltip><Tooltip title={t('stats')}><Button type="text" icon={<BarChartOutlined/>} className="control-btn" onClick={()=>setStats(true)} aria-label={t('stats')}/></Tooltip><Tooltip title={t(sound?'sound_on':'sound_off')}><Button type="text" icon={<SoundOutlined/>} className={`control-btn ${sound?'':'muted'}`} onClick={toggleSound} aria-label={t('sound')} aria-pressed={sound}/></Tooltip></Space><span className="logo" style={{color:'var(--text-primary)'}}>Lucky Lounge</span><Button type="text" icon={<SafetyCertificateOutlined/>} className="fairness-btn" onClick={()=>setFairness(true)}>{t('fairness')}</Button></div></div></div>
 <div className="recent-plays"><div className="recent-plays-header"><ThunderboltOutlined/><span>{t('recent')}</span><span className="total-plays">{number(snapshot?.wallet.rounds||0)} {t('stat_rounds')}</span></div><div className="recent-plays-bar"><div className="recent-plays-list">{records.length?records.slice().reverse().map(r=><Tooltip key={r.id} title={t('result',{mult:number(r.payout.multiplier),value:number(r.payout.value)})}><span className="play-tag" style={{backgroundColor:getBinColors(r.rowCount).background[r.binIndex]}}>{number(r.payout.multiplier)}×</span></Tooltip>):<span className="no-plays">{t('first_drop')}</span>}</div><div className="recent-plays-actions"><Button type="text" className="view-all-btn" icon={<RightOutlined/>} onClick={()=>setStats(true)} aria-label={t('stats')}/></div></div></div></div>
 <Modal title={t('settings')} open={settings} onCancel={()=>setSettings(false)} footer={null} className="settings-modal box-modal-3d" rootClassName="mobile-game-modal" centered><div className="lucky-setting"><span>{t('sound')}</span><Switch checked={sound} onChange={toggleSound}/></div><label htmlFor="lucky-volume">{t('volume')}</label><Slider id="lucky-volume" min={0} max={100} value={volume*100} onChange={v=>{setVolume(v/100);audio.set(sound,v/100);}}/><p className="lucky-note">{t('device_audio')}</p></Modal>
 <Modal title={t('stats')} open={stats} onCancel={()=>setStats(false)} footer={null} width={850} rootClassName="mobile-game-modal" centered><StatsHistory/></Modal>
 <Modal title={t('fairness')} open={fairness} onCancel={()=>setFairness(false)} footer={null} width={620} rootClassName="mobile-game-modal" centered><p>{t('plinko_'+difficulty)} · {t('fairness_text',{rows:profile.rows})}</p><table className="lucky-odds"><thead><tr><th>{t('field')}</th><th>{t('multiplier')}</th><th>{t('chance')}</th></tr></thead><tbody>{multipliers.map((m,i)=><tr key={i}><td>{i+1}</td><td>{number(m)}×</td><td>{number(probabilities[i]*100,{maximumFractionDigits:6})}%</td></tr>)}</tbody></table><p>{t('rounding')}</p><p>{t('server_settlement')}</p></Modal>
 </div>;
}
