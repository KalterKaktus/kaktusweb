# KalterKaktus — Projekt-Wissensbasis

**GitHub:** `KalterKaktus/kaktusweb` · **Live:** https://kalterkaktus.de
**Hosting:** Netlify, deployt automatisch bei Push auf `main`.
**Supabase-Projekt:** `rdqbkpowntebcrsnwyqp`

Diese Datei ist die zentrale Wissensbasis und wird automatisch geladen.
Der **aktuelle Code-Stand ist immer die Wahrheit** — wenn Doku und Code sich
widersprechen, gilt der Code, und die Doku wird korrigiert.

---

## ⚠️ Vor dem Arbeiten lesen

Diese Punkte sehen wie Bugs aus, sind aber **gewollt**. Nicht „reparieren":

- **`/impressum.html` zeigt nur `ERROR:1001`.** Vom Besitzer ausdrücklich so
  gewünscht, inklusive `noindex,nofollow`. Nicht wiederherstellen.
- **Klicks auf das Wasser in MyFishingKaktus erzeugen keine Wellen.** Bewusst
  entfernt um Leistung zu sparen. Wellen kommen nur noch von Fisch-Events
  (`waterSystem.pulseAt`) und der Idle-Ambience.
- **Datenschutz, Nutzungsbedingungen und Admin-Inhalt bleiben deutsch.** Kein
  i18n dort. Die Admin-*Nav* ist übersetzt, der Panel-Inhalt nicht.
- **`u_hold` im Wasser-Shader ist deklariert aber unbenutzt.** Rest vom
  entfernten Klick-Ripple, kein Versehen.
- **KaktusClicker hat Sound, aber keine Audio-Dateien.** Alles wird zur Laufzeit
  per Web Audio synthetisiert (`games/KaktusClicker/audio.js`). Die alten Dateien
  waren mit 5 MB das schwerste Asset des Spiels und wurden beim Cozy-Redesign
  entfernt; synthetisiert wiegt es ein paar Kilobyte und lässt jeden Klick leicht
  anders klingen. Wer Musik nachrüstet, braucht dafür wieder Dateien — Sound-
  effekte bitte nicht.
- **Die Vecteezy-Attribution im Einstellungen-Tab des Clickers muss sichtbar
  bleiben.** Die Free-Lizenz verlangt sie auf der Seite selbst. Siehe
  `games/KaktusClicker/ASSET_CREDITS.md`.

### Netlify-Credits sind knapp
Der Besitzer hat den 9-€-Plan mit begrenzten Build-Credits (Stand Ende Juli 2026:
~190). **Jeder Push auf `main` kostet einen Build.** Deshalb:
- Änderungen bündeln, nicht einzeln pushen
- Erst vollständig verifizieren, **dann** einen Commit
- Nur SQL/Migrations ohne Frontend-Änderung lösen keinen Build aus

---

## Projekt-Struktur

```
index.html              Homepage (Hero, Leaderboards, Discord-Status)
styles.css              Globale Styles (dunkles Theme)
script.js               Homepage-Logik
login.html              Auth-Einstieg
auth/                   OAuth-Callback + Passwort-Reset
profile/                Profil-Seite (Username, Badges, Referral, VIP)
adminpanel/             Admin-UI (User editieren, Live-Events)
games/
  index.html            Games-Hub
  KaktusClicker/        Idle-Clicker
  MyFishingKaktus/      Active-Fishing
steam-deals/            Steam-Deals-Seite
wiki/                   Statisches Wiki + Kauf-Optimizer (siehe eigenen Abschnitt)
js/                     Shared-Module (siehe unten)
css/                    game-tokens.css, fonts.css + selbst gehostete Schriften
tools/                  optimize-assets.py (Rohbilder → WebP); tools/raw/ gitignored
netlify/functions/      Serverless
supabase/migrations/    DB-Migrations
netlify.toml            Hosting-Config + Function-Schedules
```

