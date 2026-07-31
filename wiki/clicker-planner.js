// Kauf-Planer für KaktusClicker.
//
// Ersetzt die alte ROI-Rangliste. Der Unterschied ist grundsätzlich:
//
//   Die Rangliste hat jeden Kauf einzeln bewertet (Kosten ÷ zusätzliche CPS)
//   und den besten genommen. Sie kannte weder Zeit noch Kontostand — dass man
//   auf einen teuren Kauf erst sparen muss, kam darin nicht vor. Deshalb konnte
//   Schritt 5 eine bessere Kennzahl haben als Schritt 1: die Liste war eine
//   Sortierung, kein Ablauf.
//
//   Dieser Planer simuliert stattdessen echte Zeit. Ein Kauf kostet Wartezeit
//   (Kosten − Kontostand) ÷ Einkommen, danach steigt das Einkommen. Bewertet
//   wird eine ganze Reihenfolge daran, wie viel sie innerhalb eines Zeitfensters
//   produziert — und produzierte Kakteen sind genau der Ranglisten-Wert
//   `totalEarned`. Die Reihenfolge im Ergebnis IST damit der empfohlene Ablauf.
//
// Suchverfahren: Beam-Search über Zeitscheiben (Details bei `planRun`). Alle
// Reihenfolgen durchzuprobieren wäre bei ~180 Kaufoptionen und mehreren hundert
// Käufen aussichtslos, deshalb überlebt pro Zeitscheibe nur eine begrenzte Zahl
// der besten Teilpläne.
//
// ⚠️ Das ist eine Näherung, kein bewiesenes Optimum — ein echtes Optimum ist
// hier nicht berechenbar. Gemessen liefern die Voreinstellungen 95-115 % des
// Ertrags eines rund zwanzigmal teureren Suchlaufs; über 100 % kommt vor, weil
// auch der teure Lauf nur eine Näherung ist.
//
// Bewusst nicht modelliert (macht den Plan konservativ, nicht falsch):
//   - Goldlauf, Gold- und Rubinkakteen (Zufall, im Schnitt ein Bonus obendrauf)
//   - Abzeichen, die während des Fensters aufgehen und den Kern-Multiplikator heben
//   - Offline-Ertrag

import { buildings, upgrades } from "/games/KaktusClicker/data.js";
import {
    ACHIEVEMENT_BONUS,
    CLICK_CPS_SHARE,
    getPrestigeAvailableTotal,
    getPrestigeMultiplier,
} from "/games/KaktusClicker/economy.js";

const PRICE_GROWTH = 1.15;

const buildingIndexById = new Map(buildings.map((b, i) => [b.id, i]));

// Kandidaten einmal vorbereiten — im Suchkern soll nichts mehr nachgeschlagen
// werden müssen.
const BUILDINGS = buildings.map((b) => ({ id: b.id, baseCost: b.baseCost, cps: b.cps, icon: b.icon }));
const UPGRADES = upgrades.map((u) => ({
    id: u.id,
    cost: u.cost,
    icon: u.icon,
    building: u.buildingId ? buildingIndexById.get(u.buildingId) : -1,
    factor: u.buildingMultiplier || 1,
    clickFactor: u.clickMultiplier || 1,
    clickCpsFactor: u.clickCpsMultiplier || 1,
    autoClicks: u.autoClicksPerSecond || 0,
    unlockOwned: u.unlockOwned || 0,
}));

// Besitz-Schwellen, ab denen Blüten-Upgrades freischalten. Der Planer braucht
// sie, um ein Gebäude auch dann als Kandidat zu behalten, wenn es für sich
// genommen schlecht dasteht, aber mit dem nächsten Kauf ein starkes Upgrade
// öffnet — sonst hätte die Kandidatenauswahl genau diesen Zug nie gesehen.
const UNLOCK_THRESHOLDS = [...new Set(UPGRADES.filter((u) => u.unlockOwned).map((u) => u.unlockOwned))];

// Order-unabhängiger Hash: gleiche Kaufmenge in anderer Reihenfolge ergibt
// denselben Zustand und darf im Beam nur einmal Platz belegen.
function mix(value) {
    let x = value | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return (x ^ (x >>> 16)) >>> 0;
}

export function getBuildingCost(baseCost, owned) {
    return Math.ceil(baseCost * Math.pow(PRICE_GROWTH, owned));
}

// --- Zustand ---------------------------------------------------------------

