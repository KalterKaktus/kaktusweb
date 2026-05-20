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
- Netlify config: `netlify.toml`

## Changes Made

- Removed the disco/easter-egg mode.
- Deleted `disco-face.png`.
- Removed the dark/white mode toggle.
- The site is fixed in dark mode.
- Removed the particle background.
- Removed the Spotify embed.
- Unified the navigation:
  - `KK`
  - `Home`
  - `About`
  - `Free Games`
- Added `scrollbar-gutter: stable;` so the `KK` logo does not shift between pages.

## Free Games

The free games page is available at `/free-games.html`.

The Function `netlify/functions/steamfree.js` uses Steam Store search:
`https://store.steampowered.com/search/?maxprice=free&specials=1`

It parses Steam search results with `-100%` discount and returns JSON to the page.

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

The user wants something more exciting than generic particles. Good direction:

- dark cactus dashboard
- animated neon cactus
- small live tiles
- free-games teaser
- social/online status

Important: Do not reintroduce light mode or generic particles unless the user explicitly asks for them.
