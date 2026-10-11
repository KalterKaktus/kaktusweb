import {useText} from '../../i18n';

// Original vectors, including the engraved lounge card back. No external art.
const SUITS={
 hearts:'M50 85C37 71 12 56 12 34 12 12 39 8 50 26 61 8 88 12 88 34 88 56 63 71 50 85Z',
 diamonds:'M50 7 86 48 50 91 14 48Z',
 clubs:'M50 10C30 10 27 32 36 41 14 31 6 57 20 68 31 77 43 67 45 61L39 88H61L55 61C57 69 72 77 82 68 96 55 84 31 64 41 74 30 70 10 50 10Z',
 spades:'M50 9C39 25 13 42 13 61 13 83 42 82 46 64L40 89H60L54 64C60 83 87 83 87 61 87 42 61 25 50 9Z',
};

function Suit({suit,...props}){return <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" {...props}><path d={SUITS[suit]||SUITS.spades}/></svg>;}
export function CardBack(){return <svg className="bj-cardback-art" viewBox="0 0 120 168" aria-hidden="true" fill="none"><rect x="6" y="6" width="108" height="156" rx="9"/><rect x="12" y="12" width="96" height="144" rx="6"/><path d="m60 25 35 58-35 60L25 83Zm0 16 25 42-25 43L35 83Z"/><circle cx="60" cy="83" r="25"/><path d="M60 58v50M35 83h50M42 65l36 36M42 101l36-36M22 22l10 10M98 22 88 32M22 146l10-10M98 146l-10-10"/><path d="m60 67 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z"/><circle cx="22" cy="46" r="2"/><circle cx="98" cy="46" r="2"/><circle cx="22" cy="122" r="2"/><circle cx="98" cy="122" r="2"/></svg>;}

export default function PlayingCard({card,index=0,count=2,deal=false}){
 const {t}=useText(),hidden=!card||card.hidden,red=['hearts','diamonds'].includes(card?.suit);
 const tilt=(index-(count-1)/2)*4,overlap=count>6?'-.64':count>3?'-.49':'-.3';
 return <div className={`bj-card ${hidden?'is-hidden':''} ${red?'is-red':''} ${deal?'is-dealt':''}`} style={{'--card-tilt':`${tilt}deg`,'--card-overlap':overlap}} role="img" aria-label={hidden?t('blackjack.hidden_card'):t('blackjack.card',{rank:card.rank,suit:t('blackjack.suit_'+card.suit)})}>
  <div className="bj-card-turn"><div className="bj-card-front">
   {!hidden&&<><div className="bj-card-corner"><b>{card.rank}</b><Suit suit={card.suit}/></div><div className="bj-card-center"><Suit suit={card.suit}/>{['J','Q','K'].includes(card.rank)&&<span className="bj-card-court">{card.rank}</span>}</div><div className="bj-card-corner bj-card-corner-bottom"><b>{card.rank}</b><Suit suit={card.suit}/></div></>}
  </div><div className="bj-card-back"><CardBack/></div></div>
 </div>;
}
