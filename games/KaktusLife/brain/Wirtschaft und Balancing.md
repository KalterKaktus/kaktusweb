# Wirtschaft und Balancing

Geld wird in ganzzahligen fiktiven Kaktus-Talern gespeichert. Keine Verbindung zu LuckyLounge-Wallet, Echtgeld oder bestehenden Spielständen. Regeln und Kartentexte liegen gemeinsam in `shared/catalog.mjs`; die Zustandsmaschine ist `shared/engine.mjs`.

## Ökonomisches Modell

- 16 feste Gehaltsstationen pro Person verhindern Gehaltsvorteile allein durch langsameres Würfeln.
- Studium verschiebt den Berufseinstieg und erzeugt echte Schulden, öffnet dafür höhere Gehälter.
- Karriere-Perks unterscheiden Hauskauf, Versicherung, variable Aufträge, Anlagen und Forschungsprämien.
- Mieten erhält Liquidität und bringt Freiheit/Glück; Eigentum bindet Kapital und liefert einen Endwert bei laufendem Unterhalt.
- Familie bringt laufende Kosten und einen Endwert. Die kinderlose Option erhält einen eigenen Glückseffekt.
- Lebensglück zählt 5.000 je Punkt. Partnerschaft und Kinder haben eigene klar ausgewiesene Endwerte.
- Kredit wird nur bei fehlendem Geld in 10.000er-Schritten aufgenommen; 10 % Zinsen an vier festen Stationen. Tilgen setzt vorhandenes Bargeld voraus.
- Anlagen werden zu aktuellen Werten gekauft/verkauft; jeder folgende Zahltag nutzt veröffentlichte Gewinn-/Verlustchancen. Sicherer und abenteuerlicher Lebensstil verändern Risiken.

## Bereits erkannte und korrigierte Schwächen

Frühe Rechnungen zeigten zu schwache Mieten-, Aufstiegs- und einzelne Familienoptionen. Diese wurden angeglichen, Texte gleichzeitig korrigiert. Studienberufe wurden anhand der Diagnosepartien nachjustiert. Die Erinnerung-/Gemeinschaftsentscheidung erhält unterschiedliche Risiko- und Liquiditätseigenschaften.

## Nachweis und Grenzen

`node games/KaktusLife/tests/balance.mjs 10000` spielt vollständige gesetzte Zufallsfolgen durch. Es vergleicht Startplätze, Ausbildungswege, Karrieren, Lebensstile und wirtschaftliche/erinnerungsorientierte Strategien. Jede Partie muss enden; Geld-, Schulden-, Anlagen-, Meilenstein- und Gehaltsinvarianten werden geprüft.

**Finaler Bericht vom 2026-11-05: bestanden.** 10.000 vollständige Partien mit 1.149.397 Aktionen in 188,6 Sekunden. Alle Partien enden mit genau 16 Gehaltsstationen und 11 Meilensteinen je Person. Vollständige Regeln, reproduzierbare Seeds und Zahlen stehen in `shared/RULES.md`.

| Vergleich | Gewinnanteil |
| --- | ---: |
| Startplatz 1 / 2 | 49,53 % / 50,47 % |
| Direkter Beruf / Studium (6.000 Paarungen) | 47,53 % / 52,47 % |
| Sicher / Abenteuer (2.000 Paarungen) | 45,80 % / 54,20 % |
| Finanzorientiert / Erinnerungen und Familie (2.000 Paarungen) | 59,95 % / 40,05 % |
| Einzelne Karrieren | 46,36–54,60 % |

Mittlere Karriere-Endwerte unterscheiden sich um weniger als 1 %. Abenteuer hat die gewünschte höhere Streuung (Standardabweichung 43.922 gegenüber 36.009). Die getestete Finanzstrategie ist im Mittel stärker als die Erinnerungsstrategie; es wird keine völlige Gleichwertigkeit behauptet. Der Zufall erlaubt beiden realistische Siegchancen.

Im Median sind 19 Radzüge je Person nötig (10./90. Perzentil 16/23). Bei etwa 30 Sekunden je Personenzug plus Einstieg und Lesen sind 20–30 Minuten plausibel. Das ist eine Modellannahme, kein menschlicher Spielzeittest. Simulationsstrategien sind ausgewählte Heuristiken und kein Beweis optimaler oder vollständig gleichwertiger Strategien.

Siehe [[Spielregeln]], [[Fortschritt]].
