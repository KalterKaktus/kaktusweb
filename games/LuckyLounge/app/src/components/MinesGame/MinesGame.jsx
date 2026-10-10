import {roundChips,validBet} from '../../currency';
import BetValidation from '../BetValidation';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SettingOutlined, SafetyCertificateOutlined, SoundOutlined, TrophyOutlined, FireOutlined, LineChartOutlined, CloseOutlined, ReloadOutlined, RightOutlined, ExpandOutlined, FullscreenExitOutlined, CheckCircleOutlined, BugOutlined } from '@ant-design/icons';
import { Modal, Tooltip, Statistic, Row, Col, Space, Button, Typography, Tag, Divider, Input, InputNumber } from 'antd';
import Chart from 'chart.js/auto';
import MobileBetSheet from '../MobileBetSheet';
import './MinesGame.css';
import { useText, upstreamText } from '../../i18n';
import { audio } from '../../audio';
import { useOriginalMines } from '../originalModels';
import SourceAudioSettings from '../SourceAudioSettings';
const {
  Title,
  Text,
  Paragraph
} = Typography;
const HistoryIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>;
const StatsIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11.78l4.24-7.33 1.73 1-5.23 9.05-6.51-3.75L5.46 19H22v2H2V3h2v14.54L9.5 8z" />
    </svg>;