### Shared-Module in `js/`
| Datei | Zweck |
|---|---|
| `i18n.js` | Sprachsystem DE/RU (siehe eigenen Abschnitt) |
| `i18n/de.json`, `i18n/ru.json` | Übersetzungs-Dictionaries |
| `supabase-client.js` | Supabase-Client. **Achtung:** statischer Import von `https://esm.sh/` |
| `auth-nav.js` | Nav-Aufbau, Sandwich-Menü, Auth-Status, Presence, Admin-Nachrichten |
| `auth-login.js`, `auth-callback.js`, `auth-reset.js` | Auth-Flows |
| `profile.js` | Profil laden/speichern, Username-Validierung |
| `progression.js` | Level/XP-Formel, Badges, VIP-Namensfarbe |
| `xp-service.js` | XP-Vergabe mit Batching + Throttle |
| `game-cloud.js` | Cloud-Saves + Clicker-Leaderboard + Monatssaison |
| `home-leaderboard.js` | Die drei Leaderboards auf der Startseite |

---

## Sprachsystem (DE/RU)

**Die ganze Site außer Legal/Admin-Inhalt ist zweisprachig.** Runtime ist
`js/i18n.js`, Dictionaries sind `js/i18n/de.json` und `js/i18n/ru.json`.

### Regeln für neuen Code
- **Keine hartcodierten UI-Strings.** Immer `t("namespace.key")` in JS oder
  `data-i18n="namespace.key"` in HTML.
- **Jeder neue Key muss in BEIDE JSONs.** Fehlt er in einer Sprache, greift der
  Fallback und der Text bleibt in der anderen Sprache stehen.
- **Zahlen und Zeiten** über die locale-abhängigen Formatter, nicht `de-DE`
  hartcodieren (`getLanguage() === "ru" ? "ru-RU" : "de-DE"`).

### Die drei HTML-Attribute
| Attribut | Wirkung |
|---|---|
| `data-i18n="key"` | ersetzt `textContent` |
| `data-i18n-html="key"` | ersetzt `innerHTML` (nur für eigene, vertrauenswürdige Texte) |
| `data-i18n-attr="attr:key,attr2:key2"` | setzt Attribute, z.B. `aria-label` oder `placeholder` |

### Wichtige Eigenheiten
- ⚠️ **`DICT_VERSION` in `js/i18n.js` bei JEDER Änderung an de.json/ru.json
  hochzählen.** Die Dictionaries werden mit `cache: "force-cache"` geladen —
  ohne neue Version sieht der Browser die neuen Strings nie und `t()` liefert
  weiter den rohen Key zurück.
- **Der Flaggen-Switcher lebt in `i18n.js`, nicht in `auth-nav.js`.** Grund:
  `auth-nav.js` hängt über `supabase-client.js` an einem statischen `esm.sh`-Import.
  Ist das CDN langsam oder blockiert, wird `auth-nav.js` nie evaluiert und die
  Flaggen wären unsichtbar. `i18n.js` hat keine externen Abhängigkeiten.
- **Jede Seite lädt `js/i18n.js` direkt** (vor `auth-nav.js`), aus demselben Grund.
- **`data-i18n`-Elemente snapshotten ihr Original** in einer WeakMap. Fehlt ein
  Key, wird das Original wiederhergestellt — sonst bliebe beim Zurückschalten
  auf Deutsch der russische Text stehen.
- **`t()` vor dem Laden der Dictionaries gibt den rohen Key zurück.** Wer früh
  rendert, muss auf `ready` warten oder auf `onLanguageChange` neu rendern —
  `i18n.js` feuert nach dem Laden einmal `notify()`.
- **Klassische (nicht-Modul) Scripts** hören auf das DOM-Event
  `kk:languagechange`. So macht es `wiki/wiki.js` für seinen Such-Cache.
- **Spracheinstellung:** `localStorage["kk-lang"]` hat Vorrang; ohne Eintrag wird
  `profiles.preferred_language` verwendet. Gerät schlägt also Account.

### Was in Daten-Dateien steht
`data.js`, `upgrades.js`, `changelog.js` und `progression.js` enthalten
**deutsche Originaltexte als Fallback**. Die Lookup-Helper (`tName`, `tDesc`,
`badgeName`, `tFish` …) greifen darauf zurück wenn kein Key existiert.
Changelog-Einträge tragen die russische Variante inline als `ru: { title, items }`.

