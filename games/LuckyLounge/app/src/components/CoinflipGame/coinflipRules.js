// Display only. PostgreSQL derives and validates the same signed position.
export function coinflipRules(position) {
 const value=Math.max(-95,Math.min(95,Math.round(Number(position)||0)));
 const chance=Math.max(1,Math.abs(value));
 return {position:value,side:value<=0?'heads':'tails',chance,multiplier:100/chance};
}
