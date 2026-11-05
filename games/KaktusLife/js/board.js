import { BOARD, MILESTONES } from '../shared/catalog.mjs';
import { t, esc } from './text.js';
import { play } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export const points = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 17), column = index % 17;
  const x = 94 + (row % 2 ? 16 - column : column) * 55;
  const y = 544 - row * 106 + Math.sin(column * .53 + row) * 9;
  return { x, y };
});

const use = (id, x, y, scale = 1, extra = '') => `<use href="#life-${id}" transform="translate(${x} ${y}) scale(${scale})" ${extra}/>`;
const tree = (x, y, size = 1) => use('tree', x, y, size);
const house = (x, y, size = 1, extra = '') => use('house', x, y, size, extra);
const defs = `<defs>
 <g id="life-tree"><ellipse class="map-shadow" cy="7" rx="18" ry="6"/><path class="map-trunk" d="M-3-16h6V7h-6z"/><path class="map-tree-dark" d="m0-61 24 43H-24Z"/><path class="map-tree" d="m0-70 21 40H-21Z"/><path class="map-tree-light" d="m0-70 0 40H-21Z"/></g>
 <g id="life-roundtree"><ellipse class="map-shadow" cy="7" rx="18" ry="6"/><path class="map-trunk" d="M-3-26h6V7h-6z"/><ellipse class="map-tree-dark" cy="-32" rx="24" ry="27"/><ellipse class="map-tree-light" cx="-6" cy="-38" rx="19" ry="23"/></g>
 <g id="life-house"><ellipse class="map-shadow" cy="7" rx="34" ry="10"/><path class="map-wall" d="M-27-28 4-35v36l-31 7Z"/><path class="map-wall-side" d="m4-35 26 14v29L4 1Z"/><path class="map-roof" d="m-36-27 23-27 51 25-34 8Z"/><path class="map-roof-dark" d="m4-21 9-26 25 18-8 10Z"/><path class="map-window" d="m-19-22 8-2v11l-8 2Zm37 4 7 4v9l-7-4Z"/><path class="map-door" d="m-8-8 8-2V2l-8 2Z"/><path class="map-wall-side" d="m19-48 6 3v16l-6-3Z"/></g>
 <g id="life-cactus"><ellipse class="map-shadow" cy="5" rx="15" ry="4"/><path class="map-cactus" d="M-4 4v-40a5 5 0 0 1 10 0v19h5v-11a4 4 0 0 1 8 0v14a5 5 0 0 1-5 5H6V4Zm0-17h-8a6 6 0 0 1-6-6v-10a4 4 0 0 1 8 0v8h6Z"/><path class="map-cactus-line" d="M1-35V0"/><circle class="map-flower" cx="1" cy="-42" r="4"/></g>
 <g id="life-boat"><ellipse class="map-water-dark" cy="7" rx="24" ry="5"/><path class="map-wall" d="m-23 0 46-4-10 12h-23Z"/><path class="map-trunk-stroke" d="M0-37V0"/><path class="map-sail" d="M-3-36-3-4-23-4Z"/><path class="map-roof" d="M2-35 2-7 19-7Z"/></g>
 <g id="life-car"><ellipse class="car-shadow" cy="7" rx="23" ry="8"/><circle class="car-wheel" cx="-13" cy="4" r="5"/><circle class="car-wheel" cx="13" cy="4" r="5"/><path class="car-body" d="m-23-6 5-6 6-1 5-10h15l8 10 6 3v11h-45Z"/><path class="car-window" d="m-8-14 4-7h9l5 7Z"/><path class="car-detail" d="M1-21v7m-16 6h7m6 0h7"/><path class="car-light" d="M17-6h4v4h-4"/></g>
 </defs>`;

