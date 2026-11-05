# KaktusLife: Einstieg für künftige Sitzungen

Vor Änderungen `brain/Start.md`, `brain/Architektur.md`, `brain/Fortschritt.md` und die betroffenen Fachnotizen lesen. Bestehenden Obsidian-Vault `brain/` nutzen. Notizen nach Änderungen mit dem Code abgleichen, offene Nachweise ausdrücklich als offen führen.

- Ausschließlich Feature-Branches; niemals ohne ausdrückliche Freigabe auf main pushen, produktive Migrationen anwenden oder deployen.
- Eigenständige native ES-Module unter `/games/KaktusLife/`; kein Build erforderlich. Andere Spiele unverändert halten.
- `shared/engine.mjs` ist die einzige Regelimplementierung für Server und lokales Übungsspiel. Online-Zufall/Spielstände ausschließlich serverseitig. Browser sendet nur Absichten.
- Neue Regeln durch vollständige deterministische Partien und gezielte Invarianten prüfen. Änderungen an Zahlen mit `node games/KaktusLife/tests/balance.mjs` untersuchen.
- Tests: `node --test games/KaktusLife/tests/*.test.mjs`. Browserprüfung auf Desktop und Mobilgerät; zusätzlich zwei getrennte Sitzungen für Multiplayer.
- Alle UI-Texte in DE und RU. Exportquellen `shared/catalog.mjs` und `js/translations.mjs`; beide Site-Dictionaries sowie deren Cache-Version aktuell halten.
- Farben ausschließlich in `tokens.css`; keine Farbliterale im konsumierenden Stylesheet. SVG-Grafiken selbst erstellt, keine Originalassets des Vorbilds.
- Keine Secrets, Session-Tokens oder echten Nutzerdaten in Notizen, Tests, Screenshots oder Git. `.obsidian/workspace*.json` bleibt lokal.
- Ein lokaler Test beweist keinen produktiven Zwei-Spieler-Betrieb. Freigabe-/Integrationsstatus in `brain/Fortschritt.md` und `BACKEND.md` ehrlich dokumentieren.
- Bei längerer Arbeit nach sinnvollen Meilensteinen `brain/Fortschritt.md` mit erledigten Aufgaben, aktuellen Befunden, offenen Problemen und den nächsten konkreten Schritten aktualisieren und lokal auf dem Feature-Branch committen. Vor Unterbrechungen einen fortsetzbaren Stand sichern. Keine Veröffentlichung ohne Freigabe. Beim Wiederaufnehmen Git-Status/Log und die Notizen lesen, erledigte Arbeit erhalten und nicht erneut implementieren.