Fischnamen: `games/MyFishingKaktus/js/data/fishNames.ru.js`, gekeyt auf den
englischen Originalnamen (alle 132 abgedeckt).

---

## Games

### KaktusClicker
- **Pfad:** `games/KaktusClicker/` · **Game-ID:** `kaktus-clicker`
- Idle-Clicker mit 30 Gebäuden, 158 Upgrades, 30 Abzeichen, Nopal-Prestige,
  Goldlauf (250 Klicks kumulativ → ×3 für 30 s), Gold-/Rubinkaktus-Events,
  monatlicher Saison-Rangliste, Offline-Ertrag (ab 5 Min, max 12 h, 50 %).
- **Economy V3 (August 2026):** Kosten unverändert, CPS späterer Gebäude massiv
  gebufft (Ziel-Amortisation ≈ 120×1,5^Index s). 120 generierte Blüten-Upgrades
  (×2 bei 10/25/50/100 Besitz, `unlockOwned` gated die Anzeige), Klick-Ertrag =
  Basis + 1 % CPS (Klick-Sog-Upgrades → 4 %), Autoklicker-Upgrades klicken nur
  bei aktivem Spielen mit (Tab sichtbar + Eingabe < 15 s; zählen NICHT auf
  `totalClicks` → Klick-XP und Klick-Abzeichen bleiben manuell). Produktion
  läuft per Delta-Zeit (Hintergrund-Tab-Drossel-Fix, Cap 300 s/Tick).
  Kalibriert per Simulation gegen echte Spielerdaten (`tools/`-Historie im
  Commit). Der Server-Trigger `game_saves_initial_cap` wurde auf 1e12 angehoben
  (Migration `20260731230000`) — sonst hätte er ehrliche Tag-1-Spieler gebannt.
- **Optik:** Cozy-Look (siehe Design-System). `<body class="theme-cozy">`,
  Ladebildschirm inline in der `index.html` wie bei Fishing.
- **7 Tabs:** Gebäude · Upgrades · Stats · Prestige · Rangliste · Erfolge ·
  Einstellungen. Konvention: `data-tab="x"` braucht ein `id="x-panel"`.
- **Assets:** `assets/background/`, `assets/cactus/`, `assets/currencies/` —
  alles WebP, kein PNG-Fallback. Erzeugt aus `tools/raw/` (gitignored) per
  `python tools/optimize-assets.py`. Lizenzen in `ASSET_CREDITS.md`.
- **Daten:** `data.js` → `buildings`, `upgrades`, `achievements`, `changelogEntries`
- **Sound:** `audio.js`, komplett synthetisiert (Sinus/Dreieck, Tiefpass, weicher
  Anschlag — passend zum Cozy-Look). Sechs Sounds: Klick, Gebäude-Kauf,
  Upgrade-Kauf, Tab-Wechsel, Gold- und Rubinkaktus-Erscheinen. Der Klick ist auf
  einen alle 28 ms gedrosselt und streut in der Tonhöhe, sonst wird Dauerklicken
  zum Maschinengewehr. **Autoklicker lösen bewusst keinen Ton aus** — bei 20/s
  wäre das Dauerfeuer. Einstellungen (an/aus, Lautstärke) liegen in
  `localStorage["kaktus-clicker-audio"]`, **nicht im Spielstand**: Lautstärke ist
  eine Geräte-Einstellung und hat in der Cloud nichts verloren. Der AudioContext
  wird erst bei der ersten echten Geste geöffnet (Autoplay-Richtlinie).
- **Zahlenformat:** `format.js`, locale-abhängig (Mio./Mrd. vs. млн/млрд)
- **Changelog:** Zusatzmenü → Changelog. Neue Einträge in `data.js`, mit `ru`-Variante.
- **Prestige (V3):** Nopal-Gewinn `floor((totalEarned/1e6)^0.35)`, Multiplikator
  `1 + 0,25·nopal^0.4` — beide Formeln stehen in `economy.js`
- **Rangliste „Letzter Monat":** Platz und Punktzahl sind historisch aus
  `game_season_archives.top_entries`, **Name/Level/Badge/Farbe kommen live** aus
  `profiles_public` (per `user_id` gejoint).

