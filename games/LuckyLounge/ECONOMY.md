# Lucky Lounge: serverseitige Spielökonomie

Alle Beträge sind kostenlose virtuelle Chips ohne Echtgeldwert. Ein Einsatz
liegt zwischen 1 und 100.000 Chips, mit höchstens zwei Nachkommastellen. Eine
Auszahlung bezeichnet die gesamte Rückgabe einschließlich des Einsatzes.

Die folgenden Regeln gelten ausschließlich für neu gestartete Runden nach
`20261011010000_lucky_lounge_fair_economy.sql`. Bestehende Guthaben, Buchungen
und bereits laufende Runden werden nicht neu berechnet. Jede laufende Runde
trägt ihre eigenen Regeln; alte Crash-Flüge erhalten lediglich das neue
Metadatenfeld `rtp = 0.99`, ohne Änderung ihres Ergebnisses.

| Spiel | Theoretische Rückgabe neuer Runden | Berechnung |
|---|---:|---|
| Plinko, Einfach/Normal/Schwer | 100 % | Binomialverteilung und exakte Normalisierung der ursprünglichen Tabellen |
| Mines, alle 1–24 Minen | 100 % | Rückgabe ist der Kehrwert der Überlebenswahrscheinlichkeit |
| Dino, alle drei Schwierigkeiten und 1–12 Sprünge | 100 % | Rückgabe ist der Kehrwert der Überlebenswahrscheinlichkeit |
| Crash, vorher festgelegtes Ziel bis 1.000× | 100 % | `P(Punkt ≥ Ziel) = 1 / Ziel`; Restwahrscheinlichkeit bei 1.000× bleibt erhalten |
| Color Roulette, jede Farbe | 100 % | Rot/Schwarz je `99/200 × 200/99`; Grün `2/200 × 100` |
| Blackjack | Strategieabhängig | Klassische Regeln, ausdrücklich keine Anpassung auf 100 %; siehe Blackjack-Dokumentation |

Diese Erwartungswerte garantieren keinen Gewinn. Verluste und lange Pechserien
sind möglich. Wer bei Mines oder Dino nie auszahlt, kann die theoretische
Rückgabe nicht erreichen. Blackjack hängt zusätzlich von Entscheidungen ab.

## Exakte Cent-Rundung

Abrunden jeder Auszahlung würde einen versteckten Vorteil erzeugen. Deshalb
speichert der Server eine rationale Auszahlung als ganzzahligen Bruch in
Cents. Bei `N / D = Grundbetrag + Rest / D` wird mit Wahrscheinlichkeit
`Rest / D` auf den nächsten Cent aufgerundet, sonst abgerundet. Damit ist der
Erwartungswert exakt `N / D`, einschließlich bei einem Einsatz von 1 Chip.

`casino_round_ratio(N, D)` verwendet keine Gleitkommazufallszahlen.
`casino_random_numeric(D)` erzeugt gleichverteilte ganzzahlige Zufallsblöcke
und entfernt Modulo-Bias durch Rejection Sampling. Der Rundungsentscheid
wird einmal innerhalb der Auszahlung getroffen und im Ledger gespeichert.
UUID-Wiederholungen erzeugen weder neue Runden noch einen neuen Rundungswurf.

Beispiele: 1 Chip auf Rot gewinnt 2,02 oder 2,03 Chips; die zusätzliche
Cent-Chance beträgt `2/99`. Ein natürlicher Blackjack mit 1,01 Chips Einsatz
gibt 2,52 oder 2,53 Chips zurück, jeweils mit 50 % Wahrscheinlichkeit.

## Plinko

Für `n` Reihen erreicht Bin `k` die Wahrscheinlichkeit `C(n,k) / 2^n`.
Die ursprünglichen symmetrischen Multiplikatoren bleiben als Gewichtung
erhalten. Auszahlungsfaktor eines Bins ist nun exakt:

`Gewicht[k] × 2^n / Σ(C(n,j) × Gewicht[j])`

| Modus | Reihen | Vorherige Rückgabe vor zusätzlicher Cent-Abrundung | Gewichtssumme | Neue Rückgabe |
|---|---:|---:|---:|---:|
| Einfach | 8 | 98,984375 % | 2.534 | 100 % |
| Normal | 12 | 98,9892578125 % | 40.546 | 100 % |
| Schwer | 16 | 98,9764404296875 % | 648.652 | 100 % |

Gewichte sind ursprüngliche Faktoren mal 10. Darstellung kann Faktoren
verkürzen; die Auszahlung benutzt den vollständigen Bruch. API und Spielfeld
lesen dieselben Tabellen aus `snapshot.rules.plinko`. Der Server legt Slot,
Bit-Pfad und Auszahlung fest; die vorbereitete physikalische Kollisionsbahn
zeigt genau diesen Slot. Die Darstellung schreibt keine Guthaben.

## Mines und Dino

