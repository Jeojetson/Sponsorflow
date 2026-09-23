const assert = require('node:assert/strict'), fs = require('node:fs');
const {chromium} = require(process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright');
const makeBackend = require('./reels-backend-fixture.cjs'), contrast = require('./contrast-check.cjs');
const base = process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8771';
const youtubeMock = `window.__ytPlays=0;window.__ytDestroys=0;window.YT={Player:function(frame,options){this.playVideo=()=>window.__ytPlays++;this.mute=()=>window.__muted=true;this.destroy=()=>{frame.remove();window.__ytDestroys++;};window.__ytEnd=()=>options.events.onStateChange({data:0,target:this});window.__ytError=code=>options.events.onError({data:code,target:this});window.__ytBlocked=()=>options.events.onAutoplayBlocked({target:this});setTimeout(()=>options.events.onReady({target:this}),10);}};window.onYouTubeIframeAPIReady();`;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}); const errors=[];
 fs.mkdirSync('/tmp/sponsorflow-reels-qa',{recursive:true});
 try{
  for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
   const backend=makeBackend(base),b=backend.context;
   for(let i=0;i<30;i++)b.reelsWrite_('Posts',{id:'REEL-'+String(i).padStart(11,'0'),videoId:String(i).padStart(11,'0'),title:i===0?'A karting clip with a long title to check the phone layout carefully':'Track test '+i,caption:i===0?'A proper look at the lap. A caption that wraps naturally on smaller screens.':'One more lap.',category:i%3?'karting':'community',author:i===1?'Alexandria Montgomery-Wellington Sanders':'Jordan Lee',authorKey:'jordan lee',createdAt:new Date(Date.UTC(2026,8,20,0,i)).toISOString(),hidden:'false'});
   for(let i=0;i<42;i++)b.reelsWrite_('Discovery',{id:'REEL-D'+String(i).padStart(10,'0'),videoId:'D'+String(i).padStart(10,'0'),title:'Discover lap '+i,caption:'A karting short',category:'karting',author:'Karting Channel',createdAt:new Date(Date.UTC(2026,8,24,0,i)).toISOString(),hidden:'false',fetchedAt:new Date().toISOString()});
   b.reelsSend_({name:'Casey Morgan',peer:'Jordan Lee',body:'Have you seen this lap?',reelId:'REEL-00000000001',requestId:'a'.repeat(32)});
   const ctx=await browser.newContext({viewport:{width,height:width<700?844:1000},isMobile:width<700,hasTouch:width<700});
   await ctx.addInitScript(theme=>{if(window!==window.top)return;localStorage.setItem('asmeMemberName','Jordan Lee');localStorage.setItem('asmeWorkspaceTheme',theme);},theme);
   const replies=new Map();let dropSend=false,heldSave,holdSaved=false,heldSend,holdSend=false;
   await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.pathname==='/assets/config.js')return route.fulfill({contentType:'text/javascript',body:'window.SPONSORFLOW_CONFIG={API_URL:"https://script.google.com/macros/s/TEST/exec"};'});
    if(u.hostname==='r-fixture-script.googleusercontent.com')return route.fulfill({contentType:'text/html',body:replies.get(u.searchParams.get('id'))});
    if(u.hostname==='script.google.com'){
     const input=Object.fromEntries(req.method()==='POST'?new URLSearchParams(req.postData()):u.searchParams);
     const body=req.method()==='POST'?backend.post(input):backend.get(input);
     if(holdSaved && input.action==='reelsSaved')await new Promise(resolve=>heldSave=resolve);
     if(holdSend && input.action==='reelsSend')await new Promise(resolve=>heldSend=resolve);
     if(dropSend && input.action==='reelsSend'){dropSend=false;return route.fulfill({contentType:'text/html',body:'Connection lost after save.'});}
     if(req.method()==='POST'){replies.set(input.callId,body);return route.fulfill({contentType:'text/html',body:`<iframe src="https://r-fixture-script.googleusercontent.com/?id=${input.callId}"></iframe>`});}
     return route.fulfill({contentType:'text/javascript',body});
    }
    if(u.hostname==='www.youtube.com' && u.pathname==='/iframe_api')return route.fulfill({contentType:'text/javascript',body:youtubeMock});
    if(u.hostname==='www.youtube-nocookie.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated YouTube player fixture</title><body style="color:white;background:black">YouTube player fixture</body>'});
    return u.origin===base?route.continue():route.abort();
   });
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/reels.html');await page.waitForSelector('.reel-card.is-current');await page.evaluate(()=>document.fonts.ready);
   const active=()=>page.locator('.reel-card.is-current');
   const selectTab=async t=>{await page.click('[data-reels-tab="'+t+'"]');if(t!=='messages')await page.waitForSelector('.reel-card.is-current');};
   assert.equal(await page.locator('[data-reels-tab=discover]').getAttribute('aria-current'),'page');
   assert.equal(await page.locator('iframe[src*="youtube"]').count(),0,'No player until user asks');
   assert.match(await active().locator('h2').textContent(),/Discover/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Feed overflow ${width}`);
   assert.deepEqual(await page.evaluate(contrast),[],`Feed contrast ${theme} ${width}`);
   const box=await active().locator('.reels-stage').boundingBox();assert(box.width>=200&&box.height>=200);
   assert(box.y+box.height<=844||width>=700,'Video fits above navigation');
   await page.screenshot({path:`/tmp/sponsorflow-reels-qa/discover-${width}-${theme}.png`});
   await active().locator('[data-action=save]').click();await page.waitForFunction(()=>document.querySelector('.is-current [data-action=save]').getAttribute('aria-pressed')==='true');
   assert.equal(b.reelsSaved_({name:'Jordan Lee'}).items.length,1,'Discovery is saveable');
   await selectTab('saved');assert.match(await active().locator('h2').textContent(),/Discover/);
   await selectTab('discover');await active().locator('[data-action=play]').click();
   await page.waitForFunction(()=>window.__ytPlays===1);assert.equal(await page.locator('iframe[src*="youtube"]').count(),1);
   assert.equal(await page.locator('iframe[src*="youtube"]').getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');
   // Scroll to a later card; only the visible player survives. Pages append automatically.
   await page.locator('.reel-card').nth(10).evaluate(el=>el.scrollIntoView({block:'start'}));
   await page.waitForFunction(()=>document.querySelectorAll('.reel-card').length>=24);
   await page.waitForFunction(()=>window.__ytPlays>=2);assert.equal(await page.locator('iframe[src*="youtube"]').count(),1);
   const beforeEnd=await active().getAttribute('data-card');await page.evaluate(()=>window.__ytEnd());await page.waitForFunction(id=>document.querySelector('.is-current')?.dataset.card!==id,beforeEnd);await page.waitForFunction(()=>document.querySelectorAll('iframe[src*="youtube"]').length===1);
   await page.evaluate(()=>window.__ytError(101));await page.waitForSelector('.is-current .reels-poster');assert.match(await active().locator('.reels-playback-status').textContent(),/unavailable/);
   // Club is separate, with no discover posts leaking into it.
   await selectTab('club');assert.match(await active().locator('h2').textContent(),/Track test/);
   assert.equal(await page.locator('.reel-card[data-card^="REEL-D"]').count(),0);
   await active().locator('[data-action=send]').click();await page.fill('#reelsRecipient','Casey Morgan');await page.locator('#reelsRecipientForm button[type=submit]').click();
   await page.waitForSelector('#reelsThread:not([hidden])');await page.fill('#reelsMessageBody','Watch this with me');await page.click('#reelsMessageSubmit');
   await page.waitForFunction(()=>document.querySelector('#reelsSendStatus').textContent==='Sent.');
   assert.equal(b.reelsRows_('Messages').length,2);assert.equal(b.reelsRows_('Messages')[1].body,'Watch this with me');
   assert.match(await page.locator('.reels-notice').textContent(),/Not private/);
   if(width<700){assert.equal(await page.locator('.reels-inbox').isVisible(),false);await page.click('#reelsBack');assert.equal(await page.locator('.reels-inbox').isVisible(),true);await page.click('[data-peer="Casey Morgan"]');}
   assert.deepEqual(await page.evaluate(contrast),[],`Messages contrast ${theme} ${width}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Messages overflow ${width}`);
   await page.waitForFunction(()=>document.querySelectorAll('.reels-bubble').length===2);
   await page.screenshot({path:`/tmp/sponsorflow-reels-qa/messages-${width}-${theme}.png`});
   await page.fill('#reelsMessageBody','Keep this draft');await selectTab('discover');await selectTab('messages');assert.equal(await page.locator('#reelsMessageBody').inputValue(),'Keep this draft');
   await page.locator('.reels-bubble a').first().click();await page.waitForSelector('#reelsWatch:not([hidden])');
   if(width===390&&theme==='light'){
    await selectTab('discover');await page.click('#reelsOptions');await page.uncheck('#reelsContinuous');await page.uncheck('#reelsAutoplay');await page.click('#reelsRefresh');
    await page.waitForFunction(()=>document.querySelectorAll('.reel-card').length===12);
    await page.locator('.reel-card').nth(11).evaluate(el=>el.scrollIntoView({block:'start'}));await page.waitForTimeout(300);
    assert.equal(await page.locator('.reel-card').count(),12);assert.equal(await page.locator('iframe[src*="youtube"]').count(),0);
    await page.locator('[data-load]').click();await page.waitForFunction(()=>document.querySelectorAll('.reel-card').length===24);
    await page.click('#reelsOptions');await page.check('#reelsContinuous');await page.check('#reelsAutoplay');await page.click('[data-close=reelsOptionsDialog]');
    // A saved-list response captured before a new save cannot erase the new save.
    holdSaved=true;await page.click('[data-reels-tab=saved]');await assertEventually(()=>heldSave);
    await selectTab('club');const savedCount=b.reelsSaved_({name:'Jordan Lee'}).items.length;
    await active().locator('[data-action=save]').click();await page.waitForFunction(()=>document.querySelector('.is-current [data-action=save]').getAttribute('aria-pressed')==='true');
    holdSaved=false;await selectTab('saved');heldSave();await page.waitForTimeout(50);assert.equal(Number(await page.locator('#reelsSavedCount').textContent()),savedCount+1);
    await selectTab('messages');await page.fill('#reelsMessageBody','A retry should arrive once');
    const count=b.reelsRows_('Messages').length;dropSend=true;
    await page.clock.install();await page.click('#reelsMessageSubmit');await page.waitForTimeout(50);await page.clock.fastForward(46000);
    await page.waitForFunction(()=>!document.querySelector('#reelsMessageSubmit').disabled);await page.click('#reelsMessageSubmit');
    await page.waitForFunction(()=>document.querySelector('#reelsSendStatus').textContent==='Sent.');assert.equal(b.reelsRows_('Messages').length,count+1);
    await page.fill('#reelsMessageBody','Jordan draft');await page.evaluate(()=>SponsorFlowIdentity.save('Casey Morgan'));
    assert.equal(await page.locator('#reelsThread').isVisible(),false);assert.equal(await page.locator('#reelsMessageBody').inputValue(),'');
    await page.click('#reelsRefreshMessages');await page.waitForSelector('[data-peer="Jordan Lee"]');await page.click('[data-peer="Jordan Lee"]');
    await page.waitForFunction(()=>document.querySelectorAll('.reels-bubble').length===3);
    await page.evaluate(()=>SponsorFlowIdentity.save('Jordan Lee'));await page.click('#reelsNewMessage');await page.fill('#reelsRecipient','Casey Morgan');await page.locator('#reelsRecipientForm button[type=submit]').click();assert.equal(await page.locator('#reelsMessageBody').inputValue(),'Jordan draft');
    holdSend=true;await page.click('#reelsMessageSubmit');await assertEventually(()=>heldSend);
    await page.evaluate(()=>SponsorFlowIdentity.save('Casey Morgan'));await page.click('#reelsNewMessage');await page.fill('#reelsRecipient','Jordan Lee');await page.locator('#reelsRecipientForm button[type=submit]').click();
    await page.fill('#reelsMessageBody','Casey draft');heldSend();holdSend=false;await page.waitForTimeout(50);assert.equal(await page.locator('#reelsMessageBody').inputValue(),'Casey draft');
    await selectTab('club');await page.click('#reelsAdd');await page.fill('#reelsUrl','https://youtu.be/AbC_123xy-Z');await page.fill('#reelsAddName','<img src=x onerror=alert(1)>');await page.click('#reelsAddSubmit');
    await page.waitForFunction(()=>document.querySelector('.is-current h2').textContent==='<img src=x onerror=alert(1)>');assert.equal(await active().locator('h2 img').count(),0);
    await page.goto(base+'/reels.html?reel=REEL-AbC_123xy-Z');await page.waitForFunction(()=>document.querySelector('.is-current h2')?.textContent==='<img src=x onerror=alert(1)>');
   }
   await ctx.close();console.log(`PASS: Discover scroll, Club, Saved, messages, playback, sharing, layout and contrast ${theme} ${width}px`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
async function assertEventually(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}assert(fn(),'Expected held fixture request');}
