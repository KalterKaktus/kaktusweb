# Third-party notices — Lucky Lounge

## OpenStake

Source: https://github.com/tanh1c/stake-originals-clone

Pinned revision: `7f7065832cae8c898494ca7398f23d4a33a05c17`.

The upstream README declares “Released under the MIT License.” No separate
LICENSE file, copyright notice or asset-specific license was present in this
revision. Attribution: tanh1c and the OpenStake contributors. This notice records
the upstream declaration; it does not independently establish the rights of the
upstream author to any third-party artwork.

Adapted source: Lobby/HomePage, Layout, Header, Sidebar, MobileNavigation,
MobileBetSheet, Plinko, PlinkoGame, Plinko Sidebar, Ball, PlinkoEngine, constants,
global/home/game CSS and a subset of precomputed Plinko drop positions. The complete upstream src tree is the source baseline; MinesGame, CrashGame, BettingPanel, GameHistory, PlayerBets, PlayerResults and DinoGame retain their original render trees, panels and dashboard widgets. ThemeContext and theme/palettes retain the original Ant Design dark theme. Dino Phaser core scenes/prefabs/physics and DinoGameInstance are adapted directly from upstream.
Changes: Lucky Lounge branding, German/Russian text, isolated website routing,
Supabase wallet/RPC adapter, server-owned Mines/Crash/Dino decisions, removed Slots/Cases, original symmetric OpenStake payout tables and an hourly free-chip bonus
for free chips, fixed-step animation and synthetic audio. Color literals were moved to
tokens without changing their values. No upstream local wallet, deposit/reset
functions, tracking scripts or Stake logos are used by the active application. Unused source utilities from the copied baseline do not supply outcomes or finances. Mines, Crash and Dino are now playable through authoritative server adapters.

Repository artwork copied without visual modification into `app/public/images/`
and the generated `images/`: `hero.avif`, `plinko.avif`, `mines.avif`, `crash.avif`,
`casino-chip.svg`, and `coins/coin_{original,bronze,silver,emerald,ruby,sapphire}.svg`.
The README's repository-wide MIT declaration is the available license basis;
upstream provides no independent authorship/asset provenance documentation.

### MIT License text

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Packages

React/React DOM (Meta and contributors), React Router (Remix Software and
contributors), Vite (Evan You and contributors), Ant Design and
@ant-design/icons (Ant Design and contributors) use the MIT License.
Their original notices remain in the installed packages. The generated bundle
preserves legal comments in `games/LuckyLounge/assets/`.

Chart.js 4.5.1 (Chart.js contributors), MIT License:
https://github.com/chartjs/Chart.js/blob/v4.5.1/LICENSE.md
Used by the original dashboard/profit charts; its package license and legal comments are preserved.

## Fonts

As in the source UI, Inter, Manrope and Dancing Script are requested from
Google Fonts. These families are published under the SIL Open Font License 1.1.
They are not redistributed as local font files in this integration.

- Inter: https://github.com/google/fonts/tree/main/ofl/inter
- Manrope: https://github.com/google/fonts/tree/main/ofl/manrope
- Dancing Script: https://github.com/google/fonts/tree/main/ofl/dancingscript
- OFL: https://openfontlicense.org/open-font-license-official-text/

Lucky Lounge is not affiliated with Stake.com. Chips are free, virtual and have
no monetary or transferable value.

## Added OpenStake game assets

Copied from the same pinned revision: images/dino.avif; images/mines/bomb.svg,
diamond.svg, bomb_effect.gif; images/spaceship.png;
images/exhaust/exhaust02_preview.gif; images/explosions/normal_explosion.gif;
dino-assets/sprites/dino-atlas.png and dino-atlas.json. These are covered only
by upstream's declared repository-wide MIT license; no separate authorship
or asset-specific license was supplied. No Stake logos are used.
The copied Joystix bitmap font and MP3 files were deliberately excluded;
native monospace text and the existing synthetic audio replace them.
Telegram score/network integration is disabled.

Phaser 3.90.0: Copyright (c) 2024 Richard Davey, Phaser Studio Inc., MIT License.
https://github.com/phaserjs/phaser/blob/v3.90.0/LICENSE.md
The MIT permission/warranty text above applies. Original package legal comments
are preserved in the generated Dino bundle. Phaser is loaded only on the Dino route.

The GameIcon navigation vectors and lounge-icon.svg favicon are original
Lucky Lounge assets created in this repository; no third-party artwork is used.

## Color Roulette and Blackjack additions

`app/public/images/roulette-lounge.svg`, `blackjack-lounge.svg`, the new GameIcon
vectors, and `PlayingCard.jsx` are original SVG artwork created for Lucky Lounge.
Card suit symbols, court-card motifs and patterned backs are drawn in code;
no imagery from the user's reference screenshots is redistributed. The Roulette
strip is rendered directly on Canvas using the Lounge's own color tokens.
Roulette mechanical ticks, start/stop effects and Blackjack deal/flip/win effects
are synthesized with the existing Web Audio system; no third-party sound files
or remote asset hotlinks were added. Existing OpenStake notices above remain.

## Coinflip addition

`app/public/images/coinflip-lounge.svg`, `Coin.jsx` and the Coinflip navigation
vector are original artwork drawn for Lucky Lounge. Coin throw/spin/landing
sounds are synthesized using Web Audio. No external images, audio files or
assets from reference websites are included.
