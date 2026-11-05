# Fortschritt

Aktualisiert: **2026-11-05, 22:25 Uhr (Europe/Berlin)**. Branch: `feature/kaktuslife`. Keine Veröffentlichung, kein Push und keine produktive Migration. Erster lokaler Meilenstein: `4de6a52c`.

## Wiederaufnahme nach Unterbrechung

1. `git status --short`, `git log -4 --oneline` und diese Notiz lesen; vorhandene Änderungen nicht verwerfen.
2. [[Offene Aufgaben]] lesen. Der aktuelle Code ist implementiert, **vollständige Browserabnahme ist noch offen**; finales Balancing ist bestanden.
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
| Node-Regel-, Verbindungs- und Serverprüfungen | 38 Tests bestanden (16 Regeln, 11 Verbindung, 11 Server) |
| Echte lokale PostgreSQL/PGlite-Migration | Migration erneut anwendbar und vorhandene Daten erhalten |
| SQL-Sicherheits-/Nebenläufigkeitstests | Browserzugriffe gesperrt, fremde Accounts gesperrt, CAS-Rennen und stale UUID-Wiederholung korrekt, Limits/Bans geprüft |
| Vollpartie über echte Netlify-Funktion und SQL | 123 bestätigte Aktionen im ersten Lauf, Abschluss und Rematch-Bereitschaft erfolgreich; Auth lokal simuliert |
| Netlify-Paketierung | `@netlify/zip-it-and-ship-it` 16.6.0 bündelt Engine/Katalog; gebündelte Funktion startet Spiel mit HTTP 200 |
| Simulationen | Finale 10.000 vollständige Partien und 1.149.397 Aktionen bestanden; Startspieler 49,53 %, Studium 52,47 %, Einzelberufe 46,36–54,60 %. Vollbericht `shared/RULES.md` |
| Visuelle Erstprüfung | Desktop 1440 px und Mobil 390 px als Screenshots angesehen; kein horizontaler Überlauf, vergrößerbare Brettansicht ergänzt |

## Aktueller Arbeitsstand

- Engine: finales Balancing und Regeltests abgeschlossen; siehe `shared/RULES.md`. Keine erneute Regelimplementierung nötig.
- UI: gleiche Revision erhält geöffnete Details, Codes auf 10 Zeichen geprüft, kurze Brettlabels, Radwert/Zielfeld korrekt getrennt, Auth-Navigation gestylt, vergrößerbares Brett ergänzt.
- Verbindung: exakte unbestätigte Anfrage über Neuladen/neuere Revision bewahrt, Actor-Bindung, blockierter Speicher und Abbruch alter Polls getestet.
- Browserharness: `tests/browser.integration.mjs`; nutzt isolierte Konten, echten Servercode und echte lokale SQL-Funktionen. **Vollpartie noch nicht bestanden:** wiederholte mobile Radaktion wird vom Browser als kontinuierlich instabiles Element erkannt. Keine Laufzeitfehler und kein falscher SQL-Stand; Scroll-/Fokus-/Touch-Verhalten wird untersucht. Nicht mit erzwungenen Klicks übergehen.
- Aktueller Diagnoseversuch nutzt echte Touch-Taps auf Mobilansichten und protokolliert Elementpositionen. Bei neuer Sitzung nur einen laufenden Diagnoseprozess fortsetzen bzw. nach Behebung gezielt neu ausführen.
- Temporäre Paketierungsprüfung liegt außerhalb des Repos im Sitzungsordner `work/netlify-bundle-check/check.mjs`; dieser Nachweis wurde bereits erbracht, erneute Installation ist nicht erforderlich.

## Nächste konkrete Schritte

1. Mobile Rad-Klickstabilität im Browserharness untersuchen/beheben; unabhängig davon Produktions-Auth-Navigation, vergrößertes Brett und Hilfedialog prüfen.
2. `node games/KaktusLife/tests/browser.integration.mjs` aus dem Repo-Stamm ausführen (gepinnten Entwicklungsabhängigkeiten sind lokal installiert). Desktop/Mobil/RU, Wiederverbindung, Vollpartie und Rematch prüfen. Vorher aktuelle Übersetzungen mit `node games/KaktusLife/tests/sync-translations.mjs` synchronisieren.
3. Screenshots ansehen, normale Animation zusätzlich zu reduzierter Bewegung prüfen, produktive Auth-Navigation lokal simuliert kontrollieren.
4. Balancing ist abgeschlossen; nur bei erneuten Regeländerungen wiederholen. Alle tatsächlichen Grenzen in Notizen erhalten.
5. Tests passend zu finalen Änderungen abschließen und lokalen Abschlusscommit erstellen.
6. Produktive Migration/Deployment und echte Zwei-Account-Abnahme bleiben bis ausdrücklicher Freigabe offen.
