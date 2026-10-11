import {useEffect} from 'react';
import {Drawer} from 'antd';
import {NavLink,useLocation} from 'react-router-dom';
import {useText} from '../i18n';
import {GAMES} from '../games';
import GameIcon from './GameIcon';
import {useWallet} from '../context/WalletContext';
import './MobileNavigation.css';
export default function MobileNavigation({drawerOpen,onClose,returnFocusRef}) {
 const {t,language,setLanguage}=useText();
 const {user,profile}=useWallet(),location=useLocation(),profilePath=user?'/profile/':'/login.html?next=%2Fgames%2FLuckyLounge%2F';
 useEffect(onClose,[location.pathname,onClose]);
 return <><Drawer title={t('menu')} placement="left" width="min(88vw, 360px)" zIndex={1100} open={drawerOpen} onClose={onClose} afterOpenChange={open=>{if(!open)returnFocusRef.current?.focus();}} rootClassName="mobile-navigation-drawer">
 <div className="mobile-drawer-actions"><a href={profilePath}><GameIcon name="profile"/><span>{profile?.username||t(user?'profile':'login')}</span></a><NavLink to="/" end onClick={onClose}><GameIcon name="lobby"/>{t('lobby')}</NavLink>{GAMES.map(g=><NavLink key={g.id} to={g.path} onClick={onClose}><GameIcon name={g.icon}/>{g.nameKey?t(g.nameKey):g.name}</NavLink>)}<NavLink to="/statistics" onClick={onClose}><GameIcon name="stats"/>{t('stats')}</NavLink></div>
 <label className="mobile-drawer-field"><span>{t('language')}</span><select value={language} onChange={e=>setLanguage(e.target.value)}><option value="de">Deutsch</option><option value="ru">Русский</option></select></label></Drawer>
 </>;
}
