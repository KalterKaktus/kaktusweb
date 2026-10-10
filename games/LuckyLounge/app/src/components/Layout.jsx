import {WalletStatus} from './CasinoExtras';
import { useCallback, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import MobileNavigation from './MobileNavigation'
import GameViewBoundary from './GameViewBoundary'

function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const mobileMenuButtonRef = useRef(null)
    const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), [])
    const openMobileMenu = useCallback(() => {
        document.dispatchEvent(new Event('kk:lounge-close-bet-sheet'))
        setIsMobileMenuOpen(true)
    }, [])

    return (
        <div className="app-layout">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(value => !value)}
            />
            <div className="app-main-wrapper">
                <Header
                    menuOpen={isMobileMenuOpen}
                    menuButtonRef={mobileMenuButtonRef}
                    onMenuClick={openMobileMenu}
                />
                <WalletStatus/><main className="main-content">
                    <GameViewBoundary><Outlet /></GameViewBoundary>
                </main>
            </div>
            <MobileNavigation
                drawerOpen={isMobileMenuOpen}
                onClose={closeMobileMenu}
                returnFocusRef={mobileMenuButtonRef}
            />
        </div>
    )
}

export default Layout
