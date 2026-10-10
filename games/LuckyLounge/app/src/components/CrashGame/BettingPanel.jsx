import {roundChips,validBet} from '../../currency';
import {useText,upstreamText} from '../../i18n';
import { useState, useEffect } from 'react';
import { InputNumber, Button, Typography, Card, Switch, Tooltip, Slider } from 'antd';
import { ThunderboltOutlined, QuestionCircleOutlined } from '@ant-design/icons';
const {
  Text
} = Typography;
function BettingPanel({
  phase,
  betPlaced,
  multiplier,
  onBet,
  onCashout,
  unavailable,
  pending,
  balance,
  stake,
  committedAuto
}) {
  const {t}=useText();
  const [betAmount, setBetAmount] = useState(1);
  const [cashoutAt, setCashoutAt] = useState(2.00);
  const [autoCashout, setAutoCashout] = useState(true);
  useEffect(()=>{if(!betPlaced)return;setBetAmount(stake);setAutoCashout(committedAuto!==null);if(committedAuto!==null)setCashoutAt(committedAuto);},[betPlaced,stake,committedAuto]);

  // Calculate profit
  const profit = betAmount * (cashoutAt - 1);

  // Auto Cashout Logic

  const handleBetClick = () => {
    if (!betPlaced || phase === 'waiting') {
      if (betAmount > 0) {
        onBet(betAmount, autoCashout ? cashoutAt : null);
      }
    } else if (phase === 'running' && betPlaced) {
      onCashout();
    }
  };
  const getButtonText = () => {
    if (phase === 'waiting') {
      return betPlaced ? upstreamText('Cancel Bet') : upstreamText('Place Bet');
    }
    if (phase === 'running' && betPlaced) {
      return upstreamText('Cash Out') + ' ✦' + (betAmount * multiplier).toFixed(2);
    }
    if(phase==='running')return t('crash_next');
    if(phase==='crashed')return t('crash_results');
    return upstreamText('Place Bet');
  };
  const getButtonClass = () => {
    if (phase === 'running' && betPlaced) return 'bet-button cashout-btn';
    return 'bet-button';
  };
  return <div className="betting-panel-3d">
            <div className="bet-form">
                    {/* Bet Amount */}
                    <div className="form-group">
                        <div className="form-header">
                            <label className="form-label" style={{
            margin: 0
          }}>{upstreamText("Bet Amount")}</label>
                            <Text type="secondary" style={{
            margin: 0
          }}>✦{Number(betAmount || 0).toFixed(2)}</Text>
                        </div>
                        <div className="input-row">
                            <InputNumber disabled={betPlaced} value={betAmount} onChange={v => setBetAmount(Math.max(1, Math.min(100000, roundChips(Number(v) || 1))))} min={1} step={0.01} precision={2} decimalSeparator="," addonBefore={<div className="btc-icon" style={{
            background: 'linear-gradient(135deg, #f7931a, #ffb347)'
          }}>✦</div>} controls={false} formatter={v => `${v}`} parser={v=>v.replace(',','.')} />
                            <Button.Group>
                                <Button disabled={betPlaced || pending} onClick={() => setBetAmount(prev => Math.max(1, roundChips(prev / 2)))}>½</Button>
                                <Button disabled={betPlaced || pending} onClick={() => setBetAmount(prev => Math.min(100000,prev * 2))}>2×</Button>
                            </Button.Group>
                        </div>
                    </div>

                    {/* Cashout At */}
                    <div className="form-group mobile-sheet-secondary">
                        <div className="form-header">
                            <label className="form-label" style={{
            margin: 0,
            display: 'flex',
            alignItems: 'center'
          }}>{upstreamText("Auto Cashout")}<Tooltip title={upstreamText("Auto cashout when multiplier reaches this value")}>
                                    <QuestionCircleOutlined style={{
                marginLeft: 6,
                cursor: 'pointer',
                color: '#b1b6c6'
              }} />
                                </Tooltip>
                            </label>
                            <Switch size="small" checked={autoCashout} disabled={betPlaced} onChange={setAutoCashout} className="crash-switch" />
                        </div>
                        <InputNumber value={cashoutAt} onChange={v=>setCashoutAt(Math.max(1.01,Math.min(1000,roundChips(Number(v)||2))))} min={1.01} max={1000} step={0.1} precision={2} decimalSeparator="," parser={v=>v.replace(',','.')} disabled={!autoCashout || betPlaced} style={{
          width: '100%'
        }} addonAfter={<span style={{
          color: '#fff',
          fontSize: 14,
          fontWeight: 700
        }}>×</span>} />
                    </div>

                    {/* Profit Display - 3D Card Style */}
                    <div className="profit-card-3d mobile-sheet-secondary">
                        <div className="form-header" style={{
          marginBottom: 4
        }}>
                            <label className="form-label" style={{
            margin: 0
          }}>{upstreamText("Profit on Win")}</label>
                            <Text type="secondary" style={{
            margin: 0
          }}>✦{profit.toFixed(2)}</Text>
                        </div>
                        <Text strong style={{
          color: 'var(--success)',
          fontSize: 16,
          fontFamily: "'Courier New', monospace"
        }}>
                            +✦{profit.toFixed(2)}
                        </Text>
                    </div>

                    {/* Bet Button */}
                    <button onClick={handleBetClick} className={getButtonClass()} disabled={pending || unavailable || !betPlaced && (!validBet(betAmount) || betAmount>balance) || !(phase === 'waiting' || phase === 'running' && betPlaced)}>
                        <ThunderboltOutlined style={{
          marginRight: 6
        }} />
                        {getButtonText()}
                    </button>
                </div>
        </div>;
}
export default BettingPanel;
