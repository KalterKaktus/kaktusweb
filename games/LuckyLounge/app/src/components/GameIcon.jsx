// Small original vectors: consistent at navigation and touch-control sizes.
const shapes = {
 lobby: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
 plinko: <><circle cx="12" cy="3" r="1.5"/><path d="m4 19 8-13 8 13M4 21h16"/><circle cx="12" cy="11" r=".8"/><circle cx="9" cy="16" r=".8"/><circle cx="15" cy="16" r=".8"/></>,
 mines: <><circle cx="10" cy="14" r="7"/><path d="m15 9 2-2c2-2 0-4 2-5M6 12a4 4 0 0 1 4-2M20 5l2 1M18 2l-1-1"/></>,
 crash: <><path d="M14 4c3-2 6-2 7-1 1 4-2 8-6 11l-5-5c1-2 2-4 4-5ZM10 9 5 9l-3 5 6 1m7-1v5l-5 3-1-6M6 18l-3 3"/><circle cx="16" cy="7" r="1.5"/></>,
 dino: <path d="M5 21v-6l-3-3V8l4 4h4V8h3V3h8v6h-5v3h3v3h-3l-3 3v3m-5 0v-3h3m6-13h1"/>,
 stats: <path d="M3 3v18h18M7 16v-5m5 5V6m5 10V9"/>,
 roulette: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6M6 6l4 4m4 4 4 4m0-12-4 4m-4 4-4 4"/></>,
 blackjack: <><rect x="3" y="4" width="13" height="17" rx="2"/><path d="M8 4V2h12a2 2 0 0 1 2 2v14h-6M9.5 8l-4 6h8l-4-6Zm0 6v3"/></>,
 profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
 menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
};
export default function GameIcon({name,className=''}) {
 return <svg className={`lounge-icon ${className}`} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]||shapes.lobby}</svg>;
}
