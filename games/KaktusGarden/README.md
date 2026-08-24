# KaktusGarden

- **Pfad:** `/games/KaktusGarden/`
- **Game-ID:** `kaktus-garden`
- **Prinzip:** gemeinsames Dorf mit Läden, sechs Gartenparzellen und einer
  Figur, die im Raster läuft

Ein Dorf mit fünf Ladengebäuden in der Mitte, darum sechs eingezäunte Parzellen à
8 × 8 = 64 Pflanzfelder. Wer den Server betritt, bekommt eine freie Parzelle
zugewiesen. Bewegung ist rasterbasiert, interagiert wird immer mit dem Feld,
auf dem man steht.

## Pflanzen-Kreislauf

Gepflanzt wird **aus der Tasche heraus**, nicht über ein Menü: Fach unten
auswählen (Klick oder Zifferntaste), auf ein freies Feld der eigenen Parzelle
stellen, Aktionsknopf drücken. Der Knopf ist nur da, wenn es wirklich etwas zu
tun gibt — sonst verschwindet er ganz.

Darüber sitzt das Infoschild: bei einer wachsenden Pflanze die Restzeit, bei
einer reifen ihr Wert, bei einem leeren Feld die Wachstumsdauer des gewählten
Samens. Aktionsknopf und Schild lesen beide aus `resolveAction()` in `game.js`,
damit sie nie Verschiedenes behaupten.

| Datei | Zweck |
|---|---|
| `js/data/crops.js` | Pflanzen, Wirtschaft, Sprites |
| `js/state.js` | Spielstand v4: Münzen, Samen, Ernte, 64 Felder, Ladenbestand |
| `js/cloud.js` | Login, Cloud-Save, Revisionen und persistente Offline-Outbox |
| `js/multiplayer.js` | Räume, Presence, Bewegungs-Broadcast und Farm-Snapshots |
| `js/systems/garden.js` | Pflanzen, Wachsen, Ernten, Kaufen, Verkaufen |
| `js/render/crops.js` | Pflanzen auf der Parzelle zeichnen |
| `js/ui/hotbar.js` | Die Leiste unten |
| `js/ui/shopPanel.js` | Samenladen und Verkaufsstand |
| `js/ui/format.js` | Münzen (K/M/B), Gewichte, Zeiten |

Das Spiel ist loginpflichtig. Der Spielstand liegt als Save-Version 4 in
`game_saves`. Jede persistierbare Aktion erhöht eine monotone `revision`, landet
sofort in einer lokalen Outbox und wird ohne Gameplay-Debounce in die Cloud
geschrieben. Ein Seitenwechsel kann deshalb höchstens den Upload verzögern,
nicht den letzten ausgeführten Zustand verlieren. Alte Test-Saves werden
bewusst einmalig durch einen frischen v4-Spielstand ersetzt.

Das Inventar umfasst vorerst genau neun Stapel. Samen und Ernte derselben Sorte
sind getrennte Stapel. Ist für eine neue Sorte kein Fach frei, bleiben Feld,
Münzen und Ladenbestand unverändert und die Oberfläche zeigt „Inventar voll“.

## Wirtschaft

Die 19 Pflanzen-Assets sind zugleich die vollständige Spiel-Progression: von
Karotte bis Paprika. Jede Pflanze wird einmal geerntet und macht ihr Beet
anschließend wieder frei. Kaufpreis, Wachstumszeit und Verfügbarkeit steigen
dabei stetig an; der durchschnittliche Verkaufserlös beträgt ungefähr das
Doppelte des Saatgutpreises.

**Gewicht und Preis**

Beim Ernten wird eine Größe von 50 bis 100 gewürfelt; 50 entspricht dem
Grundgewicht, 100 dem Höchstgewicht. Der Verkaufspreis skaliert mit dem
Verhältnis zum Grundgewicht — eine schwere Frucht bringt also spürbar mehr.
Deshalb liegt die Ernte im Spielstand als **Liste einzelner Früchte** vor, nicht
als Stückzahl.

