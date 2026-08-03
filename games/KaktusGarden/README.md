# KaktusGarden

- **Pfad:** `/games/KaktusGarden/`
- **Game-ID:** `kaktus-garden`
- **Vorbild:** Magic Garden (magicgarden.wiki) — Dorf mit Läden, sechs
  Gartenparzellen, Charakter läuft im Raster

Ein Dorf mit vier Läden in der Mitte, darum sechs eingezäunte Parzellen à
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
| `js/systems/garden.js` | Pflanzen, Wachsen, Ernten, Kaufen, Verkaufen |
| `js/render/crops.js` | Pflanzen auf der Parzelle zeichnen |
| `js/ui/hotbar.js` | Die Leiste unten |
| `js/ui/shopPanel.js` | Samenladen und Verkaufsstand |
| `js/ui/format.js` | Münzen (K/M/B), Gewichte, Zeiten |

Der Spielstand liegt vorerst nur lokal (`kaktus-garden-save-v4`); Cloud-Save
kommt zusammen mit dem Multiplayer.

## Wirtschaft

Die Zahlen sind von **Magic Garden** übernommen (magicgarden.wiki/Crops und
/Seed_Shop). Elf unserer Pflanzen gibt es dort ebenfalls und tragen deren Werte
unverändert; für die acht übrigen ist jeweils ein freier Platz derselben
Preisleiter eingesetzt. Welche Vorlage benutzt wurde, steht als `template` an
jeder Pflanze in `crops.js`.

**Erntearten**

- `single` — einmal ernten, danach ist das Feld frei
- `multi` — die Pflanze bleibt stehen und wächst nach

Eine Ernte liefert bei `multi` **alle Slots auf einmal** (z. B. 5 Erdbeeren),
weil unsere Sprites keine einzeln abpflückbaren Früchte darstellen können. Jede
Frucht bekommt trotzdem ihr eigenes gewürfeltes Gewicht. Die Nachwachszeit
folgt der Wiki-Formel `(Slots + 2) / 3 × Wachstumszeit einer Frucht`.

**Gewicht und Preis**

Beim Ernten wird eine Größe von 50 bis 100 gewürfelt; 50 entspricht dem
Grundgewicht, 100 dem Höchstgewicht. Der Verkaufspreis skaliert mit dem
Verhältnis zum Grundgewicht — eine schwere Frucht bringt also spürbar mehr.
Deshalb liegt die Ernte im Spielstand als **Liste einzelner Früchte** vor, nicht
als Stückzahl.

**Laden**

Der Samenladen füllt alle fünf Minuten auf, ausgerichtet an der vollen Stunde.
Der Bestand hängt allein am Zeitfenster und nicht am Spieler — dadurch sehen
später alle im Dorf dasselbe Angebot. Jede Pflanze hat eine eigene
Erscheinungschance (Karotte 100 %, Paprika 1 %) und eine Bestandsspanne.
Gelistet werden **alle** Sorten, auch die gerade nicht lieferbaren — man soll
sehen können, worauf sich das Warten lohnt.

**Abweichungen vom Original — und warum**

Magic Garden bremst den Fortschritt vor allem über den anfangs winzigen Garten.
Bei uns sind von Beginn an alle 64 Felder nutzbar, deshalb brauchen drei
Pflanzen eine andere Behandlung:

| Pflanze | Original | Bei uns | Grund |
|---|---|---|---|
| Lauch | Snow-Shop, nur bei Wetter-Event | `stockChance: 0` | 90 s Wachstum bei 35.000 Wert — mit Abstand größter Ausreißer |
| Aubergine | Dawn-Shop, nur bei Wetter-Event | `stockChance: 0` | gehört ebenfalls nicht in den regulären Laden |
| Sellerie | (frei zugeordnet: Tulpe) | Vorlage Echeveria | 8 s bei 767 Wert und bis zu 25 Samen je Lieferung war eine Gelddruckmaschine |

Sobald es Wetter-Ereignisse gibt, bekommen Lauch und Aubergine dort ihren
Platz; die Werte stehen schon bereit.

## Stand

Fertig: Weltkarte, Canvas-Engine mit Kamera, Charakter und Rasterbewegung
inklusive Kollision, Touch-Steuerung.

Noch offen: Pflanzen und Interaktion auf den Parzellen, Multiplayer über
Supabase Realtime, Läden und Economy. `state.js`, `storage.js` und `plants.js`
enthalten noch das Datenmodell der Vorversion und werden dabei auf
Save-Version 3 umgestellt.

## Karte bearbeiten

Die Karte ist von Hand gesetzt, nichts daran ist prozedural. Zwei Dateien:

| Datei | Zuständig für |
|---|---|
| `js/data/world.js` | **Geometrie**: wo ist Erde, wo steht der Zaun, wo darf man laufen, wo stehen die Läden |
| `js/render/village.js` | **Aussehen**: Grastexturen und Dekoration |

### Koordinaten finden

Im Spiel unter **Einstellungen → Koordinatenraster** einschalten. Dann liegt ein
Raster über der Welt, alle vier Felder mit Koordinate beschriftet, das Feld
unter der Maus wird hervorgehoben. **Ein Klick schreibt die fertige Code-Zeile
in die Browser-Konsole** — von dort direkt kopieren. Der Schalter merkt sich
seinen Zustand pro Gerät.

(`?debug` in der Adresse gibt es weiterhin, das ist aber nur der Zugang für
automatisierte Tests.)

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
| `bedDark` | dunkelbraun, kräftiger Kontrast (aktuell) |
| `bedDarkAlt` | dunkelbraun, andere Form |
| `bedLight` | hell auf Sandton, dezenter |
| `bedLightAlt` | hell, andere Form |

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
| `js/render/debugGrid.js` | Bearbeitungsraster für `?debug` |
| `js/engine/assets.js` | Sheets laden |
| `js/engine/autotile.js` | Übergänge aus den 1 × 6-Strips |
| `js/engine/camera.js` | Kamera mit Kartenbegrenzung |
| `js/engine/input.js` | Tastatur und Touch |
| `js/systems/player.js` | Rasterbewegung |
| `js/game.js` | Schleife, Zeichnen, Verdrahtung |

## Technik

Die unveränderliche Welt wird beim Start einmal in 1:1-Weltpixel auf ein
Offscreen-Canvas gebacken; jeder Frame kopiert daraus nur den Kameraausschnitt.
Der Zoom ist immer ganzzahlig und wird in Gerätepixeln gerechnet, damit die
Pixelkanten scharf bleiben.

Die Bewegung ist streng rasterbasiert: ein begonnener Schritt wird immer zu
Ende geführt, der Spieler steht nie zwischen zwei Feldern. Nur dadurch trifft
Interagieren immer eindeutig das Feld unter den Füßen.
