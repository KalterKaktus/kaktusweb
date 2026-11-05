# Architektur

## Bestehende Infrastruktur

Die Website liefert statische Dateien über Netlify aus. LuckyLounge demonstriert eine isolierte React-Anwendung, benötigt aber einen Build. KaktusGarden nutzt das gemeinsame Supabase-Login und geteilte Räume. KaktusLife übernimmt Authentifizierung und Dienste, benötigt wegen seiner überschaubaren Zustandsoberfläche keine zusätzliche Framework-Laufzeit.

## Module

| Pfad | Aufgabe |
| --- | --- |
| `index.html`, `styles.css`, `tokens.css` | isolierter Spieleinstieg und Designsystem |
| `js/app.js`, `js/board.js` | Oberfläche, Brett und Animationen |
| `js/audio.js` | eigene Web-Audio-Effekte nach Nutzergeste |
| `js/connection.js` | Session, authentifizierte API, Wiederholungen und Abgleich |
| `shared/catalog.mjs` | Brett, Ereignisse, Berufe und Häuser |
| `shared/engine.mjs` | reine Zustandsmaschine, für Server und Übung identisch |
| `../../netlify/functions/kaktuslife.mjs` | authentifizierter Serverendpunkt |
| `../../supabase/migrations/20261105120000_kaktuslife.sql` | private Spielräume und atomare Mutationen |
| `tests/` | Regeln, Server, Verbindung und Simulation |

Die beiden Infrastrukturpfade sind vom Repository-Stamm aus zu lesen; sie liegen außerhalb des Spielordners.

## Datenfluss

Online sendet der Browser eine Aktion, Raumnummer, Revision und Anfrage-UUID. Der Server prüft die Supabase-Session, Mitgliedschaft, Spielphase und Zugberechtigung, berechnet das Ergebnis und speichert atomar. Erst ein bestätigter Snapshot wird zur Spielwahrheit. Polling stellt verpasste Änderungen auch nach Unterbrechungen wieder her.

Im lokalen Übungsspiel läuft dieselbe Zustandsmaschine im Browser. Es wird kein Online-Spielstand daraus hochgeladen.

## Sprachsystem

Bestehendes `js/i18n.js`, DE und RU. Spieltexte liegen unter `life`. Katalog- und UI-Exports sind die Quellen für die zusammengeführten Site-Dictionaries. Neue Schlüssel müssen in beiden Sprachen vorhanden sein und eine neue Dictionary-Cache-Version erhalten.

Siehe [[Multiplayer]], [[Entscheidungen]].