### Wiki: Kauf-Optimizer und generierte Tabellen

- **`wiki/clicker-planner.js`** — rechnet den Kauf-Plan. **Simuliert echte Zeit**,
  sortiert nicht nach Refinanzierungs-Zeit: ein Kauf kostet
  `(Kosten − Kontostand) ÷ Einkommen` an Wartezeit, danach steigt das Einkommen.
  Bewertet wird eine ganze Reihenfolge daran, wie viel sie im Zeitfenster erntet
  — also `totalEarned`, der Ranglisten-Wert. Das Ergebnis ist ein **Ablauf**,
  keine Rangliste.
  Kandidaten: Gebäude, alle 150 Gebäude-Upgrades, Klick-, Klick-Sog- und
  Autoklicker-Upgrades. `unlockOwned` ist Teil der Simulation.
  Suchverfahren: Beam-Search **über Zeitscheiben, nicht über Kaufschritte**.
  ⚠️ Das ist der Punkt, an dem zwei Anläufe gescheitert sind — nach Kaufschritten
  gruppiert stehen Zustände aus Minute 1 neben solchen aus Minute 50, und jede
  Bewertung bevorzugt dann systematisch eine Sorte. Symptom: mehr Kandidaten
  machten das Ergebnis *schlechter*. Wer daran schraubt, prüft zuerst das:
  zusätzliche Optionen dürfen nie schaden.
  Ebenfalls gemessen und verworfen: typisierte Arrays für die Zustände (4× langsamer
  als `Array.slice()`) und logarithmische Zeitscheiben (halbierte die Qualität
  über 24 h). Beides steht als Kommentar im Code, damit es niemand nochmal probiert.
  Näherung, kein Optimum: die Voreinstellungen liefern 95-115 % eines rund
  zwanzigmal teureren Suchlaufs.
- **`wiki/optimizer.js`** — nur Oberfläche: Cloud-Save lesen, Eingaben sammeln,
  Ergebnis rendern. Zeitfenster 1/6/24 h, Klicks-pro-Sekunde-Feld (0 = reines Idle).
  Die Suche blockiert den Hauptthread rund eine Sekunde, deshalb läuft sie hinter
  einem doppelten `requestAnimationFrame` — sonst sieht niemand den Hinweis.
- **Prestige-Empfehlung** (`evaluatePrestige`) — rechnet beide Wege durch,
  weiterspielen gegen sofort prestigen, und vergleicht den Ertrag über 1/6/24 h.
  Die Prestige-Seite startet bei null Gebäuden mit höherem Multiplikator. Sie
  braucht zwingend eine Klickrate > 0, sonst läuft ein zurückgesetzter Spielstand
  nie an — deshalb rechnet der Vergleich mit mindestens 1 Klick/s auf beiden Seiten.
- **`wiki/kaktusclicker/tables.js`** — Gebäude-, Abzeichen- und Upgrade-Tabellen
  auf `wiki/kaktusclicker/` werden **aus `data.js` generiert**, nicht im HTML
  gepflegt. Grund: von Hand gepflegt rotten sie bei jedem Balance-Patch, und zwar
  doppelt (die russische Fassung liegt als HTML-String in `ru.json`). Platzhalter
  ist `<div class="table-wrap" data-wiki-table="buildings|upgrades|achievements">`
  — der muss in der
  deutschen HTML-Fassung **und** im RU-String stehen, sonst fehlt die Tabelle in
  einer Sprache. Gerendert wird per `onLanguageChange`, weil `applyTranslations()`
  das `innerHTML` der Sections (`data-i18n-html`) bei jedem Wechsel ersetzt.
- Der **Fließtext** der Wiki-Seite (Formeln, Schwellen, Beispieltabellen) ist
  weiterhin Handarbeit in beiden Sprachen. Bei Balance-Änderungen mitziehen.

### My Fishing Kaktus
- **Pfad:** `games/MyFishingKaktus/` · **Game-ID:** `my-fishing-kaktus`
- Active Collection Fishing: 3 Areas (Pond/Lake/Ocean, Prestige-Cap 2),
  132 Fische, WebGL-Wasser, Fang-Minispiel (Fortschritt **und** Schnur-Spannung),
  Fish-Index, Inventar, Coin-Fische, Live-Leaderboard (Prestige > Fänge).