**Laden**

Der Samenladen füllt alle fünf Minuten auf, ausgerichtet an absoluten
Fünf-Minuten-Grenzen der Supabase-Serverzeit. Das Angebot wird ausschließlich
aus dem Zeitfenster deterministisch erzeugt und ist dadurch in allen Räumen
identisch – auch bei einer falsch gestellten Geräteuhr. Der
verbleibende Bestand ist dagegen persönlich: Käufe anderer Spieler verändern
ihn nicht, und ein Reload füllt ihn im selben Zeitfenster nicht wieder auf.
Jede Pflanze hat eine eigene Erscheinungschance (Karotte immer, Paprika selten)
und eine Bestandsspanne.
Gelistet werden **alle** Sorten, auch die gerade nicht lieferbaren — man soll
sehen können, worauf sich das Warten lohnt.

## Stand

Fertig: Weltkarte, Canvas-Engine mit Kamera, Kollision und Touch-Steuerung;
Pflanzen, Wachstum, Ernte, Samenladen, Verkauf, globaler Restock, 9-Stapel-
Inventar, Cloud-Saves und ein 6-Spieler-Dorf über Supabase Realtime.

Beim Join priorisiert `garden_join_room()` immer Server A. Erst wenn dessen
sechs Slots belegt sind, wird der nächste Raum verwendet. Presence zeigt die
Belegung, Broadcast überträgt Bewegungen und ein serverseitiger Snapshot lädt
nur die sichtbaren Farmzellen der aktuellen Raummitglieder. Jeder Account kann
nur einen aktiven Slot belegen; die neueste Browser-Session übernimmt diesen
Slot und darf über einen Invite-Code in den gewünschten Raum wechseln. Fremde Grundstücke darf man betreten und
ansehen, aber nicht bepflanzen oder ernten.

Noch Platzhalter: Gems, Profil, Statistik, Werkzeugladen sowie die geschlossenen
Eier- und Tierläden.

Die Datenbankseite liegt in
`supabase/migrations/20260803120000_kaktus_garden_multiplayer.sql` plus der
Takeover-Ergänzung `20260803153000_kaktus_garden_latest_session_wins.sql`. Sie müssen im
Supabase-Projekt angewendet sein, bevor Join und Realtime lokal oder live
funktionieren.

## Karte bearbeiten

Die Karte ist von Hand gesetzt, nichts daran ist prozedural. Zwei Dateien:

| Datei | Zuständig für |
|---|---|
| `js/data/world.js` | **Geometrie**: wo ist Erde, wo steht der Zaun, wo darf man laufen, wo stehen die Läden |
| `js/render/village.js` | **Aussehen**: Grastexturen und Dekoration |

### Koordinaten finden

Der unfertige Koordinatenraster-Schalter wurde aus den Einstellungen entfernt.
`?debug` stellt für lokale Tests weiterhin `window.__garden` mit Spieler,
Kamera, Zustand und Multiplayer-Verbindung bereit, zeichnet aber kein Raster.

### Dekoration entfernen oder setzen

`DECOR` und `GRASS_PATCHES` sind aktuell **leer** — erst steht das Grundgerüst
aus Häusern und Gärten, die Ausgestaltung kommt später. Jeder Eintrag in
`DECOR` ist eine Zeile:

```js
P("treeBig", 0, 0)      //  Tile-Name, Spalte, Zeile
```

Löschen entfernt das Objekt, Zahlen ändern verschiebt es. Ein Tippfehler im
Namen lässt nur dieses eine Objekt weg und schreibt eine Warnung in die Konsole
— die Welt lädt trotzdem.

Welche Namen es gibt, steht direkt darüber in `TILES`: Bäume, Blumen, Pilze,
Steine, Fässer, Töpfe, Laternen, Schilder, Zaunteile, Häuser. Ein neuer Name
braucht dort eine Zeile mit Sheet, Spalte, Zeile und Größe in Tiles.

