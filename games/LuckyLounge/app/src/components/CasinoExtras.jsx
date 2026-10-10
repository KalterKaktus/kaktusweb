import {useEffect,useState} from 'react';
import {useWallet} from '../context/WalletContext';
import {useText} from '../i18n';
import {audio} from '../audio';

export function HourlyBonus({inWallet=false}) {
 const {snapshot,available,claim,busy,now,refresh}=useWallet(),{t,number}=useText();
 const configured=snapshot?.rules?.economy==='casino-v1';
 const [remaining,setRemaining]=useState('—'),[celebrate,setCelebrate]=useState(false);
 useEffect(()=>{
   let refreshing=false;
   const tick=()=>{
    if(!snapshot)return;
    const next=Date.parse(snapshot.next_bonus_at);
    if(!Number.isFinite(next)){setRemaining('—');return;}
    const seconds=Math.max(0,Math.ceil((next-now())/1000));
    setRemaining([Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':'));
    if(seconds===0&&!snapshot.bonus_available&&!refreshing&&available){refreshing=true;refresh().catch(()=>{});}
   };
   tick(); const id=setInterval(tick,1000);return()=>clearInterval(id);
 },[snapshot,available]);
 async function handleClaim(){try{await audio.unlock();const result=await claim();if(result.claimed){audio.claim();setCelebrate(true);setTimeout(()=>setCelebrate(false),1000);}}catch{}}
 return <section className={`lucky-daily ${inWallet?'in-wallet':''} ${celebrate?'claimed':''}`} id={inWallet?undefined:'bonus'}><div className="lucky-daily-copy"><p className="section-kicker">{t('daily_kicker')}</p><h2>{t('daily_title')}</h2><p>{snapshot&&!configured?t('hourly_migration_required'):snapshot&&!snapshot.bonus_available?t('daily_done'):t('daily_hint')}</p></div><div className="lucky-daily-action"><button className="hero-primary-button" onClick={handleClaim} disabled={!available||busy||!configured||!snapshot?.bonus_available}>{t(busy?'processing':snapshot&&!snapshot.bonus_available?'claimed':'claim')}</button><small>{snapshot?.bonus_available?t('berlin_reset'):t('next_reward',{time:remaining})}</small></div>{celebrate&&<span className="lucky-claim-pop" aria-hidden="true">+{number(snapshot?.bonus_amount??50)} ✦</span>}</section>;
}
export function StatsHistory({compact=false}) {
 const {snapshot}=useWallet(),{t,number,chips,date}=useText();
 const w=snapshot?.wallet,legacy=w&&(w.total_wagered===null||w.total_won===null);
 const spent=w?(legacy?w.tracked_wagered:w.total_wagered):null,won=w?(legacy?w.tracked_won:w.total_won):null;
 const items=[['rounds',w?.rounds],['wagered',spent],['won',won],['net',w?won-spent:null],['biggest',w?.biggest_win]];
 return <section className={`home-section lucky-stats ${compact?'compact':''}`} id="statistics"><div className="section-header-copy"><p className="section-kicker">{t('your_lounge')}</p><h2>{t('stats')}</h2></div><div className="lucky-stats-grid">{items.map(([key,value])=><div className="lucky-stat" key={key}><span>{t('stat_'+key)}</span><strong className={key==='net'?value>=0?'positive':'negative':''}>{value===null||value===undefined?'—':(key==='net'&&value>0?'+':'')+(key==='rounds'?number(value):chips(value))}</strong><small>{t(legacy&&['wagered','won','net'].includes(key)?'since_v2':'all_time')}</small></div>)}</div>{legacy&&<p className="lucky-note">{t('legacy_note')}</p>}<h3 className="lucky-history-title">{t('recent')}</h3><div className="lucky-history">{snapshot?.recent?.length?snapshot.recent.map(r=><div className="lucky-history-row" key={r.request_id}><strong>{({plinko:'Plinko',mines:'Mines',crash:'Crash',dino:'Dino'})[r.game||r.kind||'plinko']||'—'}</strong><time dateTime={r.created_at}>{date(r.created_at,{dateStyle:'short',timeStyle:'short'})}</time><span>{t('bet_short')}: {chips(r.stake)}</span><span>{t('payout')}: {chips(r.payout)}</span><strong className={r.payout>=r.stake?'positive':'negative'}>{r.payout>r.stake?'+':''}{chips(r.payout-r.stake)}</strong></div>):<p className="lucky-note">{t('no_rounds')}</p>}</div></section>;
}
export function WalletStatus(){const {error,user,refresh}=useWallet(),{t}=useText();return error?<div className="lucky-status" role="status">{error} {user?<button onClick={()=>refresh().catch(()=>{})}>{t('retry')}</button>:<a href="/login.html?next=%2Fgames%2FLuckyLounge%2F">{t('login')}</a>}</div>:null;}
