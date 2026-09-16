const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(
  process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright',
);
const C = require('../assets/games/core.js');
const makeBackend = require('./games-backend-fixture.cjs');
const base = process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8765',
  out = process.env.SPONSORFLOW_GAMES_QA || '/tmp/sponsorflow-games-qa';
fs.mkdirSync(out, { recursive: true });
const errors = [];
const backend = makeBackend(base);
let offline = false;
const requests = [];
const replies = new Map();
async function makePage(browser, width, theme = 'light', configured = true) {
  const ctx = await browser.newContext({
    viewport: {
      width,
      height: Number(process.env.SPONSORFLOW_GAMES_HEIGHT || 900),
    },
    isMobile: width < 720,
    hasTouch: width < 720,
  });
  await ctx.addInitScript(
    ({ theme }) => localStorage.setItem('asmeWorkspaceTheme', theme),
    { theme },
  );
  await ctx.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/assets/games/config.js')
      return route.fulfill({
        contentType: 'text/javascript',
        body: `window.ASME_GAMES_CONFIG={API_URL:${JSON.stringify(configured ? 'https://script.google.com/macros/s/TEST/exec' : '')}};`,
      });
    if (url.hostname === 'n-fixture-script.googleusercontent.com')
      return route.fulfill({
        contentType: 'text/html',
        body: replies.get(url.searchParams.get('id')) || '',
      });
    if (url.hostname === 'script.google.com') {
      if (offline) return route.abort();
      const input = Object.fromEntries(
        route.request().method() === 'POST'
          ? new URLSearchParams(route.request().postData())
          : url.searchParams,
      );
      requests.push(input);
      const body =
        route.request().method() === 'POST'
          ? backend.post(input)
          : backend.get(input);
      if (route.request().method() === 'POST') {
        replies.set(input.callId, body);
        return route.fulfill({
          contentType: 'text/html',
          body:
            '<iframe src="https://n-fixture-script.googleusercontent.com/reply?id=' +
            input.callId +
            '"></iframe>',
        });
      }
      return route.fulfill({ contentType: 'text/javascript', body });
    }
    if (url.origin !== base) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
async function open(page, game = '') {
  await page.goto(base + '/games.html' + (game ? '#' + game : ''));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(50);
}
async function snap(page, name) {
  await page.screenshot({
    path: path.join(out, name + '.png'),
    fullPage: true,
  });
}
async function saved(page, id) {
  return page.evaluate(
    ({ day, id }) =>
      JSON.parse(localStorage.getItem('asmeGamesV1')).runs[day + ':' + id],
    { day: C.dayKey(), id },
  );
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    let layouts = 0;
    if (process.env.SKIP_VISUAL !== '1')
      for (const width of (process.env.GAMES_WIDTHS || '1440,900,390,320')
        .split(',')
        .map(Number))
        for (const theme of ['light', 'dark']) {
          const page = await makePage(browser, width, theme, false);
          await open(page);
          for (const id of ['', ...C.GAMES.map((g) => g.id)]) {
            if (id) await page.click(`[data-play="${id}"]`);
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 2,
            );
            assert.equal(
              overflow,
              false,
              `${id || 'hub'} ${width} ${theme} overflow`,
            );
            assert.equal(await page.locator('.mobile-app-link').count(), 6);
            if (width < 720 && ['word', 'kart'].includes(id)) {
              const controls = await page
                .locator(id === 'word' ? '.word-keyboard' : '.race-controls')
                .boundingBox();
              assert(
                controls.y + controls.height <=
                  Number(process.env.SPONSORFLOW_GAMES_HEIGHT || 900),
                `${id} controls should fit the phone viewport`,
              );
            }
            if (width !== 900)
              await snap(page, `${id || 'hub'}-${width}-${theme}`);
            layouts++;
            if (id) await page.click('#gameBack');
          }
          await page.context().close();
        }
    console.log('Games layout checks:', layouts);
    if (process.env.VISUAL_ONLY === '1') {
      assert.deepEqual(errors, []);
      return;
    }
    const page = await makePage(browser, 390);
    await open(page);
    await page.click('#gamesProfileOpen');
    await page.fill('#gamesPlayerName', 'Jordan Lee');
    await page.click('#gamesJoinButton');
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('asmeGamesV1')).profile,
    );
    const profile = await page.evaluate(
      () => JSON.parse(localStorage.getItem('asmeGamesV1')).profile,
    );
    await page.click('[data-close-dialog="gamesProfileDialog"]');
    const day = C.dayKey();
    await page.click('[data-play="word"]');
    await page.keyboard.type('ZZZZZ');
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#gameMessage').innerText(), /word list/);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
    const word = C.puzzle('word', day).answer;
    await page.keyboard.type(word.slice(0, 2));
    await page.reload();
    await page.waitForSelector('#gameStage .word-board');
    assert.equal((await saved(page, 'word')).input, word.slice(0, 2));
    await page.keyboard.type(word.slice(2));
    await page.keyboard.press('Enter');
    await page.waitForSelector('#gameResult:not([hidden])');
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('asmeGamesV1')).pending.length === 0,
    );
    assert.match(await page.locator('#gameResult').innerText(), /100 points/);
    await snap(page, 'word-complete-mobile');
    await page.click('#gameBack');
    await page.waitForSelector('.leaderboard-row.is-you');
    assert.match(
      await page.locator('.leaderboard-row.is-you').innerText(),
      /100/,
    );
    await page.click('[data-play="groups"]');
    const groups = C.puzzle('groups', day);
    for (const g of groups.groups) {
      for (const w of g.words) await page.click(`[data-group-word="${w}"]`);
      await page.click('[data-game-action="submit-group"]');
    }
    await page.waitForSelector('#gameResult:not([hidden])');
    await page.click('#gameBack');
    await page.click('[data-play="queens"]');
    const queens = C.puzzle('queens', day);
    for (let r = 0; r < 6; r++)
      await page.click(`[data-cell="${r * 6 + queens.solution[r]}"]`);
    await page.click('[data-game-action="check"]');
    await page.waitForSelector('#gameResult:not([hidden])');
    await page.click('#gameBack');
    await page.click('[data-play="binary"]');
    const binary = C.puzzle('binary', day);
    for (let i = 0; i < 36; i++) {
      if (binary.givens[i]) continue;
      for (let j = 0; j < binary.solution[i]; j++)
        await page.click(`[data-cell="${i}"]`);
    }
    await page.click('[data-game-action="check"]');
    await page.waitForSelector('#gameResult:not([hidden])');
    await page.click('#gameBack');
    await page.click('[data-play="path"]');
    const route = C.puzzle('path', day);
    const boxes = await Promise.all(
      route.solution
        .slice(0, 3)
        .map((cell) =>
          page.locator(`[data-path-cell="${cell}"]`).boundingBox(),
        ),
    );
    await page.mouse.move(
      boxes[0].x + boxes[0].width / 2,
      boxes[0].y + boxes[0].height / 2,
    );
    await page.mouse.down();
    for (const box of boxes.slice(1))
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.up();
    assert.equal((await saved(page, 'path')).cells.length, 3);
    for (const cell of route.solution.slice(3))
      await page.locator(`[data-path-cell="${cell}"]`).tap();
    await page.waitForSelector('#gameResult:not([hidden])');
    await snap(page, 'path-complete-mobile');
    await page.click('#gameBack');
    await page.click('[data-play="numbers"]');
    const numbers = C.puzzle('numbers', day);
    async function combine(tree) {
      if (Number.isInteger(tree)) return;
      await combine(tree[1]);
      await combine(tree[2]);
      const r = (await saved(page, 'numbers')) || {
        values: numbers.numbers.map((value, tree) => ({ value, tree })),
      };
      const a = r.values.findIndex(
          (v) => JSON.stringify(v.tree) === JSON.stringify(tree[1]),
        ),
        b = r.values.findIndex(
          (v) => JSON.stringify(v.tree) === JSON.stringify(tree[2]),
        );
      await page.click(`[data-number="${a}"]`);
      await page.click(`[data-operator="${tree[0]}"]`);
      await page.click(`[data-number="${b}"]`);
    }
    await combine(numbers.solution);
    await page.waitForSelector('#gameResult:not([hidden])');
    await page.click('#gameBack');
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('asmeGamesV1')).pending.length === 0,
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('asmeGamesV1')).results.filter(
            (r) => r.day === window.SFGames.dayKey(),
          ).length,
      ),
      6,
    );
    // A second device restores the same profile and server-locked puzzle results.
    const second = await makePage(browser, 1440, 'dark');
    await open(second);
    await second.click('#gamesProfileOpen');
    await second.fill('#gamesPlayerName', 'Jordan Lee');
    await second.locator('#gamesRestoreDetails summary').click();
    await second.fill('#gamesRestoreCode', profile.code);
    await second.click('#gamesJoinButton');
    await second.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('asmeGamesV1')).results.length === 6,
    );
    await second.click('[data-close-dialog="gamesProfileDialog"]');
    await second.click('[data-play="word"]');
    assert.equal(
      await second.locator('.word-keyboard button:not([disabled])').count(),
      0,
    );
    await second.evaluate(() => (Date.now = () => 12345));
    await second.click('#gamePractice');
    const before = backend.sheets.get('Results').rows.length;
    await second.keyboard.type(
      C.puzzle('word', day + ':practice:12345').answer,
    );
    await second.keyboard.press('Enter');
    await second.waitForSelector('#gameResult:not([hidden])');
    assert.match(
      await second.locator('#gameResult').innerText(),
      /Practice complete/i,
    );
    assert.equal(backend.sheets.get('Results').rows.length, before);
    await second.context().close();
    // Race works through the animation clock, pause/resume, and repeated runs.
    await page.click('[data-play="kart"]');
    await page.clock.install();
    await page.click('[data-race-start]');
    await page.clock.runFor(1000);
    await page.click('[data-race-move="-1"]');
    await page.clock.runFor(500);
    await page.click('#racePause');
    const frame = (await saved(page, 'kart')).state.frame;
    await page.clock.runFor(2000);
    assert.equal((await saved(page, 'kart')).state.frame, frame);
    await page.click('[data-race-start]');
    await page.clock.runFor(46000);
    await page.waitForSelector('#gameResult:not([hidden])');
    await snap(page, 'kart-result-mobile');
    assert((await saved(page, 'kart')).state.ended);
    await page.clock.resume();
    await page.evaluate(() => window.SFGamesService.sync());
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('asmeGamesV1')).pending.length === 0,
    );
    await page.click('[data-race-start]');
    assert.equal((await saved(page, 'kart')).state.hits, 0);
    await page.click('#gameBack');
    // Daily result stays fixed after reload; no duplicate score rows.
    await page.reload();
    await page.waitForSelector('.leaderboard-row.is-you');
    assert.equal(backend.sheets.get('Results').rows.length, 8);
    await snap(page, 'leaderboard-mobile');
    const local = await makePage(browser, 320, 'dark', false);
    await open(local, 'numbers');
    await local.click('[data-number="0"]');
    await local.click('[data-operator="+"]');
    await local.click('[data-number="1"]');
    assert.equal((await saved(local, 'numbers')).values.length, 3);
    await local.click('[data-game-action="undo"]');
    assert.equal((await saved(local, 'numbers')).values.length, 4);
    await local.click('#gameBack');
    assert.match(
      await local.locator('#leaderboardRows').innerText(),
      /coming soon/,
    );
    assert.equal(await local.locator('.mobile-officer-link').isVisible(), true);
    await local.context().close();
    await page.context().close();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: seven games, physical/touch input, reload/resume, real transport against isolated backend, shared standings, second-device restore, race pause/retry, no duplicate results, and local-only fallback.',
    );
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, 'errors.json'),
      JSON.stringify(errors, null, 2),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