function MinesGame() {
  const {
    t,
    language, number
  } = useText();
  const model = useOriginalMines();
  const {
    isPlaying,
    betAmount,
    setBetAmount,
    minesCount,
    setMinesCount,
    revealedTiles,
    mineLocations,
    gameOverState,
    currentMultiplier,
    potentialWin,
    startGame,
    cashout,
    pickRandom,
    handleTileClick,
    balance,
    totalProfit,
    winsCount,
    lossesCount,
    winRecords,
    setWinRecords,
    setTotalProfit,
    setWinsCount,
    setLossesCount,
    pending,
    available,
    error
  } = model;
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(null);
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(audio.enabled);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [hoveredProfitValue, setHoveredProfitValue] = useState(null);
  const widgetRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({
    x: 0,
    y: 0
  });
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const profitHistoryRef = useRef([0]);
  const handleDragStart = e => {
    if (!widgetRef.current) return;
    isDragging.current = true;
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  const handleDrag = e => {
    if (!isDragging.current || !widgetRef.current) return;
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;

    // Boundaries
    const maxX = window.innerWidth - widgetRef.current.offsetWidth;
    const maxY = window.innerHeight - widgetRef.current.offsetHeight;
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    widgetRef.current.style.left = `${boundedX}px`;
    widgetRef.current.style.top = `${boundedY}px`;
    widgetRef.current.style.right = 'auto';
    widgetRef.current.style.bottom = 'auto';
  };
  const handleDragEnd = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  };
  useEffect(() => {
    if (!statsDrawerOpen || !chartCanvasRef.current) return;
    const WIN_COLOR = 'rgb(74, 222, 128)';
    const WIN_COLOR_FILL = 'rgba(74, 222, 128, 0.3)';
    const LOSS_COLOR = 'rgb(248, 113, 113)';
    const LOSS_COLOR_FILL = 'rgba(248, 113, 113, 0.3)';
    const X_AXIS_COLOR = '#2a3f4d';
    const POINT_HOVER_COLOR = '#fff';
    const profitHistory = profitHistoryRef.current.length > 0 ? profitHistoryRef.current : [0];
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
  const handleBetAmountChange = e => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0;
    setBetAmount(val);
  };
  const handleBetAmountHalf = () => setBetAmount(prev => Math.max(1,roundChips(prev/2)));
  const handleBetAmountDouble = () => setBetAmount(prev => prev * 2);
  const handleMinesChange = e => {
    const count = parseInt(e.target.value, 10);
    if (count >= 1 && count <= 24) {
      setMinesCount(count);
    }
  };
  const renderGrid = () => {
    const tiles = [];
    for (let i = 0; i < 25; i++) {
      const isRevealed = revealedTiles.includes(i);
      const isMine = mineLocations.includes(i);
      const isGameOver = !isPlaying && gameOverState;
      let statusClass = '';
      let content = null;
      if (isRevealed) {
        statusClass = `revealed ${isMine ? 'bomb-tile' : 'gem-tile'}`;
        content = isMine ? <>
                        <img src="/games/LuckyLounge/images/mines/bomb.svg" alt={upstreamText("Bomb")} className="reveal-anim" />
                        <img src="/games/LuckyLounge/images/mines/bomb_effect.gif" alt={upstreamText("Explosion")} className="bomb-effect" />
                    </> : <img src="/games/LuckyLounge/images/mines/diamond.svg" alt={upstreamText("Gem")} className="reveal-anim" />;
      } else if (isGameOver) {
        // Show remaining tiles semi-transparently
        statusClass = `revealed game-over-reveal`;
        content = isMine ? <img src="/games/LuckyLounge/images/mines/bomb.svg" alt={upstreamText("Bomb")} style={{
          filter: 'grayscale(100%) opacity(0.5)'
        }} /> : <img src="/games/LuckyLounge/images/mines/diamond.svg" alt={upstreamText("Gem")} style={{
          filter: 'grayscale(100%) opacity(0.5)'
        }} />;
      }
      tiles.push(<button key={i} disabled={!isPlaying || isRevealed || pending || !available} aria-label={t('mine_tile',{value:i+1})} className={`mine-tile ${statusClass} ${!isPlaying || isRevealed ? 'inactive' : ''}`} onClick={() => {
        if (!isPlaying || isRevealed) return;
        handleTileClick(i);
      }} onMouseEnter={() => setIsHovering(i)} onMouseLeave={() => setIsHovering(null)}>
                    <div className="mine-tile-inner">
                        {content}
                    </div>
                </button>);
    }
    return tiles;
  };
  useEffect(() => {
    audio.set(soundEnabled, audio.volume);
  }, [soundEnabled]);
  profitHistoryRef.current = [0, ...winRecords.map((_, i) => winRecords.slice(0, i + 1).reduce((a, b) => a + b, 0))];
  return <>{error && <div className="lucky-status" role="alert">{error}</div>}<div className="mines-game">
            <div className="game-container">
                {/* Sidebar Controls */}
                <MobileBetSheet title={upstreamText("Mines bet controls")} className="mines-bet-sheet">
                    <div className="mines-sidebar">
                    <div className="mines-sidebar-content">
                        <div className="mines-bet-panel">
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
                                    <InputNumber value={betAmount} onChange={setBetAmount} changeOnBlur={false} step={0.01} precision={2} decimalSeparator="," disabled={isPlaying} style={{
                      flex: 1
                    }} controls={false} formatter={v => `${v}`} parser={v=>v.replace(',','.')} addonBefore={<div className="dino-currency-icon">✦</div>} />
                                    <Button.Group className="dino-btn-group">
                                        <Button onClick={handleBetAmountHalf} disabled={isPlaying}>
                                            ½
                                        </Button>
                                        <Button onClick={handleBetAmountDouble} disabled={isPlaying}>
                                            2×
                                        </Button>
                                    </Button.Group>
                                </div>
                            </div>


                            <BetValidation value={betAmount} balance={balance} active={!isPlaying}/>
                            {/* Mines Selection */}
                            <div className="form-group mobile-sheet-secondary">
                                <label className="form-label">{upstreamText("Mines")}</label>
                                <div className="mines-select-wrapper">
                                    <select className="mines-select" value={minesCount} onChange={handleMinesChange} disabled={isPlaying}>
                                        {[...Array(24)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Gems Display */}
                            <div className="form-group mobile-sheet-secondary">
                                <label className="form-label">{upstreamText("Gems")}</label>
                                <div className="input-with-controls">
                                    <span className="mines-input">{25 - minesCount}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {!isPlaying ? <button className="btn-bet-mines" onClick={startGame} disabled={!validBet(betAmount) || betAmount>balance || pending || !available}>{upstreamText("Bet")}</button> : <>
                                    <button className="btn-bet-mines" onClick={cashout} disabled={revealedTiles.length === 0 || pending || !available}>{upstreamText("Cashout")}</button>
                                    <button className="btn-random-pick mobile-sheet-secondary" onClick={pickRandom} disabled={false || pending || !available}>{upstreamText("Random Pick")}</button>
                                </>}

                            {/* Total Profit Display (Updated real-time as you pick) */}
                            <div className="form-group mobile-sheet-secondary" style={{
                  marginTop: 'auto'
                }}>
                                <div className="form-header">
                                    <label className="form-label" style={{
                      margin: 0
                    }}>{upstreamText("Total Profit (")}{currentMultiplier.toFixed(2)}×)</label>
                                    <span style={{
                      color: revealedTiles.length > 0 ? 'var(--success)' : 'var(--text-secondary)'
                    }}>
                                        ✦{(potentialWin - betAmount).toFixed(2)}
                                    </span>
                                </div>
                                <div className="input-with-controls">
                                    <input type="text" className="mines-input" value={revealedTiles.length > 0 ? potentialWin.toFixed(2) : (betAmount ?? 0).toFixed(2)} readOnly />
                                    <div className="mines-input-addon">
                                        <div className="btc-icon-small">✦</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Left Sidebar Footer */}
                    <div className="sidebar-footer mobile-sheet-secondary">
                        <div className="footer-buttons">
                            <button className={`footer-btn ${statsDrawerOpen ? 'active' : ''}`} onClick={() => setStatsDrawerOpen(true)} title={upstreamText("Live Stats")}>
                                <StatsIcon />
                            </button>
                            <button className={`footer-btn ${historyModalOpen ? 'active' : ''}`} onClick={() => setHistoryModalOpen(true)} title={upstreamText("Play History & Dashboard")}>
                                <HistoryIcon />
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

                {/* Game Display Wrapper */}
                <div className="mines-display-wrapper">
                    <div className="mines-display">
                        <div className="mines-grid">
                            {renderGrid()}
                        </div>
                    </div>

                    {/* Debug Overlay */}


                    {/* Bottom Controls */}
                    <div className="game-controls">
                        <Space>
                            <Tooltip title={upstreamText("Settings")}>
                                <Button type="text" icon={<SettingOutlined />} className="control-btn" onClick={() => setAudioSettingsOpen(true)} />
                            </Tooltip>
                            <Tooltip title={isFullscreen ? upstreamText("Exit Fullscreen") : upstreamText("Fullscreen")}>
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

            <Modal title={<Space>
                        <SafetyCertificateOutlined style={{
          color: 'var(--primary)'
        }} />
                        <span>{upstreamText("Provably Fair")}</span>
                    </Space>} open={fairnessModalOpen} onCancel={() => setFairnessModalOpen(false)} footer={null} width={480} rootClassName="mines-fairness-modal-portal mobile-game-modal" className="fairness-modal box-modal-3d" centered styles={{
        content: {
          background: '#1a2c38',
          padding: 0
        }
      }}><div className="fairness-header"><Title level={5}>{t('fairness')}</Title><Paragraph>{t('originals_server')}</Paragraph></div><div className="fairness-item"><Paragraph>{t('mines_fairness',{factor:number(model.returnFactor),rtp:number(model.returnFactor*100)})}</Paragraph><Paragraph>{t('rounding')}</Paragraph></div></Modal>

            {/* Play History & Dashboard Modal */}
            <Modal title={null} open={historyModalOpen} onCancel={() => setHistoryModalOpen(false)} footer={null} width={700} centered closable={true} rootClassName="mines-history-modal-portal mobile-game-modal" className="box-modal-3d" closeIcon={<CloseOutlined />}>
                <div className="history-window-header-title">
                    <div className="icon-wrapper">
                        <HistoryIcon />
                    </div>{upstreamText("Dashboard & Play History")}</div>

                <div className="history-window-content" style={{
          marginTop: '24px'
        }}>

                    <div className="dashboard-section">
                        <h3 className="section-title">{upstreamText("Lifetime Stats")}</h3>
                        <div className="glass-panel">
                            <Row gutter={[24, 24]}>
                                <Col span={8}>
                                    <Statistic title={<span style={{
                    color: '#94a3b8'
                  }}>{upstreamText("Total Profit")}</span>} value={totalProfit} precision={2} prefix="✦" valueStyle={{
                    color: totalProfit >= 0 ? '#4ade80' : '#f87171',
                    fontWeight: 'bold'
                  }} />
                                </Col>
                                <Col span={8}>
                                    <Statistic title={<span style={{
                    color: '#94a3b8'
                  }}>{upstreamText("Total Bets")}</span>} value={winsCount + lossesCount} valueStyle={{
                    color: '#f8fafc',
                    fontWeight: 'bold'
                  }} />
                                </Col>
                                <Col span={8}>
                                    <Statistic title={<span style={{
                    color: '#94a3b8'
                  }}>{upstreamText("Win Rate")}</span>} value={winsCount + lossesCount > 0 ? winsCount / (winsCount + lossesCount) * 100 : 0} precision={1} suffix="%" valueStyle={{
                    color: '#fbbf24',
                    fontWeight: 'bold'
                  }} />
                                </Col>
                            </Row>
                        </div>
                    </div>

                    <div className="dashboard-section">
                        <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
                            <h3 className="section-title" style={{
                margin: 0
              }}>{upstreamText("Recent Plays")}</h3>
                            <Tooltip title={upstreamText("Reset stats")}>
                                <Button type="text" icon={<ReloadOutlined style={{
                  color: '#94a3b8'
                }} />} onClick={() => {
                  setWinRecords([]);
                  setWinsCount(0);
                  setLossesCount(0);
                  setTotalProfit(0);
                  profitHistoryRef.current = [0];
                }} />
                            </Tooltip>
                        </div>
                        <div className="glass-panel" style={{
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
                            {winRecords.length === 0 ? <div style={{
                textAlign: 'center',
                padding: '40px 0',
                color: '#64748b'
              }}>
                                    <HistoryIcon style={{
                  fontSize: 48,
                  opacity: 0.2,
                  marginBottom: 16
                }} />
                                    <p>{upstreamText("No recent plays. Place a bet to start!")}</p>
                                </div> : <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                                    {[...winRecords].reverse().map((record, i) => <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px'
                }}>
                                            <span style={{
                    color: '#94a3b8',
                    fontSize: '13px'
                  }}>
                                                {record > 0 ? upstreamText("Win") : upstreamText("Loss")}
                                            </span>
                                            <span style={{
                    color: record > 0 ? '#4ade80' : '#f87171',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    fontSize: '15px'
                  }}>
                                                {record > 0 ? '+' : ''}✦{record.toFixed(2)}
                                            </span>
                                        </div>)}
                                </div>}
                        </div>
                    </div>
                </div>
            </Modal>

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
                                <button className="widget-btn-icon" onMouseDown={e => e.stopPropagation()} onClick={() => {
                setWinRecords([]);
                setWinsCount(0);
                setLossesCount(0);
                setTotalProfit(0);
                profitHistoryRef.current = [0];
              }}>
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
                                    {totalProfit >= 0 ? '+' : ''}✦{totalProfit.toFixed(2)}
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
                                    {hoveredProfitValue >= 0 ? '+' : ''}✦{hoveredProfitValue.toFixed(2)}
                                </p>}
                            <div className="canvas-wrapper">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>}
        </div><SourceAudioSettings open={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} enabled={soundEnabled} setEnabled={setSoundEnabled} /></>;
}
export default MinesGame;
