const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright');
const fixture=require('./fixture.cjs');
const base=process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8765';
const output=process.env.SPONSORFLOW_QA_DIR || '/tmp/sponsorflow-qa';fs.mkdirSync(output,{recursive:true});
const errors=[];const report=[];
const mock=`(() => {
 const data=${JSON.stringify(fixture)};window.__testData=data;window.__calls=[];
 const clone=value=>JSON.parse(JSON.stringify(value));
 window.SponsorFlowAPI={configured:()=>true,post:async(action,payload={})=>{
   window.__calls.push({action,payload:clone(payload)});
   if (action==='plannerBootstrap') {if(window.__failRefresh){window.__failRefresh=false;throw new Error('Refresh failed');}return clone(data);}
   if (action==='getPlannerTaskDetail') return {task:clone(data.tasks.find(t=>t.id===payload.taskId)),comments:[{authorName:'Avery Chen',body:'Keep the existing mounting points.',createdAt:'2026-09-15T14:00:00Z'}],activity:[]};
   if (action==='savePlannerTask') {
    if(window.__conflict)throw new Error('Someone else changed this task. Refresh before saving.');
    const old=data.tasks.find(t=>t.id===payload.id)||{};
    const task={...old,...payload,id:payload.id||'CREATED-'+Date.now(),progress:Number(payload.progress||0),dependencyIds:JSON.parse(payload.dependencyIds||'[]'),updatedAt:new Date().toISOString(),updatedBy:payload.actorName};
    const i=data.tasks.findIndex(t=>t.id===task.id);if(i<0)data.tasks.push(task);else data.tasks[i]=task;
    if(window.__failAfterSave){window.__failAfterSave=false;window.__failRefresh=true;}
    return clone(task);
   }
   if(action==='movePlannerTask')throw new Error('Simulated save failure');
   if(action==='attendanceBootstrap')return clone({teams:data.teams,meetings:data.meetings});
   if(action==='attendanceCheckIn')return {duplicate:false,checkedInAt:new Date().toISOString(),meeting:data.meetings[0]};
   if(action==='bootstrap')return {contacts:[],templates:[],memberNames:[],stats:null};
   if(action==='getRequestsByName')return [];
   throw new Error('Unexpected test action: '+action);
 }};
})();`;
async function pageFor(browser,width,theme='light',identity=true) {
 const ctx=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
 await ctx.addInitScript(({theme,identity})=>{localStorage.setItem('asmeWorkspaceTheme',theme);if(identity)localStorage.setItem('asmePlannerName','Jordan Lee');},{theme,identity});
 await ctx.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/assets/api.js')return route.fulfill({contentType:'text/javascript',body:mock});
  if(u.origin!==base)return route.abort(); // Tests can never send live writes.
  return route.continue();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(`${page.url()}: ${e.message}`));
 return page;
}
async function open(page,name) {await page.goto(`${base}/${name}.html`);await page.waitForFunction(()=>document.fonts.status==='loaded');await page.waitForTimeout(120);}
async function screenshot(page,name) {await page.screenshot({path:path.join(output,name+'.png'),fullPage:!(await page.locator('dialog[open]').count())});}
async function overflow(page) {return page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+2 && !e.closest('.gantt-scroll,.kanban-board,dialog,[hidden],.is-hidden')}).slice(0,8).map(e=>e.className||e.id||e.tagName)}));}
(async()=>{
 const browser=await chromium.launch({channel:process.env.SPONSORFLOW_BROWSER || 'chrome',headless:true});
 try {
  for(const width of (process.env.SKIP_VISUAL==='1'?[]:[1440,900,390,320]))for(const theme of ['light','dark']){
   const page=await pageFor(browser,width,theme);
   for(const name of ['index','planner','calendar','outreach','attendance','admin']) {
    await open(page,name);const o=await overflow(page);report.push({page:name,width,theme,...o});
    assert.equal(await page.evaluate(()=>document.compatMode),'CSS1Compat');
    if(o.scroll>width+2)errors.push(`Overflow ${name} ${width} ${theme}: ${JSON.stringify(o)}`);
    if(width!==900)await screenshot(page,`${name}-${width}-${theme}`);
    const fonts=await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily);assert.match(fonts,/Mona Sans/);
   }
   await page.context().close();
  }
  fs.writeFileSync(path.join(output,'visual-report.json'),JSON.stringify(report,null,2));
  console.log('Visual checks:',report.length,'pages/sizes/themes');
  if(process.env.VISUAL_ONLY==='1') {console.log(JSON.stringify(errors,null,2));return;}
  const p=await pageFor(browser,1440);await open(p,'planner');
  assert.equal(await p.locator('.work-row').count(),fixture.tasks.length);
  await p.click('[data-quick-filter="mine"]');assert.equal(await p.locator('.work-row').count(),4);
  await p.click('[data-quick-filter="attention"]');assert.equal(await p.locator('.work-row').count(),1);
  await p.click('[data-quick-filter="all"]');
  await p.fill('#taskSearch','grant');assert.equal(await p.locator('.work-row').count(),1);await p.fill('#taskSearch','');
  await p.click('[data-project-id="BOARD-ELEC"]');assert.equal(await p.locator('.work-row').count(),2);
  await p.click('[data-project-id="BOARD-CLUB-PORTFOLIO"]');
  for(const view of ['board','timeline','insights','table']) {await p.click(`[data-planner-view="${view}"]`);await p.waitForTimeout(50);assert.equal(await p.locator(`[data-planner-panel="${view}"]`).isVisible(),true);await screenshot(p,`planner-${view}-desktop`);}
  await p.click('[data-table-task="TASK-1"]');await p.waitForSelector('#taskDialog[open]');
  assert.equal(await p.inputValue('#taskProgress'),'40');await screenshot(p,'task-editor-desktop');
  assert.equal(await p.locator('#taskDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
  for(const tab of ['schedule','details','collaboration','overview']){await p.click(`[data-task-tab="${tab}"]`);await screenshot(p,`task-editor-${tab}`);}
  await p.fill('#taskTitle','Updated mounting design');
  await p.click('#taskSaveButton');await p.waitForSelector('#taskDialog:not([open])',{state:'attached'});
  let saved=await p.evaluate(()=>window.__calls.filter(c=>c.action==='savePlannerTask').at(-1).payload);
  assert.equal(saved.expectedUpdatedAt,fixture.tasks[0].updatedAt);assert.equal(saved.progress,'40');
  for(const key of ['boardId','description','ownerNames','startDate','dueDate','partName','partNumber','vendor','fundingAmountLabel','requirements','sourceUrl'])assert.equal(saved[key],fixture.tasks[0][key],key);
  assert.deepEqual(JSON.parse(saved.dependencyIds),fixture.tasks[0].dependencyIds);
  // Failed refresh after creation must retain the new server ID on retry.
  await p.click('#newTaskTopButton');await p.fill('#taskTitle','New test task');await p.evaluate(()=>window.__failAfterSave=true);await p.click('#taskSaveButton');await p.waitForFunction(()=>document.querySelector('#taskId').value.startsWith('CREATED-'));
  const createdId=await p.inputValue('#taskId');await p.click('#taskSaveButton');await p.waitForSelector('#taskDialog:not([open])',{state:'attached'});
  assert.equal(await p.evaluate(()=>window.__calls.filter(c=>c.action==='savePlannerTask').at(-1).payload.id),createdId);
  assert.equal(await p.evaluate(()=>window.__testData.tasks.filter(t=>t.title==='New test task').length),1);
  // Preserve unsaved inputs on a concurrency conflict.
  await p.click('[data-table-task="TASK-1"]');await p.fill('#taskTitle','Conflicting title');await p.evaluate(()=>window.__conflict=true);await p.click('#taskSaveButton');await p.waitForTimeout(100);assert.equal(await p.inputValue('#taskTitle'),'Conflicting title');assert.equal(await p.locator('#taskDialog').evaluate(e=>e.open),true);
  await p.context().close();
  const cal=await pageFor(browser,1440);await open(cal,'calendar');
  await cal.click('[data-calendar-scope="board:BOARD-ELEC"]');assert.equal(await cal.locator('.calendar-agenda-item').count(),2);
  await cal.click('[data-calendar-scope="all"]');await cal.click('[data-calendar-view="agenda"]');assert.equal(await cal.locator('.standalone-calendar-panel').isVisible(),false);
  await cal.click('[data-calendar-kind="events"]');assert.equal(await cal.locator('.calendar-agenda-item').count(),3);
  await cal.click('[data-calendar-kind="all"]');await cal.fill('#calendarSearch','equipment');assert.equal(await cal.locator('.calendar-agenda-item').count(),1);
  await cal.click('[data-agenda-task="TASK-6"]');assert.equal(await cal.inputValue('#calendarEventStartDate'),'');assert.equal(await cal.inputValue('#calendarEventProgress'),'25');
  await screenshot(cal,'calendar-event-editor');
  assert.equal(await cal.locator('#calendarEventDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
  await cal.fill('#calendarEventTitle','Updated grant deadline');await cal.click('#calendarEventSave');await cal.waitForSelector('#calendarEventDialog:not([open])',{state:'attached'});
  saved=await cal.evaluate(()=>window.__calls.filter(c=>c.action==='savePlannerTask').at(-1).payload);
  assert.equal(saved.startDate,'');assert.equal(saved.dueDate,fixture.tasks[5].dueDate);
  for(const key of ['partName','partNumber','vendor','fundingMin','fundingMax','quantity','estimatedCost','requirements','tags','sourceUrl'])assert.equal(saved[key],fixture.tasks[5][key],key);
  await cal.fill('#calendarSearch','');await cal.click('[data-agenda-task="TASK-1"]');assert.equal(await cal.inputValue('#calendarEventProgress'),'40');await cal.click('#calendarEventSave');await cal.waitForSelector('#calendarEventDialog:not([open])',{state:'attached'});
  saved=await cal.evaluate(()=>window.__calls.filter(c=>c.action==='savePlannerTask').at(-1).payload);assert.deepEqual(JSON.parse(saved.dependencyIds),fixture.tasks[0].dependencyIds);assert.equal(saved.progress,40);
  await cal.click('#calendarNewEventTop');await cal.fill('#calendarEventTitle','Test meeting');await cal.evaluate(()=>window.__failAfterSave=true);await cal.click('#calendarEventSave');await cal.waitForFunction(()=>document.querySelector('#calendarEventId').value.startsWith('CREATED-'));const eventId=await cal.inputValue('#calendarEventId');await cal.click('#calendarEventSave');await cal.waitForSelector('#calendarEventDialog:not([open])',{state:'attached'});assert.equal(await cal.evaluate(()=>window.__calls.filter(c=>c.action==='savePlannerTask').at(-1).payload.id),eventId);
  await cal.context().close();
  const anonymous=await pageFor(browser,390,'light',false);await open(anonymous,'planner');assert.equal(await anonymous.locator('dialog[open]').count(),0);await anonymous.click('#newTaskTopButton');assert.equal(await anonymous.locator('#identityDialog').evaluate(e=>e.open),true);await anonymous.fill('#identityDialogName','Jordan Lee');await anonymous.click('#identityDialogSave');await anonymous.waitForSelector('#taskDialog[open]');await screenshot(anonymous,'task-editor-mobile');assert.equal(await anonymous.locator('#taskDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);await anonymous.context().close();
  const attend=await pageFor(browser,390);await open(attend,'attendance');await attend.fill('#attendanceName','Jordan Lee');await attend.fill('#attendanceCode','test-code');await attend.click('#attendanceCheckInButton');await attend.waitForSelector('#attendanceSuccessDialog[open]');assert.match(await attend.locator('#attendanceSuccessTitle').innerText(),/checked in/i);await screenshot(attend,'attendance-confirmation');await attend.context().close();
  assert.deepEqual(errors,[]);console.log('PASS: layout, themes, navigation, filters, task/event field preservation, conflicts, retry IDs, attendance confirmation.');
 } finally {await browser.close();fs.writeFileSync(path.join(output,'errors.json'),JSON.stringify(errors,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});
