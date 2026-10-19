const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(process.argv[2]||'_site');
const routes=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,e.name,'index.html'))).map(e=>e.name).concat('');
const surfaceReference=JSON.parse(fs.readFileSync('layout-checks/mobile-panel-reference.json','utf8'));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';let file=path.join(root,name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});const reports=[];fs.mkdirSync('layout-checks/site',{recursive:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:2560,height:1440},{width:390,height:844},{width:430,height:932}]){
   const page=await browser.newPage({viewport});
   for(const route of (viewport.width<901?['']:routes)){
    await page.goto(`http://127.0.0.1:${server.address().port}/${route?route+'/':''}`,{waitUntil:'load'});
    const report=await page.evaluate(async()=>{
     const main=document.querySelector('main');if(!main)return {issues:[{kind:'missing-main'}]};
     const allImgs=[...main.querySelectorAll('img')];
     const imgs=allImgs;
     const decode=new Map();await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().then(()=>decode.set(i,true),()=>decode.set(i,false));}));
     const issues=[];
     const label=e=>[e.tagName.toLowerCase(),e.className?.baseVal??e.className].filter(Boolean).join('.');
     const rgba=s=>s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
     const bg=e=>{for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n),c=rgba(s.backgroundColor);if(c.length===3||c[3]>.95)return {rgb:c.slice(0,3),node:label(n)};if(s.backgroundImage!=='none'){const match=s.backgroundImage.match(/rgba?\([^)]*\)/);if(match)return {rgb:rgba(match[0]).slice(0,3),node:label(n),gradient:true};}}return {rgb:[255,255,255],node:'white'};};
     const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
     const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
     if(document.documentElement.scrollWidth>innerWidth+2)issues.push({kind:'overflow',width:document.documentElement.scrollWidth,viewport:innerWidth});
     for(const e of main.querySelectorAll('h1,h2,h3,h4,p,a,blockquote,li,dt,dd,figcaption,label,button,small,strong,em,span,b')){
      if(['SPAN','EM','B'].includes(e.tagName)&&![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(r.width<2||r.height<2||s.visibility==='hidden'||s.display==='none'||!e.textContent.trim())continue;
      if(e.closest('[hidden]')||s.clipPath==='inset(50%)')continue;
      const back=bg(e),fg=rgba(s.color).slice(0,3),ratio=contrast(fg,back.rgb),size=parseFloat(s.fontSize),large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700);
      if(ratio<(large?3:4.5)-.02)issues.push({kind:'contrast',node:label(e),text:e.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),fg:s.color,bg:back,nodeBg:back.node,size});
     }
     for(const i of imgs){
      const r=i.getBoundingClientRect(),s=getComputedStyle(i),src=i.getAttribute('src'),f=i.closest('figure'),fr=f?.getBoundingClientRect();
      if(!decode.get(i))issues.push({kind:'broken-image',src});
      if([...function*(n){while(n){yield n;n=n.parentElement}}(i)].some(n=>getComputedStyle(n).display==='none'||n.hidden))continue;
      if(r.width<2||r.height<2){if(!i.closest('[hidden]')&&s.display!=='none')issues.push({kind:'invisible-image',src});continue;}
      if(!/(models|installations|\/alta\/)/.test(src)||/brochure|footprint|diagram|dimension|reference|plan/i.test(src))continue;
      if(parseFloat(s.borderTopLeftRadius)<12)issues.push({kind:'square-photo',src,node:label(i)});
      const ratio=r.width/r.height,natural=i.naturalWidth/i.naturalHeight;
      if(Math.abs(ratio-natural)>.035&&s.objectFit!=='cover')issues.push({kind:'letterboxed-photo',src,node:label(i),fit:s.objectFit,width:r.width,height:r.height,natural:+natural.toFixed(3)});
      if(s.objectFit==='cover'&&Math.abs(ratio-natural)>.035)issues.push({kind:'cropped-photo',src,node:label(i),width:r.width,height:r.height,natural:+natural.toFixed(3)});
      if(fr&&getComputedStyle(f).overflow==='hidden'&&fr.height+2<r.height)issues.push({kind:'frame-clips-photo',src,height:r.height,frameHeight:fr.height});
     }
     for(const a of main.querySelectorAll('.social-hub-link')){
      const icon=a.querySelector('svg,.social-hub-icon');if(!icon||icon.getBoundingClientRect().width<12)issues.push({kind:'social-icon-missing',text:a.textContent.trim()});
      else if(contrast(rgba(getComputedStyle(icon).color).slice(0,3),bg(a).rgb)<4.5)issues.push({kind:'social-icon-contrast',text:a.textContent.trim()});
     }
     let home=null;
     if(main.matches('.brand-home')){
      const hero=main.querySelector('.brand-hero'),image=hero.querySelector('figure img'),closing=main.querySelector('.brand-contact-band'),closingPhoto=closing.querySelector(':scope>img');
      home={heroBottom:hero.getBoundingClientRect().bottom,imageBottom:image.getBoundingClientRect().bottom,heroImageRadius:getComputedStyle(image).borderBottomLeftRadius,
       closingHeight:closing.getBoundingClientRect().height,closingPhotoHeight:closingPhoto.getBoundingClientRect().height,
       h1Size:parseFloat(getComputedStyle(main.querySelector('h1')).fontSize),installationsBackground:getComputedStyle(main.querySelector('.brand-real-homes')).backgroundColor,
       stepColors:[...main.querySelectorAll('.brand-process li')].map(e=>getComputedStyle(e).backgroundColor)};
     }
     return {issues,home,mainBackground:getComputedStyle(main).backgroundColor,canvasBackground:getComputedStyle(document.body).backgroundColor,mainWidth:main.getBoundingClientRect().width,panels:[...main.querySelectorAll(':scope>section')].map(e=>getComputedStyle(e).backgroundColor),images:imgs.length};
    });
    if(viewport.width>900){
     const reference=surfaceReference.find(r=>r.route===(route||'home'));
     for(const panel of reference.panels){
      if(panel.background!=='rgba(0, 0, 0, 0)'&&report.panels[panel.index-1]!==panel.background)report.issues.push({kind:'desktop-panel-color',panel:panel.class,expected:panel.background,actual:report.panels[panel.index-1]});
     }
     if(report.home){
      const h=report.home;
      if(h.imageBottom>h.heroBottom+1)report.issues.push({kind:'homepage-hero-clipped',imageBottom:h.imageBottom,heroBottom:h.heroBottom});
      if(parseFloat(h.heroImageRadius)<20)report.issues.push({kind:'homepage-hero-not-rounded'});
      if(h.closingHeight>400||h.closingPhotoHeight>350)report.issues.push({kind:'homepage-closing-too-tall',...h});
      if(h.installationsBackground!=='rgb(223, 234, 219)')report.issues.push({kind:'homepage-installations-panel-missing'});
      if(h.stepColors.length!==4||new Set(h.stepColors).size!==4||h.stepColors.includes('rgba(0, 0, 0, 0)'))report.issues.push({kind:'homepage-journey-cards-missing'});
      const expected=Math.min(56,Math.max(48,viewport.width*.038));
      if(Math.abs(h.h1Size-expected)>.2)report.issues.push({kind:'homepage-type-changed',expected,actual:h.h1Size});
     }
     if(report.canvasBackground!=='rgb(241, 233, 220)')report.issues.push({kind:'missing-beige-canvas',actual:report.canvasBackground});
     if(report.mainBackground!=='rgb(241, 233, 220)')report.issues.push({kind:'missing-beige-shell',actual:report.mainBackground});
     if(report.mainWidth<Math.min(viewport.width-72,2100)-2)report.issues.push({kind:'narrow-beige-shell',width:report.mainWidth,viewport:viewport.width});
    }
    // Exercise desktop gallery navigation rather than only checking initial images.
    for(const carousel of await page.locator('.model-photo-carousel,.installation-carousel').all()){
     if(!await carousel.isVisible())continue;
     const next=carousel.getByRole('button',{name:'Next photo',exact:true});
     if(await next.count()!==1){report.issues.push({kind:'missing-gallery-controls'});continue;}
     const before=await carousel.locator('img').getAttribute('src');await next.click();
     if(await carousel.locator('img').getAttribute('src')===before)report.issues.push({kind:'gallery-does-not-advance'});
     await carousel.locator('img').evaluate(i=>i.decode().catch(()=>{}));
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    const filename=`${route||'home'}-${viewport.width}`;
    await page.screenshot({path:`layout-checks/site/${filename}.png`,fullPage:true});
    reports.push({route:route||'/',...viewport,...report});
    console.log('AUDIT',filename,JSON.stringify(report.issues));
   }
   await page.close();
  }
 }finally{await browser.close();server.close();}
 fs.writeFileSync('layout-checks/site/report.json',JSON.stringify(reports,null,2));
 const total=reports.reduce((sum,r)=>sum+r.issues.length,0);console.log('Site audit:',reports.length,'page/viewport checks;',total,'issues');
 if(total)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
