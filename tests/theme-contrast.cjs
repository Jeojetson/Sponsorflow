const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.SPONSORFLOW_PLAYWRIGHT || 'playwright');
const fixture=require('./fixture.cjs');
const base = process.env.SPONSORFLOW_BASE_URL || 'http://127.0.0.1:8771';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
 try {
 for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
  await ctx.addInitScript(theme=>{localStorage.setItem('asmeWorkspaceTheme',theme);localStorage.setItem('asmeMemberName','Theme Review');},theme);
  await ctx.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.pathname==='/assets/config.js')return r.fulfill({contentType:'text/javascript',body:'window.SPONSORFLOW_CONFIG={API_URL:""};'});
    if(u.pathname==='/assets/api.js')return r.fulfill({contentType:'text/javascript',body:`window.SponsorFlowAPI={configured:()=>true,post:async(action)=> action==='plannerBootstrap'?${JSON.stringify(fixture)}:action==='attendanceBootstrap'?${JSON.stringify({meetings:fixture.meetings,teams:fixture.teams})}:{contacts:[],templates:[],stats:null,memberNames:[]}};`});
    return u.origin===base?r.continue():r.abort();
  });
  const page=await ctx.newPage();
  for(const file of ['index','planner','planner:board','planner:timeline','planner:insights','calendar','calendar:month','outreach','attendance','admin','games','games:word','games:groups','games:queens','games:binary','games:path','games:numbers','index:welcome']){
   const [path,state]=file.split(':');
   await page.goto(base+'/'+path+'.html');await page.evaluate(()=>document.fonts.ready);
   if(path==='planner')await page.waitForSelector('.work-row',{state:'attached'});
   if(state && path==='planner')await page.click(`[data-planner-view="${state}"]`);
   if(state && path==='calendar')await page.click(`button[data-calendar-view="${state}"]`);
   if(state && path==='games')await page.click(`[data-play="${state}"]`);
   if(state==='welcome')await page.click('.member-name-button');
   const failures=await page.evaluate(()=>{
    const rgb=s=>s.match(/[\d.]+/g)?.map(Number);
    const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
    const failures=[];
    for(const e of document.querySelectorAll('body *')){
     if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) || !e.checkVisibility() || e.matches(':disabled'))continue;
     const cs=getComputedStyle(e); if(Number(cs.opacity)<1)continue;
     let background=[255,255,255],layers=[],skip=false;
     for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a);if(s.backgroundImage!=='none'||Number(s.opacity)<1){skip=true;break;}layers.push(rgb(s.backgroundColor));}
     if(skip)continue;
     for(const color of layers.reverse()){if(!color)continue;const alpha=color[3]??1;background=background.map((v,i)=>color[i]*alpha+v*(1-alpha));}
     const fg=rgb(cs.color);if(!fg)continue;const alpha=fg[3]??1;
     const actual=fg.slice(0,3).map((v,i)=>v*alpha+background[i]*(1-alpha));
     const a=luminance(actual),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     const large=parseFloat(cs.fontSize)>=24 || (parseFloat(cs.fontSize)>=18.66 && parseInt(cs.fontWeight)>=700);
     if(ratio<(large?3:4.5)-.02)failures.push({selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'),text:e.textContent.trim().slice(0,55),ratio:+ratio.toFixed(2),fg:cs.color,bg:background,font:cs.fontSize});
    }
    return failures;
   });
   report.push({theme,file,failures});
  }
  await ctx.close();
 }
 fs.writeFileSync('/tmp/sponsorflow-theme-contrast.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.filter(r=>r.failures.length),null,2));
 if(process.env.STRICT_CONTRAST==='1')assert.equal(report.flatMap(r=>r.failures).length,0);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