**Grünzeug aus `ground_03`** ist komplett verfügbar. Das Sheet enthält dieselben
fünf Formen in sieben Grüntönen (1 = fast gelbgrün … 7 = fast schwarzgrün), die
Namen werden automatisch erzeugt:

| Name | Form |
|---|---|
| `bush1` … `bush7` | großer Busch, 2 × 2 |
| `bushRound1` … `7` | runder Busch, 2 × 2 |
| `bushSmall1` … `7` | kleiner Busch, 1 × 1 |
| `tuft1` … `7` | Grasbüschel |
| `tuftAlt1` … `7` | Grasbüschel, andere Form |
| `tuftLow1` … `7` | flaches Büschel |

Dunklere Töne weiter hinten setzen gibt Tiefe. Die großen, mehrfarbig
schattierten Büsche links im Sheet sind unregelmäßig geschnitten und deshalb
nicht dabei — die müsstest du einzeln in `TILES` mit den passenden Maßen
anlegen.

### Gras austauschen

Die Wiese ist eine ruhige Grundfarbe; Textur kommt über `GRASS_PATCHES` in
derselben Datei:

```js
{ x: 14, y: 6, w: 3, h: 4, style: "meadow" }
```

- `meadow` — hohe Halme, nahtloses 2 × 2-Muster, kräftiger
- `dense` — feines gleichmäßiges Gras, ruhiger

Beide kacheln nahtlos, du kannst also beliebig große Flächen setzen. Ein Tile
Abstand zu Wegen und Beeten lassen, sonst schneidet der Erdrand hart in die
Textur.

### Beete

Die Pflanzfläche jeder Parzelle wird Feld für Feld mit einer fertigen
Beet-Fläche aus `ground_01` belegt, dadurch sieht man sofort das 8 × 8-Raster.
Welche, steht als `BED_TILE` in `village.js`:

| Name | Aussehen |
|---|---|
| `bedDark` | dunkelbraun, kräftiger Kontrast |
| `bedDarkAlt` | dunkelbraun, andere Form |
| `bedLight` | hell auf Sandton, dezenter |
| `bedLightAlt` | hell, andere Form (aktuell) |

Der Übergang von Gras zu Erde liegt bewusst **unter dem Zaun**: `isGround()` in
`world.js` zählt den ganzen Zaunring zur Erde, nicht nur die Pflanzfläche. Der
Zaun steht dadurch auf der Kante und die Parzelle wirkt als geschlossenes
Grundstück.

### Marktplatz und Läden

Der Gebäude-Atlas (`assets/buildings/atlas_16x.png`) ist ein **modularer Bausatz
auf dem 16er-Raster**, keine Sammlung fertiger Häuser. Jedes Tile ist ein
eigenes Bauteil: Dach mit linker Kante, Mitte und rechter Kante, Wandzeilen mit
Randpfosten, Fenster, Markisen, Blumenkästen, Hängeschilder und zwei
Marktstände. Ein Laden entsteht Zeile für Zeile aus einzelnen Tiles —
`ATLAS`, `SHOP_LAYOUTS` und `shopTiles()` in `village.js`.

Drei Regeln, über die man garantiert stolpert:

- ⚠️ **Zeilen immer als Ganzes übernehmen, nie aus Rand- und Mitteltiles
  zusammensetzen.** Fenster und Beschläge sind über mehrere Tiles hinweg
  gemalt; wer ein Mitteltile wiederholt, zerreißt sie. Deshalb nimmt
  `band(x, y)` schlicht vier nebeneinanderliegende Spalten so, wie sie im
  Atlas stehen.
- ⚠️ **Es gibt im ganzen Atlas genau eine Tür: Tile (17,4)**, in Wandzeile 4.
  Ein Gebäude ohne diese Zeile hat keinen Eingang. Wer stattdessen irgendeinen
  4 × 2-Block kopiert, bekommt an der Türstelle ein Dachstück.
