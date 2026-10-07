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

const routes = [];
for (const file of walk(output).filter((file) => file.endsWith('index.html'))) {
  const relative = path.relative(output, file).split(path.sep).join('/');
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/index\\.html$/, '')}`;
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
  html = html.replace('</head>', `<link rel="canonical" href="${canonical}">\\n</head>`);
  fs.writeFileSync(file, html);
}

const lastmod = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(output, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.sort().map((route) => `  <url><loc>${origin}${route}</loc><lastmod>${lastmod}</lastmod></url>`),
  '</urlset>', ''
].join('\\n'));
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\\nAllow: /\\nSitemap: ${origin}/sitemap.xml\\n`);
fs.writeFileSync(path.join(output, 'CNAME'), 'stiltzofflorida.com\\n');
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(JSON.stringify({ output, pages: routes.length }, null, 2));
