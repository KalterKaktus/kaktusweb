import {useText} from '../i18n';
import { useEffect, useId, useRef, useState } from 'react'
import './MobileBetSheet.css'

const MOBILE_QUERY = '(max-width: 768px), (max-width: 932px) and (orientation: landscape) and (hover: none)'
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

function MobileBetSheet({ title, children, className = '', collapseOn = false }) {
    const {t}=useText();
    const [expanded, setExpanded] = useState(false)
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
    )
    const contentId = useId()
    const sheetRef = useRef(null)

    useEffect(() => {
        const media = window.matchMedia(MOBILE_QUERY)
        const update = () => {
            setIsMobile(media.matches)
            if (!media.matches) setExpanded(false)
        }
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])

    useEffect(() => {
        if (collapseOn) setExpanded(false)
    }, [collapseOn])
    useEffect(() => {
        const close = () => setExpanded(false)
        document.addEventListener('kk:lounge-close-bet-sheet', close)
        return () => document.removeEventListener('kk:lounge-close-bet-sheet', close)
    }, [])

    useEffect(() => {
        if (!isMobile || !expanded) return
        const previousFocus = document.activeElement
        const sheet = sheetRef.current
        const backgroundNodes = []
        let activeBranch = sheet
        while (activeBranch?.parentElement && activeBranch.parentElement !== document.body) {
            for (const sibling of activeBranch.parentElement.children) {
                if (sibling !== activeBranch && !sibling.contains(activeBranch) && !sibling.matches('.header, .mobile-bottom-nav')) {
                    backgroundNodes.push(sibling)
                }
            }
            activeBranch = activeBranch.parentElement
        }
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setExpanded(false)
                return
            }
            if (event.key === 'Tab') {
                const focusable = [...sheet.querySelectorAll(FOCUSABLE)]
                if (!focusable.length) return
                const first = focusable[0]
                const last = focusable.at(-1)
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }

        for (const backgroundNode of backgroundNodes) backgroundNode.inert = true
        document.body.classList.add('mobile-overlay-open')
        document.addEventListener('keydown', onKeyDown)
        sheet.querySelector(FOCUSABLE)?.focus()
        return () => {
            for (const backgroundNode of backgroundNodes) backgroundNode.inert = false
            document.body.classList.remove('mobile-overlay-open')
            document.removeEventListener('keydown', onKeyDown)
            previousFocus?.focus()
        }
    }, [expanded, isMobile])

    return (
        <section
            ref={sheetRef}
            className={`mobile-bet-sheet ${className}`.trim()}
            data-state={expanded ? 'expanded' : 'collapsed'}
            data-mobile={isMobile || undefined}
            role={expanded ? 'dialog' : undefined}
            aria-modal={expanded || undefined}
            aria-label={title}
        >
            <button
                type="button"
                className="mobile-bet-sheet__backdrop"
                aria-label={t('collapse')}
                onClick={() => setExpanded(false)}
            />
            <button
                type="button"
                className="mobile-bet-sheet__handle"
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={() => setExpanded(value => !value)}
            >
                <span>{title}</span>
                <span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span>
            </button>
            <div id={contentId} className="mobile-bet-sheet__content">
                {children}
            </div>
        </section>
    )
}

export default MobileBetSheet
