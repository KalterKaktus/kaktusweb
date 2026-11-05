# Fortschritt

Aktualisiert: **2026-11-05, 22:49 Uhr (Europe/Berlin)**. Branch: `feature/kaktuslife`, auf GitHub hochgeladen. Veröffentlichung und Migration sind ausdrücklich freigegeben. **Produktive Migration angewendet und geprüft; GitHub-Merge und Netlify-Veröffentlichung werden jetzt ausgeführt.** Produkt-Meilensteine: `4de6a52c` (Grundimplementierung), `595aad16` (Wiederverbindung und Balancing), `7a880944` (vollständige Browserabnahme), `017ead2c` (Lobby-Schließen, Snor-Figur und finale Prüfungen).

## Wiederaufnahme nach Unterbrechung

1. `git status --short`, `git log -4 --oneline` und diese Notiz lesen; vorhandene Änderungen nicht verwerfen.
2. [[Offene Aufgaben]] lesen. Kernspiel, vollständige Browserpartie, finales Balancing, Lobby-Schließen und gewünschte Snor-Spielfigur sind implementiert und bestanden. Supabase-Verbindung und produktive Migration sind erledigt. Nächster Schritt ist der GitHub-Merge mit anschließendem Netlify-Deploy und Live-Prüfung.
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

1. Der geprüfte Stand ist auf `origin/feature/kaktuslife` gesichert. Pull Request: https://github.com/KalterKaktus/kaktusweb/pull/2 . Diese Arbeit ist erledigt, keinen zweiten PR anlegen.
2. Supabase-Verbindung ist bestätigt: Projekt `KaktusWeb`, Ref `rdqbkpowntebcrsnwyqp`, ACTIVE_HEALTHY. Keine erneute Einrichtung erforderlich.
3. Migration und Rechteprüfung sind abgeschlossen. Nicht erneut anwenden; andere Spieltabellen blieben unverändert.
4. PR2 mit exakt geprüftem aktuellem Feature-HEAD in main integrieren (keine Entwicklungsänderungen direkt auf main), einmal Netlify veröffentlichen und Deploy bis ready verfolgen. PR-Titel enthält `[skip netlify]`, um einen zusätzlichen Preview-Build zu sparen. Beim Merge expliziten Commit-Titel **ohne** Skip-Marker verwenden. Site `kalterkaktus`, ID `e9dfb899-049b-468e-84e9-f32b834efb73`, Ziel `https://kalterkaktus.de/games/KaktusLife/`.
5. Produktive Erreichbarkeit, Auth-Schutz und echte Zwei-Account-Funktionen soweit mit verfügbaren Sessions möglich prüfen; fehlenden menschlichen Abschlussnachweis ehrlich nennen.
6. Nach Migration/Deploy diese Notiz, BACKEND/README und offene Aufgaben auf tatsächlichen Status aktualisieren; neue sinnvolle lokale Commits. Bereits bestandene Simulationen/Grundimplementierung nicht wiederholen.

## Datenbankzugang

Supabase ist installiert und authentifiziert; `list_projects`, `apply_migration`, `execute_sql` und Advisors funktionieren. Die Tools erschienen nach Aktualisierung des Tool-Inventars. Kein lokaler Management-Token/CLI-Zugang wird benötigt. Keine Secrets wurden ausgegeben oder in Git/Obsidian gespeichert.

Advisors melden für KaktusLife lediglich INFO „RLS Enabled No Policy“: hier absichtlich, da Browserzugriffe und direkte Tabellenrechte vollständig gesperrt sind und der Server nur drei freigegebene RPCs aufruft. Keine neuen KaktusLife-Warnungen/Fehler. Hintergrund: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Vorbestehende andere Spielobjekte wurden nicht verändert.

## Veröffentlichung: bereits geprüfte Wege

- Lokales `git push` nutzt die vorhandene Repository-Anmeldung erfolgreich. Main stand vor diesem Release auf `c4106492`; aktuellen Merge-/Deploy-Stand vor einer Wiederaufnahme prüfen.
- GitHub-Plugin kann Repository-Metadaten lesen, PR-Anlage lieferte 403 „Resource not accessible by integration“. Sicherer Fallback über vorhandene Git-Anmeldung und GitHub-API ist geprüft: Skript im Sitzungsordner `work/github-release.mjs`. Es hält Zugangsdaten ausschließlich im Speicher, schreibt/zeigt keine Secrets. PR2 wurde damit erfolgreich angelegt. Für Merge kann es mit `merge 2 <aktuelle-exakte-HEAD-SHA>` verwendet werden; zuerst SQL-Zugang und Migration abschließen.
- Netlify-Verbindung und bestehende serverseitige Umgebungsvariablen sind verfügbar. Bisher veröffentlichter Deploy bleibt `6acb717c4ca0ea0008595fe5` (ready). Nicht fälschlich als KaktusLife-Deploy melden.

Die statische Vorschau läuft derzeit auf `http://127.0.0.1:4178/games/KaktusLife/`. Bei einer späteren Sitzung gegebenenfalls mit `node games/KaktusLife/tools/preview.mjs` neu starten.
