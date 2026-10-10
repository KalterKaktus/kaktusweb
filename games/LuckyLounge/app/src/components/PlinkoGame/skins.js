// Cosmetic progression uses the persisted server payout total, never chip balance.
export const SKINS = {
  normal: {file:'coin_original',goal:0},
  bronze: {file:'coin_bronze',goal:100000},
  silver: {file:'coin_silver',goal:250000},
  emerald: {file:'coin_emerald',goal:500000},
  ruby: {file:'coin_ruby',goal:1000000},
  sapphire: {file:'coin_sapphire',goal:2500000},
};
export const winningsTotal = wallet => Number(wallet?.total_won ?? wallet?.tracked_won ?? 0);
export const skinUnlocked = (id, wallet) => Boolean(SKINS[id] && winningsTotal(wallet) >= SKINS[id].goal);
