# Fortschritt

Aktualisiert: **2026-11-05, 22:15 Uhr (Europe/Berlin)**. Branch: `feature/kaktuslife`. Keine Veröffentlichung, kein Push und keine produktive Migration.

## Wiederaufnahme nach Unterbrechung

1. `git status --short`, `git log -4 --oneline` und diese Notiz lesen; vorhandene Änderungen nicht verwerfen.
2. [[Offene Aufgaben]] lesen. Der aktuelle Code ist weitgehend implementiert, **Browserabnahme und endgültiger Balancingnachweis sind noch offen**.
3. Bereits bestandene Prüfungen unten nicht erneut als Entwicklungsaufgaben behandeln. Bei weiteren Codeänderungen nur betroffene Prüfungen und abschließend die Gesamtsuite ausführen.
4. Die unten genannten konkreten nächsten Schritte fortsetzen. Nach jedem sinnvollen Meilenstein diese Notiz aktualisieren und lokal auf dem Feature-Branch committen.

## Implementiert

- Eigenständige ES-Module, 81 Felder, 11 verpflichtende Lebensstationen und faires Rad 1–10.
- Studium/Beruf, sechs Karrieren, zwei wirtschaftliche Lebensstile, Partnerschaft, Kinder, drei Häuser, Versicherung, automatische Kredite/Zinsen, Anlagen/Tilgung, Ruhestand und transparente Wertung.
- 40 originale zweisprachige Ereignisse, unveränderliche Zustandsübergänge und deterministische Simulation.
- Authentifizierte Netlify-API mit serverseitigem Zufall, privater Zwei-Personen-Lobby, Bereitschaft, Start, gespeicherten Aktionen, Revisionen, UUID-Idempotenz und neuer Partie.
- SQL-Migration mit gesperrten Browserrollen, Mitgliedschaftsprüfung, Sperren, Limits und atomaren Anfragen; **nur vorbereitet**.
- Verbindungsschicht mit bestehender Site-Session, Raumwiederaufnahme und adaptivem Snapshot-Abgleich.
- SVG-Brettwelt, Glücksrad, Figuren, Entscheidungskarten, Spieleranzeigen und Ergebnisoberfläche; UI-Feinschliff noch im Gang.
- Lokales Zwei-Personen-Übungsspiel mit Browser-Speicherung, DE/RU-Einbindung, Spiele-Hub-Karte, Obsidian-Struktur und Projektkarte.

## Tatsächlich bestanden

| Prüfung | Befund |
| --- | --- |
| Node-Regel-, Verbindungs- und Serverprüfungen | 29 Tests bestanden |
| Echte lokale PostgreSQL/PGlite-Migration | Migration erneut anwendbar und vorhandene Daten erhalten |
| SQL-Sicherheits-/Nebenläufigkeitstests | Browserzugriffe gesperrt, fremde Accounts gesperrt, CAS-Rennen und stale UUID-Wiederholung korrekt, Limits/Bans geprüft |
| Vollpartie über echte Netlify-Funktion und SQL | 123 bestätigte Aktionen im ersten Lauf, Abschluss und Rematch-Bereitschaft erfolgreich; Auth lokal simuliert |
| Netlify-Paketierung | `@netlify/zip-it-and-ship-it` 16.6.0 bündelt Engine/Katalog; gebündelte Funktion startet Spiel mit HTTP 200 |
| Simulationen | Kleine Diagnosepartien beendet; Verbesserungen an Mieten, Karriere, Familien- und Erinnerungsentscheidungen umgesetzt. Finaler 10.000-Partien-Lauf läuft/ausstehend |

## Aktueller Arbeitsstand

- Engine: finale Gehälter zuletzt 36.000/35.000/34.000 für Studienberufe, Forschung 17.000 je Prämie. Finale Simulation nach diesen Änderungen noch dokumentieren (`shared/RULES.md`).
- UI: Stylesheet liegt vor. Offene Detailkorrekturen: gleiche Revision nicht neu rendern, 10-Zeichen-Codes, kurze Brettlabels, verständlicher Radwert vs. tatsächliches Zielfeld, Auth-Navigation.
- Browserharness ist vorbereitet: `tests/browser.integration.mjs`; nutzt isolierte Konten, echten Servercode und echte lokale SQL-Funktionen. **Noch nicht erfolgreich ausgeführt.**
- Temporäre Paketierungsprüfung liegt außerhalb des Repos im Sitzungsordner `work/netlify-bundle-check/check.mjs`; dieser Nachweis wurde bereits erbracht, erneute Installation ist nicht erforderlich.

## Nächste konkrete Schritte

1. UI-Korrekturen fertigstellen; `node games/KaktusLife/tests/sync-translations.mjs` ausführen.
2. `node games/KaktusLife/tests/browser.integration.mjs` aus dem Repo-Stamm ausführen (gepinnten Entwicklungsabhängigkeiten sind lokal installiert). Desktop/Mobil/RU, Wiederverbindung, Vollpartie und Rematch prüfen, Fehler beheben.
3. Screenshots ansehen, normale Animation zusätzlich zu reduzierter Bewegung prüfen, produktive Auth-Navigation lokal simuliert kontrollieren.
4. Finale 10.000-Partien-Statistik und tatsächliche Grenzen dokumentieren; [[Wirtschaft und Balancing]] vervollständigen.
5. Tests passend zu finalen Änderungen abschließen und lokalen Abschlusscommit erstellen.
6. Produktive Migration/Deployment und echte Zwei-Account-Abnahme bleiben bis ausdrücklicher Freigabe offen.
