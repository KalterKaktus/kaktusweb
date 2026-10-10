import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
    applyPaletteCssVars,
    DEFAULT_PALETTE_ID,
    getAntdTheme,
    getPalette,
    isPaletteId,
    PALETTES,
    PALETTE_STORAGE_KEY,
} from '../theme/palettes'

const ThemeContext = createContext(null)

function getStoredPaletteId() {
    try {
        const stored = localStorage.getItem(PALETTE_STORAGE_KEY)
        if (isPaletteId(stored)) return stored
    } catch (e) { /* ignore */ }
    return DEFAULT_PALETTE_ID
}

export function ThemeProvider({ children }) {
    const [paletteId, setPaletteIdState] = useState(getStoredPaletteId)
    const palette = useMemo(() => getPalette(paletteId), [paletteId])
    const antdTheme = useMemo(() => getAntdTheme(palette), [palette])

    useEffect(() => {
        applyPaletteCssVars(palette)
    }, [palette])

    const setPaletteId = (nextPaletteId) => {
        if (!isPaletteId(nextPaletteId)) return
        try { localStorage.setItem(PALETTE_STORAGE_KEY, nextPaletteId) } catch (e) { /* ignore */ }
        setPaletteIdState(nextPaletteId)
    }

    return (
        <ThemeContext.Provider value={{ paletteId, palettes: PALETTES, setPaletteId, antdTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useThemeSettings() {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('useThemeSettings must be used within ThemeProvider')
    return context
}
