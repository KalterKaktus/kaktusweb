# Offene Aufgaben

## Für die laufende lokale Umsetzung

- [x] UI-Detailkorrekturen und Produktions-Auth-Navigation prüfen.
- [x] Desktop-/Mobil-Browsertest mit zwei getrennten Sitzungen erfolgreich abschließen.
- [x] Screenshots visuell prüfen; Überläufe und unaufgelöste Übersetzungen korrigieren.
- [x] Bewegung und Rad mit normaler Bewegung prüfen; vollständige Partie läuft im schnellen Test mit reduzierter Bewegung.
- [x] Ungenutzte Lobbys sicher schließen, Raumlimit-Platz freigeben und gezielt prüfen.
- [x] Portable UI-Prüfung inklusive letzter Hilfetexte und Lobby-Schließen abschließen.
- [x] Gewünschte Relaxo-artige Auto-Ersatzfigur für snor implementieren und im normalen/vergrößerten Brett prüfen.
- [x] Finale Balancing-Simulation von 10.000 Partien samt statistischen Grenzen dokumentieren.
- [x] DE/RU-Dictionaries nach endgültigen Text-/Zahlenänderungen synchronisieren.
- [x] Fortsetzungsfähige lokale Git-Meilensteine mit aktuellen Notizen herstellen.
- [x] Feature-Branch auf GitHub sichern und Pull Request2 vorbereiten.

## Veröffentlichung – Freigabe inzwischen erteilt

Der Benutzer hat Veröffentlichung und Weiterarbeit ausdrücklich autorisiert. Supabase-Verbindung und produktive Migration sind bestätigt.

- [x] Supabase-Erweiterung tatsächlich hinzufügen/anmelden; Projektzugriff bestätigt.

- [x] Migration `20261105120000_kaktuslife.sql` produktiv anwenden und Rechte/RPCs prüfen (Version `20261105214557`).
- [x] Veröffentlichung/Deployment der geprüften Änderungen (PR2, Deploy `6aecf9d6988ea08038ae537b`, live 2026-11-05).
- [x] Live-Erreichbarkeit, API-Auth-Schutz, Desktop-/RU-Mobilansicht und lokale Snor-Spielfigur prüfen.
- [ ] Echte Online-Abnahme mit zwei unterschiedlichen Site-Accounts, möglichst PC und Smartphone, inklusive Unterbrechung, Abschluss und neuer Partie.

## Bekannte Grenzen

- Aktuell kein offener Kernspiel-Browserfehler. Der frühere Klickstabilitätsbefund betraf Maus-Hover in Mobil-Emulation und ist im erfolgreichen Touch-Vollpartientest geklärt.

- Spiel und Backend sind produktiv veröffentlicht und geprüft. Eine vollständige menschliche Online-Partie mit zwei echten angemeldeten Site-Accounts wurde durch den Agenten nicht gespielt; dieser letzte Nutzertest bleibt offen. Eine vollständige lokale Zweikontextpartie und produktive SQL-RPC-Tests sind separat bestanden.
- Beide Lebensstile liegen auf demselben sichtbaren Hauptweg. Unterschiede betreffen Ereignisse und Anlagen; es gibt keine physisch getrennten Brettzweige.
- Snapshot-Abgleich ist adaptives Polling, keine durchgehende WebSocket-Presence. Bei Abwesenheit bleibt die Partie warten; niemand übernimmt automatisch einen Zug.
- Automatische Säuberung abgelaufener Räume ist bewusst nicht aktiv. Räume laufen nach 30 Tagen ab, Zeilen bleiben zur bewussten administrativen Bereinigung erhalten.
- Spielzeit aus Simulationen ist eine Annahme über menschliche Entscheidungsdauer, kein durchgeführter Nutzertest.

Bereits erledigte Arbeit und Befunde: [[Fortschritt]].
