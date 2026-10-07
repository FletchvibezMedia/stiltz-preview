import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve(process.argv[2] ?? 'release-source');
const output = path.resolve(process.argv[3] ?? '_site');
const origin = 'https://stiltzofflorida.com';
const rescueOrigin = 'https://stiltz-florida-rescue-replica.carolina-qua-8173.chatgpt.site';
const projectPath = '/stiltz-preview/';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    entry.isDirectory() ? walk(file, files) : files.push(file);
  }
  return files;
}

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });

const runtimePatch = '<script>(function(){if(!location.hostname.endsWith("github.io"))return;var prefix="/stiltz-preview";function patch(node,attr){var value=node.getAttribute(attr);if(value&&value.charAt(0)==="/"&&value.indexOf(prefix+"/")!==0)node.setAttribute(attr,prefix+value)}function scan(root){if(!root.querySelectorAll)return;root.querySelectorAll("a[href],img[src],source[src],script[src]").forEach(function(node){patch(node,node.tagName==="A"?"href":"src")})}document.addEventListener("DOMContentLoaded",function(){scan(document);new MutationObserver(function(records){records.forEach(function(record){if(record.type==="attributes")patch(record.target,record.attributeName);else record.addedNodes.forEach(scan)})}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["href","src"]})})}())</script>';

const navigationFile = path.join(output, 'static-navigation.js');
if (fs.existsSync(navigationFile)) {
  let navigation = fs.readFileSync(navigationFile, 'utf8');
  navigation = navigation.replace('const navigationGroups = [', `const sitePathname = () => {
  const pathname = location.hostname.endsWith('github.io')
    ? (location.pathname.startsWith('/stiltz-preview/')
      ? location.pathname.slice('/stiltz-preview'.length)
      : (location.pathname === '/stiltz-preview' ? '/' : location.pathname))
    : location.pathname;
  return pathname.endsWith('/') ? pathname : pathname + '/';
};

const navigationGroups = [`);
  navigation = navigation.replaceAll("const path = window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`;", 'const path = sitePathname();');
  fs.writeFileSync(navigationFile, navigation);
}

const routes = [];
for (const file of walk(output).filter((file) => file.endsWith('index.html'))) {
  const relative = path.relative(output, file).split(path.sep).join('/');
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/index\.html$/, '')}`;
  const canonical = `${origin}${route}`;
  routes.push(route);
  let html = fs.readFileSync(file, 'utf8');
  html = html.split(rescueOrigin).join(origin);
  html = html.replaceAll('content="noindex, nofollow"', 'content="index, follow"');
  html = html.replace(/<meta property="og:url" content="[^"]*"[^>]*>/gi, `<meta property="og:url" content="${canonical}">`);
  // Serve the same artifact both from the GitHub project preview and, later,
  // from the custom domain root. Relative URLs follow this runtime base.
  html = html.replace(/\b(href|src|action)=("|')\/(?!\/)([^"']*)\2/gi, (_match, name, quote, url) => `${name}=${quote}${url || './'}${quote}`);
  html = html.replace('<head>', '<head><script>(function(){var b=document.createElement("base");b.href=location.hostname.endsWith("github.io")?"/stiltz-preview/":"/";document.head.appendChild(b)}())</script>');
  html = html.replace(/(<script src=(\"|')static-navigation\.js[^>]*><\/script>)/i, `$1${runtimePatch}`);
  html = html.replace('</head>', `<link rel="canonical" href="${canonical}">\n</head>`);
  fs.writeFileSync(file, html);
}

const lastmod = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(output, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.sort().map((route) => `  <url><loc>${origin}${route}</loc><lastmod>${lastmod}</lastmod></url>`),
  '</urlset>', ''
].join('\n'));
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(path.join(output, 'CNAME'), 'stiltzofflorida.com\n');
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(JSON.stringify({ output, pages: routes.length }, null, 2));