// coreMultiplier = Prestige × Abzeichen. Er multipliziert Produktion UND Klick,
// verändert also keine Reihenfolge — aber sehr wohl die angezeigten Zeiten.
export function getCoreMultiplier(nopal, achievementCount) {
    return getPrestigeMultiplier({ prestige: { nopal: Math.max(0, nopal) } }) *
        (1 + Math.max(0, achievementCount) * ACHIEVEMENT_BONUS);
}

export function createPlanState({ owned = {}, boughtIds = [], cash = 0 } = {}) {
    const boughtSet = new Set(boughtIds);
    // Bewusst einfache Arrays und keine typisierten: die Suche klont pro Lauf
    // mehrere hunderttausend Zustände, und für diese kurzen Längen (30 / 30 /
    // 158) ist `Array.slice()` gemessen rund viermal schneller als der Umweg
    // über einen neuen ArrayBuffer.
    const node = {
        owned: BUILDINGS.map((b) => Math.max(0, Math.floor(Number(owned[b.id]) || 0))),
        mult: BUILDINGS.map(() => 1),
        bought: UPGRADES.map((u) => (boughtSet.has(u.id) ? 1 : 0)),
        rawCps: 0,
        clickMult: 1,
        clickCpsMult: 1,
        autoClicks: 0,
        cash: Math.max(0, Number(cash) || 0),
        t: 0,
        earned: 0,
        hash: 0,
        last: null,
        value: 0,
        flow: 0,
    };

    UPGRADES.forEach((u, i) => {
        if (!node.bought[i]) return;
        if (u.building >= 0) node.mult[u.building] *= u.factor;
        node.clickMult *= u.clickFactor;
        node.clickCpsMult *= u.clickCpsFactor;
        node.autoClicks += u.autoClicks;
        node.hash ^= mix(100000 + i);
    });
    for (let i = 0; i < BUILDINGS.length; i++) {
        node.rawCps += node.owned[i] * BUILDINGS[i].cps * node.mult[i];
        node.hash ^= mix(i * 4096 + node.owned[i]);
    }
    return node;
}

// Einkommen pro Sekunde. Ausmultipliziert, damit die Kandidaten-Bewertung
// unten dieselbe Zerlegung benutzen kann:
//
//   einkommen / core = rawCps · (1 + A·S·Q) + A·K
//
// mit A = Klicks/s inklusive Autoklicker, K = Klick-Multiplikator,
// Q = Klick-Sog-Multiplikator, S = CLICK_CPS_SHARE.
function income(node, core, clickRate) {
    const a = clickRate + node.autoClicks;
    return core * (node.rawCps * (1 + a * CLICK_CPS_SHARE * node.clickCpsMult) + a * node.clickMult);
}

function cloneNode(node) {
    return {
        owned: node.owned.slice(),
        mult: node.mult.slice(),
        bought: node.bought.slice(),
        rawCps: node.rawCps,
        clickMult: node.clickMult,
        clickCpsMult: node.clickCpsMult,
        autoClicks: node.autoClicks,
        cash: node.cash,
        t: node.t,
        earned: node.earned,
        hash: node.hash,
        last: node.last,
        value: 0,
        flow: 0,
    };
}

// --- Kandidaten ------------------------------------------------------------

