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

**Finaler 10.000-Partien-Bericht noch ausstehend.** Kleine Diagnosewerte sind keine abschließende Balancebehauptung. Der endgültige Bericht gehört nach `shared/RULES.md` und in diese Notiz. Simulationsstrategien sind ausgewählte Heuristiken und kein Beweis optimaler oder vollständig gleichwertiger Strategien. Die geschätzte Spielzeit hängt von der menschlichen Bedenkzeit ab.

Siehe [[Spielregeln]], [[Fortschritt]].
