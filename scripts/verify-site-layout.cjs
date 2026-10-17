const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(process.argv[2]||'_site');
const routes=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,e.name,'index.html'))).map(e=>e.name).concat('');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';let file=path.join(root,name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});const reports=[];fs.mkdirSync('layout-checks/site',{recursive:true});
 try{
  for(const viewport of [{width:1920,height:1080},{width:2560,height:1440},{width:390,height:844},{width:430,height:932}]){
   const page=await browser.newPage({viewport});
   for(const route of (viewport.width<901?['']:routes)){
    await page.goto(`http://127.0.0.1:${server.address().port}/${route?route+'/':''}`,{waitUntil:'load'});
    const report=await page.evaluate(async()=>{
     const main=document.querySelector('main');if(!main)return {issues:[{kind:'missing-main'}]};
     const imgs=[...main.querySelectorAll('img')].filter(i=>i.getBoundingClientRect().width>0);
     const decode=new Map();await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().then(()=>decode.set(i,true),()=>decode.set(i,false));}));
     const issues=[];
     const label=e=>[e.tagName.toLowerCase(),e.className?.baseVal??e.className].filter(Boolean).join('.');
     const rgba=s=>s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
     const bg=e=>{for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n),c=rgba(s.backgroundColor);if(c.length===3||c[3]>.95)return {rgb:c.slice(0,3),node:label(n)};if(s.backgroundImage!=='none'){const match=s.backgroundImage.match(/rgba?\([^)]*\)/);if(match)return {rgb:rgba(match[0]).slice(0,3),node:label(n),gradient:true};}}return {rgb:[255,255,255],node:'white'};};
     const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
     const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
     if(document.documentElement.scrollWidth>innerWidth+2)issues.push({kind:'overflow',width:document.documentElement.scrollWidth,viewport:innerWidth});
     for(const e of main.querySelectorAll('h1,h2,h3,h4,p,a,blockquote,li,dt,dd,figcaption,label,button,small,strong')){
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(r.width<2||r.height<2||s.visibility==='hidden'||s.display==='none'||!e.textContent.trim())continue;
      if(e.closest('[hidden]')||s.clipPath==='inset(50%)')continue;
      const back=bg(e),fg=rgba(s.color).slice(0,3),ratio=contrast(fg,back.rgb),size=parseFloat(s.fontSize),large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700);
      if(ratio<(large?3:4.5)-.02)issues.push({kind:'contrast',node:label(e),text:e.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),fg:s.color,bg:back,nodeBg:back.node,size});
     }
     for(const i of imgs){
      const r=i.getBoundingClientRect(),s=getComputedStyle(i),src=i.getAttribute('src'),f=i.closest('figure'),fr=f?.getBoundingClientRect();
      if(!decode.get(i))issues.push({kind:'broken-image',src});
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
     return {issues,mainBackground:getComputedStyle(main).backgroundColor,images:imgs.length};
    });
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
