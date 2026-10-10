import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { App as AntApp } from 'antd'
import Layout from './components/Layout'

const HomePage = lazy(() => import('./pages/HomePage'))
const CrashPage = lazy(() => import('./pages/CrashPage'))
const PlinkoPage = lazy(() => import('./pages/PlinkoPage'))
const DinoPage = lazy(() => import('./pages/DinoPage'))
const MinesPage = lazy(() => import('./pages/MinesPage'))

function App() {
    return (
        <AntApp>
            <Suspense
                fallback={
                    <div className="route-loading" role="status" aria-live="polite">
                        Loading…
                    </div>
                }
            >
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<HomePage />} />
                        <Route path="crash" element={<CrashPage />} />
                        <Route path="plinko" element={<PlinkoPage />} />
                        <Route path="dino" element={<DinoPage />} />
                        <Route path="mines" element={<MinesPage />} />
                    </Route>
                </Routes>
            </Suspense>
        </AntApp>
    )
}

export default App


