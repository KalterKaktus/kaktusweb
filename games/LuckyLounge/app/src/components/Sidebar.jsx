import {useText} from '../i18n';
import { NavLink, useLocation } from 'react-router-dom'
import { GAMES } from '../games'
import GameIcon from './GameIcon'

const navItems = [{icon:'lobby',label:'lobby',path:'/'},{icon:'stats',label:'stats',path:'/statistics'}]


function Sidebar({ isOpen, toggleSidebar }) {
 const {t}=useText();
    const isHomePage = useLocation().pathname === '/'

    return (
        <aside className={`app-sidebar ${isHomePage ? 'app-sidebar-home' : ''} ${!isOpen ? 'app-sidebar-hidden' : ''}`}>
            <div className="sidebar-header">
                <button className="icon-btn sidebar-toggle" aria-label={t('menu')} onClick={toggleSidebar}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z"></path></svg>
                </button>
                <div className="sidebar-switcher">
                    <NavLink to="/" className="switch-btn active">
                        Lucky Lounge
                    </NavLink>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">
                                <GameIcon name={item.icon}/>
                            </span>
                            <span>{t(item.label)}</span>
                        </NavLink>
                    ))}
                </div>

                <div className="nav-section">
                    <h3 className="nav-title">{t('choose')}</h3>
                    {GAMES.map((item) => item.comingSoon ? <div key={item.path} className="nav-item"><span className="nav-icon"><GameIcon name={item.icon}/></span><span>{item.name}</span><small className="lucky-soon">{t('coming')}</small></div> : (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">
                                <GameIcon name={item.icon}/>
                            </span>
                            <span>{item.nameKey?t(item.nameKey):item.navLabel}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </aside>
    )
}

export default Sidebar
