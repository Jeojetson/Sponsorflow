const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require(process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright');
const C = require('../assets/games/core.js'), M = require('../assets/games/metrics.js');
const makeBackend = require('./games-backend-fixture.cjs');
const contrast = require('./contrast-check.cjs');
const base = process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8771';
const backend = makeBackend(base), b = backend.context, day = b.gamesDay_();
const names = ['Jordan Lee','Colin Ternus','Alexandria Montgomery-Wellington Sanders','Morgan Rivera','Will Parker'];
names.forEach((name,index)=>b.gamesWrite_('Players',{playerId:'old-'+index,name,nameKey:M.nameKey(name),codeHash:'legacy-hash-'+index,createdAt:'old',updatedAt:'old'}));
for(let d=0;d<30;d++) for(let player=0;player<names.length;player++) {
  if(d%5===player && d!==29)continue;
  for(let g=0;g<(d+player)%6+1;g++){
    const date=M.shift(day,d-29),win=(d+player+g)%11!==0,elapsedMs=10000+(d+player+g)*4000;
    b.gamesWrite_('Results',{id:`old-${player}:${date}:${C.GAMES[g].id}:v2`,playerId:'old-'+player,day:date,game:C.GAMES[g].id,points:win?800+(d*7+player*11+g)%200:0,win,version:2,accuracy:win?90:0,elapsedMs,completedAt:date+'T18:00:00Z'});
  }
}
const requests=[],errors=[];let releaseScore,holdA=false;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 fs.mkdirSync('/tmp/sponsorflow-insights-qa',{recursive:true});
 try{
  for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
   await ctx.addInitScript(({theme})=>{
    if(window!==window.top)return;
    localStorage.setItem('asmeMemberName','Jordan Lee');localStorage.setItem('asmeWorkspaceTheme',theme);
    localStorage.setItem('asmeGamesV1',JSON.stringify({version:1,profile:{name:'Jordan Lee',playerId:'old-0',code:'a'.repeat(48)},runs:{},results:[],pending:[]}));
   },{theme});
   const replies=new Map();
   await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/assets/config.js')return route.fulfill({contentType:'text/javascript',body:'window.SPONSORFLOW_CONFIG={API_URL:"https://script.google.com/macros/s/TEST/exec"};'});
    if(u.hostname==='n-fixture-script.googleusercontent.com')return route.fulfill({contentType:'text/html',body:replies.get(u.searchParams.get('id'))});
    if(u.hostname==='script.google.com'){
     const input=Object.fromEntries(route.request().method()==='POST'?new URLSearchParams(route.request().postData()):u.searchParams);
     requests.push(input);
     const body=route.request().method()==='POST'?backend.post(input):backend.get(input);
     if(holdA && input.action==='gamesScore' && input.name==='Concurrent A')await new Promise(resolve=>releaseScore=resolve);
     if(route.request().method()==='POST'){
      replies.set(input.callId,body);
      return route.fulfill({contentType:'text/html',body:`<iframe src="https://n-fixture-script.googleusercontent.com/?id=${input.callId}"></iframe>`});
     }
     return route.fulfill({contentType:'text/javascript',body});
    }
    return u.origin===base?route.continue():route.abort();
   });
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/games.html');await page.evaluate(()=>document.fonts.ready);
   await page.waitForSelector('#playerMetrics .games-stat-kpi');await page.waitForSelector('.leaderboard-row.is-you');
   assert.equal(await page.evaluate(()=>window.SFGamesService.data.profile.playerId),'old-0');
   assert.equal(await page.evaluate(()=>window.SFGamesService.data.profile.code),undefined);
   assert.equal(await page.locator('#gamesProfileDialog').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${theme} ${width}`);
   const overlap=await page.locator('.leaderboard-row:not(.leaderboard-head)').evaluateAll(rows=>rows.some(row=>{
    const cells=[...row.children].map(e=>e.getBoundingClientRect());
    return cells.some((a,i)=>cells.some((b,j)=>i<j && Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
   }));
   assert.equal(overlap,false,`Overlapping leaderboard cells ${width}`);
   assert.equal(await page.locator('.leaderboard-head').isVisible(),width>600);
   assert.deepEqual(await page.evaluate(contrast),[],`Contrast ${theme} ${width}`);
   await page.selectOption('#insightsPlayer',names[2]);
   await page.waitForFunction(name=>document.querySelector('#playerStatsTitle').textContent===name,names[2]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.selectOption('#insightsPlayer',names[0]);
   await page.waitForFunction(()=>document.querySelector('#playerStatsTitle').textContent==='Jordan Lee');
   await page.locator('#leaderboardRows').screenshot({style:'.site-header,.skip-link{visibility:hidden}',path:`/tmp/sponsorflow-insights-qa/standings-${width}-${theme}.png`});
   await page.locator('#clubStats').screenshot({style:'.site-header,.skip-link{visibility:hidden}',path:`/tmp/sponsorflow-insights-qa/club-${width}-${theme}.png`});
   await page.locator('#playerMetrics').screenshot({style:'.site-header,.skip-link{visibility:hidden}',path:`/tmp/sponsorflow-insights-qa/player-${width}-${theme}.png`});
   await page.evaluate(name=>window.SponsorFlowIdentity.save(name),names[2]);
   await page.waitForFunction(()=>window.SFGamesService.data.profile?.playerId==='old-2');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Long active name overflow ${width}`);
   assert.deepEqual(await page.evaluate(contrast),[],`Long active name contrast ${theme} ${width}`);
   // Name change through the same site-wide entry form switches attempts.
   if(width===390 && theme==='light'){
    await page.click('#gamesProfileOpen');await page.fill('#memberWelcomeName','First Time Player');
    await page.locator('#memberWelcomeForm button[type=submit]').click();
    await page.waitForFunction(()=>window.SFGamesService.data.profile?.name==='First Time Player');
    assert.equal(await page.evaluate(()=>window.SFGamesService.data.results.length),0);
    await page.click('.member-name-button');await page.fill('#memberWelcomeName',' JORDAN  lee ');
    await page.locator('#memberWelcomeForm button[type=submit]').click();
    await page.waitForFunction(()=>window.SFGamesService.data.profile?.playerId==='old-0');
    assert(await page.evaluate(()=>window.SFGamesService.data.results.length)>0);
    await page.waitForFunction(()=>!document.querySelector('#gamesSyncButton').disabled);
    // In-flight replies stay with their original name, even during a switch.
    holdA=true;
    await page.evaluate(async ({day,answer})=>{
     const s=window.SFGamesService;await s.join('Concurrent A');s.saveRun(day,'word',{input:'A',scoringVersion:2});
     s.saveResult({day,game:'word',version:2,points:1,proof:{guesses:[answer],elapsedMs:5000,corrections:0},completedAt:'A'});
     window.testSyncA=s.sync();
    },{day,answer:C.puzzle('word',day).answer});
    for(let i=0;i<100 && !releaseScore;i++)await page.waitForTimeout(20);
    assert(releaseScore);
    await page.evaluate(async ({day,answer})=>{
     const s=window.SFGamesService;await s.join('Concurrent B');
     s.saveResult({day,game:'word',version:2,points:1,proof:{guesses:[answer],elapsedMs:40000,corrections:0},completedAt:'B'});await s.sync();
    },{day,answer:C.puzzle('word',day).answer});
    releaseScore();holdA=false;await page.evaluate(()=>window.testSyncA);
    assert.equal(await page.evaluate(()=>window.SFGamesService.data.results[0].elapsedMs),40000);
    await page.evaluate(()=>window.SFGamesService.join('Concurrent A'));
    assert.equal(await page.evaluate(()=>window.SFGamesService.data.results[0].elapsedMs),5000);
    assert.equal(await page.evaluate(day=>window.SFGamesService.getRun(day,'word').input,day),'A');
    await page.evaluate(()=>window.SFGamesService.join('constructor'));
    assert.equal(await page.evaluate(()=>window.SFGamesService.data.results.length),0);
   }
   await ctx.close();console.log(`PASS: populated dashboard ${theme} ${width}px`);
  }
  assert(requests.every(r=>!Object.hasOwn(r,'code')),'No player codes sent');
  assert.deepEqual(errors,[]);
 }finally{if(releaseScore)releaseScore();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