- **Module:** `js/game.js` + `js/systems/`
- **Daten:** `js/data/` (areas, fish, rarities, upgrades, mutations, karl, dailyRewards, changelog)
- **5 Upgrades:** Rute, Schnur, Haken, Glück, Köder — **interne ID von Köder ist `sonar`**
- **10 Wetter-Events**, global synchron, 15-Min-Slot mit 2,5 Min aktiv:
  sunny, rain, storm, fog, night (je ×2 auf einen Stat) + abyss, polarlicht,
  glutsturm, blutmond, geistermeer (Mutations-Events, ×3 bis ×10).
  Geistermeer ist mit 1,7 % pro Slot das seltenste.
- **Mutationen:** Standard (BIG/HUGE/SHINY, 10 %) + Event-spezifisch. Stacken
  multiplikativ. Glück erhöht alle Mutations-Chancen um +8 % pro Level.
- **Karl:** `KARL_SLOT_MS = 30 * 60 * 1000` → **maximal 1× pro 30 Minuten**,
  30 s sichtbar, deterministisch aus Epoch. Konfig `js/data/karl.js`, System
  `js/systems/karlSystem.js`, Bild `assets/karl.png`.
- **Daily-Rewards:** `js/systems/dailySystem.js` + `js/data/dailyRewards.js`.
  Streak auf lokalem Datum. Tag 7: Woche 1 = Epic, Woche 2 = 2× Epic, ab Woche 3
  = Legendary. Daily-Spots leben 90 s statt 12 s.
- **Test-Menü:** URL `?test` schaltet ihn frei (localStorage-persistent), `?notest` aus.
- **Angel-UI:** `js/systems/angelUiSystem.js` (ersetzt den alten Shop; Window-ID
  bleibt intern `shop`). Unter 460 px Breite liegen die 5 Part-Tabs als 3+2.

### KaktusGarden
- **Pfad:** `games/KaktusGarden/` · **Game-ID:** `kaktus-garden` · **Save-Version 4**
- Loginpflichtiges Live-Pixel-Farming: bis zu 6 Spieler teilen ein Dorf mit
  sechs Grundstücken à 8×8 = 64 Pflanzfeldern. Nur das eigene Grundstück ist
  veränderbar; fremde Grundstücke sind begehbar und read-only.
- **Matchmaking:** `garden_join_room()` priorisiert Server A bis 6/6 und legt
  erst danach Server B an. Ein Account kann nur einen aktiven Slot belegen.
  Presence synchronisiert die Belegung, Broadcast die Rasterbewegung.
- **Cloud:** `js/cloud.js` schreibt Save v4 nach jeder Aktion mit monotoner
  `revision` in `game_saves`; eine localStorage-Outbox verhindert Verlust beim
  Schließen/Offline-Sein. Alte Test-Saves werden bewusst einmalig zurückgesetzt.
- **Farm-Sichtbarkeit:** fremde Farmen kommen ausschließlich aus
  `garden_room_snapshot()`/`kaktus_garden_farms`; Inventar und Währungen bleiben
  privat. DB-Änderungen lösen das private Broadcast-Event `farm-changed` aus.
- **Shop:** deterministisches, global gleiches Angebot nach Supabase-Serverzeit
  an absoluten 5-Minuten-Grenzen, aber persönlicher Restbestand. Reloads füllen
  ihn im selben Zeitfenster nicht auf. Das Inventar hat genau 9 Stapel.
- **Daten/Renderer:** `js/data/crops.js`, `js/data/world.js`, Canvas-Renderer in
  `js/render/`; keine CSS-Pflanzenanimation. Das Dorf nutzt ein 16-px-Raster.
- Interagiert wird erst im Stillstand auf dem Zielfeld. Offene Menüs/Dialoge
  löschen die Eingabe und halten die Figur an.
- ⚠️ Die globale `styles.css` setzt `* { margin: 0 }` und nimmt `<dialog>` damit
  die Zentrierung. `margin: auto` muss lokal wieder gesetzt werden.

---

## Supabase

