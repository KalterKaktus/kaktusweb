export const roundChips=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
export const validBet=value=>Number.isFinite(value)&&value>=1&&value<=100000&&Math.abs(value*100-Math.round(value*100))<1e-7;
