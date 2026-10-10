import { lazy, Suspense } from 'react'

let phaserPromise

function loadPhaser() {
    if (window.Phaser) return Promise.resolve()

    phaserPromise ||= new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = '/vendor/phaser-arcade-physics.min.js'
        script.onload = () => window.Phaser ? resolve() : reject(new Error('Phaser failed to load'))
        script.onerror = () => reject(new Error('Phaser failed to load'))
        document.head.append(script)
    })

    return phaserPromise
}

const DinoGame = lazy(async () => {
    await loadPhaser()
    return import('../components/DinoGame')
})

function DinoPage() {
    return <Suspense fallback={null}><DinoGame /></Suspense>
}

export default DinoPage
