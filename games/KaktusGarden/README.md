# KaktusGarden

- **Pfad:** `/games/KaktusGarden/`
- **Game-ID:** `kaktus-garden`
- **Save-Version:** 2
- **Beete:** fest 16 (Spiellogik 4 × 4, optisch einzelne Ackerflächen)
- **Restock:** alle 5 Minuten, anhand gespeicherter Zeitstempel

## Welt

Die Farm ist eine echte Tilemap aus den Super-Retro-Ranch-Sheets, gezeichnet auf
ein `<canvas>`; alles Interaktive liegt als DOM-Ebene darüber.

- `js/data/farmMap.js` — Kartenlayout: Terrain-Bereiche, Zaun, Beete, Gebäude
  und jede einzelne Dekoration. Nichts davon ist prozedural.
- `js/render/worldRenderer.js` — Autotiler und Canvas-Zeichnung.

Der Zaun umschließt ausschließlich die Anbaufläche. Laden, Verkaufshaus und
schwarzes Brett stehen darüber auf dem Hofplatz, ein Tor führt aufs Feld. Bäume,
Büsche, Blumen, Steine und Wege liegen alle außerhalb des Zauns.

### Autotiles

Die Übergänge Gras → Erde und Erde → Beet kommen aus den 1 × 6-Strips des
Asset-Packs. Jede Zeile liefert 8 × 8-Viertel:

| Zeile | Bedeutung |
|---|---|
| 0 | freistehend (Außenecken) |
| 1 | senkrechter Streifen (linke/rechte Kante) |
| 2 | waagerechter Streifen (obere/untere Kante) |
| 3 | Innenecken |
| 4 | Füllung |
| 5 | Hintergrund |

Für jedes Viertel entscheidet nur, ob der waagerechte, der senkrechte und der
diagonale Nachbar zum selben Terrain gehören. Die beiden verwendeten Sets sind
farblich aufeinander abgestimmt (`grass_on_dirt_02` füllt mit `#eea160`, genau
dem Hintergrund von `field_02`), deshalb entstehen keine Nähte.

### Darstellung

`--px` ist der Umrechner von Map-Pixeln in CSS-Pixel, gesetzt auf
`.garden-world`. Beete, Gebäude und Pflanzen rechnen alle damit und sitzen
dadurch exakt auf ihren Tiles. Der Zoom richtet sich nach `FOCUS_VIEW`: Zaun,
Anbaufläche und Gebäude müssen immer vollständig sichtbar sein. Bleibt danach
Platz, wächst das Sichtfenster über den Fokus hinaus und zeigt so viel Waldrand,
wie hinpasst — auf dem Desktop also fast die ganze Karte, auf dem Handy nur den
Hof.

## Pflanzen

19 einmalig erntbare Nutzpflanzen verwenden die originalen Wachstums- und
Icon-Sheets. `berry` wird spielintern als Erdbeere geführt, `tallgrass` bleibt
Umgebungselement, Obstbäume sind nicht im Spiel.

Sämtliche Render-Regeln stehen zentral in `PLANT_RENDER` (`js/data/plants.js`):
eine Pflanze pro Beet, unten mittig, 8 Map-Pixel über der Beetunterkante, in
doppelter Framegröße. Der Faktor ist ganzzahlig, damit die Pixel scharf bleiben,
und wirkt auf jede Pflanze gleich — nichts wird verzerrt, kleine Pflanzen bleiben
klein und hohe (16 × 32) ragen von selbst über das Beet hinaus.

**Animationen kommen aus den Assets, nicht aus CSS.** Während des Wachstums
läuft die Pflanze durch die Frames ihres Sheets (0 … `readyFrame` − 1). Reife
Pflanzen stehen still; nur Mais hat ein eigenes Ready-Sheet (`shake`) und wackelt
deshalb. Beete hüpfen bei Hover oder Klick nicht, sie bekommen nur eine dezente
Markierung.

## Balancing

Jedes Beet liefert genau **eine** Frucht, der Gewinn pro Zyklus ist also
`Verkauf − Kauf`. Der Gewinn pro Minute steigt mit der Seltenheit, der Samen
kostet immer rund 40 % des Ernteerlöses. Gebremst wird der Fortschritt vor allem
durch den Shop: seltene Samen erscheinen kaum und dann höchstens ein- bis
zweimal.

