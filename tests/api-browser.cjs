const assert = require('node:assert/strict');
const { chromium } = require(
  process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright',
);
const base = process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  let reads = 0,
    writes = 0,
    generation = 1,
    offline = false,
    delayed = false,
    release = null;
  const replies = new Map(),
    errors = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__api_test')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><script>window.SPONSORFLOW_CONFIG={API_URL:"https://script.google.com/macros/s/TEST/exec"};window.SponsorFlowStorage=localStorage;</script><script src="/assets/api.js"></script>',
      });
    if (url.hostname === 'n-test-script.googleusercontent.com')
      return route.fulfill({
        contentType: 'text/html',
        body: replies.get(url.searchParams.get('id')),
      });
    if (url.hostname === 'script.google.com') {
      const fields = Object.fromEntries(
        route.request().method() === 'POST'
          ? new URLSearchParams(route.request().postData())
          : url.searchParams,
      );
      if (route.request().method() === 'POST') {
        writes++;
        generation++;
        const message = {
          type: 'sponsorflow-api',
          callId: fields.callId,
          ok: true,
          data: { saved: fields.title },
        };
        replies.set(
          fields.callId,
          '<script>window.top.postMessage(' +
            JSON.stringify(message) +
            ',' +
            JSON.stringify(base) +
            ')</script>',
        );
        return route.fulfill({
          contentType: 'text/html',
          body:
            '<iframe src="https://n-test-script.googleusercontent.com/reply?id=' +
            fields.callId +
            '"></iframe>',
        });
      }
      reads++;
      if (offline) return route.abort();
      const value = generation;
      if (delayed) {
        delayed = false;
        await new Promise((resolve) => (release = resolve));
      }
      return route.fulfill({
        contentType: 'text/javascript',
        body:
          fields.callback +
          '(' +
          JSON.stringify({ ok: true, data: { generation: value, tasks: [] } }) +
          ');',
      });
    }
    if (url.origin !== base) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(base + '/__api_test');
    await page.evaluate(() =>
      Promise.all([
        SponsorFlowAPI.post('plannerBootstrap'),
        SponsorFlowAPI.post('plannerBootstrap'),
      ]),
    );
    assert.equal(reads, 1);
    await page.evaluate(() => SponsorFlowAPI.post('plannerBootstrap'));
    assert.equal(reads, 1);
    await page.reload();
    await page.evaluate(() => SponsorFlowAPI.post('plannerBootstrap'));
    assert.equal(reads, 1, 'Snapshot reused across page navigation');
    await page.evaluate(() =>
      SponsorFlowAPI.post('plannerBootstrap', {}, { force: true }),
    );
    assert.equal(reads, 2);
    const saved = await page.evaluate(() =>
      Promise.all(
        ['First', 'Second'].map((title) =>
          SponsorFlowAPI.post('savePlannerTask', { title }),
        ),
      ),
    );
    assert.deepEqual(saved, [{ saved: 'First' }, { saved: 'Second' }]);
    assert.equal(writes, 2);
    assert.equal(
      await page.evaluate(() => SponsorFlowAPI.cached('plannerBootstrap')),
      null,
    );
    await page.evaluate(() => SponsorFlowAPI.post('plannerBootstrap'));
    assert.equal(reads, 3);
    offline = true;
    assert.match(
      await page.evaluate(async () => {
        try {
          await SponsorFlowAPI.post('plannerBootstrap', {}, { force: true });
        } catch (e) {
          return e.message;
        }
      }),
      /could not be reached/,
    );
    assert.equal(
      (await page.evaluate(() => SponsorFlowAPI.cached('plannerBootstrap')))
        .data.generation,
      generation,
    );
    offline = false;
    delayed = true;
    await page.evaluate(() => {
      window.loading = SponsorFlowAPI.post(
        'plannerBootstrap',
        {},
        { force: true },
      );
    });
    while (!release) await new Promise((r) => setTimeout(r, 10));
    await page.evaluate(() =>
      SponsorFlowAPI.post('savePlannerTask', { title: 'Concurrent edit' }),
    );
    release();
    assert.equal(
      (await page.evaluate(() => window.loading)).generation,
      generation,
      'Read overlapping save cannot replace new data',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: request deduplication, cross-page snapshots, forced refresh, offline fallback, independent write frames, and stale read protection.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
