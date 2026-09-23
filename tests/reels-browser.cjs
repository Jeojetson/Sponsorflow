const assert = require('node:assert/strict'), fs = require('node:fs');
const {chromium} = require(process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright');
const makeBackend = require('./reels-backend-fixture.cjs'), contrast = require('./contrast-check.cjs');
const base = process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8771';
const youtubeMock = `window.__ytPlays=0;window.__ytDestroys=0;window.YT={Player:function(frame,options){this.playVideo=()=>window.__ytPlays++;this.mute=()=>window.__muted=true;this.destroy=()=>{frame.remove();window.__ytDestroys++;};window.__ytError=code=>options.events.onError({data:code,target:this});window.__ytBlocked=()=>options.events.onAutoplayBlocked({target:this});setTimeout(()=>options.events.onReady({target:this}),10);}};window.onYouTubeIframeAPIReady();`;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}); const errors=[];
 fs.mkdirSync('/tmp/sponsorflow-reels-qa',{recursive:true});
 try{
  for(const theme of ['light','dark'])for(const width of [320,390,768,1440]){
   const backend=makeBackend(base),b=backend.context;
   for(let i=0;i<30;i++)b.reelsWrite_('Posts',{id:'REEL-'+String(i).padStart(11,'0'),videoId:String(i).padStart(11,'0'),title:i===0?'A karting clip with a long title to check the phone layout carefully':'Track test '+i,caption:i===0?'A proper look at the lap. A caption that wraps naturally on smaller screens.':'One more lap.',category:i%3?'karting':'community',author:i===1?'Alexandria Montgomery-Wellington Sanders':'Jordan Lee',authorKey:'jordan lee',createdAt:new Date(Date.UTC(2026,8,20,0,i)).toISOString(),hidden:'false'});
   b.reelsSend_({name:'Casey Morgan',peer:'Jordan Lee',body:'Have you seen this lap?',reelId:'REEL-00000000001',requestId:'a'.repeat(32)});
   const ctx=await browser.newContext({viewport:{width,height:1000},isMobile:width<700,hasTouch:width<700});
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
   await page.goto(base+'/reels.html');await page.waitForSelector('#reelsViewer:not([hidden])');await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>document.querySelector('#reelsStatus').textContent.includes('loaded'));
   assert.equal(await page.locator('iframe[src*="youtube"]').count(),0,'No player until user asks');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Feed overflow ${width}`);
   assert.deepEqual(await page.evaluate(contrast),[],`Feed contrast ${theme} ${width}`);
   await page.locator('#reelsViewer').screenshot({style:'.site-header,.skip-link,.mobile-app-nav{visibility:hidden}',path:`/tmp/sponsorflow-reels-qa/feed-${width}-${theme}.png`});
   await page.click('#reelsSave');await page.waitForFunction(()=>document.querySelector('#reelsSave').textContent==='Saved ✓');
   assert.equal(b.reelsSaved_({name:'Jordan Lee'}).items.length,1);
   await page.click('[data-reels-tab=saved]');await page.waitForFunction(()=>document.querySelector('#reelsPosition').textContent==='1 / 1');
   await page.click('[data-reels-tab=feed]');
   await page.locator('.reels-poster').scrollIntoViewIfNeeded();await page.click('.reels-poster');
   await page.waitForFunction(()=>window.__ytPlays===1);assert.equal(await page.locator('iframe[src*="youtube"]').count(),1);
   assert.equal(await page.locator('iframe[src*="youtube"]').getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');
   await page.evaluate(()=>window.__ytError(101));await page.waitForSelector('.reels-poster');assert.match(await page.locator('#reelsPlaybackStatus').textContent(),/unavailable/);
   await page.click('#reelsSend');await page.fill('#reelsRecipient','Casey Morgan');await page.locator('#reelsRecipientForm button[type=submit]').click();
   await page.waitForSelector('.reels-bubble');assert.equal(await page.locator('#reelsAttachment').isVisible(),true);
   assert.match(await page.locator('.reels-notice').textContent(),/not private/);
   await page.fill('#reelsMessageBody','That corner is quick!');
   await page.click('[data-reels-tab=feed]');await page.click('[data-reels-tab=messages]');
   assert.equal(await page.locator('#reelsMessageBody').inputValue(),'That corner is quick!');
   await page.click('#reelsMessageSubmit');await page.waitForFunction(()=>document.querySelector('#reelsSendStatus').textContent==='Sent.');
   assert.equal(b.reelsThread_({name:'Casey Morgan',peer:'Jordan Lee'}).messages.at(-1).body,'That corner is quick!');
   assert.equal(await page.locator('#reelsAttachment').isVisible(),false);assert.equal(await page.locator('#reelsMessageBody').inputValue(),'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Messages overflow ${width}`);
   assert.deepEqual(await page.evaluate(contrast),[],`Messages contrast ${theme} ${width}`);
   await page.locator('#reelsMessages').screenshot({style:'.site-header,.skip-link,.mobile-app-nav{visibility:hidden}',path:`/tmp/sponsorflow-reels-qa/messages-${width}-${theme}.png`});
   await page.locator('.reels-bubble a').first().click();await page.waitForSelector('#reelsWatch:not([hidden])');assert.equal(await page.locator('#reelsTitle').textContent(),'Track test 1');
   if(width===390 && theme==='light'){
    // A saved-list reply captured before a new save cannot erase the new save.
    holdSaved=true;await page.click('[data-reels-tab=saved]');
    await assertEventually(()=>heldSave);
    await page.click('[data-reels-tab=feed]');await page.click('#reelsNext');
    if(await page.locator('#reelsSave').getAttribute('aria-pressed')==='true')await page.click('#reelsNext');
    const savedCount=b.reelsSaved_({name:'Jordan Lee'}).items.length;
    await page.click('#reelsSave');await page.waitForFunction(()=>document.querySelector('#reelsSave').textContent==='Saved ✓');
    holdSaved=false;
    await page.click('[data-reels-tab=saved]');await page.waitForFunction(count=>Number(document.querySelector('#reelsSavedCount').textContent)===count,savedCount+1);
    heldSave();await page.waitForTimeout(50);
    assert.equal(Number(await page.locator('#reelsSavedCount').textContent()),savedCount+1);
    // Exact send retry after a lost response does not duplicate a stored message.
    await page.click('[data-reels-tab=messages]');await page.fill('#reelsMessageBody','A retry should arrive once');
    const count=b.reelsRows_('Messages').length;dropSend=true;
    await page.clock.install();await page.click('#reelsMessageSubmit');await page.waitForTimeout(50);await page.clock.fastForward(46000);
    await page.waitForFunction(()=>!document.querySelector('#reelsMessageSubmit').disabled);await page.click('#reelsMessageSubmit');
    await page.waitForFunction(()=>document.querySelector('#reelsSendStatus').textContent==='Sent.');assert.equal(b.reelsRows_('Messages').length,count+1);
    await page.fill('#reelsMessageBody','Jordan draft');
    await page.evaluate(()=>SponsorFlowIdentity.save('Casey Morgan'));
    assert.equal(await page.locator('#reelsThread').isVisible(),false);assert.equal(await page.locator('#reelsMessageBody').inputValue(),'');
    await page.click('#reelsRefreshMessages');await page.waitForSelector('[data-peer="Jordan Lee"]');await page.click('[data-peer="Jordan Lee"]');
    await page.waitForFunction(()=>document.querySelectorAll('.reels-bubble').length===3);assert.match(await page.locator('#reelsMessageList').textContent(),/A retry should arrive once/);
    await page.evaluate(()=>SponsorFlowIdentity.save('Jordan Lee'));await page.click('#reelsNewMessage');await page.fill('#reelsRecipient','Casey Morgan');await page.locator('#reelsRecipientForm button[type=submit]').click();assert.equal(await page.locator('#reelsMessageBody').inputValue(),'Jordan draft');
    // Late send responses do not clear a different name's composer or messages.
    holdSend=true;await page.click('#reelsMessageSubmit');await assertEventually(()=>heldSend);
    await page.evaluate(()=>SponsorFlowIdentity.save('Casey Morgan'));await page.click('#reelsNewMessage');await page.fill('#reelsRecipient','Jordan Lee');await page.locator('#reelsRecipientForm button[type=submit]').click();
    await page.fill('#reelsMessageBody','Casey draft');heldSend();holdSend=false;await page.waitForTimeout(50);
    assert.equal(await page.locator('#reelsMessageBody').inputValue(),'Casey draft');assert.equal(await page.locator('#reelsPeer').textContent(),'Jordan Lee');
    // Malicious title/body display as text. URL submission stays on YouTube.
    await page.click('#reelsAdd');await page.fill('#reelsUrl','https://youtu.be/AbC_123xy-Z');await page.fill('#reelsAddName','<img src=x onerror=alert(1)>');await page.fill('#reelsAddCaption','A shared Short');await page.click('#reelsAddSubmit');
    await page.waitForFunction(()=>document.querySelector('#reelsTitle').textContent==='<img src=x onerror=alert(1)>');assert.equal(await page.locator('#reelsTitle img').count(),0);
    const reel=b.reelsRows_('Posts').find(r=>r.videoId==='AbC_123xy-Z');
    await page.goto(base+'/reels.html?reel='+reel.id);await page.waitForFunction(()=>document.querySelector('#reelsTitle').textContent==='<img src=x onerror=alert(1)>');
   }
   await ctx.close();console.log(`PASS: Reels, Saved, messages, playback, sharing, layout and contrast ${theme} ${width}px`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
async function assertEventually(fn) { for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}assert(fn(),'Expected held fixture request'); }