function scenery() {
  let scene = `<path class="map-hill-light" d="M0 78Q114 10 242 75T470 44T730 52T1120 40V680H0Z"/>
  <path class="map-hill" d="M0 158Q160 43 332 111T655 84T1120 128V680H0Z"/>
  <path class="map-meadow" d="M0 260Q160 186 286 252T560 226T850 244T1120 214V680H0Z"/>
  <path class="map-grass" d="M0 620Q126 569 230 617T514 618T811 598T1120 625V680H0Z"/>
  <g class="map-mountains"><path class="map-mountain-dark" d="m790 84 70-79 75 79Z"/><path class="map-mountain" d="m850 84 88-104 89 104Z"/><path class="map-snow" d="m938-20-23 28 17-4 11 11 8-8 15 6Z"/><path class="map-mountain" d="m1000 96 61-72 70 72Z"/><path class="map-snow" d="m1061 24-21 25 19-4 15 12 7-9Z"/></g>
  <g class="map-lake"><path class="map-water-dark" d="M793 279c-4-24 66-47 127-39s138 40 129 67-86 30-144 23-107-27-112-51Z"/><path class="map-water" d="M794 271c-4-24 66-47 127-39s138 40 129 67-86 30-144 23-107-27-112-51Z"/><path class="map-water-line" d="M818 274q26-9 47-2m90 27q27 7 52-2m-142-52q25-7 47 0"/>${use('boat',925,281,.8)}</g>
  <path class="map-stream" d="M1080 324q-47 40-16 86t17 121"/>
  <g>${house(266,281,1.05)}${house(336,294,.8)}${house(213,294,.72)}${house(666,490,.9)}${house(729,486,1.15)}${house(797,495,.75)}</g>
  <g class="map-school"><ellipse class="map-shadow" cx="168" cy="481" rx="50" ry="10"/><path class="map-wall" d="M126 446h82v33h-82Z"/><path class="map-roof" d="m118 446 49-28 49 28Z"/><path class="map-wall-side" d="M208 446h10v33h-10Z"/><path class="map-door" d="M160 459h14v20h-14Z"/><path class="map-window" d="M135 455h11v12h-11Zm53 0h11v12h-11Z"/><circle class="map-clock" cx="168" cy="439" r="6"/><path class="map-clock-hand" d="M168 435v4l3 2"/></g>
  <g class="map-windmill"><ellipse class="map-shadow" cx="562" cy="167" rx="22" ry="6"/><path class="map-wall" d="m550 167 6-49h13l6 49Z"/><path class="map-roof" d="m549 120 14-22 14 22Z"/><path class="map-windmill-blades" d="m563 125-28-25m28 25 26 28m-26-28 26-26m-26 26-28 27"/><circle class="map-roof-dark" cx="563" cy="125" r="5"/></g>`;
  [[35,102,.9],[83,89,.7],[135,61,.8],[193,91,1],[231,73,.7],[403,89,.8],[462,80,1],[1063,202,1.1],[1029,176,.7],[1084,260,.8],[40,292,1.2],[84,273,.7],[415,276,.8],[451,282,.6],[604,374,.7],[645,372,.8],[498,486,.7],[545,488,.9],[900,478,.8],[961,486,1],[1002,468,.7],[36,612,.9],[90,639,.75],[914,617,.8],[960,636,1],[1040,625,.9]].forEach(([x,y,s]) => { scene += tree(x,y,s); });
  [[364,175,.8],[711,174,.7],[774,166,.9],[48,465,.8],[365,477,.8],[861,377,.65],[907,377,.8],[1040,604,.8]].forEach(([x,y,s]) => { scene += use('roundtree',x,y,s); });
  [[355,621,1.1],[397,638,.8],[588,637,1],[835,74,.7],[60,376,.8],[1004,373,.7]].forEach(([x,y,s]) => { scene += use('cactus',x,y,s); });
  for (let i=0;i<42;i++) {
    const x = 31 + (i * 139) % 1050, y = 60 + (i * 97) % 580;
    scene += `<path class="map-grass-tuft" d="m${x} ${y} -3-5m3 5 1-7m-1 7 5-4"/>`;
  }
  scene += `<g class="map-picnic"><ellipse class="map-grass-light" cx="430" cy="369" rx="43" ry="17"/><path class="map-roof" d="m401 361 39-8 23 15-39 9Z"/><path class="map-sail" d="m409 360 39 14m-29-18 39 14m-38-14-10 17m23-19-10 17m23-19-10 17"/></g>`;
  return scene;
}

const tileGlyph = type => ({payday:'◈',tax:'−',event:'✦',market:'↗',opportunity:'✧',milestone:'★',retirement:'⚑',start:'•'}[type] || '•');

