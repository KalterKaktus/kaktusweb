import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {mkdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startIntegrationServer, ROOT, PEOPLE} from './fixtures/integration-server.mjs';

const {chromium} = await import(process.env.KAKTUSLIFE_PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.KAKTUSLIFE_QA_OUTPUT || fileURLToPath(new URL('../test-results/', import.meta.url)));
let fixture, browser, base, productionAuthNav;

before(async () => {
  await mkdir(output, {recursive: true});
  productionAuthNav = await readFile(resolve(ROOT, 'js/auth-nav.js'), 'utf8');
  fixture = await startIntegrationServer({port: 0});
  base = `http://127.0.0.1:${fixture.server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.KAKTUSLIFE_BROWSER_EXECUTABLE
      ? {executablePath: process.env.KAKTUSLIFE_BROWSER_EXECUTABLE}
      : process.platform === 'win32' ? {channel: 'chrome'} : {}),
  });
});

after(async () => {
  await browser?.close();
  await fixture?.close();
});

async function openPage(width, {normalMotion = false, onlineIdentity = null} = {}) {
  const mobile = width < 650;
  const context = await browser.newContext({
    viewport: {width, height: 900},
    locale: 'de-DE',
    reducedMotion: normalMotion ? 'no-preference' : 'reduce',
    ...(mobile ? {isMobile: true, hasTouch: true} : {}),
  });
  // Everything stays local, including the real production navigation module.
  await context.route('**/*', route =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  if (onlineIdentity) {
    await context.addInitScript(person => localStorage.setItem('fixture-person', JSON.stringify(person)), onlineIdentity);
  } else {
    await context.route('**/js/auth-nav.js', route => route.fulfill({contentType: 'text/javascript', body: productionAuthNav}));
    await context.route('**/js/supabase-client.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export const isConfigReady=()=>true;
      export const getSupabase=()=>({auth:{
        getSession:async()=>({data:{session:null}}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
      }});`,
    }));
  }
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/games/KaktusLife/`);
  await page.locator('[data-action="expand-board"]').waitFor();
  if (!onlineIdentity) await page.locator('.nav-toggle').waitFor({state: 'attached'});
  const activate = async selector => {
    // Touch contexts use real touch input; desktop hover cannot linger over a
    // newly rendered control and interfere with the next action's stability.
    if (mobile) await page.locator(selector).tap();
    else { await page.locator(selector).click(); await page.mouse.move(0, 0); }
  };
  return {context, page, errors, activate};
}

async function assertFits(page, width) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no page overflow at ${width}px`);
}

for (const width of [320, 390, 1440]) {
  test(`production navigation, keyboard dialogs and map zoom fit ${width}px`, async () => {
    const {context, page, errors, activate} = await openPage(width);
    try {
      await assertFits(page, width);
      if (width < 650) {
        await activate('.nav-toggle');
        assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'true');
        await activate('.lang-btn[data-lang="ru"]');
        await page.waitForFunction(() => document.documentElement.lang === 'ru');
        await assertFits(page, width);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'false');
      }
      assert.ok(!/\blife\.[a-zA-Z]+\./.test(await page.locator('body').innerText()), 'all visible strings are translated');
      await activate('[data-action="help"]');
      assert.ok(await page.locator('#life-help').isVisible());
      const expectedHappiness = await page.evaluate(async () => {
        const {formatNumber, t} = await import('/js/i18n.js');
        const {RULES} = await import('./shared/catalog.mjs');
        return t('life.ui.money', {amount: formatNumber(RULES.happinessValue)});
      });
      assert.ok((await page.locator('#life-help').innerText()).includes(expectedHappiness), 'help explains the current happiness score value');
      await page.keyboard.press('Escape');
      await page.locator('#life-help').waitFor({state: 'detached'});
      await activate('[data-action="expand-board"]');
      assert.ok(await page.locator('#life-map-dialog').isVisible());
      const scroll = page.locator('#life-map-dialog .board-scroll');
      if (width < 650) {
        assert.ok(await scroll.evaluate(node => node.scrollWidth > node.clientWidth));
        await scroll.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('#life-map-dialog .board-scroll').scrollLeft > 0);
        await page.screenshot({path: resolve(output, `kaktuslife-mobile-zoom-${width}.png`)});
      }
      await assertFits(page, width);
      await page.keyboard.press('Escape');
      await page.locator('#life-map-dialog').waitFor({state: 'detached'});
      if (width < 650) await page.screenshot({path: resolve(output, `kaktuslife-mobile-auth-${width}.png`), fullPage: true});
      assert.deepEqual(errors, [], 'no browser exceptions');
    } finally { await context.close(); }
  });
}

