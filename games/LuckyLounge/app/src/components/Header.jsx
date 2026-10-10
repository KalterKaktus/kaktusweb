import {useState,useEffect,useRef} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useWallet} from '../context/WalletContext';
import {useText} from '../i18n';
import {HourlyBonus} from './CasinoExtras';
import GameIcon from './GameIcon';
const ChipIcon=()=> <div className="btc-icon" aria-hidden="true">✦</div>;
export default function Header({menuOpen,menuButtonRef,onMenuClick}) {
 const {balance,snapshot,user,profile}=useWallet(), {t,number,chips,language,setLanguage}=useText();
 const [open,setOpen]=useState(false),ref=useRef(null),location=useLocation();
 useEffect(()=>{const close=e=>{if(!ref.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 useEffect(()=>setOpen(false),[location.pathname]);
 const value=snapshot?chips(balance):'—';
 const name=profile?.username||user?.user_metadata?.full_name||user?.user_metadata?.name||t(user?'profile':'login');
 return <header className={`header ${location.pathname==='/'?'header-home':''}`}>
  <div className="header-left"><Link to="/" className="logo-link"><span className="logo" style={{color:'var(--text-primary)'}}>Lucky Lounge</span></Link></div>
  <div className="header-center"><div className="header-wallet" ref={ref}>
   <button type="button" className="mobile-wallet-balance" onClick={()=>setOpen(!open)} aria-label={t('balance')} aria-expanded={open}><ChipIcon/><span>{value}</span></button>
   <div className="wallet-balance-display"><ChipIcon/><span className="wallet-balance-amount">{value}</span><button className="wallet-dropdown-toggle" aria-label={t('balance')} aria-expanded={open} onClick={()=>setOpen(!open)}>⌄</button></div>
   <button className="wallet-btn" onClick={()=>setOpen(!open)}>{t('chips')}</button>
   {open&&<div className="wallet-dropdown"><div className="wallet-dropdown-header"><h4>{t('balance')}</h4><button className="wallet-close-btn" onClick={()=>setOpen(false)} aria-label={t('close')}>✕</button></div><div className="wallet-balance-section"><div className="wallet-balance-label">{t('balance')}</div><div className="wallet-balance-big"><ChipIcon/>{value}</div></div><HourlyBonus inWallet/></div>}
  </div></div>
  <div className="header-right"><label className="palette-select-label"><span className="palette-select-text">{t('language')}</span><select className="palette-select" value={language} onChange={e=>setLanguage(e.target.value)} aria-label={t('language')}><option value="de">DE</option><option value="ru">RU</option></select></label>
   <a className="header-profile" href={user?'/profile/':'/login.html?next=%2Fgames%2FLuckyLounge%2F'} title={name}><GameIcon name="profile"/><span>{name}</span></a>
   <button ref={menuButtonRef} className="mobile-menu-button" onClick={onMenuClick} aria-label={t('menu')} aria-expanded={menuOpen}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z"/></svg></button>
  </div>
 </header>;
}