### Auth
- Google OAuth + E-Mail/Passwort
- Site URL `https://kalterkaktus.de`, Redirect `/auth/callback.html`
- Google-Callback: `https://rdqbkpowntebcrsnwyqp.supabase.co/auth/v1/callback`

### Kern-Tabellen
| Tabelle | Zweck |
|---|---|
| `profiles` | `id`, `username`, `total_xp`, `equipped_badge`, `vip`, `vip_color`, `is_banned`, `referral_code`, `preferred_language` |
| `game_saves` | PK `(user_id, game_id)` — jedes Spiel eigene Zeile, können sich nicht überschreiben |
| `game_saves_history` | Änderungs-Log, erlaubt `restore_game_save()` |
| `game_season_archives` | Monatsabschluss `(game_id, season_id)` → `top_entries jsonb` inkl. `user_id` |
| `admin_game_events` | Live-Push an Online-Spieler, Auto-Expire 60 s |
| `admin_messages` | Nachrichten an einzelne User |
| `user_presence` | Wer ist online und wo |
| `user_badges` | Freigeschaltete Badges |
| `kaktus_garden_rooms` | Persistente Raum-IDs, A/B-Reihenfolge und Invite-Codes |
| `kaktus_garden_room_members` | Race-sichere 6er-Slots mit 45-s-Verbindungs-Lease; ein Slot pro Account |

### Views — nicht direkt auf `game_saves` lesen!
Das Security-Hardening (`20260525120000`) hat die alten Public-SELECT-Policies
ersetzt. Leaderboards lesen **ausschließlich** aus Views, die nur unkritische
Spalten exponieren:
- `kaktus_clicker_leaderboard`
- `my_fishing_kaktus_leaderboard`
- `profiles_public` (inkl. berechnetem `level`, ohne Spendenbeträge)
- `kaktus_garden_farms` (nur aktive Mitglieder des eigenen Raums, ausschließlich 64 Farmzellen)

Gebannte User sind in den Views herausgefiltert (`20260525170000_ban_enforcement`).

### Wichtige Trigger
- `game_saves_force_display_name` — erzwingt `display_name = profiles.username`,
  verhindert Impersonation. Client-Wert wird überschrieben.
- `kaktus_clicker_guard_season` — lehnt Saves mit veralteter `season_id` ab.
- `game_saves_block_banned`, `profiles_ban_block_xp` — Ban-Durchsetzung.
- `profiles_throttle_cols_protect` — XP-Throttle-Spalten gegen Client-Writes.
- `cheat_flags_autoban` — Autoban bei Cheat-Flags.
- `game_saves_validate_kaktus_garden_payload` — erzwingt Save v4, 64 Zellen,
  höchstens 9 Inventarstapel und monotone Revisionen.
- `garden_broadcast_farm_update` — sendet geänderte Farmzellen privat an den
  aktuellen Garden-Raum.

### Migrations ausführen
Migrations laufen **nicht** automatisch. Zwei Wege:
1. **Supabase MCP** (`apply_migration`) — direkt aus der Session, bevorzugt
2. Supabase Dashboard → SQL Editor → Datei einfügen → Run

Dateien sind idempotent (drop + create). Nach dem Anwenden gehört die `.sql`
trotzdem ins Repo, damit ein Neuaufbau reproduzierbar bleibt.

KaktusGarden Multiplayer benötigt
`20260803120000_kaktus_garden_multiplayer.sql`; ohne diese Migration bleiben
Join, Presence-Autorisierung und Cloud-v4-Validierung absichtlich gesperrt.

---

## Level, XP und Badges

- **Formel:** `XP_für(N) = N² × 8`, also `level = floor(sqrt(xp / 8))`. Cap 9999.
- **Quellen:** Fishing-Fang nach Rarity (+ Bonus ab Mutation ×3), Clicker
  100 Klicks = 1 XP, Prestige `100 + min(900, nopal × 5)`, Heartbeat 2 XP/Min
  bei aktivem Tab.
- **Server-Limits:** max 1000 XP pro `add_xp`-Call, Heartbeat max 1×/50 s.
- **10 Badges**, davon 4 Level-Auto-Awards. Nur **eins** gleichzeitig sichtbar,
  Auswahl im Profil. Definition in `js/progression.js`.
