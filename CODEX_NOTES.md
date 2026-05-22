# Codex Project Notes

Project: KalterKaktus Website

Repo path:
`C:\Users\maxwi\Documents\Codex\2026-05-20\KaktusWebsite\deploy`

GitHub remote:
`https://github.com/KalterKaktus/kaktusweb.git`

Netlify deploys automatically from the GitHub repo after pushes to `main`.

## Current Structure

- Main page: `index.html`
- Styles: `styles.css`
- Main JavaScript: `script.js`
- Steam deals page: `steam-deals/index.html`
- Games hub: `games/index.html`
- KaktusClicker game: `games/KaktusClicker/`
- Netlify Function: `netlify/functions/steamfree.js`
- Discord checker: `netlify/functions/check-free-games.js`
- Shared Steam parser: `netlify/functions/lib/steamDeals.js`
- Netlify config: `netlify.toml`
- Dependencies: `package.json`

## Changes Made

- Removed the disco/easter-egg mode.
- Deleted `disco-face.png`.
- Removed the dark/white mode toggle.
- The site is fixed in dark mode.
- Removed the particle background.
- Removed the Spotify embed.
- Reworked the homepage hero into a dark Matrix-inspired grid design with a large centered `KalterKaktus` title and Steam Deals CTA.
- Keep the static green grid vibe as the homepage background direction.
- Added a Discord status card powered by Lanyard.
- Unified the navigation:
  - `KK`
  - `Home`
  - `About`
  - `Steam Deals`
  - `Games`
- Added `scrollbar-gutter: stable;` so the `KK` logo does not shift between pages.
- Added a Games hub at `/games/` with a first card for KaktusClicker. Future games should be added as sibling folders under `games/` and linked from `games/index.html`.
- KaktusClicker has a small `Zurück zu Games` link and should keep visible German text with real umlauts.
- KaktusClicker cloud loading must treat a missing local save as missing, so a fresh device cannot win over an existing Supabase save by timestamp.
- KaktusClicker leaderboard scores are monthly. The server-side season reset runs on Netlify, resets on the first day of the next month in Europe/Berlin, stores the season in the save payload and `game_saves.season_id`, archives the previous Top 3, and the leaderboard tab shows a reset countdown.
- KaktusClicker V2 uses modular game data/economy/state/format files for Nopal prestige, German compact number formatting, offline progress, random event Kakteen, a 1,000-click Goldlauf, expanded buildings/upgrades, and 20 multiplier achievements.
- Legal pages now exist at `/datenschutz`, `/nutzungsbedingungen`, and `/impressum`; the short paths rewrite to static HTML via `netlify.toml`.

## Steam Deals

The Steam deals page is available at `/steam-deals/`.

The Function `netlify/functions/steamfree.js` uses Steam Store search for:

- free games with `-100%`
- popular discount deals from `-70%` to `-99%` with at least 5,000 reviews and at least 80% positive reviews

It returns JSON with:

- `active`: free games
- `discounted`: quality-sorted popular deals with at least 70% discount, excluding free games

## Discord Announcements

There is a scheduled Netlify Function:
`netlify/functions/check-free-games.js`

Schedule in `netlify.toml`:
`@hourly`

It checks Steam free games and popular 70%+ deals, stores seen app IDs in Netlify Blobs, and posts only newly discovered offers to Discord.
Discord posts are capped at 10 free games and 10 discount deals per message. The message links to `/steam-deals/` at the top and bottom with angle brackets to avoid Discord link previews.

Required Netlify environment variable:
`DISCORD_WEBHOOK_URL`

Never commit the real Discord webhook URL into the repo.

Opening the HTML file locally by double click will not run the Netlify Function. Correct test flow:

- Push to GitHub.
- Wait for Netlify deploy.
- Open online:
  - `/steam-deals/`
  - `/.netlify/functions/steamfree`

## GitHub Desktop Workflow

Local repo folder:
`C:\Users\maxwi\Documents\Codex\2026-05-20\KaktusWebsite\deploy`

In GitHub Desktop:

1. Review changes.
2. Write a commit message.
3. Click `Commit to main`.
4. Click `Push origin`.

Netlify deploys automatically after the push.

## Supabase Auth

Static login via Magic Link (E-Mail).

Files:

- `js/config.js` — URL, Publishable Key, `SITE_URL` (für Redirects)
- `js/config.example.js` — Vorlage
- `js/supabase-client.js`, `js/auth-nav.js`, `js/auth-login.js`, `js/auth-callback.js`
- `login.html` — Magic-Link-Formular
- `auth/callback.html` — Redirect nach E-Mail-Link

Supabase Dashboard → Authentication → URL configuration:

- Site URL: `https://kalterkaktus.de`
- Redirect URLs: `https://kalterkaktus.de/auth/callback.html`

Provider: **Email** (Magic Link), **Google** — OAuth-Redirect bei Google auf  
`https://rdqbkpowntebcrsnwyqp.supabase.co/auth/v1/callback` setzen.

Login-UI: `login.html` (Google-Button + Magic Link). Nav: **Login** / **Logout**.

Profil: Tabelle `public.profiles` (`id`, `username`). Seite `profile.html` — Benutzername ersetzt E-Mail in der Nav, wenn gesetzt. Klick auf den Namen in der Nav öffnet das Profil.

Dateien: `js/profile.js`, `js/profile-page.js`, `js/auth-nav.js`.

KaktusClicker Cloud-Save + Rangliste:

- Tabelle `public.game_saves` (`payload`, `total_earned`, `display_name`)
- Eingeloggt: Spielstand in Supabase, lokal als Fallback (neuerer Stand gewinnt)
- Tab **Rangliste** im Spiel, sortiert nach `total_earned`
- Anzeigename: Profil-Benutzername, sonst E-Mail; Rangliste aktualisiert sich beim Speichern des Profils

Dateien: `js/game-cloud.js`, `games/KaktusClicker/game.js`, `games/KaktusClicker/index.html`

Nach Änderung an `js/config.js`: committen und nach Netlify pushen.

## Suggested Next Design Direction

The visual direction should stay poisonous green / Matrix-inspired:

- dark background
- toxic green accents
- subtle grid background
- glassy dark cards with green borders/glow
- 8px radius for main UI containers where possible
- avoid light mode, beige palettes, and generic particles unless the user asks again

Important: Do not reintroduce light mode or generic particles unless the user explicitly asks for them.
