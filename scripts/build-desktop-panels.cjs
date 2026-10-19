const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(process.argv[2]||'_site');
const routes=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,e.name,'index.html'))).map(e=>e.name).concat('');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const file=path.join(root,name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const baseline=[];
 try{
  for(const route of routes){
   await page.goto(`http://127.0.0.1:${server.address().port}/${route?route+'/':''}`,{waitUntil:'domcontentloaded'});
   const panels=await page.evaluate(()=>[...document.querySelectorAll('main>section')].map((e,index)=>({index:index+1,class:e.className,background:getComputedStyle(e).backgroundColor})));
   baseline.push({route:route||'home',panels});
  }
 }finally{await browser.close();server.close();}
 // The mobile rendering is the authority. No mobile CSS is generated or changed.
 const rules=baseline.flatMap(({route,panels})=>panels.filter(p=>p.background!=='rgba(0, 0, 0, 0)').map(p=>`main[data-design-page="${route}"] > section:nth-of-type(${p.index}) { background-color: ${p.background} !important; background-image: none !important; }`));
 const cssFile=path.join(root,'desktop-panels.css');
 const base=fs.readFileSync(cssFile,'utf8').replace(/\/\* MOBILE_PANEL_COLORS_START \*\/[\s\S]*?\/\* MOBILE_PANEL_COLORS_END \*\//g,'');
 fs.writeFileSync(cssFile,base+`\n/* MOBILE_PANEL_COLORS_START */\n@layer desktop-restoration { @media (min-width:901px) {\n${rules.join('\n')}\n} }\n/* MOBILE_PANEL_COLORS_END */\n`);
 fs.mkdirSync('layout-checks',{recursive:true});
 fs.writeFileSync('layout-checks/mobile-panel-reference.json',JSON.stringify(baseline,null,2));
 console.log('Matched desktop surfaces to mobile:',baseline.length,'pages,',rules.length,'colored panels');
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