// Sammelt die Kaufoptionen eines Zustands und bewertet sie nach
// Kosten ÷ zusätzlichem Einkommen. Der Zuwachs wird analytisch aus der
// Zerlegung oben gebildet — kein Probe-Objekt, keine zweite Einkommens-
// Rechnung, weil diese Schleife der heißeste Pfad der ganzen Suche ist.
//
// Die Rangfolge hier wählt nur aus, WELCHE Züge die Suche überhaupt betrachtet.
// Bewertet werden sie danach über die simulierte Zeit, nicht über diesen Wert.
function collectCandidates(node, core, clickRate, limit, out) {
    out.length = 0;
    const a = clickRate + node.autoClicks;
    const cpsWeight = core * (1 + a * CLICK_CPS_SHARE * node.clickCpsMult);

    for (let i = 0; i < BUILDINGS.length; i++) {
        const gain = BUILDINGS[i].cps * node.mult[i] * cpsWeight;
        if (gain <= 0) continue;
        const cost = getBuildingCost(BUILDINGS[i].baseCost, node.owned[i]);
        out.push({
            kind: 0,
            index: i,
            cost,
            roi: cost / gain,
            // Ein Kauf, der eine Blüten-Schwelle erreicht, bleibt immer im
            // Rennen: für sich genommen kann er mies aussehen und trotzdem der
            // einzige Weg zu einem starken Upgrade sein.
            forced: UNLOCK_THRESHOLDS.includes(node.owned[i] + 1),
        });
    }

    for (let i = 0; i < UPGRADES.length; i++) {
        if (node.bought[i]) continue;
        const u = UPGRADES[i];
        if (u.unlockOwned && node.owned[u.building] < u.unlockOwned) continue;

        let gain = 0;
        if (u.building >= 0) {
            gain += node.owned[u.building] * BUILDINGS[u.building].cps * node.mult[u.building] * (u.factor - 1) * cpsWeight;
        }
        if (u.clickFactor !== 1) {
            gain += core * a * node.clickMult * (u.clickFactor - 1);
        }
        if (u.clickCpsFactor !== 1) {
            gain += core * node.rawCps * a * CLICK_CPS_SHARE * node.clickCpsMult * (u.clickCpsFactor - 1);
        }
        if (u.autoClicks) {
            gain += core * u.autoClicks * (node.clickMult + CLICK_CPS_SHARE * node.clickCpsMult * node.rawCps);
        }
        if (gain <= 0) continue;
        out.push({ kind: 1, index: i, cost: u.cost, roi: u.cost / gain, forced: false });
    }

    out.sort(byRoi);
    if (out.length > limit) {
        // Erzwungene Kandidaten hinter dem Schnitt trotzdem behalten.
        for (let i = limit; i < out.length; i++) {
            if (out[i].forced) out[limit++] = out[i];
        }
        out.length = limit;
    }
    return out;
}

const byRoi = (a, b) => a.roi - b.roi;

function applyPurchase(node, candidate) {
    const next = cloneNode(node);
    const i = candidate.index;
    if (candidate.kind === 0) {
        next.rawCps += BUILDINGS[i].cps * next.mult[i];
        next.hash ^= mix(i * 4096 + next.owned[i]);
        next.owned[i] += 1;
        next.hash ^= mix(i * 4096 + next.owned[i]);
    } else {
        const u = UPGRADES[i];
        if (u.building >= 0) {
            next.rawCps += next.owned[u.building] * BUILDINGS[u.building].cps * next.mult[u.building] * (u.factor - 1);
            next.mult[u.building] *= u.factor;
        }
        next.clickMult *= u.clickFactor;
        next.clickCpsMult *= u.clickCpsFactor;
        next.autoClicks += u.autoClicks;
        next.bought[i] = 1;
        next.hash ^= mix(100000 + i);
    }
    return next;
}

// --- Suche -----------------------------------------------------------------

// Für den Prestige-Vergleich reicht eine schmalere Suche: verglichen werden
// zwei Ergebnisse derselben Suche, und das Urteil war in Tests bis hinunter zu
// Breite 16 unverändert. Kostet ein Drittel der Zeit — und hier laufen sechs
// Suchläufe statt einem.
export const PRESTIGE_SEARCH = {
    beamWidth: 24,
    candidateLimit: 8,
};

export const DEFAULT_SEARCH = {
    beamWidth: 48,
    candidateLimit: 10,
    // Zeitscheiben werden aus dem Fenster abgeleitet statt fest gezählt: eine
    // Scheibe soll ungefähr so lang sein wie der Abstand zweier Käufe. Fest
    // gesetzt war ein 24-Stunden-Fenster deutlich schlechter versorgt als ein
    // einstündiges (74 % statt 97 %).
    secondsPerBucket: 28,
    minBuckets: 96,
    maxBuckets: 320,
    // Wie viele Runden sofort bezahlbarer Käufe eine Zeitscheibe abarbeitet,
    // bevor der Rest in die nächste weitergereicht wird.
    roundsPerBucket: 4,
};

/**
 * Sucht die Kauf-Reihenfolge, die innerhalb von `horizonSeconds` am meisten
 * produziert. Rückgabe: { steps, earned, endCps, startCps }.
 *
 * Die Suche läuft in Zeitscheiben, nicht in Kaufschritten — das ist der Punkt,
 * an dem zwei frühere Anläufe gescheitert sind. Nach Kaufschritten sortiert
 * stehen in derselben Ebene Zustände nach 4 billigen Käufen (Minute 1) neben
 * solchen nach 4 teuren (Minute 50). Die sind nicht vergleichbar, und jede
 * Bewertung, die es trotzdem versucht, bevorzugt systematisch eine der beiden
 * Sorten. Messbar war das daran, dass MEHR Kandidaten das Ergebnis schlechter
 * machten — ein Suchverfahren, dem zusätzliche Optionen schaden, misst falsch.
 *
 * Innerhalb einer Zeitscheibe sind die Zustände dagegen direkt vergleichbar,
 * und dann reicht das ehrliche Maß: was hat der Plan produziert und was
 * produziert er bis zum Ende weiter. Keine Extrapolation, keine Wachstums-
 * schätzung.
 */
