import {useText,upstreamText} from '../../i18n';
import { useState, useEffect, useRef } from 'react';
import { Card, Typography, Space, Badge, Collapse, Avatar } from 'antd';
import { UserOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
const {
  Text
} = Typography;

function PlayerBets({
  players=[],
  playerCount=0,
  totalBet=0
}) {
  const {t,number}=useText();
  const [expanded, setExpanded] = useState(true);
  return <div className="player-bets-panel">
            {/* Header */}
            <div className="player-bets-header" onClick={() => setExpanded(!expanded)}>
                <Space>
                    <Badge status="processing" color="var(--success)" />
                    <UserOutlined />
                    <Text strong>{number(playerCount)}</Text><Text type="secondary">{t('crash_bets')}</Text>
                </Space>
                <Space>
                    <span className="currency-badge usdt">✦</span>
                    <Text strong>{number(totalBet,{minimumFractionDigits:2,maximumFractionDigits:2})}</Text>
                    {expanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
                </Space>
            </div>

            {/* Player List */}
            {expanded && <div className="player-bets-list">
                    {players.length===0&&<Text type="secondary">{t('crash_no_bets')}</Text>}
                    {players.map((player, i) => <div key={player.id} className={`player-bet-row ${player.status==='won' ? 'cashed-out' : player.status==='lost' ? 'lost' : ''}`}>
                            <div className="player-info">
                                {player.isHidden ? <Text type="secondary" className="hidden-name">
                                        <UserOutlined />{upstreamText("Hidden")}</Text> : <Text className="player-name">{player.name}</Text>}
                                {player.cashoutAt && player.profit && <Text className="cashout-mult" type="success">
                                        {player.cashoutAt}×
                                    </Text>}
                                {player.cashoutAt && !player.profit && <Text className="cashout-mult" type="secondary">
                                        -
                                    </Text>}
                            </div>
                            <div className="bet-amount">
                                <span className="currency-badge small" style={{
            background: player.currency.color
          }}>
                                    {player.currency.symbol}
                                </span>
                                <Text className={player.status==='lost' ? 'loss' : player.profit ? 'profit' : ''}>
                                    {player.status==='lost' ? '−'+number(player.amount,{minimumFractionDigits:2,maximumFractionDigits:2}) : player.profit || number(player.amount,{minimumFractionDigits:2,maximumFractionDigits:2})}
                                </Text>
                            </div>
                        </div>)}
                </div>}
        </div>;
}
export default PlayerBets;
