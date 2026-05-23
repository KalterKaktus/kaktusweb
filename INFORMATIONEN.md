# INFORMATIONEN — KalterKaktus Website

**Repo:** `C:\Users\maxwi\Documents\Codex\2026-05-20\KaktusWebsite\deploy`
**GitHub:** `https://github.com/KalterKaktus/kaktusweb.git`
**Hosting:** Netlify deployt automatisch nach Push auf `main`.

Diese Datei ist die zentrale Wissensbasis. Pflegen bei strukturellen Änderungen, neuen Features, neuen Migrations oder geänderten Workflows.

---

## Projekt-Struktur

```
deploy/
├── index.html                    Homepage (Hero + Discord-Status)
├── styles.css                    Globale Styles
├── script.js                     Homepage-Logik
├── login.html, profile.html      Auth
├── auth/                         Magic-Link Callback
├── adminpanel/                   Admin-UI (User editieren, Live-Events)
├── games/
│   ├── index.html                Games-Hub (Cards je Spiel)
│   ├── KaktusClicker/            Idle-Clicker (released)
│   └── MyFishingKaktus/          Active-Fishing (released)
├── steam-deals/                  Steam-Deals-Seite
├── wiki/                         Statisches Wiki
├── js/                           Shared: config, supabase-client, auth, profile
├── netlify/functions/            Serverless: steamfree, check-free-games, admin-panel, season reset
├── supabase/migrations/          DB-Migrations (manuell im Supabase SQL-Editor laufen lassen)
└── netlify.toml                  Hosting-Config + Function-Schedules
```

---

## Games

### KaktusClicker
- **Pfad:** `games/KaktusClicker/`
- **Game-ID (Saves):** `kaktus-clicker`
- **Inhalt:** Idle-Clicker mit Nopal-Prestige, Goldlauf, Gold-/Rubinkaktus-Events, monatlicher Saison-Rangliste, 20 Achievements, deutschem Zahlenformat, Offline-Progression (5 Min → bis zu 12 h halbe Auto-Produktion).
- **Daten:** `data.js` (`buildings`, `upgrades`, `achievements`, `changelogEntries`)
- **Changelog:** Im Spiel über Zusatzmenü → Changelog. Neue Einträge in `data.js` → `changelogEntries`.

### My Fishing Kaktus
- **Pfad:** `games/MyFishingKaktus/`
- **Game-ID (Saves):** `my-fishing-kaktus`
- **Inhalt:** Active Collection Fishing mit Pond/Lake/Ocean Areas, Prestige-Cap 2, WebGL-Wasser, 5 Wetter-Events (sunny/rain/storm/fog/night, global synchron, 30 Min Slot, 5 Min aktiv), Fish-Index, Inventar, Coin-Fish Timer-Spawns, Live-Leaderboard (Prestige > Fänge).
- **Module:** `js/game.js` + `js/systems/` (water, weather, weatherEvent, audio, bubble, coinFish, broadcast, fishingMinigame, fishArt, save, inventory, upgrade, rarity, area, index)
- **Daten:** `js/data/` (areas, fish, rarities, upgrades, changelog)
- **Changelog:** Im Spiel über Game-Menü → Changelog. Neue Einträge in `js/data/changelog.js` → `FISHING_CHANGELOG`.
- **Test-Menü:** URL `?test` schaltet versteckten Test-Button frei (localStorage-persistent). Über `?notest` wieder deaktivieren.

---

## Supabase

### Auth
- Magic-Link (Email) + Google OAuth
- **Site URL:** `https://kalterkaktus.de`
- **Redirect URL:** `https://kalterkaktus.de/auth/callback.html`
- Google OAuth-Callback: `https://rdqbkpowntebcrsnwyqp.supabase.co/auth/v1/callback`
- **Profil-Tabelle:** `public.profiles` (`id`, `username`, `avatar_url`, `is_banned`)

### Cloud Saves
- **Tabelle:** `public.game_saves` (`user_id`, `game_id`, `payload jsonb`, `total_earned`, `display_name`, `season_id`, `updated_at`)
- Schlüssel: `(user_id, game_id)` — jedes Spiel hat eigene Zeile. **Können sich nicht gegenseitig überschreiben.**
- Eingeloggt: Cloud-Save; nicht eingeloggt: localStorage-Fallback.

