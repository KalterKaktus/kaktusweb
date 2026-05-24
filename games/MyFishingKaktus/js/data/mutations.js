// Mutationen — multiplikative Coin-Bonuses auf gefangene Fische.
//
// Zwei Kategorien:
//   1) Standard-Mutationen — IMMER würfelbar (10 % pro Catch). BIG / HUGE / SHINY.
//   2) Event-Mutationen — nur während eines bestimmten Wetter-Events. Higher
//      multiplier the rarer the event (×3 Polarlicht → ×10 Geistermeer).
//
// Stacking: Beide Würfel sind unabhängig — kann SHINY (×3) UND HAUNTED (×10)
// gleichzeitig kriegen → Endmultiplikator ×30. Effektive Wahrscheinlichkeit für
// Doppel-Mutation ist im "5 %"-Bereich (z.B. 10 % std × 30 % polarlicht = 3 %).

export const STANDARD_MUTATION_CHANCE = 0.10;

// Gewichte sind relativ — innerhalb der Standard-Pool wird per Weight gepicked.
// 65/25/10 → BIG dominiert, SHINY ist seltenes Premium.
export const STANDARD_MUTATIONS = [
    { id: "big",   name: "BIG",   mult: 1.5, color: "#7ee2a3", weight: 65 },
    { id: "huge",  name: "HUGE",  mult: 2.0, color: "#ffd166", weight: 25 },
    { id: "shiny", name: "SHINY", mult: 3.0, color: "#ffe680", weight: 10, glow: true },
];

// Event-spezifische Mutationen. Pro Event-Type genau eine Mutation, definiert in
// WEATHER_EVENTS via {mutation: "abyssal", mutationChance: 0.15}.
//
// Aufteilung:
//   - Standard-5-Events (sunny/wet/stormy/misty/nocturnal): ×2, kein Glow — wirken
//     wie eine zweite "Standard-Mutation" mit Wetter-Flavour.
//   - Rare-Events (abyssal/aurora/ember/crimson/haunted): ×3 bis ×10, mit Glow.
export const EVENT_MUTATIONS = {
    // Standard-Wetter — modest ×2 Bonus, häufig (20 % during event)
    sunny:     { id: "sunny",     name: "SUNNY",     mult: 2, color: "#ffd166" },
    wet:       { id: "wet",       name: "WET",       mult: 2, color: "#7ec0ff" },
    stormy:    { id: "stormy",    name: "STORMY",    mult: 2, color: "#9aa6ff" },
    misty:     { id: "misty",     name: "MISTY",     mult: 2, color: "#c8d8e6" },
    nocturnal: { id: "nocturnal", name: "NOCTURNAL", mult: 2, color: "#a3a4ff" },
    // Rare-Wetter — höherer Mult, mit Glow
    abyssal:   { id: "abyssal",   name: "ABYSSAL",   mult: 4,  color: "#5fb8ff", glow: true },
    aurora:    { id: "aurora",    name: "AURORA",    mult: 3,  color: "#a3ff8c", glow: true },
    ember:     { id: "ember",     name: "EMBER",     mult: 5,  color: "#ff7a3a", glow: true },
    crimson:   { id: "crimson",   name: "CRIMSON",   mult: 7,  color: "#ff4060", glow: true },
    haunted:   { id: "haunted",   name: "HAUNTED",   mult: 10, color: "#c8f5ff", glow: true },
};

export const MUTATIONS_BY_ID = Object.fromEntries(
    [...STANDARD_MUTATIONS, ...Object.values(EVENT_MUTATIONS)].map((m) => [m.id, m])
);

function pickWeighted(pool) {
    const total = pool.reduce((s, m) => s + m.weight, 0);
    let roll = Math.random() * total;
    for (const m of pool) {
        roll -= m.weight;
        if (roll <= 0) return m;
    }
    return pool[0];
}

export function rollStandardMutation() {
    if (Math.random() > STANDARD_MUTATION_CHANCE) return null;
    return pickWeighted(STANDARD_MUTATIONS);
}

export function rollEventMutation(event) {
    if (!event || !event.mutation || !event.mutationChance) return null;
    if (Math.random() > event.mutationChance) return null;
    return EVENT_MUTATIONS[event.mutation] || null;
}

/**
 * Wendet eine Liste Mutationen auf einen Catch an. Multipliziert candidate.value
 * mit dem Produkt aller Mults und hängt mutations + mutationMult an.
 * Liefert die unveränderte candidate-Referenz zurück wenn keine Mutationen.
 */
export function applyMutationsToCandidate(candidate, mutations) {
    if (!mutations || !mutations.length) return candidate;
    const mult = mutations.reduce((m, mut) => m * mut.mult, 1);
    return {
        ...candidate,
        value: Math.max(1, Math.round(candidate.value * mult)),
        mutations: mutations.map((m) => m.id),
        mutationMult: mult,
    };
}

/**
 * Convenience: würfelt Standard + (optional) Event-Mutation und liefert beide
 * als Array (kann leer sein).
 */
export function rollMutations(event) {
    const out = [];
    const std = rollStandardMutation();
    if (std) out.push(std);
    const ev = rollEventMutation(event);
    if (ev) out.push(ev);
    return out;
}
