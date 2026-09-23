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
let legacyDeployment = false;
let loseJoinReply = false;
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
    ({ theme }) => { if(window!==window.top)return; localStorage.setItem('asmeWorkspaceTheme', theme); localStorage.setItem('asmeMemberName','Jordan Lee'); },
    { theme },
  );
  await ctx.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/assets/config.js')
      return route.fulfill({
        contentType: 'text/javascript',
        body: `window.SPONSORFLOW_CONFIG={API_URL:${JSON.stringify(configured ? 'https://script.google.com/macros/s/TEST/exec' : '')}};`,
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
      const legacyReply = {
        type: 'sponsorflow-api',
        callId: input.callId,
        ok: false,
        error: 'Unknown SponsorFlow action.',
      };
      let body = legacyDeployment
        ? route.request().method() === 'POST'
          ? '<script>window.top.postMessage(' +
            JSON.stringify(legacyReply) +
            ',' +
            JSON.stringify(base) +
            ');</script>'
          : input.callback +
            '(' +
            JSON.stringify({
              ok: false,
              error: 'This read action is unavailable.',
            }) +
            ');'
        : route.request().method() === 'POST'
          ? backend.post(input)
          : backend.get(input);
      if (loseJoinReply && input.action === 'gamesJoin') {
        loseJoinReply = false; // The backend accepted it, but the client gets an uncertain failure.
        body = '<script>window.top.postMessage(' + JSON.stringify({type:'asme-games',callId:input.callId,ok:false,error:'Connection interrupted. Please retry.'}) + ',' + JSON.stringify(base) + ');</script>';
      }
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
    if (process.env.VISUAL_ONLY === '1') { assert.deepEqual(errors, []); return; }
    const page = await makePage(browser, 390);
    await open(page);
    await page.click('#gamesProfileOpen');
    await page.fill('#memberWelcomeName', 'Jordan Lee');
    await page.locator('#memberWelcomeForm button[type=submit]').click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('asmeGamesV1')).profile,
    );
    const profile = await page.evaluate(
      () => JSON.parse(localStorage.getItem('asmeGamesV1')).profile,
    );

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
    assert.match(await page.locator('#gameResult').innerText(), /accuracy points/);
    await snap(page, 'word-complete-mobile');
    await page.click('#gameBack');
    await page.waitForSelector('.leaderboard-row.is-you');
    assert.match(
      await page.locator('.leaderboard-row.is-you').innerText(),
      /Jordan Lee/,
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
    const startedAt=(await saved(page,'queens')).startedAt;
    await page.click('[data-game-action="check"]');
    assert.equal((await saved(page,'queens')).corrections,1);
    await page.click('#gameReset');assert.equal((await saved(page,'queens')).startedAt,startedAt);assert.equal((await saved(page,'queens')).corrections,2);
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
    await second.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('asmeGamesV1')).results.length === 6,
    );
    assert.equal(await second.locator('#gamesRestoreCode').count(),0);
    assert.equal(await second.evaluate(()=>window.SFGamesService.data.profile.playerId),profile.playerId);
    await second.click('[data-play="word"]');
    assert.equal(
      await second.locator('.word-keyboard button:not([disabled])').count(),
      0,
    );
    await second.evaluate(() => (Date.now = () => 12345));
    await second.click('#gamePractice');
    const before = backend.sheets.get('Games Results').rows.length;
    await second.keyboard.type(
      C.puzzle('word', day + ':practice:12345').answer,
    );
    await second.keyboard.press('Enter');
    await second.waitForSelector('#gameResult:not([hidden])');
    assert.match(
      await second.locator('#gameResult').innerText(),
      /Practice complete/i,
    );
    assert.equal(backend.sheets.get('Games Results').rows.length, before);
    await second.context().close();
    assert.equal(await page.locator('[data-play="kart"]').count(), 0);
    // Daily result stays fixed after reload; no duplicate score rows.
    await page.reload();
    await page.waitForSelector('.leaderboard-row.is-you');
    assert.equal(backend.sheets.get('Games Results').rows.length, 7);
    await snap(page, 'leaderboard-mobile');
    const timedRow=backend.sheets.get('Games Results').rows.find(r=>r[3]==='queens');assert.equal(timedRow[12],80);assert.equal(timedRow[13],640);
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
    assert(requests.some((r) => r.action === 'gamesJoin'));
    assert(requests.some((r) => r.action === 'gamesScore'));
    assert(requests.some((r) => r.action === 'gamesLeaderboard'));
    assert(
      requests.every((r) =>
        ['gamesJoin', 'gamesScore', 'gamesLeaderboard', 'gamesInsights'].includes(r.action),
      ),
    );
    legacyDeployment = true;
    const legacy = await makePage(browser, 390);
    await open(legacy);
    await legacy.waitForFunction(() =>
      document
        .querySelector('#gamesServiceStatus')
        .textContent.includes('Shared rankings need the latest Apps Script deployment'),
    );
    const legacyError = await legacy.evaluate(async () => {
      try {
        await window.SFGamesService.join('New Member');
      } catch (error) {
        return error.message;
      }
    });
    assert.match(legacyError, /Shared rankings need the latest Apps Script deployment/);
    assert.equal(
      await legacy.evaluate(() => window.SFGamesService.data.profile),
      null,
    );
    await legacy.context().close();
    legacyDeployment = false;
    loseJoinReply = true;
    const recovery = await makePage(browser,390,'dark');
    await recovery.context().addInitScript(()=>{if(window===window.top)localStorage.setItem('asmeMemberName','Recovery Test');});
    await open(recovery);
    await recovery.waitForFunction(()=>document.querySelector('#gamesSyncStatus').textContent.includes('Connection interrupted'));
    const recoveryId=backend.context.gamesJoin_({name:'Recovery Test'}).playerId;
    await recovery.reload();
    await recovery.waitForFunction(()=>window.SFGamesService.data.profile);
    assert.equal(await recovery.evaluate(()=>window.SFGamesService.data.profile.playerId),recoveryId);
    assert.equal(backend.sheets.get('Games Players').rows.filter(r=>r[2]==='Recovery Test').length,1);
    // A bad proof remains recoverable but does not prevent a valid score or standings read.
    await recovery.evaluate(({day,answer})=>{
      const s=window.SFGamesService;
      s.saveResult({day,game:'groups',version:2,points:0,proof:{},completedAt:'bad'});
      s.saveResult({day,game:'word',version:2,points:999,proof:{guesses:[answer],elapsedMs:5000,corrections:0},completedAt:'good'});
    },{day,answer:C.puzzle('word',day).answer});
    await recovery.click('#gamesSyncButton');
    await recovery.waitForFunction(()=>window.SFGamesService.data.results.find(r=>r.game==='word')?.synced);
    await recovery.waitForSelector('.leaderboard-row.is-you');
    assert.equal(await recovery.evaluate(()=>window.SFGamesService.data.pending.length),1);
    assert.match(await recovery.locator('#gamesSyncStatus').innerText(),/waiting to sync/);
    // Once the server has the first daily result, restoring replaces an uncertain local copy.
    await recovery.evaluate(async()=>{
      const s=window.SFGamesService; const r=s.data.results.find(r=>r.game==='word');
      s.data.pending.push({...r,points:1});r.points=1;r.synced=false;
      await s.join('Recovery Test');
    });
    assert(await recovery.evaluate(()=>window.SFGamesService.data.results.find(r=>r.game==='word').points)>800);
    assert.equal(await recovery.evaluate(()=>window.SFGamesService.data.pending.some(r=>r.game==='word')),false);
    await recovery.evaluate(()=>Promise.all([window.SFGamesService.join('Recovery Alpha'),window.SFGamesService.join('Recovery Beta')]));
    assert.equal(await recovery.evaluate(()=>window.SFGamesService.data.profile.name),'Recovery Beta');
    assert.notEqual(await recovery.evaluate(()=>window.SFGamesService.data.profile.playerId),recoveryId);
    assert.equal(await recovery.evaluate(()=>window.SFGamesService.data.results.length),0);
    await recovery.evaluate(()=>window.SFGamesService.join('Recovery Test'));
    assert(await recovery.evaluate(()=>window.SFGamesService.data.results.some(r=>r.game==='word' && r.synced)));
    assert.equal(await recovery.evaluate(()=>window.SFGamesService.data.pending.length),1);
    await recovery.context().close();
    const blocked = await makePage(browser,390,'light');
    await blocked.context().addInitScript(()=>{
      if(window!==window.top)return;
      localStorage.setItem('asmeMemberName','Storage Test');
      Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};
    });
    const playersBeforeBlocked=backend.sheets.get('Games Players').rows.length;
    await open(blocked);
    await blocked.waitForFunction(()=>window.SFGamesService.data.profile?.name === 'Storage Test');
    assert.equal(backend.sheets.get('Games Players').rows.length,playersBeforeBlocked+1);
    await blocked.click('[data-play="word"]');
    await blocked.keyboard.type('A');
    assert.equal(await blocked.evaluate(()=>window.SFGamesService.getRun(window.SFGames.dayKey(),'word').input),'A');
    await blocked.context().close();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: six games, physical/touch input, reload/resume, real transport against isolated backend, shared standings, second-device restore, timed scoring, no duplicate results, and local-only fallback.',
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
