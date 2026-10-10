import {roundChips,validBet} from '../../currency';
import BetValidation from '../BetValidation';
// DinoGame - React Wrapper integrating original Phaser game with betting
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Space, Tooltip, Typography, Modal, Drawer, Statistic, Row, Col, Card, Tag, App, Progress, InputNumber, Radio, Input, Divider, Popover, Switch } from 'antd';
import { SettingOutlined, ExpandOutlined, BarChartOutlined, SafetyCertificateOutlined, SoundOutlined, FullscreenExitOutlined, TrophyOutlined, ThunderboltOutlined, CheckCircleOutlined, FireOutlined, StarOutlined, PlayCircleOutlined, StopOutlined, SyncOutlined, BugOutlined, CloseOutlined, BulbOutlined, LineChartOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import Chart from 'chart.js/auto';

// Import game config and scenes from original source
import MobileBetSheet from '../MobileBetSheet';
import './DinoGame.css';
import { useText, upstreamText } from '../../i18n';
import { audio } from '../../audio';
import { useOriginalDino } from '../originalDinoModel';
import SourceAudioSettings from '../SourceAudioSettings';
const {
  Text,
  Title,
  Paragraph
} = Typography;
const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    survivalChance: 0.85,
    multiplierPerJump: 1.15,
    color: '#35d06f'
  },
  medium: {
    label: 'Medium',
    survivalChance: 0.65,
    multiplierPerJump: 1.40,
    color: '#f7931a'
  },
  hard: {
    label: 'Hard',
    survivalChance: 0.45,
    multiplierPerJump: 1.90,
    color: '#ed4245'
  }
};
function DinoGame() {
  const {
    t,
    language, number
  } = useText();
  const model = useOriginalDino();
  const {
    betAmount,
    setBetAmount,
    difficulty,
    setDifficulty,
    gamePhase,
    obstaclesCleared,
    currentMultiplier,
    potentialWin,
    lastResult,
    gamesPlayed,
    highScore,
    totalWagered,
    totalProfit,
    winRecords,
    setWinRecords,
    gameContainerRef,
    phaserContainerRef,
    gameRef,
    gameSceneRef,
    placeBet,
    handleJump,
    cashOut,
    getMultiplierForCleared,
    isPlaying,
    canBet,
    ready,
    balance,
    pending,
    available,
    error
  } = model;
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(audio.enabled);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [hoveredProfitValue, setHoveredProfitValue] = useState(null);
  const widgetRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const profitHistoryRef = useRef([0]);
  const isDragging = useRef(false);
  const dragOffset = useRef({
    x: 0,
    y: 0
  });
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      gameContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);
  useEffect(() => {
    if (!statsDrawerOpen || !chartCanvasRef.current) return;
    const WIN_COLOR = 'rgb(74, 222, 128)';
    const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
    const LOSS_COLOR = 'rgb(248, 113, 113)';
    const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
    const X_AXIS_COLOR = '#2a3f4d';
    const POINT_HOVER_COLOR = '#fff';
    const profitHistory = [0];
    let runningTotal = 0;
    winRecords.forEach(profit => {
      runningTotal += profit;
      profitHistory.push(runningTotal);
    });
    profitHistoryRef.current = profitHistory;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = Array(profitHistory.length).fill(0);
      chartInstanceRef.current.data.datasets[0].data = profitHistory;
      chartInstanceRef.current.update();
    } else {
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
                if (y1 === 0) return y0 < 0 ? LOSS_COLOR : WIN_COLOR;
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
              display: false
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
              const val = profitHistoryRef.current[idx];
              setHoveredProfitValue(val !== undefined ? val : null);
            } else {
              setHoveredProfitValue(null);
            }
          }
        }
      });
    }
  }, [statsDrawerOpen, winRecords]);
  const handleDragStart = useCallback(e => {
    if (!widgetRef.current) return;
    isDragging.current = true;
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    const handleMouseMove = moveEvt => {
      if (!isDragging.current || !widgetRef.current) return;
      const newX = moveEvt.clientX - dragOffset.current.x;
      const newY = moveEvt.clientY - dragOffset.current.y;
      // Clamp to viewport
      const maxX = window.innerWidth - widgetRef.current.offsetWidth;
      const maxY = window.innerHeight - widgetRef.current.offsetHeight;
      widgetRef.current.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      widgetRef.current.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
      widgetRef.current.style.right = 'auto';
      widgetRef.current.style.bottom = 'auto';
      widgetRef.current.style.transform = 'none'; // Clear any residual transform
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);
  useEffect(() => {
    audio.set(soundEnabled, audio.volume);
  }, [soundEnabled]);
  const diffConfig = {
    ...DIFFICULTIES[difficulty],
    label: t('difficulty_' + difficulty)
  };
  const winsCount = winRecords.filter(r => r >= 0).length,
    lossesCount = winRecords.filter(r => r < 0).length;
  // Phaser emit returns a boolean; React effects may only return cleanup functions.
  useEffect(() => { gameSceneRef.current?.events.emit('FORCE_DARK_MODE', isDarkMode); }, [isDarkMode, ready]);
  return <>{error && <div className="lucky-status" role="alert">{error}</div>}<div className="dino-game-page" ref={gameContainerRef}>
            <div className="dino-main">
                <div className="dino-container">
                    {/* Betting Sidebar */}
                    <MobileBetSheet title={upstreamText("Dino bet controls")} className={`dino-bet-sheet ${isPlaying?'is-playing':''}`} collapseOn={gamePhase === 'running' || gamePhase === 'waiting'}>
                        <div className="dino-sidebar">
                        {/* Bet Mode Tabs */}
                        <div className="bet-mode-tabs">
                            <button className="bet-mode-tab active">{upstreamText("Manual")}</button>
                            <button className="bet-mode-tab" disabled>{upstreamText("Auto")}</button>
                        </div>

                        {/* Bet Amount */}
                        <div className="form-group">
                            <div className="form-header">
                                <label className="form-label" style={{
                    margin: 0
                  }}>{upstreamText("Bet Amount")}</label>
                                <Text type="secondary" style={{
                    margin: 0
                  }}>✦{(betAmount ?? 0).toFixed(2)}</Text>
                            </div>
                            <div className="input-row">
                                <InputNumber value={betAmount} onChange={setBetAmount} changeOnBlur={false} step={0.01} precision={2} decimalSeparator="," disabled={!canBet} style={{
                    flex: 1
                  }} controls={false} formatter={v => `${v}`} parser={v=>v.replace(',','.')} addonBefore={<div className="dino-currency-icon">✦</div>} />
                                <Button.Group className="dino-btn-group">
                                    <Button onClick={() => setBetAmount(prev => Math.max(1,roundChips(Number(prev||1)/2)))} disabled={!canBet}>
                                        ½
                                    </Button>
                                    <Button onClick={() => setBetAmount(prev => Math.min(balance, parseFloat((Number(prev || 1) * 2).toFixed(2))))} disabled={!canBet}>
                                        2×
                                    </Button>
                                </Button.Group>
                            </div>
                            <BetValidation value={betAmount} balance={balance} active={canBet}/>
                        </div>

                        {/* Difficulty Selector */}
                        <div className="form-group difficulty-section">
                            <div className="form-header" style={{
                  marginBottom: 12
                }}>
                                <label className="form-label" style={{
                    margin: 0
                  }}>{upstreamText("Difficulty")}</label>
                                <div className="survive-badge" style={{
                    '--diff-color': diffConfig.color
                  }}>
                                    <div className="survive-indicator"></div>
                                    {Math.round(diffConfig.survivalChance * 100)}{upstreamText("% Survive")}</div>
                            </div>
                            <div className="difficulty-tabs">
                                {Object.entries(DIFFICULTIES).map(([key, val]) => <button key={key} className={`diff-tab ${difficulty === key ? 'active' : ''}`} onClick={() => setDifficulty(key)} disabled={!canBet} style={{
                    '--diff-color': val.color
                  }}>
                                        {t('difficulty_'+key)}
                                    </button>)}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {canBet && <button className="bet-button" onClick={placeBet} disabled={!validBet(betAmount) || betAmount > balance || pending || !available || !ready}>
                                <PlayCircleOutlined /> {gamePhase === 'idle' ? upstreamText("Place Bet") : upstreamText("Play Again")}
                            </button>}

                        {(gamePhase === 'running' || gamePhase === 'waiting') && <div className="jump-decision">
                                <button className="bet-button jump-btn" style={{
                  marginBottom: '12px'
                }} onClick={handleJump} disabled={gamePhase !== 'waiting' || pending || !available || !ready}>
                                    <div>
                                        <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                                            <ThunderboltOutlined />{upstreamText("JUMP!")}</div>
                                        <div style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: gamePhase === 'waiting' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                      textTransform: 'none',
                      marginTop: '4px'
                    }}>{upstreamText("Risk for")}{getMultiplierForCleared(obstaclesCleared + 1).toFixed(2)}×
                                        </div>
                                    </div>
                                </button>
                                <button className="bet-button" onClick={cashOut} disabled={!(obstaclesCleared > 0 && (gamePhase === 'waiting' || gamePhase === 'running')) || pending || !available || !ready}>
                                    <TrophyOutlined />{upstreamText("Cash Out ✦")}{(betAmount * currentMultiplier).toFixed(2)}
                                </button>
                            </div>}

                        {/* Current Status Card */}
                        {isPlaying && <div className="last-win-card current">
                                <div className="last-win-header">
                                    <FireOutlined className="fire-icon" />
                                    <span>{upstreamText("Current Run")}</span>
                                </div>
                                <div className="last-win-multiplier" style={{
                  '--run-color': diffConfig.color
                }}>
                                    {currentMultiplier.toFixed(2)}×
                                </div>
                                <div className="last-win-amount">
                                    +✦{(betAmount * currentMultiplier).toFixed(2)}
                                </div>
                                <div className="last-win-score">{upstreamText("Cleared")}{obstaclesCleared}{upstreamText("obstacles")}</div>
                            </div>}



                        {/* Last Result Card */}
                        {lastResult && <div className={`last-win-card mobile-sheet-secondary ${lastResult.type === 'loss' ? 'lost' : 'won'}`}>
                                <div className="last-win-header">
                                    <TrophyOutlined />
                                    <span>{upstreamText("Last Game")}</span>
                                </div>
                                {lastResult.type === 'loss' ? <>
                                        <div className="last-win-result lost">{upstreamText("💀 Crashed!")}</div>
                                        <div className="last-win-score">{upstreamText("Cleared")}{lastResult.obstaclesCleared}{upstreamText("obstacles")}</div>
                                    </> : <>
                                        <div className="last-win-multiplier">{lastResult.multiplier.toFixed(2)}×</div>
                                        <div className="last-win-amount">+✦{lastResult.amount.toFixed(2)}</div>
                                        <div className="last-win-score">{upstreamText("Cleared")}{lastResult.obstaclesCleared}{upstreamText("obstacles")}</div>
                                    </>}
                            </div>}

                        {/* Footer */}
                        <div className="sidebar-footer mobile-sheet-secondary">
                            <Tooltip title={upstreamText("Live Stats")}>
                                <Button type="text" icon={<LineChartOutlined />} className="footer-btn" onClick={() => setStatsDrawerOpen(true)} />
                            </Tooltip>
                            <Tooltip title={upstreamText("Dashboard")}>
                                <Button type="text" icon={<BarChartOutlined />} className="footer-btn" onClick={() => setHistoryModalOpen(true)} />
                            </Tooltip>
                            <Tooltip title={upstreamText("Fairness")}>
                                <Button type="text" icon={<SafetyCertificateOutlined />} className="footer-btn" onClick={() => setFairnessModalOpen(true)} />
                            </Tooltip>
                        </div>
                        </div>
                    </MobileBetSheet>

                    {/* Game Area */}
                    <div className="dino-game-area">
                        <div className="game-hud">
                            <div className="hud-item score">
                                <span className="hud-label">{upstreamText("Jumps")}</span>
                                <span className="hud-value">{obstaclesCleared}</span>
                            </div>
                            <div className="hud-item highscore">
                                <span className="hud-label">{upstreamText("Best")}</span>
                                <span className="hud-value">{highScore}</span>
                            </div>
                            {isPlaying && <div className="hud-item multiplier">
                                    <span className="hud-value multiplier-glow" style={{
                  color: diffConfig.color
                }}>
                                        {currentMultiplier.toFixed(2)}×
                                    </span>
                                </div>}
                        </div>

                        {/* Phaser Game Container */}
                        <div ref={phaserContainerRef} className="phaser-container" />

                        {gamePhase === 'idle' && <div className="bet-overlay">
                                <div className="bet-overlay-content">
                                    <div className="dino-icon">🦖</div>
                                    <div className="overlay-title">{upstreamText("Dino Gamble")}</div>
                                    <div className="overlay-subtitle">{upstreamText("Place your bet to start the run!")}</div>
                                </div>
                            </div>}

                        {gamePhase === 'waiting' && <div className="obstacle-warning">
                                <div className="warning-pulse">{upstreamText("⚠️ OBSTACLE AHEAD!")}</div>
                                <div className="warning-sub">{upstreamText("Jump or Cash Out?")}</div>
                            </div>}

                        {/* Debug Overlay */}


                        {/* Bottom Controls */}
                        <div className="game-controls">
                            <Space>
                                <Popover content={<div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '4px 8px'
                }}>
                                            <BulbOutlined style={{
                    fontSize: 16,
                    color: isDarkMode ? '#f7931a' : '#8c9bac'
                  }} />
                                            <span style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 500
                  }}>{upstreamText("Canvas Dark Mode")}</span>
                                            <Switch size="small" checked={isDarkMode} onChange={setIsDarkMode} />
                                        </div>} title={null} trigger="click" placement="topLeft" overlayInnerStyle={{
                  background: '#1a2c38',
                  border: '1px solid #2a3f4d',
                  borderRadius: 8
                }}>
                                    <Tooltip title={upstreamText("Settings")}>
                                        <Button type="text" icon={<SettingOutlined />} className="control-btn" onClick={() => setAudioSettingsOpen(true)} />
                                    </Tooltip>
                                </Popover>
                                <Tooltip title={upstreamText("Fullscreen")}>
                                    <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <ExpandOutlined />} className="control-btn" onClick={toggleFullscreen} />
                                </Tooltip>
                                <Tooltip title={soundEnabled ? upstreamText("Mute") : upstreamText("Unmute")}>
                                    <Button type="text" icon={<SoundOutlined />} className={`control-btn ${!soundEnabled ? 'muted' : ''}`} onClick={() => setSoundEnabled(!soundEnabled)} />
                                </Tooltip>

                            </Space>
                            <span className="logo" style={{
                color: 'var(--text-primary)'
              }}>Lucky Lounge</span>
                            <Button type="text" icon={<SafetyCertificateOutlined />} className="fairness-btn" onClick={() => setFairnessModalOpen(true)}>{upstreamText("Fairness")}</Button>
                        </div>
                    </div>
                </div>

                {/* Multiplier Track */}
                <div className="milestones-bar">
                    <div className="milestones-header">
                        <ThunderboltOutlined />
                        <span>{upstreamText("Multiplier Track (")}{t('difficulty_'+difficulty)})</span>
                    </div>
                    <div className="milestones-list">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(jump => {
              const mult = getMultiplierForCleared(jump);
              return <Tag key={jump} className={`milestone-tag ${obstaclesCleared >= jump ? 'achieved' : ''} ${obstaclesCleared + 1 === jump ? 'next' : ''}`}>{upstreamText("Jump")}{jump}: {mult.toFixed(2)}×
                                </Tag>;
            })}
                    </div>
                </div>
            </div>

            {/* Live Stats Draggable Widget */}
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
                                <button className="widget-btn-icon" onMouseDown={e => e.stopPropagation()} onClick={() => setWinRecords([])}>
                                    <ReloadOutlined />
                                </button>
                            </Tooltip>
                            <Tooltip title={upstreamText("View History")} placement="topRight">
                                <button className="widget-btn-icon" onMouseDown={e => e.stopPropagation()} onClick={() => {
                setHistoryModalOpen(true);
                setStatsDrawerOpen(false);
              }}>
                                    <RightOutlined />
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

            {/* Statistics Dashboard */}
            <Modal title={<Space className="history-window-header-title">
                        <div className="icon-wrapper"><ThunderboltOutlined /></div>
                        <span>{upstreamText("Play History & Dashboard")}</span>
                    </Space>} centered footer={null} onCancel={() => setHistoryModalOpen(false)} open={historyModalOpen} width={460} rootClassName="dino-history-modal-portal mobile-game-modal" className="history-window box-modal-3d" closeIcon={<CloseOutlined style={{
        color: '#94a3b8'
      }} />}>
                <div className="history-window-content">
                    {/* Achievements Summary Style */}
                    <div className="dashboard-section">
                        <div className="section-title">{upstreamText("Lifetime Stats")}</div>
                        <div className="profit-box" style={{
              background: 'transparent',
              padding: 0,
              border: 'none'
            }}>
                            <div className="profit-main" style={{
                marginBottom: 12
              }}>
                                <p className="label">{upstreamText("Total Profit")}</p>
                                <p className="value" style={{
                  color: totalProfit >= 0 ? '#4ade80' : '#f87171'
                }}>
                                    {totalProfit >= 0 ? '+' : ''}✦{totalProfit.toFixed(2)}
                                </p>
                            </div>
                            <div className="profit-divider" style={{
                background: 'rgba(255,255,255,0.05)'
              }}></div>
                            <div className="profit-stats" style={{
                marginTop: 12
              }}>
                                <div className="stat-row">
                                    <p className="label">{upstreamText("Total Wagered")}</p>
                                    <p className="value" style={{
                    color: '#00b4d8'
                  }}>✦{totalWagered.toFixed(2)}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">{upstreamText("Best Run")}</p>
                                    <p className="value" style={{
                    color: '#ffd700'
                  }}>{highScore}{upstreamText("jumps")}</p>
                                </div>
                                <div className="stat-row">
                                    <p className="label">{upstreamText("Games Played")}</p>
                                    <p className="value" style={{
                    color: '#fff'
                  }}>{gamesPlayed.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-section">
                        <div className="section-title">{upstreamText("Achievements")}</div>
                        <div className="achievements-row">
                            <div className={`achievement-badge ${gamesPlayed > 0 ? 'unlocked' : 'locked'}`}>
                                <div className="achievement-icon"><StarOutlined /></div>
                                <div className="achievement-title">{upstreamText("First Run")}</div>
                            </div>
                            <div className={`achievement-badge ${highScore >= 5 ? 'unlocked' : 'locked'}`}>
                                <div className="achievement-icon"><FireOutlined /></div>
                                <div className="achievement-title">{upstreamText("Survivor 5")}</div>
                            </div>
                            <div className={`achievement-badge ${totalProfit > 0 ? 'unlocked' : 'locked'}`}>
                                <div className="achievement-icon"><TrophyOutlined /></div>
                                <div className="achievement-title">{upstreamText("In Profit")}</div>
                            </div>
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
                    </Space>} open={fairnessModalOpen} onCancel={() => setFairnessModalOpen(false)} footer={null} width={480} rootClassName="dino-fairness-modal-portal mobile-game-modal" className="fairness-modal box-modal-3d" centered styles={{
        content: {
          background: '#1a2c38',
          padding: 0
        }
      }}><div className="fairness-header"><Title level={5}>{t('fairness')}</Title><Paragraph>{t('originals_server')}</Paragraph></div><div className="fairness-item"><Paragraph>{t('dino_fairness',{factor:number(model.returnFactor),rtp:number(model.returnFactor*100)})}</Paragraph><Paragraph>{t('rounding')}</Paragraph></div></Modal>
        </div><SourceAudioSettings open={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} enabled={soundEnabled} setEnabled={setSoundEnabled} /></>;
}
export default DinoGame;
