import {useText,upstreamText} from '../../i18n';
import { useState, useEffect, useRef } from 'react';
import { Typography } from 'antd';
const {
  Text
} = Typography;
function PlayerResults({
  cashouts
}) {
  const [visibleCashouts, setVisibleCashouts] = useState([]);
  const seen=useRef(new Set());
  const signature=cashouts.map(c=>c.id).join(',');

  // Add new cashouts and remove old ones
  useEffect(() => {
    const added=cashouts.filter(c=>!seen.current.has(c.id)).map(c=>{seen.current.add(c.id);return {...c,expires:(Date.parse(c.at)||Date.now())+10000};});
    if(added.length)setVisibleCashouts(prev=>[...prev,...added].slice(-5));
    while(seen.current.size>500)seen.current.delete(seen.current.values().next().value);
  }, [signature]);
  useEffect(()=>{const timer=setInterval(()=>setVisibleCashouts(prev=>prev.filter(c=>c.expires>Date.now())),1000);return()=>clearInterval(timer);},[]);
  if (visibleCashouts.length === 0) return null;
  return <div className="player-results">
            {visibleCashouts.map((cashout, index) => <div key={cashout.id} className="player-result-item" style={{
      animationDelay: `${index * 0.1}s`,
      top: `${80 + index * 45}px`
    }}>
                    <Text className="result-name">{cashout.name}</Text>
                    <span className="currency-badge" style={{
        background: cashout.currency.color
      }}>
                        {cashout.currency.symbol}
                    </span>
                    <Text className="result-amount" style={{
        color: 'var(--success)'
      }}>
                        {cashout.amount}
                    </Text>
                </div>)}
        </div>;
}
export default PlayerResults;
