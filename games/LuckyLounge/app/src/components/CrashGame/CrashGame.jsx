import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, Button, Space, Tag, Tooltip, Typography, message, Switch, Modal, Drawer, Statistic, Row, Col, Divider, Radio, Progress, Input } from 'antd';
import { SettingOutlined, ExpandOutlined, BarChartOutlined, AppstoreOutlined, SafetyCertificateOutlined, SoundOutlined, FullscreenOutlined, FullscreenExitOutlined, TrophyOutlined, FireOutlined, ThunderboltOutlined, CheckCircleOutlined, CopyOutlined, SyncOutlined, RightOutlined, StarOutlined, LineChartOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import Chart from 'chart.js/auto';
import BettingPanel from './BettingPanel';
import MobileBetSheet from '../MobileBetSheet';
import GameChart from './GameChart';
import GameHistory from './GameHistory';
import PlayerBets from './PlayerBets';
import PlayerResults from './PlayerResults';
import './CrashGame.css';
import { useText, upstreamText } from '../../i18n';
import { audio } from '../../audio';
import useSharedCrash from '../useSharedCrash';
import SourceAudioSettings from '../SourceAudioSettings';
const {
  Text,
  Title,
  Paragraph
} = Typography;
const PHASE = {
  WAITING: 'waiting',
  RUNNING: 'running',
  CRASHED: 'crashed'
};
const MOBILE_QUERY = '(max-width: 768px), (max-width: 932px) and (orientation: landscape) and (hover: none)';
function CrashGame() {
  const {
    t,
    language, number
  } = useText();
  const model = useSharedCrash();
  const {
    phase,
    multiplier,
    countdown,
    elapsedTime,
    history,
    betPlaced,
    gameRecords,
    setGameRecords,
    playerCashouts,
    userBetData,
    handleBet,
    handleCashout,
    handlePlayerCashout,
    totalProfit,
    winsCount,
    lossesCount,
    maxStreak,
    balance,
    pending,
    available,
    error
  } = model;
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(audio.enabled);
  const [showPlayerBets, setShowPlayerBets] = useState(true);
  const [showPlayerResults, setShowPlayerResults] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [layout, setLayout] = useState('default');
  const [mobileDataTab, setMobileDataTab] = useState('bets');
  useEffect(() => { if(phase==='crashed')setMobileDataTab('bets'); },[phase]);
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobileLayout(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const widgetRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [hoveredProfitValue, setHoveredProfitValue] = useState(null);
  const gameDisplayRef = useRef(null);
  const [messageApi, contextHolder] = message.useMessage();
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (gameDisplayRef.current) {
        gameDisplayRef.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
          messageApi.success(upstreamText("Entered fullscreen mode"));
        }).catch(err => {
          messageApi.error(upstreamText("Could not enter fullscreen"));
        });
      }
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        messageApi.info(upstreamText("Exited fullscreen mode"));
      });
    }
  }, [messageApi]);
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const handleDragStart = useCallback(e => {
    const widget = widgetRef.current;
    if (!widget) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = widget.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;
    const handleMouseMove = moveEvent => {
      let newX = moveEvent.clientX - offsetX;
      let newY = moveEvent.clientY - offsetY;
      newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));
      widget.style.left = `${newX}px`;
      widget.style.top = `${newY}px`;
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);
  useEffect(() => {
    if (!statsDrawerOpen || !chartCanvasRef.current) return;
    const WIN_COLOR = 'rgb(74, 222, 128)';
    const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
    const LOSS_COLOR = 'rgb(248, 113, 113)';
    const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
    const X_AXIS_COLOR = '#2a3f4d';
    const POINT_HOVER_COLOR = '#fff';
    let runProfit = 0;
    const profitHistory = [0, ...gameRecords.map(r => {
      runProfit += r.profit;
      return runProfit;
    })];
    if (chartInstanceRef.current) {
      // Update existing chart
      chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
      chartInstanceRef.current.data.datasets[0].data = profitHistory;
      chartInstanceRef.current.update('none'); // Update without animation for smooth flow
    } else {
      // Initialize new chart
      chartInstanceRef.current = new Chart(chartCanvasRef.current, {
        type: 'line',
        data: {
          labels: Array(profitHistory.length).fill(0),
          datasets: [{
            label: upstreamText("Profit"),
            data: profitHistory,
            fill: {
              target: 'origin',
              above: WIN_COLOR_FILL,
              below: LOSS_COLOR_FILL
            },
            cubicInterpolationMode: 'monotone',
            segment: {
              borderColor: ctx => {
                if (!ctx.p0 || !ctx.p1) return WIN_COLOR;
                const y0 = ctx.p0.parsed.y;
                const y1 = ctx.p1.parsed.y;
                if (y1 === 0) {
                  return y0 < 0 ? LOSS_COLOR : WIN_COLOR;
                }
                return y1 < 0 ? LOSS_COLOR : WIN_COLOR;
              }
            },
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: POINT_HOVER_COLOR,
            pointHoverBorderColor: POINT_HOVER_COLOR
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animations: {
            y: {
              duration: 0
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              enabled: false
            }
          },
          scales: {
            x: {
              border: {
                display: false
              },
              grid: {
                display: false
              },
              ticks: {
                display: false
              }
            },
            y: {
              border: {
                display: false
              },
              grid: {
                color: ctx => ctx.tick.value === 0 ? X_AXIS_COLOR : 'transparent',
                lineWidth: 2
              },
              ticks: {
                display: false
              },
              grace: '1%'
            }
          },
          onHover: (_, elements) => {
            if (elements.length) {
              const idx = elements[0].index;
              const val = profitHistory[idx];
              setHoveredProfitValue(val !== undefined ? val : null);
            } else {
              setHoveredProfitValue(null);
            }
          }
        }
      });
    }
  }, [statsDrawerOpen, gameRecords]);
  const copyToClipboard = text => {
    navigator.clipboard.writeText(text);
    messageApi.success(upstreamText("Copied to clipboard!"));
  };
  useEffect(() => {
    audio.set(soundEnabled, audio.volume);
  }, [soundEnabled]);
  const stats = {
    totalGames: history.length,
    avgMultiplier: history.length ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(2) : '—',
    maxMultiplier: history.length ? Math.max(...history).toFixed(2) : '—',
    under2x: history.filter(x => x < 2).length,
    over2x: history.filter(x => x >= 2 && x < 10).length,
    over10x: history.filter(x => x >= 10).length,
    over100x: history.filter(x => x >= 100).length
  };
  const betControls = (
                <MobileBetSheet title={upstreamText("Crash bet controls")} className="crash-bet-sheet" collapseOn={betPlaced}>
                    <div className="crash-sidebar">
                        <BettingPanel balance={balance} unavailable={!available} pending={pending} stake={model.round?.stake} committedAuto={model.round?.params.auto??null} phase={phase} betPlaced={betPlaced} multiplier={multiplier} onBet={handleBet} onCashout={handleCashout} />

                        {/* Player Bets List */}
                        {showPlayerBets && !isMobileLayout && <PlayerBets players={model.players} playerCount={model.playerCount} totalBet={model.totalBet} />}

                        {/* Footer */}
                        <div className="sidebar-footer">
                            <div className="footer-buttons">
                                <button className={`footer-btn ${historyDrawerOpen ? 'active' : ''}`} onClick={() => setHistoryDrawerOpen(true)} title={upstreamText("Play History & Dashboard")}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                    </svg>
                                </button>
                                <button className={`footer-btn ${statsDrawerOpen ? 'active' : ''}`} onClick={() => setStatsDrawerOpen(true)} title={upstreamText("Live Stats")}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
                                    </svg>
                                </button>
                                <button className="footer-btn" onClick={() => setFairnessModalOpen(true)} title={upstreamText("Provably Fair")}>
                                    <SafetyCertificateOutlined style={{
                    fontSize: 18
                  }} />
                                </button>
                            </div>
                        </div>
                    </div>
                </MobileBetSheet>
  );
  return <>{error && <div className="lucky-status" role="alert">{error}</div>}<div className={`crash-game layout-${layout}`}>
            {contextHolder}

            <div className="game-container">
                {/* Betting Panel + Player Bets */}
                {!isMobileLayout && betControls}

                {/* Game Display */}
                <div className="game-display" ref={gameDisplayRef}>
                    <GameHistory history={history} />

                    <div className="lucky-shared-crash-status"><span>{t('crash_online',{count:model.onlineCount})}</span><span>{model.notice||t('crash_shared')}</span></div>
                    <GameChart connected={available} phase={model.chartPhase} multiplier={model.chartMultiplier} elapsedTime={model.chartElapsed} countdown={countdown} />
                    {isMobileLayout && betControls}

                    {/* Player Results (floating on chart) */}
                    {showPlayerResults && !isMobileLayout && <PlayerResults cashouts={playerCashouts} />}

                    {isMobileLayout && <section className="crash-mobile-tabs" aria-label={upstreamText("Crash player data")}>
                            <div role="tablist" aria-label={upstreamText("Player data")}>
                                {['bets', 'results'].map((tab, index, tabs) => <button key={tab} id={`crash-${tab}-tab`} type="button" role="tab" tabIndex={mobileDataTab === tab ? 0 : -1} aria-selected={mobileDataTab === tab} aria-controls={`crash-${tab}-panel`} onClick={() => setMobileDataTab(tab)} onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const nextTab = tabs[(index + direction + tabs.length) % tabs.length];
                setMobileDataTab(nextTab);
                document.getElementById(`crash-${nextTab}-tab`)?.focus();
              }}>
                                        {upstreamText(tab === 'bets' ? 'Bets' : 'Results')}
                                    </button>)}
                            </div>
                            <div id={`crash-${mobileDataTab}-panel`} role="tabpanel" aria-labelledby={`crash-${mobileDataTab}-tab`}>
                                {showPlayerBets && mobileDataTab === 'bets' ? <PlayerBets players={model.players} playerCount={model.playerCount} totalBet={model.totalBet} /> : mobileDataTab === 'results' && showPlayerResults ? <PlayerResults cashouts={playerCashouts} /> : null}
                            </div>
                        </section>}

                    {/* Bottom Controls */}
                    <div className="bottom-controls-antd">
                        <Space>
                            <Tooltip title={<div>
                                        <div style={{
                  marginBottom: 8
                }}>
                                            <Text style={{
                    color: '#fff'
                  }}>{upstreamText("Show Player Bets")}</Text>
                                            <Switch size="small" checked={showPlayerBets} onChange={setShowPlayerBets} style={{
                    marginLeft: 8
                  }} />
                                        </div>
                                        <div>
                                            <Text style={{
                    color: '#fff'
                  }}>{upstreamText("Show Player Results")}</Text>
                                            <Switch size="small" checked={showPlayerResults} onChange={setShowPlayerResults} style={{
                    marginLeft: 8
                  }} />
                                        </div>
                                    </div>} trigger="click" placement="top">
                                <Button type="text" icon={<SettingOutlined />} className="control-btn-antd" onClick={() => setAudioSettingsOpen(true)} />
                            </Tooltip>

                            {/* Fullscreen Button */}
                            <Tooltip title={isFullscreen ? upstreamText("Exit Fullscreen") : upstreamText("Fullscreen")}>
                                <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />} className="control-btn-antd" onClick={toggleFullscreen} />
                            </Tooltip>



                            {/* Layout Button */}
                            <Tooltip title={<Radio.Group value={layout} onChange={e => setLayout(e.target.value)} size="small">
                                        <Radio.Button value="default">{upstreamText("Default")}</Radio.Button>
                                        <Radio.Button value="compact">{upstreamText("Compact")}</Radio.Button>
                                        <Radio.Button value="wide">{upstreamText("Wide")}</Radio.Button>
                                    </Radio.Group>} trigger="click" placement="top">
                                <Button type="text" icon={<AppstoreOutlined />} className="control-btn-antd" />
                            </Tooltip>

                            {/* Sound Button */}
                            <Tooltip title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}>
                                <Button type="text" icon={<SoundOutlined />} className={`control-btn-antd ${!soundEnabled ? 'muted' : ''}`} onClick={() => setSoundEnabled(!soundEnabled)} />
                            </Tooltip>
                        </Space>

                        <span className="logo" style={{
              color: 'var(--text-primary)'
            }}>Lucky Lounge</span>

                        {/* Fairness Button */}
                        <Button type="text" icon={<SafetyCertificateOutlined />} className="fairness-btn" onClick={() => setFairnessModalOpen(true)}>{upstreamText("Fairness")}</Button>
                    </div>
                </div>
            </div>

            {/* Hot Bet Banner */}


            {/* Statistics Mini Window / Profit Chart */}
            {statsDrawerOpen && <div className="fixed-widget fade-in-scale" ref={widgetRef}>
                    <div className="widget-header" onMouseDown={handleDragStart}>
                        <div className="widget-title">
                            <LineChartOutlined style={{
              fontSize: 20,
              color: '#94a3b8'
            }} />
                            <span>{upstreamText("Live Stats")}</span>
                        </div>
                        <div className="widget-actions">
                            <Tooltip title={upstreamText("Reset Live Stats")} placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={e => e.stopPropagation()} onClick={() => setGameRecords([])}>
                                    <ReloadOutlined />
                                </button>
                            </Tooltip>
                            <button className="widget-btn-icon" onMouseDown={e => e.stopPropagation()} onClick={() => setStatsDrawerOpen(false)}>
                                <CloseOutlined />
                            </button>
                        </div>
                    </div>

                    <div className="widget-content">
                        {/* Profit Overview */}
                        <div className="profit-box">
                            <div className="profit-main">
                                <p className="label">{upstreamText("Profit")}</p>
                                <p className="value" style={{
                color: totalProfit >= 0 ? '#4ade80' : '#f87171'
              }}>
                                    ✦{totalProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="profit-divider"></div>
                            <div className="profit-stats">
                                <div className="stat-row">
                                    <p className="label">{upstreamText("Wins")}</p>
                                    <p className="value" style={{
                  color: '#4ade80'
                }}>{winsCount.toLocaleString()}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">{upstreamText("Losses")}</p>
                                    <p className="value" style={{
                  color: '#f87171'
                }}>{lossesCount.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Chart.js Container */}
                        <div className="chart-box" onMouseLeave={() => setHoveredProfitValue(null)}>
                            <p className="label">{upstreamText("Profit History")}</p>
                            {hoveredProfitValue !== null && <p className="hovered-value" style={{
              color: hoveredProfitValue >= 0 ? '#4ade80' : '#f87171'
            }}>
                                    {hoveredProfitValue >= 0 ? '' : '-'}✦{Math.abs(hoveredProfitValue).toFixed(2)}
                                </p>}
                            <div className="canvas-wrapper">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>}

            {/* History Window - sleek modern dashboard style */}
            <Modal title={<Space className="history-window-header-title">
                        <div className="icon-wrapper"><ThunderboltOutlined /></div>
                        <span>{upstreamText("Play History & Dashboard")}</span>
                    </Space>} centered footer={null} onCancel={() => setHistoryDrawerOpen(false)} open={historyDrawerOpen} width={460} rootClassName="crash-history-modal-portal mobile-game-modal" className="history-window box-modal-3d" closeIcon={<CloseOutlined style={{
        color: '#94a3b8'
      }} />}>
                <div className="history-window-content">
                    {/* Achievements */}
                    <div className="dashboard-section">
                        <div className="section-title">{upstreamText("Milestones")}</div>
                        <div className="achievements-row">
                            {(() => {
                const achievements = [{
                  id: 'first-drop',
                  title: upstreamText("First Drop"),
                  unlocked: gameRecords.length > 0,
                  icon: <StarOutlined />
                }, {
                  id: 'big-win',
                  title: upstreamText("Big Win 20×"),
                  unlocked: gameRecords.some(w => w.multiplier >= 20 && w.profit >= 0),
                  icon: <TrophyOutlined />
                }, {
                  id: 'hot-streak',
                  title: upstreamText("Hot streak 5+"),
                  unlocked: maxStreak >= 5,
                  icon: <FireOutlined />
                }];
                return achievements.map(a => <div key={a.id} className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}>
                                        <div className="achievement-icon">{a.icon}</div>
                                        <div className="achievement-title">{a.title}</div>
                                    </div>);
              })()}
                        </div>
                    </div>

                    {/* Streak timeline (last 20 results) */}
                    <div className="dashboard-section">
                        <div className="section-title">{upstreamText("Streak Timeline (Last 20)")}</div>
                        <div className="streak-timeline glass-panel">
                            {gameRecords.slice(-20).map((r, idx) => <div key={r.id || idx} className={`timeline-dot ${r.profit >= 0 ? 'win' : 'loss'}`} title={`Crash: ${r.multiplier.toFixed(2)}x ${r.cashedOutAt ? `• Cashed out: ${r.cashedOutAt.toFixed(2)}x` : ''}`} />)}
                        </div>
                    </div>

                    {/* History list */}
                    <div className="dashboard-section">
                        <div className="section-title">{upstreamText("Recent Transactions")}</div>
                        <div className="history-list">
                            {gameRecords.length === 0 ? <div className="empty-state">{upstreamText("No transaction history yet")}</div> : gameRecords.slice().reverse().map(r => {
                const isWin = r.profit >= 0;
                return <div key={r.id} className="history-card glass-panel">
                                            <div className="history-card-icon">
                                                <div className="ball-color-circle medium" style={{
                      background: isWin ? 'linear-gradient(135deg, var(--success), #26ad58)' : 'linear-gradient(135deg, #ff4d4f, #cf1322)'
                    }}>
                                                    {isWin ? <TrophyOutlined style={{
                        color: '#fff'
                      }} /> : <CloseOutlined style={{
                        color: '#fff'
                      }} />}
                                                </div>
                                            </div>
                                            <div className="history-card-info">
                                                <div className="history-card-name">{isWin ? upstreamText("Win") : upstreamText("Loss")}</div>
                                                <div className="history-card-multiplier" style={{
                      color: isWin ? 'var(--success)' : '#ff4d4f'
                    }}>
                                                    {r.cashedOutAt ? r.cashedOutAt.toFixed(2) : r.multiplier.toFixed(2)}×
                                                </div>
                                            </div>
                                            <div className={`history-card-profit ${isWin ? 'profit-up' : 'profit-down'}`}>
                                                {isWin ? '+' : '-'}✦{Math.abs(r.profit).toFixed(2)}
                                            </div>
                                        </div>;
              })}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Fairness Modal */}
            <Modal title={<Space>
                        <SafetyCertificateOutlined style={{
          color: 'var(--primary)'
        }} />
                        <span>{upstreamText("Provably Fair")}</span>
                    </Space>} open={fairnessModalOpen} onCancel={() => setFairnessModalOpen(false)} footer={null} width={480} rootClassName="crash-fairness-modal-portal mobile-game-modal" className="fairness-modal" centered><div className="fairness-header"><Title level={5}>{t('fairness')}</Title><Paragraph>{t('originals_server')}</Paragraph></div><div className="fairness-item"><Paragraph>{t('crash_fairness',{factor:number(model.returnFactor),rtp:number(model.returnFactor*100)})}</Paragraph><Paragraph>{t('rounding')}</Paragraph></div></Modal>
        </div><SourceAudioSettings open={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} enabled={soundEnabled} setEnabled={setSoundEnabled} /></>;
}
export default CrashGame;
