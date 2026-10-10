import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8')

const sidebarStyles = [
    './CrashGame/CrashGame.css',
    './PlinkoGame/Sidebar.css',
    './DinoGame/DinoGame.css',
    './MinesGame/MinesGame.css',
]

test('bet amount inputs join their Bitcoin addons without a rounded left edge', async () => {
    const styles = await Promise.all(sidebarStyles.map(read))

    for (const css of styles) {
        assert.match(css, /ant-space-addon-compact-first-item\.ant-input-number-addon\s*\+\s*\.ant-input-number-compact-last-item/)
        assert.match(css, /border-top-left-radius:\s*0 !important/)
        assert.match(css, /border-bottom-left-radius:\s*0 !important/)
    }
})
