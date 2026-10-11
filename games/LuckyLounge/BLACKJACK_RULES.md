# Blackjack: Regeln und technische Abrechnung

Blackjack bleibt auf ausdrücklichen Wunsch klassisch. Es erhält keinen
Ausgleichsbonus und keine Änderung der Kartenwahrscheinlichkeiten für 100 % RTP.

## Regeln

- Sechs vollständige 52-Karten-Decks, vor jeder Runde neu und gleichverteilt
  serverseitig gemischt. Kein fortlaufender Schuh und keine Kartenmanipulation.
- Spieler und Dealer erhalten jeweils zwei Karten. Die zweite Dealerkarte bleibt
  bis zur Abrechnung verdeckt; Dealer-Blackjack wird vor Spieleraktionen geprüft.
- Ass zählt als 11, soweit die Hand damit nicht über 21 liegt, sonst als 1.
- Dealer zieht bis mindestens 17 und steht auch auf Soft 17.
- **Hit:** eine weitere Karte. Auf 21 folgt automatisch der Dealerzug.
- **Stand:** Dealer spielt seine Hand zu Ende.
- **Double:** nur auf die ersten zwei Karten; ein weiterer ursprünglicher Einsatz
  wird abgebucht, genau eine Karte gezogen und anschließend automatisch gehalten.
  Der Einsatz darf ursprünglich 1–100.000 Chips betragen; nach Double sind bis zu
  200.000 Chips in der Runde eingesetzt. Fehlendes Guthaben verhindert Double.
- Natürlicher Blackjack (Ass und eine Zehnwertkarte als erste zwei Karten) bezahlt
  3:2 Nettogewinn, also 2,5× des Einsatzes einschließlich Rückgabe des Einsatzes.
  Ein aus drei oder mehr Karten gebildeter Wert 21 ist ein gewöhnlicher Gewinn.
- Gewöhnlicher Gewinn bezahlt 2× des gesamten Einsatzes; Gleichstand (Push) gibt
  den Einsatz zurück; Verlust oder Bust bezahlt 0. Zwei natürliche Blackjacks sind
  ebenfalls Push. Es gibt kein Split, Insurance oder Surrender.
- Bei einem halben Cent aus einem natürlichen Blackjack entscheidet der Server
  einmalig und gleichverteilt zwischen den beiden benachbarten Centbeträgen.
  Beispiel: 1,01 Chips Einsatz ergeben im Mittel 2,525 Chips Rückzahlung, konkret
  2,52 oder 2,53. Diese unverzerrte Rundung ändert die erwartete 3:2-Auszahlung nicht.

## RTP-Prüfung

`node tools/lucky-blackjack-math.mjs` berechnet per dynamischer Programmierung die
optimale totalabhängige Hit/Stand/Double-Strategie im Modell unendlich vieler Decks.
Dieses Modell ist eine analytische Vergleichsrechnung, nicht der verwendete Schuh.
Es berücksichtigt Dealer-Peek, S17, natürliche Blackjacks und fehlendes Split.

Für dieses Modell ergeben sich:

| Größe | Wert |
|---|---:|
| Erwarteter Nettogewinn je ursprünglichem Einsatz | −1,0867422745 % |
| Durchschnittlich insgesamt eingesetzt, inklusive Double | 1,0935541473× |
| RTP bezogen auf alle eingesetzten Chips, inklusive Double | 99,0062291133 % |

Die gleiche Strategie wurde mit den tatsächlich verwendeten sechs Decks und
neu gemischtem Schuh in **2.000.000 reproduzierbaren Runden** geprüft (Seed
`0x4b414b54`). Das Ergebnis beträgt **99,0321085019 % RTP**, mit einem statistischen
95-%-Intervall von **98,8914119795 % bis 99,1728050243 %**. Der mittlere Nettogewinn
je ursprünglichem Einsatz beträgt −1,0584 %. Dies ist ein endlicher, statistischer
Schätzwert, kein Beweis eines exakten RTP für alle endlichen Kartenkombinationen.
Die Strategie optimiert das analytische Modell und verwendet keine verbleibende
Schuhzusammensetzung; kleine Abweichungen durch endliche Decks bleiben möglich.
Ein anderes Spielverhalten kann deutlich schlechtere Ergebnisse liefern.

Die Definition über alle tatsächlich eingesetzten Chips entspricht der Wallet-
Statistik: ein Double zählt als zweiter Einsatzbetrag, aber nicht als zweite Runde.
Es wird kein allgemeiner 100-%-RTP für Blackjack behauptet.

## Sicherheit, Wiederherstellung und öffentlicher Feed

Migration `20261011030000_lucky_lounge_blackjack.sql` wird manuell nach den neuen
Economy- und Color-Roulette-Migrationen angewendet. Sie verändert keine vorhandenen
Guthaben oder abgeschlossenen Ergebnisse.

`casino_blackjack_action` verarbeitet Start, Hit, Stand und Double unter dem
bestehenden Wallet-Lock. Jeder Request trägt eine UUID; ein identischer Replay
liefert den gespeicherten Zustand, eine Wiederverwendung mit anderem Inhalt wird
abgewiesen. Aktionen müssen außerdem die aktuelle Runden-Version tragen. So können
zwei Tabs nicht gleichzeitig dieselbe Karte oder einen zusätzlichen Double buchen.

Die vollständige Mischfolge, die verdeckte Karte und die Ziehposition bleiben in
`casino_rounds.secret`. Browser haben keinen Tabellenzugriff. `casino_get_wallet`
stellt dieselbe laufende Hand nach Reload wieder her und veröffentlicht während
einer aktiven Hand ausschließlich den Dealer-Upcard-Wert, niemals den Hole-Card-
Wert. Guthabenänderung, Statistik, Ledger und Ergebnis-Feed werden atomar gebucht.

`casino_blackjack_results` enthält ausschließlich einen vom Server erzeugten
Ergebnis-Identifier, Spielernamen, Gesamteinsatz, Rückzahlung, Ergebnis und Datum
abgeschlossener Runden. Es enthält keine Benutzer-ID, Karten, Wallet oder privaten
Rundendaten. Authentifizierte, nicht gesperrte Accounts können lesen, aber nicht
schreiben. `casino_blackjack_feed()` liefert höchstens 30 Ergebnisse; die Tabelle
ist für Supabase Realtime freigegeben. Es werden weder alte Ergebnisse erfunden
noch laufende Hände in den Feed aufgenommen.

`node tools/test-lucky-blackjack.mjs` prüft die echten SQL-Funktionen lokal mit
PGlite: Datenerhalt und wiederholte Migration, Ass-Wertung, Naturals, Dealer-Peek,
S17, Hit/Stand/Double, Push, Bust, Idempotenz, Versionsprüfung, Besitzprüfung,
Guthabenlimits, verdeckte Karten, Reload sowie sichere Feed- und Rollenrechte.
Die lokale PGlite-Abhängigkeit bleibt im ignorierten Entwicklungsverzeichnis;
sie ist keine Abhängigkeit der veröffentlichten Website. Alle Prüfungen laufen
ohne Verbindung zur produktiven Supabase-Instanz.
