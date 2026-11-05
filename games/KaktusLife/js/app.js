import { createGame, applyAction, scorePlayer } from '../shared/engine.mjs';
import { CAREERS, HOUSES } from '../shared/catalog.mjs';
import { t, ready, onLanguageChange, money, esc, label, icon } from './text.js';
import { createBoard, wheelMarkup, spinWheel, points } from './board.js';
import { soundEnabled, toggleSound, play } from './audio.js';

const app = document.querySelector('#app');
const PRACTICE_KEY = 'kk-life-practice-v1';
let mode = 'home', state = null, room = null, identity = null, busy = false, animation = false;
let error = null, connectionStatus = 'checking', stopRoom = null, board = null, journalExpanded = false;
let connectionPromise, toastTimeout, updateSerial = 0, formNames = null, codeDraft = null, practiceOpen = false;
const connection = () => connectionPromise ||= import('./connection.js');
const rng = () => {
  const limit = 0x100000000 - (0x100000000 % 1000000);
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return (values[0] % 1000000) / 1000000;
};
const text = key => label(`life.ui.${key}`);
const button = (action, title, kind = '', disabled = false, glyph = '') => `<button type="button" class="button ${kind}" data-action="${action}" ${disabled ? 'disabled' : ''}>${glyph ? icon(glyph) : ''}<span>${text(title)}</span></button>`;
const tool = (action, title, glyph, pressed) => `<button type="button" class="icon-button" data-action="${action}" aria-label="${text(title)}" title="${text(title)}" ${pressed !== undefined ? `aria-pressed="${pressed}"` : ''}>${icon(glyph)}</button>`;
const storedPractice = () => { try { const saved = JSON.parse(localStorage.getItem(PRACTICE_KEY)); return saved?.version === 1 && saved.players?.length === 2 && ['playing','finished'].includes(saved.status) ? saved : null; } catch { return null; } };
const currentPlayer = () => state?.players[state.turn];
const isOwnTurn = () => mode === 'local' || currentPlayer()?.id === identity?.id;
const canAct = () => !busy && !animation && state?.status === 'playing' && isOwnTurn();
const lookupItem = (collection,id) => Array.isArray(collection) ? collection.find(item=>item.id===id) : collection[id];
const itemName = (collection,id,fallback) => id ? t(lookupItem(collection,id)?.title || lookupItem(collection,id)?.name || `life.${collection === CAREERS ? 'careers' : 'houses'}.${id}.title`) : t(`life.ui.${fallback}`);

