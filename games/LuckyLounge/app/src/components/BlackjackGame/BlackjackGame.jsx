import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Button,InputNumber,Modal,Tooltip} from 'antd';
import {SoundOutlined,SettingOutlined,SafetyCertificateOutlined,PlusOutlined,StopOutlined,ThunderboltOutlined} from '@ant-design/icons';
import {useText} from '../../i18n';
import {roundChips,validBet} from '../../currency';
import {audio} from '../../audio';
import BetValidation from '../BetValidation';
import SourceAudioSettings from '../SourceAudioSettings';
import PlayingCard,{CardBack} from './PlayingCard';
import BlackjackFeed from './BlackjackFeed';
import useBlackjack from './useBlackjack';
import './BlackjackGame.css';

function Hand({cards=[],total,soft,label,dealer=false,winning=false}){
 const {t}=useText();
 return <div className={`bj-hand ${dealer?'bj-dealer':'bj-player'} ${winning?'is-winning':''}`}><div className="bj-hand-label"><span>{label}</span>{cards.some(card=>!card.hidden)&&<strong className={total>21?'is-bust':''}>{total}{soft&&<small>{t('blackjack.soft')}</small>}</strong>}</div><div className="bj-hand-cards" style={cards.length>6?{'--card-width':`${Math.max(36,Math.min(64,520/cards.length))}px`}:undefined}>
  {cards.length?cards.map((card,index)=><PlayingCard key={index} card={card} index={index} count={cards.length} deal/>):<div className="bj-hand-empty"><span>♠</span><span>♦</span></div>}
 </div></div>;
}
export default function BlackjackGame(){
 const model=useBlackjack(),{t,chips}=useText();
 const {available,balance,round,shown,active,pending,animating,resultShown,error,run}=model;
 const [stake,setStake]=useState(1),[rulesOpen,setRulesOpen]=useState(false),[audioOpen,setAudioOpen]=useState(false),[sound,setSound]=useState(audio.enabled);
 const valid=validBet(stake)&&stake<=balance,win=resultShown&&['blackjack','win'].includes(shown.outcome),net=round?Number(round.payout)-Number(round.stake):0;
 const changeStake=factor=>setStake(roundChips(Math.min(100000,Math.max(1,(stake??1)*factor))));
 const doubleEnough=round&&balance>=Number(round.state.base_stake);
 const toggleSound=async()=>{audio.set(!audio.enabled,audio.volume);setSound(audio.enabled);await audio.unlock();};
 return <div className="blackjack-game"><div className="lucky-game-top"><Link to="/">← {t('back')}</Link><span>{t('blackjack.subtitle')}</span></div>
  <div className="bj-header"><div><span className="bj-kicker">Lucky Lounge</span><h1>Blackjack</h1></div><div className="bj-tools"><Tooltip title={t(sound?'sound_on':'sound_off')}><Button type="text" icon={<SoundOutlined/>} onClick={toggleSound} aria-pressed={sound} aria-label={t('sound')}/></Tooltip><Tooltip title={t('audio_settings')}><Button type="text" icon={<SettingOutlined/>} onClick={()=>setAudioOpen(true)} aria-label={t('audio_settings')}/></Tooltip><Button type="text" icon={<SafetyCertificateOutlined/>} onClick={()=>setRulesOpen(true)}>{t('blackjack.rules')}</Button></div></div>
  {error&&<div className="lucky-status" role="status">{error}</div>}
  <div className={`bj-stage ${active?'is-active':''}`}>
   <aside className="bj-betting"><div className="bj-betting-heading"><span>{t('bet_short')}</span><strong>{chips(active?Number(round.stake):stake??0)} ✦</strong></div><div className="bj-stake-edit"><label htmlFor="bj-stake">{t('blackjack.stake_label')}</label><div className="bj-stake-input"><span aria-hidden="true">✦</span><InputNumber id="bj-stake" aria-label={t('blackjack.stake_label')} value={stake} onChange={setStake} changeOnBlur={false} controls={false} step={.01} precision={2} decimalSeparator="," disabled={pending||active}/></div><div className="bj-stake-shortcuts"><button type="button" onClick={()=>setStake(1)} disabled={pending||active}>{t('blackjack.min')}</button><button type="button" onClick={()=>changeStake(.5)} disabled={pending||active}>½</button><button type="button" onClick={()=>changeStake(2)} disabled={pending||active}>2×</button><button type="button" onClick={()=>setStake(roundChips(Math.min(100000,balance)))} disabled={pending||active}>{t('blackjack.max')}</button></div><BetValidation value={stake} balance={balance} active={!active}/></div>
    <Button type="primary" className="bj-deal-button" onClick={()=>run('start',{stake})} disabled={!available||pending||active||!valid} loading={pending&&!animating}>{t(resultShown?'blackjack.play_again':'blackjack.deal')}</Button>
    <div className="bj-sidebar-note"><span>♠</span><p>{t('blackjack.table_note')}</p></div>
   </aside>
   <div className={`bj-table ${win?'is-winning':''} ${resultShown&&shown.outcome==='blackjack'?'is-blackjack':''}`}>
    <div className="bj-table-inner"/>
    <div className="bj-shoe" aria-hidden="true"><CardBack/><CardBack/></div>
    <div className="bj-table-brand" aria-hidden="true"><span>Lucky Lounge</span><strong>{t('blackjack.table_payout')}</strong><small>{t('blackjack.table_s17')}</small></div>
    <Hand cards={shown.dealer_cards} total={shown.dealer_total} soft={shown.dealer_soft} label={t('blackjack.dealer')} dealer/>
    <div className={`bj-result ${resultShown?'is-visible':''} ${win?'is-win':''} ${net<0?'is-loss':''}`} role="status" aria-live="polite">{resultShown?<><strong>{t('blackjack.outcome_'+shown.outcome)}</strong><span>{net>0?'+':''}{chips(net)} ✦</span></>:<span>{t(animating?'blackjack.dealing':active?'blackjack.your_turn':'blackjack.place_stake')}</span>}</div>
    <Hand cards={shown.player_cards} total={shown.player_total} soft={shown.player_soft} label={t('blackjack.you')} winning={win}/>
    <div className="bj-table-chips" aria-label={t('blackjack.table_stake')}><span className="bj-chip" aria-hidden="true">✦</span><strong>{chips(Number(round?.stake??0))}</strong>{shown.doubled&&<small>2×</small>}</div>
   </div>
   <div className="bj-actions"><Button className="bj-action bj-hit" icon={<PlusOutlined/>} onClick={()=>run('hit')} disabled={!available||!active||pending}>{t('blackjack.hit')}</Button><Button className="bj-action bj-stand" icon={<StopOutlined/>} onClick={()=>run('stand')} disabled={!available||!active||pending}>{t('blackjack.stand')}</Button><Tooltip title={active&&shown.can_double&&!doubleEnough?t('insufficient'):t('blackjack.double_hint')}><Button className="bj-action bj-double" icon={<ThunderboltOutlined/>} onClick={()=>run('double')} disabled={!available||!active||pending||!shown.can_double||!doubleEnough}>{t('blackjack.double')}</Button></Tooltip></div>
  </div>
  <BlackjackFeed/>
  <Modal title={t('blackjack.rules')} open={rulesOpen} onCancel={()=>setRulesOpen(false)} footer={null} width={600}><p>{t('blackjack.rules_intro')}</p><ul className="bj-rules-list"><li>{t('blackjack.rules_cards')}</li><li>{t('blackjack.rules_dealer')}</li><li>{t('blackjack.rules_payout')}</li><li>{t('blackjack.rules_double')}</li><li>{t('blackjack.rules_limits')}</li><li>{t('blackjack.rules_server')}</li></ul></Modal>
  <SourceAudioSettings open={audioOpen} onClose={()=>setAudioOpen(false)} enabled={sound} setEnabled={setSound}/>
 </div>;
}
