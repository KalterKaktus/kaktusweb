export const GAMES=[
{id:'plinko',name:'Plinko',navLabel:'Plinko',path:'/plinko/',icon:'plinko',image:'/games/LuckyLounge/images/plinko.avif',comingSoon:false},
{id:'mines',name:'Mines',navLabel:'Mines',path:'/mines/',icon:'mines',image:'/games/LuckyLounge/images/mines.avif',comingSoon:false},
{id:'crash',name:'Crash',navLabel:'Crash',path:'/crash/',icon:'crash',image:'/games/LuckyLounge/images/crash.avif',comingSoon:false},
{id:'dino',name:'Dino',navLabel:'Dino',path:'/dino/',icon:'dino',image:'/games/LuckyLounge/images/dino.avif',comingSoon:false},
{id:'roulette',name:'Color Roulette',nameKey:'roulette.name',path:'/roulette/',icon:'roulette',image:'/games/LuckyLounge/images/roulette-lounge.svg',comingSoon:false},
{id:'blackjack',name:'Blackjack',nameKey:'blackjack.name',path:'/blackjack/',icon:'blackjack',image:'/games/LuckyLounge/images/blackjack-lounge.svg',comingSoon:false},
{id:'coinflip',name:'Coinflip',nameKey:'coinflip.name',path:'/coinflip/',icon:'coinflip',image:'/games/LuckyLounge/images/coinflip-lounge.svg',comingSoon:false}];
export const isGamePath=path=>GAMES.some(g=>!g.comingSoon&&path.startsWith('/'+g.id));
