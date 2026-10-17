const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '_site');
const routes = ['stiltz-duo-alta-new-model','stiltz-trio-alta-new-model','stiltz-duo-classic','stiltz-duo-vista','stiltz-duo-thru-car','stiltz-trio-alta-thru-car','trio-alta-three-story'];
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  let name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (name.endsWith('/')) name += 'index.html';
  const file = path.join(root,name);
  if (!file.startsWith(root + '/') || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const failures=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync('layout-checks',{recursive:true});
 try {
  for (const width of [390,430,1920]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   for (const route of routes) {
    try {
     await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`,{waitUntil:'load'});
     await page.locator('main').waitFor();
     const stats=await page.evaluate(async()=>{
      const main=document.querySelector('main');
      const images=[...main.querySelectorAll(':is(.variant-hero,.alta-hero,.duo-classic-hero,.variant-media,.duo-classic-media,.model-photo-carousel) img')].filter(e=>e.getBoundingClientRect().width>0);
      await Promise.all(images.map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));
      const metrics=images.map(i=>{const s=getComputedStyle(i),r=i.getBoundingClientRect(),f=i.closest('figure');return {src:i.getAttribute('src'),loaded:i.naturalWidth>0,width:r.width,height:r.height,naturalRatio:i.naturalWidth/i.naturalHeight,frameWidth:f?.getBoundingClientRect().width,radius:parseFloat(s.borderTopLeftRadius),fit:s.objectFit};});
      const cards=[...main.querySelectorAll('.alta-features > *, .variant-facts > *, .duo-classic-feature-grid > *, .alta-next aside, .variant-next aside, .duo-classic-next aside')];
      const colors=cards.flatMap(e=>[...e.querySelectorAll('h3,p,a')].filter(n=>n.textContent.trim()).map(n=>({text:n.textContent.trim().slice(0,40),color:getComputedStyle(n).color,bg:getComputedStyle(e).backgroundColor})));
      return {images:metrics,colors,overflow:document.documentElement.scrollWidth>innerWidth+1};
     });
     assert(!stats.overflow,'horizontal page overflow');
     for(const i of stats.images){
      assert(i.loaded,`image failed: ${i.src}`);
      if(width<901){
       assert(i.radius>=16,`square image: ${i.src}`);
       if(i.frameWidth)assert(i.width>=i.frameWidth*.95,`thumbnail inside frame: ${i.src} (image ${i.width}, frame ${i.frameWidth})`);
       assert(Math.abs(i.width/i.height-i.naturalRatio)<.03,`cropped/distorted image: ${i.src}`);
      }
     }
     const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
     const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
     for(const c of stats.colors){
      if(c.bg==='rgba(0, 0, 0, 0)')continue;
      const a=lum(rgb(c.color)),b=lum(rgb(c.bg));
      assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`unreadable card: ${c.text} (${c.color} on ${c.bg})`);
     }
     if(width<901){
      const carousels=page.locator('.model-photo-carousel');
      for(const carousel of await carousels.all()){
       if(!await carousel.isVisible())continue;
       const next=carousel.getByRole('button',{name:'Next photo',exact:true});
       const rect=await next.boundingBox();
       assert(rect && rect.x>=0 && rect.x+rect.width<=width, 'gallery button outside viewport');
       const before=await carousel.locator('img').getAttribute('src');
       await next.click();
       assert.notEqual(await carousel.locator('img').getAttribute('src'),before,'gallery next button does not change photo');
      }
     }
     await page.screenshot({path:`layout-checks/${route}-${width}.png`,fullPage:true});
     console.log('PASS',route,width);
    }catch(e){failures.push(`${route} at ${width}: ${e.message}`);console.error('FAIL',failures.at(-1));await page.screenshot({path:`layout-checks/FAIL-${route}-${width}.png`,fullPage:true});}
   }
   await page.close();
  }
 }finally{await browser.close();server.close();}
 if(failures.length)throw new Error(failures.join('\n'));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
