import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Button,InputNumber,Modal} from 'antd';
import {SoundOutlined,SettingOutlined,SafetyCertificateOutlined} from '@ant-design/icons';
import {useText} from '../../i18n';
import {roundChips,validBet} from '../../currency';
import {audio} from '../../audio';
import BetValidation from '../BetValidation';
import SourceAudioSettings from '../SourceAudioSettings';
import RouletteStrip from './RouletteStrip';
import useRoulette from './useRoulette';
import './RouletteGame.css';
const COLORS=['red','green','black'];
export default function RouletteGame(){
 const game=useRoulette(),{t,chips,number}=useText(),[stake,setStake]=useState(1),[settings,setSettings]=useState(false),[rules,setRules]=useState(false),[enabled,setEnabled]=useState(audio.enabled);
 const {state,round,open,pending,error,balance,now,user}=game,phase=round?.phase;
 const seconds=round?Math.max(0,Math.ceil((Date.parse(phase==='waiting'?round.betting_ends_at:phase==='spinning'?round.spin_ends_at:round.result_ends_at)-now())/1000)):0;
 const own=(state?.players||[]).filter(p=>p.user_id===user?.id),ownStake=own.reduce((sum,p)=>sum+Number(p.stake),0),ownPayout=own.reduce((sum,p)=>sum+Number(p.payout||0),0);
 useEffect(()=>{if(phase==='result'&&ownPayout>0)audio.land(ownPayout/ownStake);},[round?.id,phase]);
 const participants=color=>{
  const grouped=new Map();for(const p of state?.players||[]){if(p.color!==color)continue;const key=p.user_id;const row=grouped.get(key)||{...p,stake:0,payout:0};row.stake+=Number(p.stake);row.payout+=Number(p.payout||0);grouped.set(key,row);}return [...grouped.values()].sort((a,b)=>b.stake-a.stake);
 };
 const toggle=async()=>{const value=!audio.enabled;audio.set(value,audio.volume);setEnabled(value);if(value)await audio.unlock();};
 return <section className="roulette-game"><div className="roulette-heading"><Link to="/">← {t('back')}</Link><h1>{t('roulette.name')}</h1><div className="roulette-heading-tools"><Button type="text" icon={<SoundOutlined/>} aria-label={t('sound')} aria-pressed={enabled} onClick={toggle}/><Button type="text" icon={<SettingOutlined/>} aria-label={t('audio_settings')} onClick={()=>setSettings(true)}/><Button type="text" icon={<SafetyCertificateOutlined/>} onClick={()=>setRules(true)}>{t('fairness')}</Button></div></div>
 {error&&<div className="lucky-status" role="status">{error}</div>}
 <div className="roulette-stage"><div className="roulette-history" aria-label={t('recent')}><div className="roulette-history-track">{(state?.history||[]).map(h=><span key={h.id} className={`roulette-history-pill ${h.outcome}`} title={t('roulette.'+h.outcome)}>{h.outcome==='green'?'✦':number(h.landing_index)}</span>)}</div></div>
 <div className="roulette-phase" aria-live="polite"><span className="section-kicker">{t('roulette.shared')}</span><strong>{!round?t('processing'):phase==='waiting'?t('roulette.next',{seconds:number(seconds)}):phase==='spinning'?t('roulette.spinning'):t('roulette.landed',{color:t('roulette.'+round.outcome)})}</strong><div className={`roulette-timer ${phase==='waiting'?'is-counting':''}`}><span style={{transform:`scaleX(${phase==='waiting'?Math.min(1,seconds/15):phase==='spinning'?Math.max(0,seconds/8):1})`}}/></div></div>
 <RouletteStrip round={round} history={state?.history||[]} now={now}/>
 <div className="roulette-result" role="status">{phase==='result'&&ownStake>0?<span className={ownPayout>=ownStake?'positive':'negative'}>{t(ownPayout>ownStake?'roulette.you_won':ownPayout===ownStake?'roulette.you_push':'roulette.you_lost',{value:chips(Math.abs(ownPayout-ownStake))})}</span>:<span>{t(phase==='spinning'?'roulette.locked':phase==='result'?'roulette.next_soon':'roulette.place_hint')}</span>}</div>
 <div className="roulette-stake"><span>{t('bet_short')}</span><div className="roulette-stake-controls"><button onClick={()=>setStake(1)} disabled={pending}>{t('roulette.min')}</button><button onClick={()=>setStake(v=>Math.max(1,roundChips(Number(v||0)/2)))} disabled={pending}>½</button><InputNumber aria-label={t('bet')} value={stake} onChange={setStake} changeOnBlur={false} step={.01} precision={2} decimalSeparator="," controls={false} disabled={pending}/><button onClick={()=>setStake(v=>Math.min(100000,roundChips(Number(v||0)*2)))} disabled={pending}>2×</button><button onClick={()=>setStake(Math.min(100000,roundChips(balance)))} disabled={pending}>{t('roulette.max')}</button></div><BetValidation value={stake} balance={balance}/></div>
 </div>
 <div className="roulette-bets">{COLORS.map(color=>{const players=participants(color),total=players.reduce((sum,p)=>sum+p.stake,0),won=phase==='result'&&round.outcome===color;return <div className={`roulette-color-column ${color} ${won?'is-winner':''}`} key={color}><button className="roulette-place-bet" disabled={!open||pending||!validBet(stake)||stake>balance} onClick={()=>game.bet(color,stake)}><span>{t('roulette.'+color)}</span><strong>{color==='green'?'100':number(round?.red_black_multiplier??200/99,{maximumFractionDigits:4})}×</strong></button><div className="roulette-column-head"><span>{t('roulette.players',{count:number(players.length)})}</span><strong>{chips(total)} ✦</strong></div><div className="roulette-player-list">{players.length?players.map(p=><div className={`roulette-player ${p.user_id===user?.id?'is-own':''} ${phase==='result'?(won?'won':'lost'):''}`} key={p.user_id}><span className="roulette-avatar" aria-hidden="true">{(p.name||'?').slice(0,1).toUpperCase()}</span><span className="roulette-player-name">{p.user_id===user?.id?t('you'):p.name}</span><strong>{phase==='result'?`${p.payout>p.stake?'+':''}${chips(p.payout-p.stake)}`:chips(p.stake)}</strong></div>):<p className="roulette-empty">{t('roulette.no_bets')}</p>}</div></div>;})}</div>
 <SourceAudioSettings open={settings} onClose={()=>setSettings(false)} enabled={enabled} setEnabled={setEnabled}/>
 <Modal title={t('fairness')} open={rules} onCancel={()=>setRules(false)} footer={null} rootClassName="mobile-game-modal"><p>{t('roulette.rules',{multiplier:number(round?.red_black_multiplier??200/99,{maximumFractionDigits:6})})}</p><table className="lucky-odds"><thead><tr><th>{t('roulette.color')}</th><th>{t('chance')}</th><th>{t('multiplier')}</th></tr></thead><tbody>{COLORS.map(c=><tr key={c}><td>{t('roulette.'+c)}</td><td>{number(c==='green'?1:49.5)}%</td><td>{c==='green'?100:number(round?.red_black_multiplier??200/99,{maximumFractionDigits:6})}×</td></tr>)}</tbody></table><p>{t('fair_rounding')}</p><p>{t('server_settlement')}</p></Modal>
 </section>;
}
