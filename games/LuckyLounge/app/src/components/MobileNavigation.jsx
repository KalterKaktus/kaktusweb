import {useEffect} from 'react';
import {Drawer} from 'antd';
import {NavLink} from 'react-router-dom';
import {useText} from '../i18n';
import {GAMES} from '../games';
import './MobileNavigation.css';
export default function MobileNavigation({drawerOpen,onClose,returnFocusRef}) {
 const {t,language,setLanguage}=useText();
 return <><Drawer title={t('menu')} placement="left" width="min(88vw, 360px)" open={drawerOpen} onClose={onClose} afterOpenChange={open=>{if(!open)returnFocusRef.current?.focus();}} rootClassName="mobile-navigation-drawer">
 <label className="mobile-drawer-field"><span>{t('language')}</span><select value={language} onChange={e=>setLanguage(e.target.value)}><option value="de">Deutsch</option><option value="ru">Русский</option></select></label><div className="mobile-drawer-actions"><a href="/profile/">{t('profile')}</a>{GAMES.map(g=><NavLink key={g.id} to={g.path} onClick={onClose}>{g.name}</NavLink>)}</div></Drawer>
 <nav className="mobile-bottom-nav" aria-label={t('navigation')}>
 <NavLink to="/" end onClick={onClose}><span aria-hidden="true">⌂</span><span>{t('lobby')}</span></NavLink><NavLink to="/plinko/" onClick={onClose}><span aria-hidden="true">◆</span><span>Plinko</span></NavLink><NavLink to="/statistics" onClick={onClose}><span aria-hidden="true">▥</span><span>{t('stats')}</span></NavLink><a href="/profile/"><span aria-hidden="true">♙</span><span>{t('profile')}</span></a></nav></>;
}
