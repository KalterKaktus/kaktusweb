# Designsystem

## Erscheinung

Eine eigenständig illustrierte SVG-Brettwelt mit verschlungenem Lebensweg, kleinen Häusern, Vegetation und Landschaft bildet das Zentrum. Creme, Grün, Koralle, Gold und blaue Akzente sorgen für unterscheidbare Felder und Spieler. Das Spiel übernimmt die lokal gehostete Nunito-Schrift und den Cozy-Gedanken bestehender Spiele.

`tokens.css` definiert die spielinternen Farben und Gestaltungstoken. Das konsumierende Stylesheet verwendet Variablen. Grafiken und Symbole entstehen aus eigenem SVG/CSS-Code; keine fremden Originalassets oder zusätzliche Bild-CDNs.

## Bedienung

Glücksrad, Figuren und Karten erklären den Zug visuell. Anzeigen bündeln Geld, Beruf und Familie. Entscheidungen nennen ihre Auswirkungen. Desktop und schmale Mobilansichten erhalten passende Anordnungen. Interaktive Elemente bleiben Tastatur-bedienbar und erhalten sichtbaren Fokus.

Reduzierte Bewegung wird über `prefers-reduced-motion` berücksichtigt. Töne entstehen mit Web Audio erst nach einer Nutzergeste und können gerätebezogen abgeschaltet werden.

## Gewünschtes Easter Egg

Für den normalisierten Profil-/Spielernamen `snor` ersetzt eine eigene Relaxo-artige Schlafriesen-SVG die Auto-Spielfigur auf dem Brett und im vergrößerten Brett. Der Spielername wird nicht geändert. Atembewegung, Schlafbuchstaben und kleine Bewegungsschritte sind rein kosmetisch und respektieren reduzierte Bewegung. Andere Namen behalten das Auto; Spielwerte und Chancen bleiben identisch. Diese Figur wurde vom Besitzer ausdrücklich gewünscht und soll erhalten bleiben.

## Sprachen

DE und RU verwenden das vorhandene Sprachsystem. Zahlen folgen der aktiven Sprache. Eigennamen bleiben erkennbar, dynamische Spielernamen werden vor HTML-Ausgabe maskiert.

Siehe [[Vision]], [[Architektur]].