function announce(message) { document.querySelector('#announcer').textContent = message; }
function toast(message) { const node = document.querySelector('#toast'); node.textContent = message; node.hidden = false; clearTimeout(toastTimeout); toastTimeout = setTimeout(()=>node.hidden=true,3000); }
function savePractice() { try { localStorage.setItem(PRACTICE_KEY,JSON.stringify(state)); } catch { toast(t('life.ui.storageUnavailable')); } }
function classifyError(cause) {
  const key = String(cause?.key || cause?.message || '');
  if (cause?.status === 401 || /auth|login|session/i.test(key)) return 'auth';
  if (/full|occupied/i.test(key)) return 'full';
  if (/setup|migration|unavailable|configuration|not_configured|server/i.test(key)) return 'setup';
  if (cause?.status === 409) return 'action';
  if (cause?.status === 404 || /not_found|invalid_code/i.test(key)) return 'invalid';
  if ([500,501,502,503].includes(cause?.status)) return 'setup';
  if (!cause?.status || /network|fetch|timeout/i.test(key)) return 'network';
  return 'generic';
}
function banner() {
  if (!error) return '';
  return `<aside class="notice notice-error" role="alert"><span class="notice-mark">!</span><div><strong>${text(`${error}Title`)}</strong><p>${text(`${error}Message`)}</p>${error === 'auth' ? `<a class="text-link" href="${loginHref()}">${text('signIn')}${icon('arrow')}</a>` : ''}${error === 'network' && room ? button('reconnect','retry','button-small') : ''}</div>${tool('dismiss','dismiss','close')}</aside>`;
}
function loginHref() { return `/login.html?next=${encodeURIComponent(location.pathname+location.search)}`; }
function header() {
  return `<header class="game-header"><a href="./" class="game-wordmark" data-action="home">${icon('leaf')}<span>Kaktus<span>Life</span><small>${text(mode === 'local' ? 'localOnly' : 'onlineRoom')}</small></span></a><div class="header-tools">${mode === 'online' && room ? `<span class="connection-pill ${connectionStatus === 'connected' ? '' : 'is-reconnecting'}"><i></i><span>${text(connectionStatus)}</span></span><button class="room-mini" data-action="copy-link">${icon('link')}<span>${label('life.ui.room',{code:room.code})}</span></button>` : ''}${tool('sound',soundEnabled()?'soundOn':'soundOff',soundEnabled()?'sound':'muted',soundEnabled())}${tool('help','rules','help')}</div></header>`;
}
function homeView() {
  const saved = storedPractice();
  return `<header class="home-header"><a href="./" class="game-wordmark">${icon('leaf')}<span>Kaktus<span>Life</span></span></a><div class="header-tools">${tool('sound',soundEnabled()?'soundOn':'soundOff',soundEnabled()?'sound':'muted',soundEnabled())}${tool('help','rules','help')}</div></header>
  ${banner()}<section class="hero"><div class="hero-copy"><p class="eyebrow"><span></span>${text('eyebrow')}</p><h1>${text('title')}<br><em>${text('titleAccent')}</em></h1><p class="hero-description">${text('intro')}</p><div class="hero-facts"><span>${icon('people')}${text('players')}</span><span>${icon('clock')}${text('duration')}</span><span>${icon('route')}${text('decisions')}</span></div></div><div class="hero-emblem" aria-hidden="true"><svg viewBox="0 0 160 160"><circle class="emblem-ring" cx="80" cy="80" r="72"/><path class="emblem-lines" d="M80 2v12m0 132v12M2 80h12m132 0h12M25 25l9 9m92 92 9 9m0-110-9 9M34 126l-9 9"/><path class="emblem-cactus" d="M69 117V49a12 12 0 0 1 24 0v33h10V65a8 8 0 0 1 16 0v24a10 10 0 0 1-10 10H93v18M69 91H54a12 12 0 0 1-12-12V65a8 8 0 0 1 16 0v10h11"/><path class="emblem-pot" d="m55 116 8 25h37l8-25Z"/><path class="emblem-flower" d="M80 30c-17 4-7 15 0 9 7 6 17-5 0-9Z"/></svg></div></section>
  <div class="home-grid"><section class="home-board-card"><div class="section-kicker"><span>${text('original')}</span><span class="tiny-star" aria-hidden="true">✦</span></div><h2>${text('mapTag')}</h2><div id="board" class="board-container"></div><div class="map-caption"><span>${text('mapCaption')}</span>${icon('route')}</div></section><section class="start-card"><div class="start-card-heading"><span class="section-icon">${icon('people')}</span><div><h2>${text('playTogether')}</h2><p>${text('lobbyIntro')}</p></div></div><div class="online-start"><h3>${icon('globe')}${text('online')}</h3><p>${text('privateRoom')}</p>${identity ? `<p class="identity-line">${icon('check')}${label('life.ui.signedAs',{name:identity.name})}</p>` : `<p class="login-hint">${text('needLogin')} <a href="${loginHref()}">${text('signIn')}${icon('arrow')}</a></p>`}${button('create','createRoom','button-primary button-full',busy,'plus')}
  <form id="join-form" class="join-form"><label for="room-code">${text('joinLabel')}</label><div class="input-group"><input id="room-code" name="code" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" minlength="10" maxlength="10" pattern="[A-HJ-NP-Za-hj-np-z2-9]{10}" required aria-label="${text('code')}" placeholder="${text('codePlaceholder')}" value="${esc(codeDraft ?? new URLSearchParams(location.search).get('room') ?? '')}"><button class="button button-secondary" type="submit" ${busy?'disabled':''}>${text('join')}${icon('arrow')}</button></div></form><div id="saved-room-slot"></div></div>
  <div class="divider"><span>${text('or')}</span></div><details class="practice-details" ${saved||practiceOpen?'open':''}><summary>${icon('home')}<span>${text('practice')}</span><span class="summary-plus" aria-hidden="true">+</span></summary><p>${text('practiceHint')}</p>${saved ? `<div class="resume-block">${button('resume-local','resumePractice','button-secondary button-full',busy,'refresh')}<small>${text('localSaved')}</small></div>` : ''}<form id="practice-form"><div class="practice-fields"><label>${text('playerOne')}<input name="one" maxlength="24" autocomplete="off" required value="${esc(formNames?.[0] || t('life.ui.defaultOne'))}"></label><label>${text('playerTwo')}<input name="two" maxlength="24" autocomplete="off" required value="${esc(formNames?.[1] || t('life.ui.defaultTwo'))}"></label></div><button type="submit" class="button button-quiet button-full" ${busy?'disabled':''}>${text('startPractice')}${icon('arrow')}</button></form></details></section></div>
  <section class="how-section"><p class="eyebrow">${text('how')}</p><div class="how-grid">${['One','Two','Three','Four'].map((n,index)=>`<article><span class="how-number">0${index+1}</span>${icon(['graduate','dice','heart','flag'][index])}<h3>${text(`how${n}`)}</h3><p>${text(`how${n}Text`)}</p></article>`).join('')}</div></section>`;
}
function lobbyView() {
  const host = identity?.id === room.hostId;
  const guest = Boolean(room.guestId);
  const hint = !guest ? 'waitingGuest' : !room.guestReady ? 'waitingReady' : 'waitingHost';
  return `${header()}${banner()}<section class="lobby-layout"><div class="lobby-map"><p class="eyebrow">${text('onlineRoom')}</p><h1>${text('waitingRoom')}</h1><p>${text('waitingIntro')}</p><div id="board" class="board-container"></div></div><section class="lobby-card"><p class="eyebrow">${text('roomCode')}</p><div class="room-code-display"><input readonly aria-label="${text('code')}" value="${esc(room.code)}">${tool('copy-code','copyCode','copy')}</div>${button('copy-link','copyLink','button-secondary button-full',false,'link')}<p class="privacy-hint">${icon('shield')}${text('linkPrivacy')}</p><div class="lobby-seats"><div class="lobby-seat seat-0"><span class="seat-avatar">1</span><div><small>${text('host')}</small><strong>${esc(room.hostName || identity?.name || t('life.ui.host'))}</strong></div><span class="seat-status">${icon('check')}${text('ready')}</span></div><div class="lobby-seat seat-1 ${guest?'':'is-empty'}"><span class="seat-avatar">${guest?'2':'+'}</span><div><small>${text('guest')}</small><strong>${esc(room.guestName || t('life.ui.emptySeat'))}</strong></div>${guest?`<span class="seat-status">${room.guestReady?icon('check'):icon('clock')}${text(room.guestReady?'ready':'notReady')}</span>`:''}</div></div><p class="lobby-hint">${text(hint)}</p>${host?button('start-online','startOnline','button-primary button-full',busy||!guest||!room.guestReady,'arrow'):button('ready',room.guestReady?'unready':'makeReady','button-primary button-full',busy,'check')}<button class="text-button lobby-return" data-action="home">${text('leave')}</button><small class="save-hint">${text('leaveHint')}</small></section></section>`;
}
function playerCard(player,index) {
  const active = state.status === 'playing' && state.turn === index;
  const family = [player.partner?t('life.ui.partner'):t('life.ui.solo'),player.children?t(player.children===1?'life.ui.child':'life.ui.children',{count:player.children}):''].filter(Boolean).join(' · ');
  return `<article class="player-card player-${index} ${active?'is-active':''}"><div class="player-card-head"><span class="player-avatar">${index+1}</span><div><span class="eyebrow">${label('life.ui.playerLabel',{number:index+1})}</span><h3>${esc(player.name)}</h3></div>${active?`<span class="active-badge">${text('active')}</span>`:player.retired?`<span class="retired-badge">${icon('flag')}</span>`:''}</div><div class="player-money"><span>${text('cash')}<strong>${esc(money(player.cash))}</strong></span><span class="debt-stat">${text('debt')}<strong>${esc(money(player.debt))}</strong></span></div><div class="player-progress"><div><span>${label('life.ui.position',{position:player.position})}</span><span>${player.retired?text('retired'):`${Math.round(player.position/80*100)}%`}</span></div><progress value="${player.position}" max="80" aria-label="${text('progress')}"></progress></div><div class="player-quick-stats"><div>${icon('case')}<span>${esc(itemName(CAREERS,player.career,'noCareer'))}</span></div><div>${icon('home')}<span>${esc(itemName(HOUSES,player.house,'noHouse'))}</span></div><div>${icon('heart')}<span>${esc(family)}</span></div></div><details class="player-details"><summary>${text('details')}<span>+</span></summary><dl><div><dt>${text('salary')}</dt><dd>${esc(money(player.salary))}</dd></div><div><dt>${text('education')}</dt><dd>${text(player.education==='degree'?'educationDegree':player.education==='studying'?'educationStudying':'educationNone')}</dd></div><div><dt>${text('insurance')}</dt><dd>${text(player.insurance?'insured':'uninsured')}</dd></div><div><dt>${text('investments')}</dt><dd>${esc(money(player.investments))}</dd></div><div><dt>${text('happiness')}</dt><dd>${label('life.ui.happinessPoints',{count:player.happiness})}</dd></div></dl></details></article>`;
}
function optionMarkup(option,index) {
  const metadata = ['cost','gain','salary'].filter(key=>Number(option[key])>0).map(key=>`<span class="option-meta meta-${key}">${text(key)} <b>${esc(money(option[key]))}</b></span>`).join('');
  return `<button class="choice-option" type="button" data-choice="${esc(option.id)}" ${!canAct()||option.disabled?'disabled':''}><span class="option-icon">${icon(({path:['case','graduate'],partner:['heart','route'],home:['home','home'],family:['people','leaf'],investment:['coin','shield'],route:['leaf','mountain']})[state.pending.type]?.[index] || ['star','leaf','coin'][index%3])}</span><span class="option-content"><strong>${label(option.title)}</strong><span class="option-description">${label(option.description)}</span>${metadata?`<span class="option-metadata">${metadata}</span>`:''}</span><span class="option-arrow">${icon('arrow')}</span></button>`;
}
function actionPanel() {
  const player = currentPlayer();
  const own = isOwnTurn();
  const turnTitle = mode === 'local' ? t('life.ui.passTo',{name:player.name}) : own ? t('life.ui.yourTurn') : t('life.ui.turnOf',{name:player.name});
  const last = state.lastRoll;
  return `<section class="action-panel"><div class="turn-heading"><span class="turn-dot player-color-${state.turn}"></span><span>${esc(turnTitle)}</span><small>${label('life.ui.round',{round:state.round})}</small></div><div class="action-main ${state.stage==='choice'?'has-choice':''}">
  ${state.stage === 'choice' && state.pending ? `<div class="decision-heading"><span class="section-icon">${icon('route')}</span><p class="eyebrow">${text('chooseHint')}</p><h2>${label(state.pending.title)}</h2><p>${label(state.pending.description)}</p></div><div class="choices">${state.pending.options.map(optionMarkup).join('')}</div>` : `<div class="wheel-heading"><p class="eyebrow">${text(state.stage==='end'?'endTitle':'spinTitle')}</p><h2>${text(state.stage==='end'?'endHint':'spinHint')}</h2></div>${wheelMarkup(animation?null:last?.value)}<p class="wheel-fairness">${icon('shield')}${text('chance')}</p>${last&&state.stage==='end'?`<p class="roll-message">${label('life.ui.landed',{name:state.players.find(p=>p.id===last.playerId)?.name||'',value:last.value,to:last.to})}</p>`:''}${button(state.stage==='end'?'end-turn':'roll',animation?'spinning':state.stage==='end'?'endTurn':'spin','button-primary button-full',!canAct(),state.stage==='end'?'arrow':'refresh')}`}
  ${!own?`<p class="opponent-notice">${icon('clock')}${text('opponentTurnHint')}</p>`:mode==='local'?`<p class="local-turn-hint">${icon('people')}${text('localTurnHint')}</p>`:''}</div></section>`;
}
function journal() {
  const entries = [...(state.log||[])].reverse();
  const visible = journalExpanded?entries:entries.slice(0,6);
  return `<section class="journal-card"><header><div><p class="eyebrow">${text('journal')}</p><h2>${text('journalHint')}</h2></div><span class="journal-count">${entries.length}</span></header><ol class="journal-entries">${visible.length?visible.map(entry=>{const playerIndex=state.players.findIndex(p=>p.id===entry.playerId); const vars={...entry,...entry.params,name:state.players[playerIndex]?.name||'',amount:money(entry.amount??entry.params?.amount??0),upkeep:money(entry.upkeep??entry.params?.upkeep??0)}; if(entry.choiceKey)vars.choice=t(entry.choiceKey);if(vars.careerKey)vars.career=t(vars.careerKey);if(vars.houseKey)vars.house=t(vars.houseKey); return `<li><span class="journal-dot player-color-${Math.max(0,playerIndex)}"></span><div><small>${esc(state.players[playerIndex]?.name||'')}</small><p>${esc(t(entry.key||'life.ui.unknownLog',vars))}</p></div></li>`;}).join(''):`<li><p>${text('journalEmpty')}</p></li>`}</ol>${entries.length>6?button('journal',journalExpanded?'hideAll':'showAll','button-quiet button-small'):''}</section>`;
}
function gameView() {
  return `${header()}${banner()}<div class="game-topline"><div><p class="eyebrow">${text('routeLabel')}</p><h1>${text('routeTitle')}</h1></div>${mode==='local'?`<span class="local-badge">${icon('home')}${text('localOnly')}</span>`:''}</div><div class="play-layout"><div class="board-column"><section class="game-board-card"><div id="board" class="board-container"></div><div class="board-legend" aria-label="${text('legend')}"><span><i class="legend-payday">◈</i>${text('legendPayday')}</span><span><i class="legend-event">✦</i>${text('legendEvent')}</span><span><i class="legend-choice">★</i>${text('legendChoice')}</span><span><i class="legend-tax">−</i>${text('legendTax')}</span><span><i class="legend-market">↗</i>${text('legendMarket')}</span></div></section><div class="players-grid">${state.players.map(playerCard).join('')}</div></div><div class="action-column">${actionPanel()}</div></div>${journal()}<div class="game-bottom">${button('home','leave','button-quiet button-small',busy,'back')}<span>${text(mode==='local'?'localSaved':'leaveHint')}</span></div>`;
}
function resultsView() {
  const results = (state.results || state.players.map(player=>({...scorePlayer(player),playerId:player.id}))).slice().sort((a,b)=>b.total-a.total);
  const draw = results[0].total === results[1].total;
  const winner = state.players.find(player=>player.id===results[0].playerId);
  return `${header()}${banner()}<section class="results-header"><span class="result-flower" aria-hidden="true">✺</span><p class="eyebrow">${text('finishEyebrow')}</p><h1>${text('finishTitle')}</h1><h2>${draw?text('draw'):label('life.ui.winner',{name:winner?.name})}</h2><p>${text('finishIntro')}</p></section><div class="results-grid">${results.map((result,index)=>{const player=state.players.find(p=>p.id===result.playerId),playerIndex=state.players.indexOf(player);return `<article class="result-card player-${playerIndex} ${index===0?'result-winner':''}"><span class="result-rank">${draw?'=':index+1}</span><div class="player-card-head"><span class="player-avatar">${playerIndex+1}</span><div><p class="eyebrow">${label('life.ui.playerLabel',{number:playerIndex+1})}</p><h3>${esc(player.name)}</h3></div></div><div class="result-total"><span>${text('finalScore')}</span><strong>${esc(money(result.total))}</strong></div><dl class="score-breakdown">${[['cash','scoreCash'],['house','scoreHouse'],['investments','scoreInvestments'],['family','scoreFamily'],['happiness','scoreHappiness'],['debt','scoreDebt']].map(([key,translation])=>`<div class="${key==='debt'?'score-negative':''}"><dt>${text(translation)}</dt><dd>${key==='debt'?'−':''}${esc(money(result[key]||0))}</dd></div>`).join('')}<div class="score-total"><dt>${text('total')}</dt><dd>${esc(money(result.total))}</dd></div></dl></article>`;}).join('')}</div><div class="result-actions">${button(mode==='local'?'new-local':'rematch',mode==='local'?'newPractice':'rematch','button-primary',busy,'refresh')}${button('home','returnHome','button-quiet',busy,'back')}${mode==='online'?`<p>${text('rematchHint')}</p>`:''}</div>${journal()}`;
}