- **VIP:** +20 % XP und eigene Namensfarbe, solange `profiles.vip = true` —
  unabhängig davon ob das VIP-Badge angezeigt wird.
- **Referral:** `?ref=CODE` → localStorage → `claim_referral()` beim ersten
  Login. Qualifiziert sobald der Geworbene Level 5 erreicht.

---

## Adminpanel

**Pfad:** `/adminpanel/` (nur eingetragene Admins)

- **Per-Player-Editing:** Payload-Felder werden rekursiv als Inputs gerendert —
  funktioniert automatisch für jedes Spiel in `game_saves`. Dazu: JSON direkt
  editieren, Save löschen, Client-Reload erzwingen, Nachricht schicken, sperren.
- **Live-Events:** Clicker (Gold-/Rubinkaktus) · Fishing (Wetter forcen inkl.
  der 5 neuen Events, Coin-Fisch, Broadcast, Force-Spawn Epic/Legendary, Karl)
- **Cross-Game:** „Alle Spieler neu laden" (`force-reload`)
- **Server-Whitelist:** `netlify/functions/admin-panel.mjs` →
  `ADMIN_GAME_EVENT_TYPES` und `CROSS_GAME_EVENT_TYPES`. Neue Event-Typen müssen
  dort eingetragen werden, sonst werden sie abgelehnt.

---

## Netlify Functions

| Function | Zweck |
|---|---|
| `steamfree.js` | Steam-Deals (kostenlos + 70-99 % mit ≥5000 Reviews, ≥80 % positiv) |
| `check-free-games.js` | `@hourly` Cron → Discord-Post bei neuen Gratis-Spielen. Braucht `DISCORD_WEBHOOK_URL` |
| `kaktus-clicker-season.mjs` | Prüft/erzwingt die aktuelle Monatssaison |
| `kaktus-clicker-monthly-reset.mjs` | Saison-Abschluss: archiviert Top 3, resettet Saves |
| `admin-panel.mjs` | Admin-Aktionen mit Service-Role-Key |
| `lib/kaktusSeason.mjs` | Gemeinsame Saison-Logik. Archiviert `user_id` mit |

Secrets nie committen. `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` deckt nur
bewusst öffentliche Werte ab.

---

## Design-System

### Grundregel
**Keine Hex- oder `rgba()`-Literale in Seiten- oder Game-CSS.** Farben, Radien
und Typo kommen aus Tokens. Fehlt ein Wert, kommt er ins Token-File — nicht ins
konsumierende CSS.

### Zwei Token-Ebenen

**1. Site-Tokens** — `styles.css` unter `:root`. Gelten für Landing, Wiki,
Profil, Login, Steam Deals, Adminpanel.

| Token | Zweck |
|---|---|
| `--bg-primary`, `--bg-secondary` | Flächen |
| `--card-bg`, `--card-hover` | Karten |
| `--text-primary`, `--text-secondary` | Text |
| `--accent`, `--accent-light`, `--accent-hot` | Akzente |
| `--border` | Rahmen |

**2. Game-Tokens** — `css/game-tokens.css`. Wird von einem Spiel **vor** dem
eigenen Stylesheet eingebunden. Umfangreicher als die Site-Tokens, weil Spiele
mehr semantische Farben brauchen.

Jede Basisfarbe liegt doppelt vor: `--x` als fertige Farbe und `--x-rgb` als
Kanal-Tripel. Grund: `rgba(var(--x), 0.24)` funktioniert **nicht** — die
Komma-Syntax akzeptiert keine Variable. Mit Alpha also immer:
```css
border-color: rgb(var(--green-rgb) / 0.24);
```

Die fünf **semantischen Akzente** müssen in jedem Theme klar unterscheidbar
bleiben, Spieler lesen daran das System ab:
`--prestige` (violett) · `--achievement` (blau) · `--building` (orange) ·
`--gold` · `--red-event` (rot)

### Aktuelle Looks

**Rest der Site:** dunkel, Matrix-inspiriert. Toxic-Green-Akzente, dezentes
Grid, glasige dunkle Cards mit grünen Borders und Glow, 8 px Radius. Kein
Light-Mode, keine generischen Partikel, kein Matrix-Regen.

