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

Der Benutzer hat Veröffentlichung und Weiterarbeit ausdrücklich autorisiert. Supabase-Verbindung ist als nächster technischer Zugang gewählt, aber noch nicht bestätigt.

- [ ] Supabase-Erweiterung tatsächlich hinzufügen/anmelden; letzter bestätigter Status `installed:false`.

- [ ] Vorbereitete Migration `20261105120000_kaktuslife.sql` auf dem produktiven Supabase-Projekt anwenden.
- [ ] Veröffentlichung/Deployment der geprüften Änderungen.
- [ ] Echte Online-Abnahme mit zwei unterschiedlichen Site-Accounts, möglichst PC und Smartphone, inklusive Unterbrechung, Abschluss und neuer Partie.

## Bekannte Grenzen

- Aktuell kein offener Kernspiel-Browserfehler. Der frühere Klickstabilitätsbefund betraf Maus-Hover in Mobil-Emulation und ist im erfolgreichen Touch-Vollpartientest geklärt.

- Online-Betrieb ist lokal integriert und SQL-geprüft, **noch nicht produktiv abgenommen**. Ein lokal simulierter Auth-Dienst ersetzt diesen Nachweis nicht.
- Beide Lebensstile liegen auf demselben sichtbaren Hauptweg. Unterschiede betreffen Ereignisse und Anlagen; es gibt keine physisch getrennten Brettzweige.
- Snapshot-Abgleich ist adaptives Polling, keine durchgehende WebSocket-Presence. Bei Abwesenheit bleibt die Partie warten; niemand übernimmt automatisch einen Zug.
- Automatische Säuberung abgelaufener Räume ist bewusst nicht aktiv. Räume laufen nach 30 Tagen ab, Zeilen bleiben zur bewussten administrativen Bereinigung erhalten.
- Spielzeit aus Simulationen ist eine Annahme über menschliche Entscheidungsdauer, kein durchgeführter Nutzertest.

Bereits erledigte Arbeit und Befunde: [[Fortschritt]].
