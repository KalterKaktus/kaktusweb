export const FISHING_CHANGELOG = [
    {
        date: "24.05.2026",
        title: "Neue Angel-UI",
        items: [
            "Neue entspannte Hintergrundmusik im Loop für einen ruhigeren Fishing-Vibe.",
            "Beim Halten im Fang-Minispiel läuft jetzt ein Rollen-Sound, beim Loslassen pausiert er sauber.",
            "Aus „Shop\" wird „Angel\" — du siehst jetzt deine richtige Angel mit allen Teilen oben drauf.",
            "Wechsel zwischen Rute, Schnur, Haken, Köder und Glück über die Tabs unter der Angel.",
            "Jedes Teil bekommt mit jedem Upgrade-Level einen neuen Look — von Holz über Bambus, Karbon, Silber bis Gold; Köder mutiert vom Wurm zum mythischen Köder, Glück vom Bead zum kosmischen Stern.",
            "Detail-Panel rechts zeigt Level-Dots, Beschreibung und einen großen Upgrade-Button.",
        ],
    },
    {
        date: "24.05.2026",
        title: "Wetter-Performance — Sturm und Nebel optimiert",
        items: [
            "Sturm und Regen: weniger, dafür größere Regentropfen-Ringe statt vielen kleinen — bleibt visuell dramatisch, läuft aber deutlich flüssiger.",
            "Nebel: schlichter weißer Schleier statt animierter Wolken-Textur — kein Lag mehr beim Event-Wechsel.",
        ],
    },
    {
        date: "24.05.2026",
        title: "Doppelter Index + Performance",
        items: [
            "Doppelt so viele Fische zum Sammeln — Pond, Lake und Ocean haben jeweils neue Arten in allen Raritäten.",
            "Fish Index zeigt jetzt nur die Fische deiner aktuellen Area mit voller Animation — andere Areas zeigen den Fortschritts-Counter und einen Hinweis zum Wechseln.",
            "Performance: deutlich schnelleres Öffnen des Fish-Index, weniger Ruckler beim Anzeigen.",
            "Nebel-Event auf Mobile/iPad: leichteres Rendering, kein Lag mehr beim Event-Wechsel.",
        ],
    },
    {
        date: "24.05.2026",
        title: "Daily Login-Belohnungen",
        items: [
            "Jeder Tag in Folge bringt eine Belohnung — Coins steigen pro Tag, Tag 7 ist immer der Special.",
            "Woche 1 Tag 7: garantierte Epic-Fischstelle. Woche 2 Tag 7: 2× Epic. Ab Woche 3: garantierte Legendary-Fischstelle.",
            "Längere Streaks skalieren die Coin-Belohnung sanft hoch (12 % pro Woche, gedeckelt) — bleibt aber Beilage, kein Ersatz fürs aktive Spielen.",
            "Streak resettet wenn du einen Tag aussetzt — also lieber täglich kurz reinschauen!",
            "Karl die Schildkröte taucht jetzt maximal einmal pro Stunde auf (vorher alle 30 Min).",
        ],
    },
    {
        date: "24.05.2026",
        title: "Bella's Schildkröte Karl",
        items: [
            "Karl die Schildkröte taucht zufällig alle ~30 Minuten im Wasser auf (global synchron für alle Spieler).",
            "Tippe ihn an und putze seinen Panzer sauber — wisch den Schmutz mit Finger oder Maus weg.",
            "Sauberer Panzer = Glücksrad mit Belohnungen: Coins von 10 bis 10.000 oder garantierte Epic/Legendary-Fischstellen.",
            "Belohnungen skalieren mit deiner aktuellen Area — Legendary-Spawn gibt's nur im Ocean.",
            "Tolerant: ein paar Dreckkrümel reichen nicht zum Sauber-Sein, aber 85 % genügt — kein Pixel-Perfektion nötig.",
        ],
    },
    {
        date: "23.05.2026",
        title: "Entspannteres Tempo + Mobile-Polish",
        items: [
            "Loading-Screen beim Öffnen — kein weißer Flash mehr beim Direkt-Link.",
            "Fischstellen tauchen jetzt entspannt auf — ohne Köder ca. alle 10 s, mit Maxlevel ca. alle 2-3 s.",
            "Sie bleiben 4 s sichtbar (ohne Köder) bis 12 s (Maxlevel).",
            "Upgrade-Texte komplett vereinfacht — weniger Fachchinesisch.",
            "iPhone-Lupe beim Doppeltippen im Fang-Menü wird jetzt zuverlässig unterdrückt.",
            "Performance: Wasser pausiert automatisch wenn das Fang-Fenster offen ist oder der Tab versteckt — spart Akku.",
            "Auf Tablets/Smartphones reduzierte Blur-Effekte für flüssigere Performance.",
        ],
    },
    {
        date: "23.05.2026",
        title: "Köder ersetzt Sonar",
        items: [
            "Sonar heisst jetzt Köder — passt thematisch besser.",
            "Mit jedem Level: +1 Fischstelle parallel (max 6) und längere Verweildauer.",
        ],
    },
    {
        date: "23.05.2026",
        title: "Force-Spawn-Events",
        items: [
            "Admins können jetzt garantierte Epic- oder Legendary-Fischstellen für alle Online-Spieler auftauchen lassen.",
            "Force-Spawn-Spots leuchten lila (Epic) oder gold (Legendary) und bleiben länger sichtbar.",
            "Wer einen Force-Spawn-Spot antippt, kriegt garantiert die entsprechende Rarity — auch im Pond kann man so Legendary fangen.",
        ],
    },
    {
        date: "23.05.2026",
        title: "Mehr Spannung beim Fang",
        items: [
            "Neue Schnur-Spannung im Fang-Menü: bleibt der Fisch zu lange ausserhalb der Zone, reisst die Schnur und du verlierst den Catch.",
            "Better Line dämpft das Ausreissen, Better Hook füllt die Schnur-Spannung dafür schneller wieder auf.",
            "Sonar-Upgrade ist deutlich spürbarer: ohne Sonar dauert es lange bis ein Fisch auftaucht, jedes Level beschleunigt das massiv.",
            "Mit voll ausgebautem Sonar (Level 5) können jetzt zwei Fischstellen gleichzeitig auf dem Wasser sein.",
            "Fischstellen verschwinden schneller — wer zu lange wartet, verpasst den Fang.",
        ],
    },
    {
        date: "23.05.2026",
        title: "Launch — V1",
        items: [
            "Drei Areas: Pond, Lake, Ocean — schalte sie über Prestige frei.",
            "Sammle Fische in deinem Fish Index und tracke beste Gewichte.",
            "Coin-Fische ziehen ab und zu durchs Bild — antippen für Bonus-Coins.",
            "Wetter-Events laufen global im 30-Minuten-Takt: Sonnig, Regen, Sturm, Nebel und Nacht ändern Wasser und Buffs für 5 Minuten.",
            "Upgrades für Rute, Schnur, Haken, Köder und Sonar pushen Fang-Chancen und Spawn-Rate.",
            "Cloud-Speicher: log dich ein und dein Fortschritt syncht geräteübergreifend.",
            "Live-Rangliste sortiert nach Prestige und gefangenen Fischen.",
            "Epische und legendäre Fänge werden allen Online-Spielern angekündigt.",
        ],
    },
];
