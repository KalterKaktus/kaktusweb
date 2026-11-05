# Fortschritt

Aktualisiert: **2026-11-05, 22:52 Uhr (Europe/Berlin)**. **KaktusLife ist veröffentlicht:** https://kalterkaktus.de/games/KaktusLife/ . Produktive Migration und Live-Prüfungen sind bestanden. PR2 wurde als `428963fe25f7e1a612eecac4a0b06aff3e25422f` zusammengeführt; Netlify-Deploy `6aecf9d6988ea08038ae537b` ist seit 22:49:45 Uhr veröffentlicht und ready. Genau ein Produktionsbuild für die Veröffentlichung. Produkt-Meilensteine: `4de6a52c`, `595aad16`, `7a880944`, `017ead2c`; Migration dokumentiert in `f848547b`.

## Wiederaufnahme nach Unterbrechung

1. `git status --short`, `git log -4 --oneline` und diese Notiz lesen; vorhandene Änderungen nicht verwerfen.
2. [[Offene Aufgaben]] lesen. Kernspiel, vollständige Browserpartie, finales Balancing, Lobby-Schließen, Snor-Spielfigur, Supabase-Migration, GitHub-Merge und Netlify-Veröffentlichung sind erledigt. Nicht erneut migrieren oder deployen. Für weitere Änderungen einen passenden Feature-Stand verwenden.
3. Bereits bestandene Prüfungen unten nicht erneut als Entwicklungsaufgaben behandeln. Bei weiteren Codeänderungen nur betroffene Prüfungen und abschließend die Gesamtsuite ausführen.
4. Die unten genannten konkreten nächsten Schritte fortsetzen. Nach jedem sinnvollen Meilenstein diese Notiz aktualisieren und lokal auf dem Feature-Branch committen.

## Implementiert

- Eigenständige ES-Module, 81 Felder, 11 verpflichtende Lebensstationen und faires Rad 1–10.
- Studium/Beruf, sechs Karrieren, zwei wirtschaftliche Lebensstile, Partnerschaft, Kinder, drei Häuser, Versicherung, automatische Kredite/Zinsen, Anlagen/Tilgung, Ruhestand und transparente Wertung.
- 40 originale zweisprachige Ereignisse, unveränderliche Zustandsübergänge und deterministische Simulation.
- Authentifizierte Netlify-API mit serverseitigem Zufall, privater Zwei-Personen-Lobby, Bereitschaft, Start, gespeicherten Aktionen, Revisionen, UUID-Idempotenz und neuer Partie.
- SQL-Migration mit gesperrten Browserrollen, Mitgliedschaftsprüfung, Sperren, Limits und atomaren Anfragen; **produktiv angewendet**.
- Verbindungsschicht mit bestehender Site-Session, Raumwiederaufnahme und adaptivem Snapshot-Abgleich.
- SVG-Brettwelt, Glücksrad, Figuren, Entscheidungskarten, Spieleranzeigen und Ergebnisoberfläche fertig und visuell geprüft.
- Lokales Zwei-Personen-Übungsspiel mit Browser-Speicherung, DE/RU-Einbindung, Spiele-Hub-Karte, Obsidian-Struktur und Projektkarte.

## Tatsächlich bestanden