export function createBoard(container, players = [], { preview = false } = {}) {
  const road = points.map((p,index) => `${index ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const tiles = BOARD.map(tile => {
    const p = points[tile.index];
    const major = ['start','milestone','retirement'].includes(tile.type);
    return `<g class="map-tile tile-${esc(tile.type)} ${major ? 'tile-major' : ''}" transform="translate(${p.x} ${p.y})"><title>${esc(t(tile.title || `life.ui.tile.${tile.type}`))} · ${tile.index}</title><path class="tile-side" d="m-24-12 48 0v25l-48 0Z"/><rect class="tile-top" x="-24" y="-18" width="48" height="26" rx="7"/><text class="tile-glyph" y="1" text-anchor="middle">${tileGlyph(tile.type)}</text>${tile.index % 5 === 0 || major ? `<text class="tile-number" y="24" text-anchor="middle">${tile.index}</text>` : ''}</g>`;
  }).join('');
  const labels = (MILESTONES || []).filter(m => m.index > 0 && m.index < 80).map((m,index) => {
    const p = points[m.index];
    const right = p.x > 870, left = p.x < 190;
    const dx = right ? -35 : left ? 35 : 0;
    const dy = index % 2 ? 44 : -45;
    return `<g class="map-label" transform="translate(${p.x + dx} ${p.y+dy})"><path class="map-label-stem" d="M${-dx} ${-dy} 0 ${dy>0?-10:10}"/><rect x="-83" y="-14" width="166" height="28" rx="14"/><text text-anchor="middle" y="5">${esc(t(`life.ui.mapMilestone.${m.id}`))}</text></g>`;
  }).join('');
  container.innerHTML = `<svg class="life-board ${preview ? 'board-preview' : ''}" viewBox="0 0 1120 680" role="img" aria-label="${esc(t('life.ui.boardLabel'))}">${defs}<rect class="map-base" width="1120" height="680" rx="22"/>${scenery()}<path class="map-road-shadow" d="${road}"/><path class="map-road" d="${road}"/>${tiles}${labels}<g class="map-start-sign" transform="translate(103 605)"><rect x="-55" y="-15" width="110" height="30" rx="15"/><text text-anchor="middle" y="5">${esc(t('life.ui.start'))}</text></g><g class="map-finish-sign" transform="translate(815 56)"><rect x="-75" y="-17" width="150" height="34" rx="17"/><text text-anchor="middle" y="5">${esc(t('life.ui.retirement'))}</text></g><g class="board-pawns"></g><g class="map-compass" transform="translate(1035 590)"><circle r="27"/><path d="m0-20 7 20-7 20-7-20Z"/><text y="-34" text-anchor="middle">N</text></g></svg>`;
  const layer = container.querySelector('.board-pawns');
  const pawnElements = new Map();
  players.forEach((player,index) => {
    const g = document.createElementNS(NS,'g');
    g.setAttribute('class', `map-pawn pawn-${index}`);
    g.innerHTML = `<title>${esc(player.name)}</title><use href="#life-car"/><g class="pawn-badge" transform="translate(0 -35)"><circle r="10"/><text text-anchor="middle" y="4">${index+1}</text></g>`;
    layer.append(g); pawnElements.set(player.id,g);
  });
  function place(id, position, index = players.findIndex(player => player.id === id)) {
    const element = pawnElements.get(id); if (!element) return;
    const p = points[Math.min(80,Math.max(0,position))];
    const row = Math.floor(position / 17);
    element.setAttribute('transform', `translate(${p.x+(index ? 5 : -4)} ${p.y+(index ? -12 : -29)})`);
    element.classList.toggle('pawn-reverse', row % 2 === 1);
  }
  players.forEach((player,index) => place(player.id,player.position,index));
  return {
    async move(id, from, to) {
      const element = pawnElements.get(id);
      if (!element || reduced()) { place(id,to); return; }
      element.classList.add('is-moving');
      for (let position = from+1; position<=to; position++) { place(id,position); play('step'); await wait(190); }
      element.classList.remove('is-moving');
    },
    place,
  };
}

export function wheelMarkup(value = null) {
  const wedges = Array.from({length:10},(_,index) => {
    const a = (index*36-108)*Math.PI/180, b = ((index+1)*36-108)*Math.PI/180;
    const x1 = 130 + 112*Math.cos(a), y1 = 130 + 112*Math.sin(a), x2 = 130 + 112*Math.cos(b), y2 = 130 + 112*Math.sin(b);
    const mid = (a+b)/2, x = 130+84*Math.cos(mid), y = 130+84*Math.sin(mid);
    return `<g class="wheel-segment segment-${index%5}"><path d="M130 130L${x1} ${y1}A112 112 0 0 1 ${x2} ${y2}Z"/><text x="${x}" y="${y+6}" transform="rotate(${index*36} ${x} ${y})" text-anchor="middle">${index+1}</text></g>`;
  }).join('');
  return `<div class="wheel-wrap"><svg class="spin-wheel" viewBox="0 0 260 260" aria-hidden="true"><circle class="wheel-shadow" cx="130" cy="135" r="122"/><circle class="wheel-rim" cx="130" cy="130" r="122"/><g class="wheel-disc">${wedges}<circle class="wheel-center" cx="130" cy="130" r="31"/><path class="wheel-center-leaf" d="M119 142c-10-18 3-32 22-26 4 19-9 33-22 26Zm0 3 15-20"/></g><path class="wheel-pointer" d="m118 5 12 27 12-27Z"/><circle class="wheel-rim-dot" cx="130" cy="13" r="3"/></svg><span class="wheel-result ${value ? 'has-result' : ''}" aria-live="polite">${value || ''}</span></div>`;
}

export async function spinWheel(container,value) {
  const disc = container.querySelector('.wheel-disc');
  if (!disc) return;
  const rotation = 1800 - (value-1)*36;
  play('spin');
  if (reduced()) { disc.style.transform = `rotate(${rotation}deg)`; return; }
  const animation = disc.animate([{transform:'rotate(0deg)'},{transform:`rotate(${rotation}deg)`}], {duration:2100,easing:'cubic-bezier(.15,.7,.12,1)',fill:'forwards'});
  await animation.finished;
  disc.style.transform = `rotate(${rotation}deg)`;
  container.querySelector('.wheel-result').textContent = value;
  container.querySelector('.wheel-result').classList.add('has-result');
  play('confirm');
}