export function planRun(startNode, {
    horizonSeconds,
    coreMultiplier,
    clicksPerSecond = 0,
    beamWidth = DEFAULT_SEARCH.beamWidth,
    candidateLimit = DEFAULT_SEARCH.candidateLimit,
    timeBuckets = 0,
    roundsPerBucket = DEFAULT_SEARCH.roundsPerBucket,
} = {}) {
    if (!timeBuckets) {
        timeBuckets = Math.max(
            DEFAULT_SEARCH.minBuckets,
            Math.min(DEFAULT_SEARCH.maxBuckets, Math.round(horizonSeconds / DEFAULT_SEARCH.secondsPerBucket)),
        );
    }
    const core = coreMultiplier;
    const rate = Math.max(0, clicksPerSecond);
    // Gleich breite Zeitscheiben. Logarithmische wurden ausprobiert — die
    // Vermutung war, dass sich die Käufe am Anfang ballen und die frühe Phase
    // mehr Auflösung braucht. Gemessen war es durchweg schlechter (über 24 h
    // halbierte sich die Qualität), weil die teuren späten Käufe dann in sehr
    // groben Scheiben zusammenfallen. Genau die entscheiden das Ergebnis.
    const bucketWidth = horizonSeconds / timeBuckets;

    // Ehrlicher Wert: bereits produziert plus das, was bis zum Ende des Fensters
    // noch dazukommt, wenn ab jetzt nichts mehr gekauft wird. Unterschätzt nie —
    // jeder weitere Kauf macht es nur besser.
    const measure = (node) => {
        node.flow = income(node, core, rate);
        node.value = node.earned + node.flow * (horizonSeconds - node.t);
        return node;
    };

    const bucketOf = (t) => Math.min(timeBuckets - 1, Math.floor(t / bucketWidth));
    const byValue = (a, b) => b.value - a.value;

    // Zustände mit identischer Kaufmenge sind derselbe Zustand, egal über welche
    // Reihenfolge man dorthin kam — pro Kaufmenge bleibt nur der beste.
    const prune = (nodes, keep) => {
        const seen = new Map();
        for (const node of nodes) {
            const other = seen.get(node.hash);
            if (!other || node.value > other.value) seen.set(node.hash, node);
        }
        return [...seen.values()].sort(byValue).slice(0, keep);
    };

    const frontier = Array.from({ length: timeBuckets }, () => []);
    measure(startNode);
    frontier[0].push(startNode);

    let best = startNode;
    let bestValue = startNode.value;
    const candidates = [];

    for (let b = 0; b < timeBuckets; b++) {
        if (!frontier[b].length) continue;
        let generation = prune(frontier[b], beamWidth);
        frontier[b] = null;

        // Käufe, die man sich sofort leisten kann, landen in derselben
        // Zeitscheibe. Die werden in Generationen abgearbeitet statt in einer
        // unbegrenzt wachsenden Liste — sonst frisst eine einzige Zeitscheibe
        // das ganze Budget. Was am Ende übrig ist, wandert in die nächste
        // Scheibe weiter und geht dadurch nicht verloren.
        for (let round = 0; round < roundsPerBucket && generation.length; round++) {
            const sameBucket = [];

            for (const node of generation) {
                if (node.value > bestValue) {
                    bestValue = node.value;
                    best = node;
                }
                const flow = node.flow;
                if (!(flow > 0)) continue;

                collectCandidates(node, core, rate, candidateLimit, candidates);
                for (let c = 0; c < candidates.length; c++) {
                    const candidate = candidates[c];
                    const wait = node.cash >= candidate.cost ? 0 : (candidate.cost - node.cash) / flow;
                    const t = node.t + wait;
                    // Käufe nach dem Zeitfenster tragen nichts mehr bei.
                    if (t > horizonSeconds) continue;

                    const next = applyPurchase(node, candidate);
                    next.t = t;
                    next.earned = node.earned + flow * wait;
                    next.cash = node.cash + flow * wait - candidate.cost;
                    next.last = { prev: node.last, kind: candidate.kind, index: candidate.index, t, cost: candidate.cost };
                    measure(next);

                    // Weitergereichte Zustände behalten ihre echte Zeit und
                    // können in einer schon erledigten Scheibe landen — dann
                    // gehören sie in die aktuelle.
                    const target = Math.max(b, bucketOf(t));
                    if (target === b) sameBucket.push(next);
                    else frontier[target].push(next);
                }
            }

            generation = prune(sameBucket, beamWidth);
        }

        // Rest der Zeitscheibe mitnehmen statt fallen lassen.
        if (generation.length && b + 1 < timeBuckets) {
            frontier[b + 1].push(...generation);
        }
    }

    const steps = [];
    for (let link = best.last; link; link = link.prev) steps.unshift(link);

    return {
        steps: steps.map((link, i) => ({
            step: i + 1,
            kind: link.kind === 0 ? "building" : "upgrade",
            id: link.kind === 0 ? BUILDINGS[link.index].id : UPGRADES[link.index].id,
            index: link.index,
            atSeconds: link.t,
            cost: link.cost,
        })),
        earned: bestValue,
        endCps: best.rawCps * core,
        startCps: startNode.rawCps * core,
    };
}