| Prüfung | Befund |
| --- | --- |
| Node-Regel-, Verbindungs-, Server- und Sprachprüfungen | 47 Tests bestanden (16 Regeln, 17 Verbindung, 13 Server, 1 ausgelieferte DE/RU-Dictionaries) |
| Echte lokale PostgreSQL/PGlite-Migration | Migration erneut anwendbar und vorhandene Daten erhalten |
| SQL-Sicherheits-/Nebenläufigkeitstests | Browserzugriffe gesperrt, fremde Accounts gesperrt, CAS-Rennen und stale UUID-Wiederholung korrekt, Limits/Bans geprüft |
| Vollpartie über echte Netlify-Funktion und SQL | 123 bestätigte Aktionen im ersten Lauf, Abschluss und Rematch-Bereitschaft erfolgreich; Auth lokal simuliert |
| Netlify-Paketierung | `@netlify/zip-it-and-ship-it` 16.6.0 bündelt Engine/Katalog; gebündelte Funktion startet Spiel mit HTTP 200 |
| Simulationen | Finale 10.000 vollständige Partien und 1.149.397 Aktionen bestanden; Startspieler 49,53 %, Studium 52,47 %, Einzelberufe 46,36–54,60 %. Vollbericht `shared/RULES.md` |
| Vollpartie in zwei Browserkontexten | 126 bestätigte Aktionen, Desktop 1440×1050 und Mobil 390×844; Neuladen, komplette Wertung, Rematch, Russisch und lokales Spiel ohne Auth-CDN bestanden |
| Visuelle/Bedienprüfung | 320/390/1440 px ohne Überlauf; Produktions-Auth-Navigation mit simuliertem Logout-Status, Sprachmenü, Tastatur/Escape und vergrößertes Brett bestanden |
| Normale Animation | Vier echte Touch-Würfe mit normaler Bewegung, Rad-/Figurenanimation und korrektem dauerhaften Radwinkel geprüft, einschließlich Meilenstein-Überwurf |
| Portable UI-Endprüfung | 6 Tests bestanden: 3 Viewports, 4 normale Touch-Würfe einschließlich Snor, echte SQL-Lobby-Schließung mit beiden Browsern, genaue Snor-/Nicht-Snor-Erkennung, Zoom und reduzierte Bewegung |
| Produktive SQL-Migration | `20261105214557_kaktuslife` erfolgreich; Quelle `20261105120000_kaktuslife.sql`, nur neue Spielobjekte |
| Produktive Rechte und RPCs | Beide Tabellen RLS an, keine direkten Rechte für anon/authenticated/service_role; nur 3 entry-RPCs für service_role, 2 Helfer gesperrt, Owner postgres mit festem leeren search_path |
| Produktiver Lobby-Smoke | Create/replay/join/ready/close/expired-replay und Gast-404 bestanden; alle Testschreibvorgänge zurückgerollt, keine Testzimmer verbleiben |
| Produktion | Deploy ready, neue Node22-Funktion `/api/kaktuslife` korrekt paketiert und veröffentlicht, keine Secrets-Scan-Treffer |
| Live-HTTP | Homepage, Spiele-Hub, KaktusLife, Clicker, Fishing, Garden und LuckyLounge jeweils HTTP200; KaktusLife-Link im Hub vorhanden |
| Live-API | Nicht angemeldete POST-Aktionen erhalten HTTP401 mit `life.errors.auth` und `Cache-Control:no-store` |
| Live-Browser | Desktop1440×1050 und Mobil390×844/RU ohne Überlauf oder Browserausnahmen, lokales Spiel und Snor-Spielfigur auf der produktiven Website geprüft |

## Aktueller Arbeitsstand

- Engine: finales Balancing und Regeltests abgeschlossen; siehe `shared/RULES.md`. Keine erneute Regelimplementierung nötig.
- UI: gleiche Revision erhält geöffnete Details, Codes auf 10 Zeichen geprüft, kurze Brettlabels, Radwert/Zielfeld korrekt getrennt, Auth-Navigation gestylt, vergrößerbares Brett ergänzt. Rad zeigt auch nach Neurendern/Neuladen den korrekten Winkel.
- Verbindung: exakte unbestätigte Anfrage über Neuladen/neuere Revision bewahrt, Actor-Bindung, blockierter Speicher und Abbruch alter Polls getestet.
- Browserharness `tests/browser.integration.mjs` ist erfolgreich. Die frühere Instabilität wurde durch mausbasierte Eingabe in einer Mobil-Emulation ausgelöst; explizite Touch-Taps und entfernter Mauszeiger führen ohne erzwungene Klicks durch die vollständige Partie. Kein offener Spielzustandsfehler.
- Zusätzliche UI-/Animationsprüfungen liegen portabel als `tests/ui.integration.mjs` im Repository und sind bestanden. Spielhilfe erklärt Endwerte und Kreditregeln anhand der Regelkonstanten.
- Host kann eine noch nicht gestartete Lobby über einen Bestätigungsdialog schließen. Backend/API/SQL behalten Raum und UUID-Belege, schließen Einladungen und geben den Raumlimit-Platz frei. Geschlossene Räume werden beim Gast sauber verlassen; laufende/abgeschlossene Partien bleiben geschützt.
- Gewünschtes Easter Egg: Für `snor` ersetzt eine eigene Relaxo-artige Schlafriesen-Figur die Auto-Spielfigur, einschließlich Atem-/Schlaf-/Bewegungsanimation. Der Spielername und Spielwerte bleiben unverändert. Nahaufnahme im Sitzungsordner `outputs/kaktuslife-snor-nahaufnahme.png`.
- Temporäre Paketierungsprüfung liegt außerhalb des Repos im Sitzungsordner `work/netlify-bundle-check/check.mjs`; dieser Nachweis wurde bereits erbracht, erneute Installation ist nicht erforderlich.