**MyFishingKaktus:** weicht thematisch ab — ozeanische Blautöne, weiches Wasser,
warme Gelb-/Goldtöne für Highlights. Die globale Nav bleibt im grünen System.

**KaktusClicker:** **cozy** — cremig, pastellig, handgezeichnet. Umgesetzt als
zweiter Wertesatz `.theme-cozy` in `css/game-tokens.css`, aktiviert über
`<body class="theme-cozy">`. Die Token-*Namen* sind identisch zum dunklen Theme.
Cremeflächen, Radien 12–26 px, weiche Schatten nach unten statt Glow, Nunito
(selbst gehostet in `css/fonts/`, eingebunden über `css/fonts.css`).

⚠️ **Die Suffixe kehren sich im Cozy-Theme um.** Im dunklen Theme heißt `-hot`
„heller, damit es auf Schwarz lesbar ist". Auf Creme gilt:

| Suffix | Bedeutung im Cozy-Theme |
|---|---|
| `--x` | Grundfarbe für Flächen und Rahmen |
| `--x-hot` | **dunkler und kräftiger** — für Text und starke Kanten |
| `--x-pale`, `--x-deep` | **helle Tönung** — nur als Hintergrundfläche |

Ein aus dem dunklen Theme übernommenes `color: var(--gold-pale)` ist auf Creme
unlesbar. Beim Portieren also prüfen, nicht blind übernehmen.

Cozy-eigene Zusatztokens: `--on-accent` (Text auf gefüllten Akzentflächen —
nicht `--bg` dafür nehmen, Creme auf Pastellgrün schafft nur ~2,9:1),
`--terracotta`, `--paper-rgb`, `--shadow-soft`, `--shadow-raise`,
`--shadow-button`, `--shadow-button-press`, `--shadow-inset-top`.

Das „kein Beige/Creme"-Verbot gilt also **nur noch für den Rest der Site**, nicht
für den Clicker und nicht für künftige Spiele, die den Cozy-Look übernehmen.

### Neues Spiel im Cozy-Look anlegen
1. `css/fonts.css` und `css/game-tokens.css` vor dem eigenen Stylesheet einbinden
2. `<body class="theme-cozy">` setzen
3. Im eigenen CSS ausschließlich `var(--…)` verwenden
4. `font-family: var(--font-game)` **auf `body`** setzen, nicht nur auf `:root` —
   die globale `styles.css` setzt `body { font-family: … }` und schlägt sonst
   die Vererbung
5. Die globale Nav umfärben, indem auf ihr die *Site*-Tokens lokal neu belegt
   werden (`--text-primary`, `--text-secondary`, `--accent-light`, `--border`).
   Dann erben alle Nav-Kinder mit, auch was `auth-nav.js` zur Laufzeit einhängt.
6. `.player-name`, `.level-tag` und `.badge-pill` kommen aus der globalen
   `styles.css` und sind für Dunkel gebaut — `.player-name` ist dort hart auf
   Weiß gesetzt und auf Creme **unsichtbar**. Lokal überschreiben.

---

## Workflow

1. Lokal arbeiten, `git` auf `main`
2. Vollständig verifizieren, **dann** ein Commit (Netlify-Credits!)
3. Push auf `main` → Netlify deployt automatisch
4. Testen auf `https://kalterkaktus.de`, Functions unter `/.netlify/functions/<name>`

---

## Wartung dieser Datei

Bei strukturellen Änderungen pflegen:
- Neue Spiele → unter „Games" mit Pfad, Game-ID, Changelog-Ort
- Neue Migrations → unter „Supabase" mit Zweck
- Neue Admin-Event-Typen → unter „Adminpanel" (auch Server-Whitelist!)
- Neue i18n-Konventionen → unter „Sprachsystem"
- Absichtlich seltsame Zustände → nach oben unter „Vor dem Arbeiten lesen"

Stale Inhalte **löschen**, nicht überlagern. Kompakt und aktuell halten statt
historisch wachsen lassen. Bei Widerspruch zwischen Doku und Code gilt der Code.