test('two humans complete four normal-motion mobile rolls with matching wheel results', async () => {
  const {context, page, errors, activate} = await openPage(390, {normalMotion: true});
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('kk-life-practice-v1')));
  const ready = () => page.waitForFunction(() =>
    [...document.querySelectorAll('[data-choice],[data-action="roll"],[data-action="end-turn"]')]
      .some(button => !button.disabled));
  const act = async selector => { await activate(selector); await ready(); };
  try {
    assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion:reduce)').matches), false);
    await page.locator('.practice-details').evaluate(node => node.open = true);
    await page.locator('[name="one"]').fill('snor');
    await page.locator('[name="two"]').fill('Ben');
    await act('#practice-form button[type="submit"]');
    const rolls = [];
    for (let count = 0; count < 4; count++) {
      while ((await saved()).stage === 'choice') {
        const current = await saved();
        const choice = current.pending.options.find(option => option.id === 'study') || current.pending.options[0];
        await act(`[data-choice="${choice.id}"]`);
      }
      assert.equal((await saved()).stage, 'roll');
      const started = Date.now();
      await act('[data-action="roll"]');
      const next = await saved();
      assert.ok(Date.now() - started > 1800, 'wheel animation actually runs before another action is enabled');
      while ((await saved()).stage === 'choice') await act('[data-choice]:enabled:first-of-type');
      assert.equal((await saved()).stage, 'end');
      const rotation = await page.locator('.wheel-disc').evaluate(node => node.style.transform);
      assert.equal(rotation, `rotate(${-(next.lastRoll.value - 1) * 36}deg)`, 'pointer matches the authoritative number');
      assert.ok(next.lastRoll.to <= next.lastRoll.from + next.lastRoll.value, 'mandatory stops never overshoot the roll');
      assert.equal(next.lastRoll.playerId, count % 2 ? 'local-2' : 'local-1');
      rolls.push(next.lastRoll);
      await assertFits(page, 390);
      if (count === 1) await page.screenshot({path: resolve(output, 'kaktuslife-mobile-wheel.png'), fullPage: true});
      await act('[data-action="end-turn"]');
    }
    assert.equal(rolls.length, 4);
    assert.deepEqual(errors, [], 'no browser exceptions');
  } finally { await context.close(); }
});

test('host confirms closing an unused room and both browsers leave its lobby', async () => {
  const host = await openPage(1440, {onlineIdentity: PEOPLE[0]});
  const guest = await openPage(390, {onlineIdentity: PEOPLE[1]});
  try {
    await host.activate('[data-action="create"]');
    await host.page.locator('.lobby-card').waitFor();
    const roomId = await host.page.evaluate(() => localStorage.getItem('kk-life-room'));
    const code = await host.page.locator('.room-code-display input').inputValue();
    await guest.page.locator('[name="code"]').fill(code);
    await guest.activate('#join-form button[type="submit"]');
    await guest.page.locator('.lobby-card').waitFor();
    await host.page.locator('.lobby-seat.seat-1:not(.is-empty)').waitFor();
    await host.activate('[data-action="close-room"]');
    assert.ok(await host.page.locator('#life-close-room').isVisible());
    await host.page.keyboard.press('Escape');
    await host.page.locator('#life-close-room').waitFor({state: 'detached'});
    assert.equal(await host.page.evaluate(() => localStorage.getItem('kk-life-room')), roomId, 'cancelling preserves the room');
    await host.activate('[data-action="close-room"]');
    await host.activate('[data-action="confirm-close"]');
    await host.page.locator('#practice-form').waitFor({state: 'attached'});
    await guest.page.locator('#practice-form').waitFor({state: 'attached'});
    assert.equal(await host.page.evaluate(() => localStorage.getItem('kk-life-room')), null);
    assert.equal(await guest.page.evaluate(() => localStorage.getItem('kk-life-room')), null);
    await guest.page.locator('#toast').waitFor({state: 'visible'});
    const response = await fixture.handler(new Request(`${base}/api/kaktuslife`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${PEOPLE[0].token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({op: 'snapshot', roomId}),
    }));
    assert.equal(response.status, 404, 'closed room is inaccessible');
    assert.deepEqual([...host.errors, ...guest.errors], []);
  } finally { await host.context.close(); await guest.context.close(); }
});

test('Snor gets the sleepy giant in the board and zoom while similar names keep their car', async () => {
  const {context, page, errors, activate} = await openPage(390);
  try {
    await page.locator('.practice-details').evaluate(node => node.open = true);
    await page.locator('[name="one"]').fill(' ＳＮＯＲ ');
    await page.locator('[name="two"]').fill('snorling');
    await activate('#practice-form button[type="submit"]');
    await page.locator('.player-card').first().waitFor();
    assert.equal(await page.locator('#board .map-pawn.pawn-sleepy').count(), 1);
    assert.equal(await page.locator('#board .map-pawn:not(.pawn-sleepy)').count(), 1);
    assert.equal(await page.locator('#board .pawn-sleepy>use').getAttribute('href'), '#life-sleepy-giant');
    assert.equal(await page.locator('#board .sleepy-zzz text').count(), 3);
    assert.equal(await page.locator('#board .sleepy-zzz text').first().evaluate(node => getComputedStyle(node).animationName), 'none', 'reduced motion keeps sleeping letters still');
    // Capture the actual username on its own tile after proving the normalized
    // spelling above; the screenshot is a normal game reached through the UI.
    await activate('button[data-action="home"]');
    await page.locator('[name="one"]').fill('snor');
    await page.locator('[name="two"]').fill('Noah');
    await activate('#practice-form button[type="submit"]');
    await activate('[data-choice="study"]');
    await activate('[data-action="roll"]');
    assert.equal(await page.locator('#board .map-pawn.pawn-sleepy').count(), 1);
    await assertFits(page, 390);
    await page.screenshot({path: resolve(output, 'kaktuslife-snor-easteregg.png'), fullPage: true});
    await activate('[data-action="expand-board"]');
    assert.equal(await page.locator('#life-map-dialog .map-pawn.pawn-sleepy').count(), 1);
    await page.locator('#life-map-dialog').screenshot({path: resolve(output, 'kaktuslife-snor-nahaufnahme.png')});
    await page.keyboard.press('Escape');
    await page.locator('#life-map-dialog').waitFor({state: 'detached'});
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