## Nächste konkrete Schritte

1. Veröffentlichung ist abgeschlossen, kein weiterer Release-Schritt nötig. Site `kalterkaktus`, ID `e9dfb899-049b-468e-84e9-f32b834efb73`, Supabase-Projekt `rdqbkpowntebcrsnwyqp`.
2. Als noch ausstehende menschliche Abnahme eine produktive Partie mit zwei unterschiedlichen angemeldeten Site-Accounts auf PC/Smartphone bis zum Ende spielen. Agent hatte keine zwei echten Benutzersitzungen; dies wurde nicht als erledigt behauptet. Vollständige lokale Zweikontextpartie, produktive SQL-RPCs und Live-Auth-Schutz sind separat bestanden.
3. Weitere Wünsche/Fehler anhand des aktuellen Git-Standes bearbeiten, betroffene Prüfungen ausführen und Notizen pflegen. Simulation/Grundimplementierung nur bei relevanten Änderungen wiederholen.
4. Nachträgliche Dokumentationscommits mit `[skip netlify]` veröffentlichen, damit keine zusätzlichen Builds für reine Prüfprotokolle entstehen.

## Datenbankzugang

Supabase ist installiert und authentifiziert; `list_projects`, `apply_migration`, `execute_sql` und Advisors funktionieren. Die Tools erschienen nach Aktualisierung des Tool-Inventars. Kein lokaler Management-Token/CLI-Zugang wird benötigt. Keine Secrets wurden ausgegeben oder in Git/Obsidian gespeichert.

Advisors melden für KaktusLife lediglich INFO „RLS Enabled No Policy“: hier absichtlich, da Browserzugriffe und direkte Tabellenrechte vollständig gesperrt sind und der Server nur drei freigegebene RPCs aufruft. Keine neuen KaktusLife-Warnungen/Fehler. Hintergrund: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Vorbestehende andere Spielobjekte wurden nicht verändert.

## Veröffentlichung: bereits geprüfte Wege

- Lokales `git push` nutzt die vorhandene Repository-Anmeldung erfolgreich. Main wurde aus dem Feature-Branch über PR2 integriert; keine Entwicklungsarbeit direkt auf main.
- GitHub-Plugin konnte Repository-Metadaten lesen, PR-Anlage lieferte 403. Sicherer Fallback über die vorhandene Git-Anmeldung und GitHub-API ist geprüft: Sitzungsdatei `work/github-release.mjs`, Zugangsdaten ausschließlich im Speicher. PR2 wurde damit angelegt und mit exakt erwarteter Head-SHA erfolgreich zusammengeführt.
- Netlify-Verbindung und vorhandene serverseitige Umgebungsvariablen funktionieren. Verifizierter veröffentlichter KaktusLife-Deploy: `6aecf9d6988ea08038ae537b`; Runtime-Commit `428963fe`. Spätere reine Dokumentationscommits können ohne neuen Deploy folgen.
- Live-Prüfskript/Protokoll im Sitzungsordner: `work/live-smoke.mjs`, `outputs/KaktusLife-Live-Pruefung.json`; Screenshots `outputs/kaktuslife-live-desktop.png` und `outputs/kaktuslife-live-mobile-ru.png`. Keine echten Zugangsdaten oder privaten Kontoinhalte darin.

Die statische Vorschau läuft derzeit auf `http://127.0.0.1:4178/games/KaktusLife/`. Bei einer späteren Sitzung gegebenenfalls mit `node games/KaktusLife/tools/preview.mjs` neu starten.