function render({ fromPlayers = null } = {}) {
  const focused = document.activeElement?.dataset?.action;
  if(mode==='home') {
    const one=app.querySelector('[name="one"]'),two=app.querySelector('[name="two"]'),code=app.querySelector('[name="code"]');
    if(one&&two)formNames=[one.value,two.value];
    if(code)codeDraft=code.value;
    practiceOpen=app.querySelector('.practice-details')?.open||practiceOpen;
  }
  app.innerHTML = mode==='home'?homeView():!state?lobbyView():state.status==='finished'?resultsView():gameView();
  app.removeAttribute('aria-busy');
  const container = app.querySelector('#board');
  if(container) board = createBoard(container,fromPlayers||state?.players||[],{preview:mode==='home'||!state});
  if(focused) app.querySelector(`[data-action="${focused}"]`)?.focus({preventScroll:true});
  if(mode==='home') mountSavedRoom();
}
async function mountSavedRoom() {
  try { const api=await connection(); const slot=document.querySelector('#saved-room-slot'); if(slot&&api.getSavedRoomId())slot.innerHTML=button('resume-room','resumeRoom','button-quiet button-full button-small',busy,'refresh'); } catch { /* Local play remains available. */ }
}
async function acceptRoom(nextRoom) {
  if(!nextRoom || nextRoom.id !== room?.id && room) return;
  if(room && nextRoom.revision < room.revision) return;
  if(room && nextRoom.revision === room.revision) {
    connectionStatus='connected';
    if(['network','setup'].includes(error)){error=null;render();}
    else {
      const pill=app.querySelector('.connection-pill');
      pill?.classList.remove('is-reconnecting');
      if(pill) pill.querySelector('span').textContent=t('life.ui.connected');
    }
    return;
  }
  room=nextRoom;connectionStatus='connected';
  await acceptState(nextRoom.state);
}
async function acceptState(next) {
  const previous=state;
  state=next;
  if(mode==='local')savePractice();
  const changedRoll=next?.lastRoll && next.lastRoll.id !== previous?.lastRoll?.id && previous;
  const serial=++updateSerial;
  if(changedRoll && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if(next.status==='finished') state={...next,status:'playing'};
    animation=true;render({fromPlayers:previous.players});
    announce(t('life.ui.landed',{name:next.players.find(p=>p.id===next.lastRoll.playerId)?.name,value:next.lastRoll.value,to:next.lastRoll.to}));
    // Choice stops still show the wheel before the decision becomes actionable.
    let wheel=document.querySelector('.wheel-wrap');
    if(!wheel){ const panel=document.querySelector('.action-main'); if(panel){panel.classList.add('animating-choice');panel.insertAdjacentHTML('afterbegin',`<div class="roll-overlay">${wheelMarkup()}<p>${text('spinning')}</p></div>`);wheel=panel.querySelector('.wheel-wrap');}}
    if(wheel)await spinWheel(wheel,next.lastRoll.value);
    if(serial !== updateSerial)return;
    const p=previous.players.find(player=>player.id===next.lastRoll.playerId);
    await board?.move(next.lastRoll.playerId,p?.position??next.lastRoll.from,next.lastRoll.to);
    if(serial !== updateSerial)return;
    state=next;animation=false;render();
  } else { animation=false;render(); }
  if(next?.status==='finished'&&previous?.status!=='finished'){play('finish');announce(t('life.ui.finishTitle'));}
}
function watchRoom() {
  stopRoom?.();
  connection().then(api=>{stopRoom=api.subscribeRoom(room.id,next=>{if(!animation)acceptRoom(next);},cause=>{connectionStatus='reconnecting';error=classifyError(cause);render();});});
}
async function enterRoom(nextRoom) {
  stopRoom?.();state=null;room=null;mode='online';room=nextRoom;error=null;connectionStatus='connected';
  await acceptState(nextRoom.state);watchRoom();
  const url=new URL(location.href);url.searchParams.set('room',room.code);history.replaceState({},'',url);
}
async function runOnline(operation) {
  if(busy)return;busy=true;error=null;render();
  try { const api=await connection(); identity=await api.getIdentity(); if(!identity){error='auth';return;} const result=await operation(api); await enterRoom(result); }
  catch(cause){error=classifyError(cause);}finally{busy=false;render();}
}
async function takeAction(action) {
  if(!canAct())return;busy=true;error=null;render();
  try {
    if(mode==='local'){const next=applyAction(state,currentPlayer().id,action,rng);busy=false;play('confirm');await acceptState(next);}
    else {const api=await connection();const nextRoom=await api.roomAction(room,action);busy=false;await acceptRoom(nextRoom);}
  }catch(cause){
    error=classifyError(cause);
    if(cause?.status===409&&room){try{const api=await connection();await acceptRoom(await api.loadRoom(room.id));}catch{}}
  }finally{busy=false;if(!animation)render();}
}
async function lobbyAction(action) {
  if(busy)return;busy=true;error=null;render();
  try{const api=await connection();const next=await api.roomAction(room,action);busy=false;await acceptRoom(next);}catch(cause){error=classifyError(cause);if(cause.status===409){try{const api=await connection();await acceptRoom(await api.loadRoom(room.id));}catch{}}}finally{busy=false;render();}
}
function goHome() {
  if(animation||busy)return;
  stopRoom?.();stopRoom=null;mode='home';state=null;room=null;error=null;updateSerial++;render();
  history.replaceState({},'',location.pathname);window.scrollTo({top:0,behavior:'instant'});
}
function newLocal(names) {
  stopRoom?.();stopRoom=null;formNames=names;room=null;mode='local';error=null;
  state=createGame(names.map((name,index)=>({id:`local-${index+1}`,name})),rng);savePractice();play('confirm');render();window.scrollTo({top:0,behavior:'instant'});
}
async function copy(value) {
  try{await navigator.clipboard.writeText(value);toast(t('life.ui.copied'));}catch{toast(t('life.ui.copyFailed'));document.querySelector('.room-code-display input')?.select();}
}
function showHelp() {
  document.querySelector('#life-help')?.remove();
  const dialog=document.createElement('dialog');dialog.id='life-help';dialog.className='help-dialog';
  dialog.innerHTML=`<div class="dialog-head"><span class="section-icon">${icon('route')}</span>${tool('close-help','dismiss','close')}</div><h2>${text('helpTitle')}</h2><p>${text('helpIntro')}</p><ol>${['helpTurns','helpEconomy','helpEnd','helpSave'].map(key=>`<li>${text(key)}</li>`).join('')}</ol>${button('close-help','understood','button-primary button-full')}`;
  document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target.closest('[data-action="close-help"]'))dialog.close();});dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function showBoard() {
  document.querySelector('#life-map-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='life-map-dialog';dialog.className='board-dialog';
  dialog.innerHTML=`<div class="dialog-head"><div><h2>${text('routeTitle')}</h2><p>${text('panBoard')}</p></div>${tool('close-map','dismiss','close')}</div><div class="board-scroll" tabindex="0" aria-label="${text('boardLabel')}"><div class="board-dialog-canvas"></div></div>`;
  document.body.append(dialog);
  createBoard(dialog.querySelector('.board-dialog-canvas'),state?.players||[],{expandable:false});
  dialog.addEventListener('click',event=>{if(event.target.closest('[data-action="close-map"]'))dialog.close();});
  dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  const scroll=dialog.querySelector('.board-scroll');
  if(state)scroll.scrollLeft=Math.max(0,points[currentPlayer().position].x/1120*1050-scroll.clientWidth/2);
}

app.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;
  if(form.id==='join-form'){const code=new FormData(form).get('code').trim().toUpperCase();runOnline(api=>api.joinRoom(code));}
  if(form.id==='practice-form'){const data=new FormData(form);const names=[String(data.get('one')).trim(),String(data.get('two')).trim()];if(names.every(Boolean))newLocal(names);}
});
app.addEventListener('click',async event=>{
  const choice=event.target.closest('[data-choice]');if(choice){takeAction({type:'choose',choice:choice.dataset.choice});return;}
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;if(target.tagName==='A')event.preventDefault();
  if(action==='sound'){toggleSound();if(!animation)render();}
  if(action==='help')showHelp();
  if(action==='expand-board')showBoard();
  if(action==='dismiss'){error=null;render();}
  if(action==='home')goHome();
  if(action==='create')runOnline(api=>api.createRoom());
  if(action==='resume-room')runOnline(api=>api.loadRoom(api.getSavedRoomId()));
  if(action==='resume-local'){state=storedPractice();if(state){mode='local';room=null;error=null;render();window.scrollTo({top:0,behavior:'instant'});}}
  if(action==='roll')takeAction({type:'roll'});
  if(action==='end-turn')takeAction({type:'end'});
  if(action==='ready')lobbyAction({type:'ready',ready:!room.guestReady});
  if(action==='start-online')lobbyAction({type:'start'});
  if(action==='copy-code')copy(room.code);
  if(action==='copy-link'){const url=new URL(location.pathname,location.origin);url.searchParams.set('room',room.code);copy(url.href);}
  if(action==='reconnect'){busy=true;render();try{const api=await connection();await acceptRoom(await api.loadRoom(room.id));error=null;watchRoom();}catch(cause){error=classifyError(cause);}finally{busy=false;render();}}
  if(action==='journal'){journalExpanded=!journalExpanded;render();}
  if(action==='new-local')newLocal(state.players.map(player=>player.name));
  if(action==='rematch'){busy=true;render();try{const api=await connection();await enterRoom(await api.rematchRoom(room));}catch(cause){error=classifyError(cause);}finally{busy=false;render();}}
});

await ready;
render();
onLanguageChange(()=>{if(!animation)render();});
// Auth and networking load independently of the local game and translations.
connection().then(async api=>{
  identity=await api.getIdentity();
  if(mode!=='home')return;
  render();
  const code=new URLSearchParams(location.search).get('room');
  if(code){if(identity)runOnline(client=>client.joinRoom(code));else{error='auth';render();}}
}).catch(()=>{if(mode==='home')render();});
