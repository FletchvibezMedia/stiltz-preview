const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let file=path.join(root,url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
 if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'}[path.extname(file)];
 if(type)res.setHeader('Content-Type',type);fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});const reports=[];
 fs.mkdirSync('layout-checks/roadmap',{recursive:true});
 try{
  for(const width of [390,430,900,901,1024,1440,1920,2844,3840]){
   const page=await browser.newPage({viewport:{width,height:1000}});
   await page.goto('http://127.0.0.1:'+server.address().port+'/installation/',{waitUntil:'load'});
   const report=await page.evaluate(()=>{
    const section=document.querySelector('.installation-roadmap'),intro=section.querySelector('.installation-roadmap-intro'),steps=section.querySelector('.installation-steps');
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};};
    const style=getComputedStyle(section);
    return {section:rect(section),main:rect(section.parentElement),intro:rect(intro),steps:rect(steps),paddingLeft:Number.parseFloat(style.paddingLeft),paddingRight:Number.parseFloat(style.paddingRight),columns:style.gridTemplateColumns.split(' ').length,gap:Number.parseFloat(getComputedStyle(steps).rowGap),cards:[...steps.children].map(e=>({rect:rect(e),copy:rect(e.querySelector('div')),overflow:e.scrollWidth>e.clientWidth+1})),text:section.innerText};
   });
   assert.equal(report.cards.length,5);assert(report.text.includes('Walk through and support'));
   assert(report.cards.every(c=>!c.overflow));
   if(width>900){
    assert(report.paddingLeft<=60&&report.paddingRight<=60,'Viewport-sized padding returned at '+width);
    assert(report.section.left>=report.main.left&&report.section.right<=report.main.right+1,'Panel escapes the beige shell at '+width);
    assert.equal(report.columns,2);assert(report.intro.width>=200);assert(report.steps.width>=320,'Collapsed step column at '+width);
    assert(report.cards.every(c=>c.copy.width>=240),'Unreadably narrow card text at '+width);
    assert(report.gap>=16,'Roadmap cards need visible spacing');
    assert(report.section.height<1250,'Roadmap is stretched vertically at '+width);
   }else if(width<=430){
    assert.equal(report.columns,1);assert.equal(report.paddingLeft,24);assert.equal(report.paddingRight,24);
   }
   await page.locator('.installation-roadmap').screenshot({path:'layout-checks/roadmap/roadmap-'+width+'.png'});
   reports.push({viewportWidth:width,...report});console.log('PASS installation roadmap',width);
   await page.close();
  }
 }finally{await browser.close();server.close();}
 fs.writeFileSync('layout-checks/roadmap/report.json',JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