Mines legt die 25 Felder mit einem serverseitigen Fisher-Yates-Shuffle fest.
Für `m` Minen und `k` sichere Öffnungen gilt:

`P(Überleben) = C(25-m,k) / C(25,k)`

Auszahlung ist `Einsatz × C(25,k) / C(25-m,k)`. Alle 300 unterstützten
Minen-/Öffnungskombinationen werden geprüft. Eine unbekannte Feldposition
besitzt dieselbe Chance wie jede andere unbekannte Position. Das Muster
bereits gewählter Felder erzeugt keinen geheimen Vorteil.

Dino hat unverändert 85 %, 65 % beziehungsweise 45 % Erfolgschance pro
Sprung. Nach `k` Sprüngen ist die Auszahlung `Einsatz / p^k`, ohne vorab
abgerundeten Multiplikator. Alle 36 Kombinationen werden geprüft.

## Crash

Neue Crash-Punkte liegen weiter auf einem Cent-Raster zwischen 1,00× und
1.000×. Der Server wendet die inverse Verteilung `floor(100 / U) / 100` an
und begrenzt bei 1.000×. `U` wird durch zunehmend genaue zufällige Intervalle
bestimmt, bis der resultierende Cent-Punkt eindeutig ist. Damit entsteht
keine endliche Zufallsraster-Abweichung in den Gewinnwahrscheinlichkeiten.

Für ein Cent-Ziel `t` gilt exakt `P(Punkt ≥ t) = 1/t`. Ein vorher festgelegter
automatischer Cashout gewinnt bei einem Gleichstand. Ein manueller Cashout
wird nur vor dem Crash akzeptiert; seine Auszahlung benutzt den nächsten
Cent-Multiplikator (`ceil`), weil die überlebende Crash-Schwelle genau dieser
Rasterpunkt ist. Diese Korrektur entfernt den kleinen Nachteil, den ein
abgerundeter sichtbarer Multiplikator sonst erzeugen würde. Netzwerkverzögerung
kann einen zu späten manuellen Klick trotzdem verlieren lassen.

Der sichtbare Flug läuft anhand der Serverzeit. Nach Crash bleiben Ergebnisse
5 Sekunden stehen, danach folgt die bestehende Einsatzphase von 10 Sekunden.
Bereits gestartete alte Flüge behalten ihre ursprünglichen Regeln.

## Color Roulette und Multiplayer

Die Rollenleiste besitzt 200 gleich breite Felder: 99 rote, 99 schwarze und
2 grüne. Der Server wählt genau einen gleichverteilten Index. Grün steht an
Position 0 und 100; davor/danach alternieren Rot und Schwarz. Somit stimmen
sichtbare Segmenthäufigkeiten, API-Ergebnis und tatsächliche Chancen überein.

Die gemeinsame Runde umfasst 15 Sekunden Einsatzzeit, 8 Sekunden Spin und
5 Sekunden Ergebnisanzeige. Das private Ergebnis wird während der
Einsatzphase weder im Snapshot noch in Realtime veröffentlicht. Ab Beginn
des Spins erhält jeder denselben Index; die Leiste stoppt exakt darunter.
Auszahlungen erfolgen erst nach Ende des Spins atomar und genau einmal.
Die Animation entscheidet niemals über die Auszahlung.

Es sind mehrere Einsätze pro Spieler/Farbe möglich, insgesamt höchstens
100.000 Chips pro Farbe und Runde. Teilnehmer, Namen und Beträge stammen
ausschließlich aus echten Serverbuchungen. Sichere Realtime-Projektionen
enthalten nur aktuelle Rundentermine und veröffentlichte Wettdaten.
Private Ergebnis-, Wallet- und Kartenfelder werden nicht repliziert.

Runden werden durch authentifizierte Server-RPCs vorangeschaltet, während
die Oberfläche regelmäßig synchronisiert. Bei leerer Lounge werden keine
erfundenen vergangenen Runden erzeugt. Nach einem Disconnect bleiben die
Einsätze erhalten; das nächste Roulette- oder Wallet-Öffnen wickelt sie ab.
Eine Browseranimation oder offene Verbindung ist dafür nicht erforderlich.

## Technische Prüfung

`node tools/test-lucky-economy.mjs` prüft die Formeln mit ganzen Zahlen und
die SQL-Funktionen in einer lokalen PostgreSQL-Instanz (PGlite). Die Tests
nutzen zwei ausdrücklich lokale Fixture-Konten, keine Fake-Spieler im Produkt
und keine Verbindung zum produktiven Supabase. Abgedeckt sind Migrationen,
Bestandsschutz, Idempotenz, Rundung, alte Runden, Deadline-Prüfung,
gemeinsame Runde, geheime Ergebnisse, Auszahlungen, Rollenrechte und RLS.

Ausführungsreihenfolge der neuen Migrationen: Fair Economy, Color Roulette,
Blackjack. Keine Migration wird automatisch in Produktion ausgeführt.
