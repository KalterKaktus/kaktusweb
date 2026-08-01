// Übersetzte Anzeigenamen für Gebäude, Upgrades und Abzeichen.
//
// Diese Logik lag vorher dreifach vor — in game.js, wiki/optimizer.js und der
// Wiki-Tabellengenerierung. Als Economy V3 die Blüten-Upgrades einführte, wurde
// nur ein Teil der Kopien nachgezogen: der Optimizer zeigte daraufhin mehrere
// verschiedene Upgrades alle als „<Gebäude> Kern" an. Deshalb hier einmal
// zentral.
//
// Prinzip: Erst einen eigenen i18n-Key versuchen. Für die generierten
// Gebäude-Upgrades gibt es keinen — deren Name wird aus dem Gebäudenamen plus
// einem Suffix zusammengesetzt. Fällt beides aus, greift der deutsche
// Originaltext aus data.js.

import { t } from "/js/i18n.js";

export function buildingName(building) {
    const key = `clicker.buildings.${building.id}.name`;
    const value = t(key);
    return value === key ? building.name : value;
}

export function upgradeName(upgrade) {
    const key = `clicker.upgrades.${upgrade.id}.name`;
    const value = t(key);
    if (value !== key) return value;

    if (upgrade.buildingId) {
        const bKey = `clicker.buildings.${upgrade.buildingId}.name`;
        const bValue = t(bKey);
        if (bValue !== bKey) {
            // Blüten-Stufen tragen `tier` (10/25/50/100) und haben je einen
            // eigenen Suffix-Key. Ohne diese Abfrage hießen sie alle „… Kern".
            if (upgrade.tier) {
                const tierKey = `clicker.upgrade_tier_${upgrade.tier}`;
                const tierValue = t(tierKey, { name: bValue });
                if (tierValue !== tierKey) return tierValue;
            } else {
                return t("clicker.upgrade_core_suffix", { name: bValue });
            }
        }
    }
    return upgrade.name;
}

export function upgradeDescription(upgrade) {
    const key = `clicker.upgrades.${upgrade.id}.description`;
    const value = t(key);
    if (value !== key) return value;

    if (upgrade.buildingId) {
        const bKey = `clicker.buildings.${upgrade.buildingId}.name`;
        const bValue = t(bKey);
        if (bValue !== bKey) return t("clicker.upgrade_prod_x2", { name: bValue });
    }
    return upgrade.description || "";
}

export function buildingDescription(building) {
    const key = `clicker.buildings.${building.id}.description`;
    const value = t(key);
    return value === key ? (building.description || "") : value;
}

export function achievementName(achievement) {
    const key = `clicker.achievements.${achievement.id}.name`;
    const value = t(key);
    return value === key ? achievement.name : value;
}

export function achievementGoal(achievement) {
    const key = `clicker.achievements.${achievement.id}.goal`;
    const value = t(key);
    return value === key ? (achievement.goal || "") : value;
}