- Der Atlas benutzt **Pink (`#ff99cc`) als Transparenzfarbe** statt eines
  Alphakanals. Die wird beim Laden einmalig herausgerechnet (`keyOutColor`).

Fünf Gebäude, links kaufen und rechts verkaufen wie im Vorbild. Unterschieden
werden sie über die **Dachfarbe** und die Bauform:

| ID | Laden | Aufbau | Zustand |
|---|---|---|---|
| `seeds` | Samenladen | Haus, Holzdach (4 × 4) | offen |
| `tools` | Werkzeugladen | Haus, rotes Dach (4 × 4) | offen |
| `eggs` | Eierladen | Haus, blaues Dach (4 × 4) | geschlossen |
| `crops` | Ernte verkaufen | Zelt, rotes Dach (4 × 3) | offen |
| `pets` | Tiere verkaufen | Zelt, blaues Dach (4 × 3) | geschlossen |

Häuser sind Dach (2 Zeilen) + Obergeschoss + Erdgeschoss mit Tür; Zelte lassen
das Obergeschoss weg und sind dadurch flacher und klar unterscheidbar. Die Tür
sitzt immer in Spalte 1 (`DOOR_COLUMN`) und muss zum Türfeld in `world.js`
passen.

Position, Größe, Türfeld und `closed` stehen in `SHOPS` in `world.js`. Die
Kollision ergibt sich automatisch aus `size`; begehbar ist nur das Türfeld. Ein
geschlossener Laden zeigt am Aktionsknopf „Geschlossen" und lässt sich nicht
öffnen — beides hängt allein am `closed`-Flag.

Der Platz selbst ist bewusst offen gelassen, damit du ihn dekorieren kannst.

### Wege, Parzellen und Kollision

In `js/data/world.js`:

- `PLOT_ORIGINS` — obere linke Ecke der sechs Parzellen. Größe steckt in
  `PLOT_COLS`/`PLOT_ROWS`, Tor und Zaun ergeben sich daraus von selbst.
- `VILLAGE` — der gepflasterte Dorfplatz als Rechteck.
- `PATHS` — die Wegstücke zwischen Parzellen und Platz.
- `SHOPS` — Position des Gebäudes und das Türfeld davor.

Erde und Grasrand werden aus diesen Rechtecken automatisch zusammengesetzt
(Autotiles), du musst keine Übergangskacheln setzen. Begehbar ist alles außer
Zaunringen, Ladengebäuden und dem Kartenrand — das ergibt sich ebenfalls
automatisch aus den Rechtecken.

## Module

| Datei | Zweck |
|---|---|
| `js/data/world.js` | Kartengeometrie, Kollision, Parzellen, Läden |
| `js/render/village.js` | Backt die statische Welt einmalig; Deko und Grasflächen |
| `js/render/actors.js` | Charakter-Sprites |
| `js/engine/assets.js` | Sheets laden |
| `js/engine/autotile.js` | Übergänge aus den 1 × 6-Strips |
| `js/engine/camera.js` | Kamera mit Kartenbegrenzung |
| `js/engine/input.js` | Tastatur und Touch |
| `js/systems/player.js` | Rasterbewegung |
| `js/cloud.js` | Cloud-Save und Outbox |
| `js/multiplayer.js` | Raumzuweisung und Realtime |
| `js/game.js` | Schleife, Zeichnen, Verdrahtung |

## Technik

Die unveränderliche Welt wird beim Start einmal in 1:1-Weltpixel auf ein
Offscreen-Canvas gebacken; jeder Frame kopiert daraus nur den Kameraausschnitt.
Der Zoom ist immer ganzzahlig und wird in Gerätepixeln gerechnet, damit die
Pixelkanten scharf bleiben.

Die Bewegung ist streng rasterbasiert: ein begonnener Schritt wird immer zu
Ende geführt, der Spieler steht nie zwischen zwei Feldern. Nur dadurch trifft
Interagieren immer eindeutig das Feld unter den Füßen.