| ID | Name | Seltenheit | Kauf | Verkauf | Wachstum | Restock-Chance | Stück |
|---|---|---|---|---|---|---|---|
| `carrot` | Karotte | gewöhnlich | 8 | 15 | 45 s | 100 % | 1–3 |
| `radish` | Radieschen | gewöhnlich | 14 | 28 | 1 m 15 s | 88 % | 1–3 |
| `beetroot` | Rote Bete | gewöhnlich | 20 | 46 | 2 m | 80 % | 1–2 |
| `lettuce` | Kopfsalat | gewöhnlich | 32 | 78 | 3 m | 75 % | 1–2 |
| `onion` | Zwiebel | ungewöhnlich | 50 | 123 | 4 m | 55 % | 1–2 |
| `strawberry` | Erdbeere | ungewöhnlich | 75 | 180 | 5 m | 48 % | 1–2 |
| `potato` | Kartoffel | ungewöhnlich | 110 | 267 | 6 m 30 s | 43 % | 1–2 |
| `leek` | Lauch | ungewöhnlich | 150 | 366 | 8 m | 39 % | 1 |
| `cauliflower` | Blumenkohl | ungewöhnlich | 210 | 510 | 10 m | 35 % | 1 |
| `celery` | Sellerie | selten | 290 | 700 | 12 m | 24 % | 1–2 |
| `tomato` | Tomate | selten | 370 | 900 | 14 m | 20 % | 1–2 |
| `broccoli` | Brokkoli | selten | 500 | 1 220 | 17 m | 16 % | 1 |
| `eggplant` | Aubergine | selten | 640 | 1 560 | 20 m | 13 % | 1 |
| `pepper` | Paprika | selten | 840 | 2 040 | 24 m | 10 % | 1 |
| `corn` | Mais | episch | 1 200 | 2 960 | 30 m | 7 % | 1 |
| `pumpkin` | Kürbis | episch | 1 750 | 4 260 | 38 m | 4,5 % | 1 |
| `grape` | Traube | episch | 2 350 | 5 720 | 45 m | 2 % | 1 |
| `wheat` | Weizen | legendär | 3 250 | 7 930 | 55 m | 1,5 % | 1 |
| `bamboo` | Bambus | legendär | 4 650 | 11 320 | 70 m | 0,8 % | 1 |

Die Schaufel kostet 400 Münzen. Die erlaubten Bänder je Seltenheit stehen als
`RESTOCK_RULES` neben der Tabelle im Code — wer neu balanciert, schaut zuerst
dort nach.

Karotten sind mit 100 % bewusst garantiert (`GUARANTEED_SEED`), sonst könnten
Spieler ohne Samen und ohne Münzen dauerhaft feststecken. Alle anderen Einträge
dürfen und sollen bei einem Restock fehlen.

Nach der Ernte wird die Pflanze vollständig entfernt; es gibt keine
Regrow-Logik.

## Module

- `js/data/plants.js` — Pflanzen-, Sprite-, Render-, Ernte-, Werkzeug- und Economy-Werte
- `js/data/farmMap.js` — Kartenlayout und Tile-Zuordnung
- `js/render/worldRenderer.js` — Autotiler und Canvas-Renderer
- `js/state.js` — normalisierter Spielzustand, Restock und Farm-Snapshots
- `js/storage.js` — austauschbare LocalStorage-/Supabase-Adapter
- `js/game.js` — UI, Pflanzen, Ernten, Verkauf und Farmbesuche

Angemeldete Spieler speichern in `game_saves`; Gäste bleiben lokal. Fremde
Farmen werden ausschließlich über die read-only View `kaktus_garden_farms`
gelesen. Diese View exponiert keine Währungen oder Inventare.

## Changelog

- **2026-08-01 — V3:** echte Tilemap mit Autotile-Übergängen, Zaun nur um die
  Anbaufläche, Gebäude statt Bottom-Navigation, mittige Menü-Overlays, eine
  Pflanze je Beet, Ertrag 1, deutlich strengeres Shop-Balancing.
- **2026-08-01 — V2:** vollständiger Pixel-Umbau mit 19 Super-Retro-Ranch-
  Nutzpflanzen, Sprite-Wachstumsphasen, Pixel-UI und kuratierten Farm-Tiles.
- **2026-08-01 — V1:** 16 Felder, sechs Pflanzen, Shop/Restock, Inventare,
  Schaufel, Offline-Wachstum, Cloud-Saves und schreibgeschützte Farmbesuche.
