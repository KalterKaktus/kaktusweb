# Entscheidungen

## 2026-11-05: Isolierte native ES-Module

Die Spieloberfläche braucht keinen Routing- oder Komponenten-Framework-Zwang. Native Module und SVG halten Downloads und Buildkosten klein und passen zur statischen Site. Die Netlify-Funktion kann dieselbe Regeldatei importieren. Bestehende React-Spiele bleiben unverändert.

## 2026-11-05: Serverautorität mit Supabase und Netlify

Die Site besitzt Login und serverseitige Supabase-Zugänge bereits. Ein eigener Spielserver-Daemon wäre zusätzlicher Betriebsaufwand. Netlify verarbeitet Aktionen; Supabase speichert Räume atomar. Browserrollen erhalten keine Spieltabellenrechte.

## 2026-11-05: Autoritative Snapshots über Polling

Zugbasierter Ablauf benötigt keine Bildraten-Synchronisation. Ein kurzer, adaptiver Snapshot-Abgleich ist leichter wiederherzustellen und zu prüfen als eine alleinige Broadcast-Lösung. Animationen folgen bestätigten Zugdaten. Echtzeit-Presence ist kein Ersatz für gespeicherte Spielwahrheit.

## 2026-11-05: Eine Zustandsmaschine, zwei Spielarten

Online und lokales Übungsspiel verwenden dieselben Regeln. Dies ermöglicht vollständige deterministische Partien und Simulationen ohne Duplikate. Lokale Ergebnisse sind nicht als Online-Spielstände importierbar.

## 2026-11-05: Bestehenden Vault behalten

`brain/.obsidian` bleibt erhalten. Die anfängliche Willkommen-Notiz verweist auf [[Start]]; das leere Canvas erhält eine Projektübersicht. Gerätebezogene Workspace-Dateien werden nicht versioniert.

Siehe [[Architektur]], [[Multiplayer]].
