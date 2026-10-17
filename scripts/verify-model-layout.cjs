const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '_site');
const routes = ['stiltz-duo-alta-new-model','stiltz-trio-alta-new-model','stiltz-duo-classic','stiltz-duo-vista','stiltz-duo-thru-car','stiltz-trio-alta-thru-car','trio-alta-three-story','testimonials','stiltz-news','gallery-of-installs-florida','build-down-installations','landing-installations','custom-colors','compare','meet-the-team'];
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
      const images=[...main.querySelectorAll(':is(.variant-hero,.alta-hero,.duo-classic-hero,.variant-media,.duo-classic-media,.model-photo-carousel,.curated-model-images,.installation-carousel,.compare-model-card) img')].filter(e=>e.getBoundingClientRect().width>0);
      const decoded=new Map();
      await Promise.all(images.map(i=>{i.loading='eager';return i.decode().then(()=>decoded.set(i,true),()=>decoded.set(i,false));}));
      const metrics=images.map(i=>{const s=getComputedStyle(i),r=i.getBoundingClientRect(),f=i.closest('figure');return {src:i.getAttribute('src'),loaded:i.naturalWidth>0 && decoded.get(i),width:r.width,height:r.height,naturalRatio:i.naturalWidth/i.naturalHeight,frameWidth:f?.getBoundingClientRect().width,frameHeight:f?.getBoundingClientRect().height,radius:parseFloat(s.borderTopLeftRadius),fit:s.objectFit};});
      const cards=[...main.querySelectorAll('.alta-features > *, .variant-facts > *, .duo-classic-feature-grid > *, .alta-next aside, .variant-next aside, .duo-classic-next aside, .testimonial-story, .news-card, .compare-model-content > a, .testimonials-cta > a.cta, .installation-page--custom-colors > .installation-page__intro')];
      const colors=cards.flatMap(e=>[...(e.matches('a')?[e]:[]),...e.querySelectorAll('h1,h2,h3,p,a,blockquote,footer b,footer span,.news-card-action,.news-card > div > span')].filter(n=>n.textContent.trim() && (!n.matches('a[class*=cta]') || n===e)).map(n=>({text:n.textContent.trim().slice(0,40),color:getComputedStyle(n).color,bg:getComputedStyle(e).backgroundColor})));
      return {images:metrics,colors,overflow:document.documentElement.scrollWidth>innerWidth+1};
     });
     assert(!stats.overflow,'horizontal page overflow');
     for(const i of stats.images){
      assert(i.loaded,`image failed: ${i.src}`);
      if(width<901){
       assert(i.radius>=16,`square image: ${i.src}`);
       if(i.frameHeight)assert(i.frameHeight>=i.height-1,`image clipped by frame: ${i.src} (image ${i.height}, frame ${i.frameHeight})`);
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
      const carousels=page.locator('.model-photo-carousel, .installation-carousel');
      for(const carousel of await carousels.all()){
       if(!await carousel.isVisible())continue;
       const next=carousel.getByRole('button',{name:'Next photo',exact:true});
       const rect=await next.boundingBox();
       assert(rect && rect.x>=0 && rect.x+rect.width<=width, 'gallery button outside viewport');
       const before=await carousel.locator('img').getAttribute('src');
       await next.click();
       assert.notEqual(await carousel.locator('img').getAttribute('src'),before,'gallery next button does not change photo');
       const countText=await carousel.locator('p').innerText();
       const total=Number(countText.split('/').at(-1).trim());
       assert(total>1 && total<100,'invalid gallery count');
       for(let index=1; index<total; index++) {
        const photo=carousel.locator('img');
        const state=await photo.evaluate(async i=>{try{await i.decode();return {ok:true,src:i.getAttribute('src')};}catch{return {ok:false,src:i.getAttribute('src')};}});
        assert(state.ok,`gallery photo cannot decode: ${state.src}`);
        if(index<total-1)await next.click();
       }
       if(route==='build-down-installations')assert.equal(total,7,'corrupt build-down photo still included');
       if(route==='landing-installations')assert.equal(total,22,'corrupt landing photo still included');

      }
     }
     if(route==='meet-the-team') {
      const bill=page.locator('.team-card').filter({has:page.getByRole('heading',{name:'Bill Bell',exact:true})});
      assert.equal(await bill.count(),1,'Bill card missing or duplicated');
      const photo=bill.locator('img');
      assert.equal(await photo.count(),1,'Bill photo missing');
      assert(await photo.evaluate(async i=>{i.loading='eager';try{await i.decode();return i.naturalWidth===1152 && i.naturalHeight===1536;}catch{return false;}}),'Bill uploaded photo failed to load');
      await bill.screenshot({path:`layout-checks/bill-${width}.png`});
     }
     if(route==='compare') {
      assert(await page.evaluate(()=>{
       const brochure=document.querySelector('.compare-specification-sheet');
       return [...document.querySelectorAll('.compare-model-card')].every(card=>!!(card.compareDocumentPosition(brochure)&Node.DOCUMENT_POSITION_FOLLOWING));
      }),'brochure appears before the last model');
      if(width>900) {
       const menu=page.locator('.desktop-nav details').first();
       await menu.locator('summary').click();
       assert(await menu.evaluate(e=>e.open),'desktop menu did not open');
       await page.evaluate(()=>window.scrollBy(0,300));
       await page.waitForFunction(()=>!document.querySelector('.desktop-nav details').open);
       await page.evaluate(()=>window.scrollTo(0,0));
       await menu.locator('summary').click();
      } else {
       await page.locator('.home-menu').click();
       assert(await page.locator('#mobile-site-navigation').isVisible(),'mobile menu did not open');
       await page.evaluate(()=>window.scrollBy(0,300));
       await page.waitForFunction(()=>document.getElementById('mobile-site-navigation').hidden);
       await page.evaluate(()=>window.scrollTo(0,0));
       await page.locator('.home-menu').click();
      }
      await page.goto(`http://127.0.0.1:${server.address().port}/stiltz-duo-vista/`,{waitUntil:'load'});
      await page.goBack({waitUntil:'load'});
      assert(await page.evaluate(()=>![...document.querySelectorAll('.desktop-nav details')].some(e=>e.open) && document.getElementById('mobile-site-navigation').hidden),'navigation reopened after Back');
     }
     await page.evaluate(async()=>{window.scrollTo(0,0);await Promise.all([...document.querySelectorAll('main img')].map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));});
     await page.screenshot({path:`layout-checks/${route}-${width}.png`,fullPage:true});
     console.log('PASS',route,width);
    }catch(e){failures.push(`${route} at ${width}: ${e.message}`);console.error('FAIL',failures.at(-1));await page.screenshot({path:`layout-checks/FAIL-${route}-${width}.png`,fullPage:true});}
   }
   await page.close();
  }
 }finally{await browser.close();server.close();}
 if(failures.length)throw new Error(failures.join('\n'));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
