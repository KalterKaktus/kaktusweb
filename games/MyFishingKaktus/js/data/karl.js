// Bella's Schildkröte Karl — Bonus-Event Konfiguration.
//
// Karl erscheint global synchron (deterministisch aus Epoch), maximal 1× pro 30 Min Slot,
// irgendwann zufällig innerhalb des Slots. Sichtbar für ~30 s, dann taucht ab.

export const KARL_NAME = "Bella's Schildkröte Karl";
export const KARL_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01 UTC
export const KARL_SLOT_MS = 60 * 60 * 1000;             // 60 Minuten — max 1× pro Stunde
export const KARL_VISIBLE_MS = 30 * 1000;               // 30 Sekunden Klick-Fenster

// Wheel-Segmente pro Area. Gewicht = relative Häufigkeit.
// Reihenfolge so gemischt dass „lange" Labels (Epic-/Legendary-Fisch) nicht direkt
// neben anderen langen Labels stehen — vermeidet Text-Overlap im Wheel.
//
// `wheelLabel` ist die kurze Version fürs Wheel selbst,
// `label` die ausführliche Version für das Reward-Popup.
export const KARL_REWARDS_BY_AREA = {
    pond: [
        { weight: 30, label: "10 Coins",    wheelLabel: "+10",       type: "coins-fixed", amount: 10 },
        { weight:  3, label: "Epic-Fisch!", wheelLabel: "★ Epic",    type: "spawn",       rarity: "Epic" },
        { weight: 20, label: "50 Coins",    wheelLabel: "+50",       type: "coins-fixed", amount: 50 },
        { weight: 25, label: "25 Coins",    wheelLabel: "+25",       type: "coins-fixed", amount: 25 },
        { weight:  7, label: "250 Coins",   wheelLabel: "+250",      type: "coins-fixed", amount: 250 },
        { weight: 15, label: "100 Coins",   wheelLabel: "+100",      type: "coins-fixed", amount: 100 },
    ],
    lake: [
        { weight: 25, label: "50 Coins",    wheelLabel: "+50",       type: "coins-fixed", amount: 50 },
        { weight:  5, label: "Epic-Fisch!", wheelLabel: "★ Epic",    type: "spawn",       rarity: "Epic" },
        { weight: 25, label: "150 Coins",   wheelLabel: "+150",      type: "coins-fixed", amount: 150 },
        { weight: 10, label: "1.500 Coins", wheelLabel: "+1.5k",     type: "coins-fixed", amount: 1500 },
        { weight: 20, label: "400 Coins",   wheelLabel: "+400",      type: "coins-fixed", amount: 400 },
        { weight: 15, label: "800 Coins",   wheelLabel: "+800",      type: "coins-fixed", amount: 800 },
    ],
    ocean: [
        { weight: 22, label: "200 Coins",        wheelLabel: "+200",     type: "coins-fixed", amount: 200 },
        { weight:  8, label: "Epic-Fisch!",      wheelLabel: "★ Epic",   type: "spawn",       rarity: "Epic" },
        { weight: 22, label: "600 Coins",        wheelLabel: "+600",     type: "coins-fixed", amount: 600 },
        { weight: 10, label: "10.000 Coins",     wheelLabel: "+10k",     type: "coins-fixed", amount: 10000 },
        { weight: 20, label: "1.500 Coins",      wheelLabel: "+1.5k",    type: "coins-fixed", amount: 1500 },
        { weight:  3, label: "Legendary-Fisch!", wheelLabel: "★ Legend", type: "spawn",       rarity: "Legendary" },
        { weight: 15, label: "4.000 Coins",      wheelLabel: "+4k",      type: "coins-fixed", amount: 4000 },
    ],
};

// Deterministischer Hash → in welcher Sekunde innerhalb des Slots taucht Karl auf?
// Zwischen 60s und (SLOT_MS - VISIBLE_MS - 60s) damit er nie genau am Slot-Rand klemmt.
//
// Nutzt einen 32-bit Integer-Hash mit guten Avalanche-Eigenschaften, sodass
// aufeinanderfolgende Stunden komplett unterschiedliche Sekunden ergeben.
// (Die alte string-basierte djb2-Variante hatte schwache Verteilung für
//  consecutive Integers → Karl tauchte mehrere Stunden in Folge fast zur
//  selben Sekunde auf.)
export function karlAppearOffsetMs(slotIndex) {
    let x = (slotIndex | 0) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x = x ^ (x >>> 16);
    const usable = KARL_SLOT_MS - KARL_VISIBLE_MS - 60_000;
    const range = usable - 60_000;
    return 60_000 + ((x >>> 0) % range);
}

export function currentKarlSlot(now = Date.now()) {
    return Math.floor((now - KARL_EPOCH) / KARL_SLOT_MS);
}

// Liefert das aktive Karl-Status-Objekt: { isActive, appearAt, leaveAt, slot, msLeft }.
export function getKarlStatus(now = Date.now()) {
    const slot = currentKarlSlot(now);
    const slotStart = KARL_EPOCH + slot * KARL_SLOT_MS;
    const appearAt = slotStart + karlAppearOffsetMs(slot);
    const leaveAt = appearAt + KARL_VISIBLE_MS;
    return {
        slot,
        appearAt,
        leaveAt,
        isActive: now >= appearAt && now < leaveAt,
        msUntilAppear: Math.max(0, appearAt - now),
        msLeft: Math.max(0, leaveAt - now),
    };
}
