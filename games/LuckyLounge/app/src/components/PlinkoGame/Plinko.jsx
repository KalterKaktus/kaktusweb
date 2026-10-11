import {useText} from '../../i18n';
// Plinko Component - Integrated with main layout
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import PlinkoEngine from './PlinkoEngine';
import { getBinColors, BIN_PAYOUTS } from './constants';
import './Plinko.css';

let outcomesPromise;

function loadOutcomes() {
    outcomesPromise ||= fetch('/games/LuckyLounge/plinko-outcomes.json').then((response) => {
        if (!response.ok) throw new Error('Unable to load Plinko outcomes');
        return response.json();
    });
    return outcomesPromise;
}

function BinsRow({ rowCount, riskLevel, multipliers, winRecords, binsWidthPercentage }) {
 const {number}=useText();
    const binsRef = useRef([]);
    const [highlightedBin, setHighlightedBin] = useState(null);

    const binColors = useMemo(() => getBinColors(rowCount), [rowCount]);
    const payouts = multipliers || BIN_PAYOUTS[rowCount][riskLevel];

    // Play animation when new win record
    useEffect(() => {
        if (winRecords.length > 0) {
            const lastWin = winRecords[winRecords.length - 1];
            const binIndex = lastWin.binIndex;
            setHighlightedBin(binIndex);

            const binEl = binsRef.current[binIndex];
            if (binEl) {
                binEl.animate(
                    [
                        { transform: 'translateY(0)' },
                        { transform: 'translateY(30%)' },
                        { transform: 'translateY(0)' },
                    ],
                    {
                        duration: 300,
                        easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                    }
                );
            }

            const timer = setTimeout(() => setHighlightedBin(null), 500);
            return () => clearTimeout(timer);
        }
    }, [winRecords]);

    // Use pure CSS percentage relative to .plinko-board-wrapper
    const binsWidth = `${(binsWidthPercentage || 0.85) * 100}%`;

    return (
        <div
            className="bins-row"
            style={{ width: binsWidth }}
        >
            {payouts.map((payout, binIndex) => (
                <div
                    key={binIndex}
                    ref={el => binsRef.current[binIndex] = el}
                    className={`bin ${highlightedBin === binIndex ? 'highlight' : ''}`}
                    style={{
                        backgroundColor: binColors.background[binIndex],
                        '--shadow-color': binColors.shadow[binIndex],
                    }}
                >
                    <span className="bin-label" title={`${number(payout,{maximumFractionDigits:8})}×`}>{number(payout,{maximumFractionDigits:2})}{payout < 100 ? '×' : ''}</span>
                </div>
            ))}
        </div>
    );
}

function LastWins({ winRecords, winCount = 4 }) {
 const {number}=useText();
    const lastWins = winRecords.slice(-winCount).reverse();

    if (lastWins.length === 0) return null;

    return (
        <div className="last-wins" style={{ '--win-count': winCount }}>
            {lastWins.map((win, i) => {
                const binColors = getBinColors(win.rowCount);
                return (
                    <div
                        key={win.id || i}
                        className="last-win-item"
                        style={{ backgroundColor: binColors.background[win.binIndex] }}
                    >
                        {number(win.payout.multiplier)}{win.payout.multiplier < 100 ? '×' : ''}
                    </div>
                );
            })}
        </div>
    );
}

