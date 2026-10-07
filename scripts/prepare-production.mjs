import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve(process.argv[2] ?? 'release-source');
const output = path.resolve(process.argv[3] ?? '_site');
const origin = 'https://stiltzofflorida.com';
const rescueOrigin = 'https://stiltz-florida-rescue-replica.carolina-qua-8173.chatgpt.site';

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
  html = html.replaceAll(rescueOrigin, origin);
  html = html.replace(/<meta name="robots" content="noindex, nofollow"\\s*\\/?>(?:<\\/meta>)?/gi, '<meta name="robots" content="index, follow">');
  html = html.replace(/<meta property="og:url" content="[^"]*"\\s*\\/?>(?:<\\/meta>)?/gi, `<meta property="og:url" content="${canonical}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\\s*\\/?>(?:<\\/link>)?/gi, '');
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
