const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;const file=path.join(root,name.endsWith('/')?name+'index.html':name);
 if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404).end();return;}
 const size=fs.statSync(file).size;const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mp4':'video/mp4','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
 res.setHeader('Content-Type',type);res.setHeader('Accept-Ranges','bytes');
 const match=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
 if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),size-1):size-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);}else{res.writeHead(200,{'Content-Length':size});fs.createReadStream(file).pipe(res);}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});const reports=[];
 fs.mkdirSync('layout-checks/social',{recursive:true});
 try{
  const posts=JSON.parse(fs.readFileSync(path.join(root,'instagram/posts.json'))).posts;
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000}});const requests=[];page.on('request',r=>requests.push(r.url()));
   await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
   const gallery=page.locator('.native-social-gallery');await gallery.scrollIntoViewIfNeeded();
   const layout=await gallery.evaluate(async e=>{await Promise.all([...e.querySelectorAll('img')].map(i=>i.decode()));return {cards:e.querySelectorAll('button').length,columns:getComputedStyle(e.querySelector('.native-social-grid')).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth,images:[...e.querySelectorAll('img')].map(i=>({loaded:i.naturalWidth>0,radius:getComputedStyle(i).borderTopLeftRadius})),icon:getComputedStyle(e.querySelector('.native-social-play')).color};});
   assert.equal(layout.cards,6);assert.equal(layout.columns,width>900?3:1);assert.equal(layout.overflow,false);assert(layout.images.every(i=>i.loaded&&parseFloat(i.radius)>=16));
   assert(!requests.some(u=>u.includes('behold.so')),'Behold must not be requested');assert(!requests.some(u=>u.endsWith('.mp4')),'Videos must not download before opening a post');
   await gallery.screenshot({path:`layout-checks/social/gallery-${width}.png`});
   for(let i=0;i<posts.length;i++){
    const button=page.locator('.native-social-card').nth(i);await button.click();
    const dialog=page.locator('.native-social-dialog');await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.locator('.native-social-caption').textContent(),posts[i].caption);
    await page.waitForFunction(()=>{const v=document.querySelector('.native-social-dialog video');return v.currentTime>.3&&!v.paused&&v.videoWidth>0;},null,{timeout:20000});
    const media=await dialog.locator('video').evaluate(v=>({src:v.currentSrc,time:v.currentTime,duration:v.duration,fit:getComputedStyle(v).objectFit,width:v.videoWidth,height:v.videoHeight}));
    assert(media.src.includes('/instagram/'+posts[i].id+'.mp4'));assert.equal(media.fit,'contain');assert(media.duration>10);
    if(i===0)await page.screenshot({path:`layout-checks/social/player-${width}.png`});
    if(i%2===0)await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:'Close video'}).click();
    await dialog.waitFor({state:'hidden'});assert(await button.evaluate(b=>document.activeElement===b));
    await page.waitForFunction(()=>{const v=document.querySelector('.native-social-dialog video');return v.paused&&!v.hasAttribute('src');});
    reports.push({width,id:posts[i].id,...media});
   }
   await page.close();
  }
  fs.writeFileSync('layout-checks/social/report.json',JSON.stringify(reports,null,2));console.log('PASS: all six native videos play with captions at desktop and mobile sizes; no Behold, no eager video downloads, close and keyboard focus verified.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