function Plinko({
    rowCount,
    riskLevel,
    multipliers,
    betAmount,
    winRecords,
    onBallEnterBin,
    onBalanceChange,
    engineRef, onEngineError
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const contentRef = useRef(null);
    const [fitWidth, setFitWidth] = useState(null);
    const [plinkoEngine, setPlinkoEngine] = useState(null);
    const [binsWidthPercentage, setBinsWidthPercentage] = useState(0.85);
    const [isLoading, setIsLoading] = useState(true);

    const { WIDTH, HEIGHT } = PlinkoEngine;

    // Fit the complete board INCLUDING bins; resizing never changes the physics.
    useEffect(() => {
        const content = contentRef.current;
        const fit = () => {
            if (!content) return;
            const style = getComputedStyle(content), rect = content.getBoundingClientRect();
            const width = rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const sheet = document.querySelector('.plinko-bet-sheet[data-mobile]');
            const bins = content.querySelector('.bins-row');
            const reserve = (bins?.offsetHeight || 28) + 12;
            let height = rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - reserve;
            if (sheet) {
                const nav = document.querySelector('.mobile-bottom-nav');
                const controls = document.querySelector('.plinko-controls');
                const collapsed = parseFloat(getComputedStyle(sheet).getPropertyValue('--mobile-sheet-collapsed-height')) || 196;
                const top = rect.top + (document.querySelector('.main-content')?.scrollTop || 0);
                height = (window.visualViewport?.height || innerHeight) - top - collapsed - (nav?.offsetHeight || 0) - (controls?.offsetHeight || 60) - reserve - 20;
            }
            const minWidth = sheet ? Math.min(width, 240) : 1;
            setFitWidth(Math.floor(Math.min(width, 880, Math.max(minWidth, height * WIDTH / HEIGHT))));
        };
        const observer = new ResizeObserver(fit);
        observer.observe(content);
        window.addEventListener('resize', fit);
        window.visualViewport?.addEventListener('resize', fit);
        fit();
        return () => {observer.disconnect();window.removeEventListener('resize', fit);window.visualViewport?.removeEventListener('resize', fit);};
    }, []);

    // Initialize engine
    useEffect(() => {
        let cancelled = false;
        let engine;

        loadOutcomes().then((outcomes) => {
            if (cancelled || !canvasRef.current) return;

            engine = new PlinkoEngine(canvasRef.current, {
                rowCount,
                riskLevel,
                betAmount,
                outcomes,
                onBallEnterBin: (data) => {
                    onBallEnterBin?.(data);
                },
                onBalanceChange: (amount) => {
                    onBalanceChange?.(amount);
                },
            });

            engine.start();
            setPlinkoEngine(engine);
            setBinsWidthPercentage(engine.binsWidthPercentage);
            setIsLoading(false);

            if (engineRef) engineRef.current = engine;
        }).catch(error => { setIsLoading(false); onEngineError?.(error); });

        return () => {
            cancelled = true;
            engine?.stop();
            if (engineRef) engineRef.current = null;
        };
    }, []);

    // Update row count
    useEffect(() => {
        if (plinkoEngine) {
            plinkoEngine.updateRowCount(rowCount);
            setBinsWidthPercentage(plinkoEngine.binsWidthPercentage);
        }
    }, [rowCount, plinkoEngine]);

    // Update risk level
    useEffect(() => {
        if (plinkoEngine) {
            plinkoEngine.updateRiskLevel(riskLevel);
        }
    }, [riskLevel, plinkoEngine]);

    // Update bet amount
    useEffect(() => {
        if (plinkoEngine) {
            plinkoEngine.updateBetAmount(betAmount);
        }
    }, [betAmount, plinkoEngine]);

    return (
        <div className="plinko" ref={containerRef}>
            <div className="plinko-content" ref={contentRef}>
                <div className="plinko-board-wrapper" style={{maxWidth:fitWidth===null?undefined:`${fitWidth}px`}}>
                    <div className="plinko-canvas-container" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
                        {isLoading && (
                            <div className="plinko-loading">
                                <div className="loading-spinner" />
                            </div>
                        )}
                        <canvas
                            ref={canvasRef}
                            width={WIDTH}
                            height={HEIGHT}
                            className="plinko-canvas"
                        />
                    </div>
                    <BinsRow
                        rowCount={rowCount}
                        riskLevel={riskLevel}
                        multipliers={multipliers}
                        winRecords={winRecords}
                        binsWidthPercentage={binsWidthPercentage}
                    />
                </div>
            </div>
            <LastWins winRecords={winRecords} />
        </div>
    );
}

export default Plinko;