### Live-Events (Admin-Push an Online-Spieler)
- **Tabelle:** `public.admin_game_events` (`game_id`, `event_type`, `payload jsonb`, `expires_at`)
- Auto-Expire nach 60s. Realtime + Polling-Fallback im Client.
- **Migration:** `supabase/migrations/20260522183000_admin_game_events.sql`

### Fishing-Leaderboard
- Public-SELECT-Policy auf `game_saves` für `game_id = 'my-fishing-kaktus'`.
- **Migration:** `supabase/migrations/20260522223000_my_fishing_kaktus_leaderboard.sql`
- **Wichtig:** Ohne diese Policy lädt das Fishing-Leaderboard nur den eigenen Spielstand.

### Migrations ausführen
Migrations werden NICHT automatisch ausgeführt. Im Supabase Dashboard → SQL Editor → entsprechende `.sql` einfügen → Run. Dateien sind idempotent (drop+create).

---

## Adminpanel

**Pfad:** `/adminpanel/` (nur für eingetragene Admins)

### Per-Player-Editing (generisch)
Im User-Eintrag → Games-Sektion → Spiel aufklappen → alle Payload-Felder werden rekursiv als editierbare Inputs gerendert (boolean/number/string/JSON). Funktioniert automatisch für jedes Spiel das in `game_saves` schreibt.

Funktionen: Werte editieren, JSON direkt editieren, Spielstand löschen, Online-Client zum Neuladen zwingen, Nachricht an User schicken, Account sperren/entsperren.

### Adminabuse (Live-Events)
Globale Events an alle gerade Online-Spieler eines Spiels.

**KaktusClicker:**
- Goldkaktus / Rubinkaktus spawnen

**My Fishing Kaktus:**
- Wetter forcen (sunny / rain / storm / fog / night / clear)
- Timer-Fisch spawnen (klein / groß / Schwertfisch / Hai)
- Broadcast-Nachricht (eigener Text, max. 200 Zeichen, erscheint im Epic-Catch-Feed)

**Cross-Game (oben im Adminabuse):**
- „Alle Spieler neu laden" — `force-reload`-Event wird in alle Spiele gefannt. Online-Spieler kriegen Toast + nach 1.5s automatisches `location.reload()`. Ideal nach Deploy.

Im Spiel zeigt jeweils ein Toast/Broadcast „⚙ Admin spawnt …" / „⚙ Admin hat Event gestartet …" / „⚙ Neue Version verfügbar …".

Server-Whitelist für Event-Typen: `netlify/functions/admin-panel.mjs` → `ADMIN_GAME_EVENT_TYPES`. Cross-Game-Events: `CROSS_GAME_EVENT_TYPES`.

---

## Steam Deals & Discord

- Seite: `/steam-deals/`
- Function: `netlify/functions/steamfree.js` (Steam Store search für Free + 70-99% Deals mit ≥5000 Reviews und ≥80% positiv)
- Discord-Auto-Posts: `netlify/functions/check-free-games.js` — `@hourly` cron, Netlify Blobs für gesehene App-IDs.
- Required ENV: `DISCORD_WEBHOOK_URL`. Webhook-URL niemals committen.

---

## Workflow

1. Lokal arbeiten in `deploy/`
2. GitHub Desktop: Commit + Push
3. Netlify deployt automatisch
4. Online testen: `https://kalterkaktus.de` + `/.netlify/functions/<name>` für Functions

---

## Design-Richtung

Vergiftet-grün / Matrix-inspiriert:
- Dunkler Hintergrund, toxic-green Akzente
- Dezentes Grid, glasige dunkle Cards mit grünen Borders/Glow
- 8px Border-Radius für Main-Container
- Kein Light-Mode, keine generischen Partikel, keine Beige-Palette — außer der User fordert es explizit

Fishing weicht aus thematischen Gründen ab: ozeanische Blautöne, weiches Wasser, warme Gelb-/Goldtöne für Highlights. Die globale Nav bleibt im grünen System.

---

## Wartung dieser Datei

Bei jeder Änderung pflegen:
- Neue Spiele → unter „Games" eintragen mit Pfad, Game-ID, Changelog-Ort
- Neue Supabase-Migrations → unter „Supabase" mit Zweck + Dateipfad
- Neue Admin-Event-Typen → unter „Adminabuse" mit Beschreibung
- Strukturelle Pfad-Änderungen → unter „Projekt-Struktur"
- Geänderte Workflows → unter „Workflow"

Stale Inhalte entfernen statt nur überlagern. Datei soll kompakt und aktuell bleiben, nicht historisch wachsen.
