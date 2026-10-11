import {useEffect,useState} from 'react';
import {useWallet} from '../../context/WalletContext';
import {useText} from '../../i18n';

export default function BlackjackFeed(){
 const {available,blackjackFeed,subscribeBlackjackFeed}=useWallet(),{t,chips,date}=useText();
 const [items,setItems]=useState([]),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!available)return;let alive=true;
  const merge=value=>{if(!alive)return;const rows=Array.isArray(value)?value:[value];setItems(previous=>{const combined=new Map(previous.map(row=>[row.id,row]));for(const row of rows)if(row?.id)combined.set(row.id,row);return [...combined.values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,15);});};
  const load=async()=>{try{merge(await blackjackFeed());if(alive){setLoaded(true);setFailed(false);}}catch{if(alive){setLoaded(true);setFailed(true);}}};
  load();const unsubscribe=subscribeBlackjackFeed(merge),interval=setInterval(load,30000);
  return()=>{alive=false;clearInterval(interval);if(typeof unsubscribe==='function')unsubscribe();};
 },[available]);
 return <section className="bj-feed" aria-label={t('blackjack.feed_title')}><div className="bj-feed-heading"><h2>{t('blackjack.feed_title')}</h2><span>{t('blackjack.feed_hint')}</span></div>
  <div className="bj-feed-scroll"><table><thead><tr><th>{t('blackjack.player')}</th><th>{t('bet_short')}</th><th>{t('blackjack.result')}</th><th>{t('blackjack.time')}</th></tr></thead><tbody>{items.map(row=>{const net=Number(row.payout)-Number(row.stake);return <tr key={row.id}><td><span className="bj-feed-avatar" aria-hidden="true">{String(row.player_name||'?').slice(0,1)}</span><strong>{row.player_name}</strong></td><td>{chips(Number(row.stake))} ✦</td><td className={net>0?'positive':net<0?'negative':'bj-push'}><b>{net>0?'+':''}{chips(net)} ✦</b><small>{t('blackjack.outcome_'+row.outcome)}</small></td><td><time dateTime={row.created_at}>{date(row.created_at,{timeStyle:'short'})}</time></td></tr>;})}</tbody></table></div>
  {!items.length&&<p className="bj-feed-empty">{t(!available?'login_required':!loaded?'blackjack.feed_loading':failed?'blackjack.feed_unavailable':'blackjack.feed_empty')}</p>}
 </section>;
}
