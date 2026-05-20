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
- Free games page: `free-games.html`
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
  - `Free Games`
- Added `scrollbar-gutter: stable;` so the `KK` logo does not shift between pages.

## Free Games

The free games/deals page is available at `/free-games.html`.

The Function `netlify/functions/steamfree.js` uses Steam Store search for:

- free games with `-100%`
- strong discount deals from `-80%` to `-99%`

It returns JSON with:

- `active`: free games
- `discounted`: deals with at least 80% discount, excluding free games

## Discord Announcements

There is a scheduled Netlify Function:
`netlify/functions/check-free-games.js`

Schedule in `netlify.toml`:
`@hourly`

It checks Steam free games and 80%+ deals, stores seen app IDs in Netlify Blobs, and posts only newly discovered offers to Discord.
Discord posts are capped at 5 free games and 5 discount deals per message. The message links to `/free-games.html` at the top and bottom.

Required Netlify environment variable:
`DISCORD_WEBHOOK_URL`

Never commit the real Discord webhook URL into the repo.

Opening the HTML file locally by double click will not run the Netlify Function. Correct test flow:

- Push to GitHub.
- Wait for Netlify deploy.
- Open online:
  - `/free-games.html`
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

## Suggested Next Design Direction

The visual direction should stay poisonous green / Matrix-inspired:

- dark background
- toxic green accents
- subtle grid background
- glassy dark cards with green borders/glow
- 8px radius for main UI containers where possible
- avoid light mode, beige palettes, and generic particles unless the user asks again

Important: Do not reintroduce light mode or generic particles unless the user explicitly asks for them.
