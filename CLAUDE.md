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
wiki/                   Statisches Wiki + Kauf-Optimizer
js/                     Shared-Module (siehe unten)
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
- Idle-Clicker mit 30 Gebäuden, 33 Upgrades, 20 Abzeichen, Nopal-Prestige,
  Goldlauf (1000 Klicks in 30 s → ×2 für 30 s), Gold-/Rubinkaktus-Events,
  monatlicher Saison-Rangliste, Offline-Ertrag (ab 5 Min, max 12 h, 50 %).
- **Daten:** `data.js` → `buildings`, `upgrades`, `achievements`, `changelogEntries`
- **Zahlenformat:** `format.js`, locale-abhängig (Mio./Mrd. vs. млн/млрд)
- **Changelog:** Zusatzmenü → Changelog. Neue Einträge in `data.js`, mit `ru`-Variante.
- **Prestige:** `nopal^0.35 × 0.15 + 1` — Formel steht in `economy.js`
- **Rangliste „Letzter Monat":** Platz und Punktzahl sind historisch aus
  `game_season_archives.top_entries`, **Name/Level/Badge/Farbe kommen live** aus
  `profiles_public` (per `user_id` gejoint).

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

### Views — nicht direkt auf `game_saves` lesen!
Das Security-Hardening (`20260525120000`) hat die alten Public-SELECT-Policies
ersetzt. Leaderboards lesen **ausschließlich** aus Views, die nur unkritische
Spalten exponieren:
- `kaktus_clicker_leaderboard`
- `my_fishing_kaktus_leaderboard`
- `profiles_public` (inkl. berechnetem `level`, ohne Spendenbeträge)

Gebannte User sind in den Views herausgefiltert (`20260525170000_ban_enforcement`).

### Wichtige Trigger
- `game_saves_force_display_name` — erzwingt `display_name = profiles.username`,
  verhindert Impersonation. Client-Wert wird überschrieben.
- `kaktus_clicker_guard_season` — lehnt Saves mit veralteter `season_id` ab.
- `game_saves_block_banned`, `profiles_ban_block_xp` — Ban-Durchsetzung.
- `profiles_throttle_cols_protect` — XP-Throttle-Spalten gegen Client-Writes.
- `cheat_flags_autoban` — Autoban bei Cheat-Flags.

### Migrations ausführen
Migrations laufen **nicht** automatisch. Zwei Wege:
1. **Supabase MCP** (`apply_migration`) — direkt aus der Session, bevorzugt
2. Supabase Dashboard → SQL Editor → Datei einfügen → Run

Dateien sind idempotent (drop + create). Nach dem Anwenden gehört die `.sql`
trotzdem ins Repo, damit ein Neuaufbau reproduzierbar bleibt.

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

**KaktusClicker:** wird auf **clean, modern, creamy, lime, soft, cozy**
umgestellt (Stand Ende Juli 2026, in Arbeit). Helle Cremeflächen, große Radien
(16–28 px), weiche tiefe Schatten statt Glow, runde Schrift, Pastell-Varianten
der semantischen Akzente. Umsetzung als zweites Wertesatz-Theme im Game-Token-File,
aktiviert per Klasse auf `<body>` — die Token-*Namen* bleiben identisch.

Das „kein Beige/Creme"-Verbot gilt also **nur noch für den Rest der Site**, nicht
für den Clicker und nicht für künftige Spiele, die den Cozy-Look übernehmen.

### Neues Spiel im Cozy-Look anlegen
1. `css/game-tokens.css` vor dem eigenen Stylesheet einbinden
2. `<body class="theme-cozy">` setzen
3. Im eigenen CSS ausschließlich `var(--…)` verwenden

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