// --- Prestige --------------------------------------------------------------

export function getPrestigeOutlook({ totalEarned, nopal, totalNopalEarned }) {
    const availableTotal = getPrestigeAvailableTotal({ totalEarned: Math.max(0, totalEarned) });
    const newNopal = Math.max(0, availableTotal - Math.max(0, totalNopalEarned));
    const currentMultiplier = getPrestigeMultiplier({ prestige: { nopal: Math.max(0, nopal) } });
    const afterMultiplier = getPrestigeMultiplier({ prestige: { nopal: Math.max(0, nopal) + newNopal } });

    // Wie viel totalEarned bis zum nächsten Nopal fehlt (identisch zu getNopalGap
    // im Spiel, hier ohne den vollen State).
    const nextTotal = Math.max(0, totalNopalEarned) + newNopal + 1;
    const nextTarget = Math.pow(nextTotal, 1 / 0.35) * 1e6;

    return {
        availableTotal,
        newNopal,
        currentMultiplier,
        afterMultiplier,
        ratio: afterMultiplier / currentMultiplier,
        missingForNext: Math.max(0, nextTarget - totalEarned),
    };
}

/**
 * Vergleicht "weiterspielen" gegen "jetzt prestigen" für mehrere Zeitfenster.
 *
 * Beide Seiten laufen durch denselben Planer, es wird also nicht geschätzt
 * sondern gerechnet: die Prestige-Seite startet bei null Gebäuden, null
 * Upgrades und null Kakteen, dafür mit dem höheren Kern-Multiplikator.
 *
 * Ohne Klicks pro Sekunde kann die Prestige-Seite nicht anlaufen (kein
 * Einkommen, kein Startkapital) — deshalb ist `clicksPerSecond` hier Pflicht
 * und wird für beide Seiten gleich angesetzt.
 */
export function evaluatePrestige({
    owned,
    boughtIds,
    cash,
    totalEarned,
    nopal,
    totalNopalEarned,
    achievementCount,
    clicksPerSecond,
    horizons,
    search = {},
}) {
    const outlook = getPrestigeOutlook({ totalEarned, nopal, totalNopalEarned });
    if (outlook.newNopal <= 0) return { outlook, comparisons: [], verdict: "no-nopal" };

    const keepCore = getCoreMultiplier(nopal, achievementCount);
    const resetCore = getCoreMultiplier(nopal + outlook.newNopal, achievementCount);
    const keepStart = createPlanState({ owned, boughtIds, cash });
    const resetStart = createPlanState({ owned: {}, boughtIds: [], cash: 0 });

    const comparisons = horizons.map((horizonSeconds) => {
        const keep = planRun(keepStart, { horizonSeconds, coreMultiplier: keepCore, clicksPerSecond, ...search });
        const reset = planRun(resetStart, { horizonSeconds, coreMultiplier: resetCore, clicksPerSecond, ...search });
        return {
            horizonSeconds,
            keepEarned: keep.earned,
            resetEarned: reset.earned,
            keepCps: keep.endCps,
            resetCps: reset.endCps,
            prestigeWins: reset.earned > keep.earned,
        };
    });

    const first = comparisons.find((c) => c.prestigeWins);
    return {
        outlook,
        comparisons,
        verdict: first ? "worth-it" : "wait",
        breakEvenSeconds: first ? first.horizonSeconds : null,
    };
}
