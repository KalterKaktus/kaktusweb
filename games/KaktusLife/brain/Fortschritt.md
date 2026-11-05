# Fortschritt

Aktualisiert: **2026-11-05, 22:27 Uhr (Europe/Berlin)**. Branch: `feature/kaktuslife`. Keine Veröffentlichung, kein Push und keine produktive Migration. Lokale Meilensteine: `4de6a52c` (Grundimplementierung), `595aad16` (Wiederverbindung und Balancing).

## Wiederaufnahme nach Unterbrechung

1. `git status --short`, `git log -4 --oneline` und diese Notiz lesen; vorhandene Änderungen nicht verwerfen.
2. [[Offene Aufgaben]] lesen. Kernspiel, vollständige Browserpartie und finales Balancing sind bestanden. Derzeit wird noch das sichere Schließen ungenutzter Lobbys ergänzt und gezielt geprüft.
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
| Node-Regel-, Verbindungs-, Server- und Sprachprüfungen | 42 Tests bestanden (16 Regeln, 14 Verbindung, 11 Server, 1 ausgelieferte DE/RU-Dictionaries) |
| Echte lokale PostgreSQL/PGlite-Migration | Migration erneut anwendbar und vorhandene Daten erhalten |
| SQL-Sicherheits-/Nebenläufigkeitstests | Browserzugriffe gesperrt, fremde Accounts gesperrt, CAS-Rennen und stale UUID-Wiederholung korrekt, Limits/Bans geprüft |
| Vollpartie über echte Netlify-Funktion und SQL | 123 bestätigte Aktionen im ersten Lauf, Abschluss und Rematch-Bereitschaft erfolgreich; Auth lokal simuliert |
| Netlify-Paketierung | `@netlify/zip-it-and-ship-it` 16.6.0 bündelt Engine/Katalog; gebündelte Funktion startet Spiel mit HTTP 200 |
| Simulationen | Finale 10.000 vollständige Partien und 1.149.397 Aktionen bestanden; Startspieler 49,53 %, Studium 52,47 %, Einzelberufe 46,36–54,60 %. Vollbericht `shared/RULES.md` |
| Vollpartie in zwei Browserkontexten | 126 bestätigte Aktionen, Desktop 1440×1050 und Mobil 390×844; Neuladen, komplette Wertung, Rematch, Russisch und lokales Spiel ohne Auth-CDN bestanden |
| Visuelle/Bedienprüfung | 320/390/1440 px ohne Überlauf; Produktions-Auth-Navigation mit simuliertem Logout-Status, Sprachmenü, Tastatur/Escape und vergrößertes Brett bestanden |
| Normale Animation | Vier echte Touch-Würfe mit normaler Bewegung, Rad-/Figurenanimation und korrektem dauerhaften Radwinkel geprüft, einschließlich Meilenstein-Überwurf |

## Aktueller Arbeitsstand

- Engine: finales Balancing und Regeltests abgeschlossen; siehe `shared/RULES.md`. Keine erneute Regelimplementierung nötig.
- UI: gleiche Revision erhält geöffnete Details, Codes auf 10 Zeichen geprüft, kurze Brettlabels, Radwert/Zielfeld korrekt getrennt, Auth-Navigation gestylt, vergrößerbares Brett ergänzt. Rad zeigt auch nach Neurendern/Neuladen den korrekten Winkel.
- Verbindung: exakte unbestätigte Anfrage über Neuladen/neuere Revision bewahrt, Actor-Bindung, blockierter Speicher und Abbruch alter Polls getestet.
- Browserharness `tests/browser.integration.mjs` ist erfolgreich. Die frühere Instabilität wurde durch mausbasierte Eingabe in einer Mobil-Emulation ausgelöst; explizite Touch-Taps und entfernter Mauszeiger führen ohne erzwungene Klicks durch die vollständige Partie. Kein offener Spielzustandsfehler.
- Zusätzliche UI-/Animationsprüfungen werden als `tests/ui.integration.mjs` portabel im Repository hinterlegt; letzte Hilfe-/Lobby-Ergänzungen anschließend prüfen.
- Aktuelle Ergänzung: Host darf ausschließlich eine noch nicht gestartete Lobby schließen. Backend/API/SQL behalten Raum und UUID-Belege, schließen Einladungen und geben den Raumlimit-Platz frei. `closeRoom(room)`, `room.closed`, native Bestätigung und 404-Aufräumen im Client sind in Arbeit. Laufende Partien werden nicht schließbar.
- Temporäre Paketierungsprüfung liegt außerhalb des Repos im Sitzungsordner `work/netlify-bundle-check/check.mjs`; dieser Nachweis wurde bereits erbracht, erneute Installation ist nicht erforderlich.

## Nächste konkrete Schritte

1. Lobby-Schließen fertigstellen und gezielte API-/SQL-/Browserprüfungen ausführen. Ergänzte Spielhilfe erklärt Wertung und Kreditregeln über aktuelle Regelkonstanten.
2. Aktuelle Übersetzungen mit `node games/KaktusLife/tests/sync-translations.mjs` synchronisieren. `node --test games/KaktusLife/tests/*.test.mjs`, SQL- und portable UI-Prüfungen nach letzten Änderungen abschließen.
3. Screenshots der Endfassung prüfen. Vollpartie ist bereits bestanden; nur bei relevanten Änderungen erneut erforderlich.
4. Balancing ist abgeschlossen; nur bei erneuten Regeländerungen wiederholen. Alle tatsächlichen Grenzen in Notizen erhalten.
5. Tests passend zu finalen Änderungen abschließen und lokalen Abschlusscommit erstellen.
6. Produktive Migration/Deployment und echte Zwei-Account-Abnahme bleiben bis ausdrücklicher Freigabe offen.

Die statische Vorschau läuft derzeit auf `http://127.0.0.1:4178/games/KaktusLife/`. Bei einer späteren Sitzung gegebenenfalls mit `node games/KaktusLife/tools/preview.mjs` neu starten.
