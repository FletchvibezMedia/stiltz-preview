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

// Keep approved production-only photo replacements stable even though the
// source release is re-mirrored on every GitHub Pages deployment.
const approvedAssetOverrides = [
  ['assets/rescue-overrides.css', 'rescue-overrides.css'],
  ['assets/duo-alta/duo-alta-thru-car-straight.jpg', 'images/models/duo-alta/professional-02.jpg'],
  ['assets/duo-thru-car/duo-thru-car-hero-straight.jpg', 'images/models/duo-thru-car/verified-hero.jpg'],
  ['assets/duo-classic/duo-classic-hero-straight.jpg', 'images/models/duo-classic/drive-hero.jpg'],
  ['assets/trio-alta/trio-alta-feature-web.jpg', 'images/models/trio-alta/drive-hero-gray.jpg'],
  ['assets/trio-alta/trio-alta-feature-web.jpg', 'images/models/trio-alta/professional-white-01.jpg'],
  ['assets/landing/5131.jpg', 'images/installations/landing/5131.jpg'],
  ['assets/landing/5132.jpg', 'images/installations/landing/5132.jpg'],
  ['assets/landing/5133.jpg', 'images/installations/landing/5133.jpg'],
  ['assets/landing/5134.jpg', 'images/installations/landing/5134.jpg'],
  ['assets/landing/5135.jpg', 'images/installations/landing/5135.jpg'],
  ['assets/landing/5136.png', 'images/installations/landing/5136.png'],
  ['assets/landing/5137.jpg', 'images/installations/landing/5137.jpg'],
  ['assets/landing/5138.jpg', 'images/installations/landing/5138.jpg'],
  ['assets/landing/5139.jpg', 'images/installations/landing/5139.jpg'],
  ['assets/landing/5140.jpg', 'images/installations/landing/5140.jpg'],
  ['assets/landing/5141.jpg', 'images/installations/landing/5141.jpg'],
  ['assets/landing/5142.jpg', 'images/installations/landing/5142.jpg'],
  ['assets/landing/5143.jpg', 'images/installations/landing/5143.jpg'],
  ['assets/landing/5144.jpg', 'images/installations/landing/5144.jpg'],
  ['assets/landing/5145.jpg', 'images/installations/landing/5145.jpg'],
  ['assets/landing/5146.jpg', 'images/installations/landing/5146.jpg'],
  ['assets/landing/5147.jpg', 'images/installations/landing/5147.jpg'],
  ['assets/landing/5148.jpg', 'images/installations/landing/5148.jpg'],
  ['assets/landing/5149.jpg', 'images/installations/landing/5149.jpg'],
  ['assets/landing/5150.jpg', 'images/installations/landing/5150.jpg'],
  ['assets/landing/5151.jpg', 'images/installations/landing/5151.jpg'],
  ['assets/landing/5152.jpg', 'images/installations/landing/5152.jpg'],
  ['assets/landing/5153-clean.jpg', 'images/installations/landing/5153.jpg'],
  ['assets/landing/5154.jpg', 'images/installations/landing/5154.jpg'],
  ['assets/landing/5155.jpg', 'images/installations/landing/5155.jpg'],
  ['assets/landing/5156.jpg', 'images/installations/landing/5156.jpg'],
  ['assets/landing/5157.jpg', 'images/installations/landing/5157.jpg'],
  ['assets/landing/5158.jpg', 'images/installations/landing/5158.jpg'],
  ['assets/landing/5159.jpg', 'images/installations/landing/5159.jpg'],
  ['assets/build-down/5123.png', 'images/installations/build-down/5123.png'],
  ['assets/build-down/5124.png', 'images/installations/build-down/5124.png'],
  ['assets/build-down/5125.jpg', 'images/installations/build-down/5125.jpg'],
  ['assets/build-down/5126.jpg', 'images/installations/build-down/5126.jpg'],
  ['assets/build-down/5127.jpg', 'images/installations/build-down/5127.jpg'],
  ['assets/build-down/5128.jpg', 'images/installations/build-down/5128.jpg'],
  ['assets/build-down/5129.jpg', 'images/installations/build-down/5129.jpg'],
  ['assets/build-down/5130.jpg', 'images/installations/build-down/5130.jpg'],
  ...Array.from({ length: 17 }, (_, index) => [
    `assets/custom-paint/custom-paint-${String(index + 1).padStart(2, '0')}.jpg`,
    `images/installations/finishes/custom-paint/custom-paint-${String(index + 1).padStart(2, '0')}.jpg`,
  ]),
];
for (const [from, to] of approvedAssetOverrides) {
  const sourceAsset = path.resolve(from);
  if (!fs.existsSync(sourceAsset)) {
    throw new Error(`Missing approved asset override: ${from}`);
  }
  const destinationAsset = path.join(output, to);
  fs.mkdirSync(path.dirname(destinationAsset), { recursive: true });
  fs.copyFileSync(sourceAsset, destinationAsset);
}

const runtimePatch = '<script>(function(){if(!location.hostname.endsWith("github.io"))return;var prefix="/stiltz-preview";function patch(node,attr){var value=node.getAttribute(attr);if(value&&value.charAt(0)==="/"&&value.indexOf(prefix+"/")!==0)node.setAttribute(attr,prefix+value)}function scan(root){if(!root.querySelectorAll)return;root.querySelectorAll("a[href],img[src],source[src],script[src]").forEach(function(node){patch(node,node.tagName==="A"?"href":"src")})}document.addEventListener("DOMContentLoaded",function(){scan(document);new MutationObserver(function(records){records.forEach(function(record){if(record.type==="attributes")patch(record.target,record.attributeName);else record.addedNodes.forEach(scan)})}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["href","src"]})})}())</script>';

const navigationFile = path.join(output, 'static-navigation.js');
if (fs.existsSync(navigationFile)) {
  let navigation = fs.readFileSync(navigationFile, 'utf8');
  navigation = navigation.replace(
    "['Testimonials', '/testimonials/'], ['Videos', '/videos/'], ['Stiltz news', '/stiltz-news/'],",
    "['Testimonials', '/testimonials/'], ['Custom Paint', '/custom-colors/'], ['Videos', '/videos/'], ['Stiltz news', '/stiltz-news/'],",
  );
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
  navigation = navigation.replace(/const landingImages = \[[\s\S]*?\n\]\.map\(\(file\) => `\/images\/installations\/landing\/\$\{file\}`\);/, `const landingImages = [
  '5131.jpg', '5132.jpg', '5133.jpg', '5134.jpg', '5135.jpg', '5136.png', '5137.jpg', '5138.jpg', '5139.jpg', '5140.jpg',
  '5141.jpg', '5142.jpg', '5143.jpg', '5144.jpg', '5145.jpg', '5146.jpg', '5147.jpg', '5148.jpg', '5149.jpg', '5150.jpg',
  '5151.jpg', '5152.jpg', '5153.jpg', '5154.jpg', '5155.jpg', '5156.jpg', '5157.jpg', '5158.jpg', '5159.jpg',
].map((file) => \`/images/installations/landing/\${file}\`);`);
  navigation = navigation.replace(/const buildDownImages = \[[\s\S]*?\n\];/, `const buildDownImages = [
  '/images/installations/build-down/5123.png', '/images/installations/build-down/5124.png',
  '/images/installations/build-down/5125.jpg', '/images/installations/build-down/5126.jpg',
  '/images/installations/build-down/5127.jpg', '/images/installations/build-down/5128.jpg',
  '/images/installations/build-down/5129.jpg', '/images/installations/build-down/5130.jpg',
];`);
  navigation = navigation.replace(/const customColorImages = \[[\s\S]*?\n\]\.(?:map\([^\n]*\))?;/, `const customPaintImages = Array.from({ length: 17 }, (_, index) =>
  \`/images/installations/finishes/custom-paint/custom-paint-\${String(index + 1).padStart(2, '0')}.jpg\`);`);
  navigation = navigation
    .replace("'/stiltz-duo-alta-new-model/': [duoImages, whiteDuoImages],", "'/stiltz-duo-alta-new-model/': [duoImages],")
    .replace("'/custom-colors/': [customColorImages],", "'/custom-colors/': [customPaintImages],");
  navigation += `

// A normal static-page navigation should never leave a desktop <details>
// menu visually open while the browser moves to its next document.
document.addEventListener('click', (event) => {
  const link = event.target.closest('.desktop-nav details a[href]');
  if (!link) return;
  document.querySelectorAll('.desktop-nav details[open]').forEach((menu) => { menu.open = false; });
}, true);

document.addEventListener('DOMContentLoaded', () => {
  const menus = [...document.querySelectorAll('.desktop-nav details')];
  menus.forEach((menu) => menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    menus.forEach((other) => { if (other !== menu) other.open = false; });
  }));
});
`;
  fs.writeFileSync(navigationFile, navigation);
}

const buildStamp = Date.now().toString();
const routes = [];
for (const file of walk(output).filter((file) => file.endsWith('index.html'))) {
  const relative = path.relative(output, file).split(path.sep).join('/');
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/index\.html$/, '')}`;
  const canonical = `${origin}${route}`;
  routes.push(route);
  let html = fs.readFileSync(file, 'utf8');
  // Version the cleaned Trio Alta photo URLs so visitors are not held to an
  // older cached version of the same filenames.
  html = html
    .replaceAll('rescue-overrides.css', 'rescue-overrides.css?v=custom-paint-v1')
    .replaceAll('images/models/duo-alta/professional-02.jpg', 'images/models/duo-alta/professional-02.jpg?v=duo-alta-straight-v1')
    .replaceAll('images/models/duo-thru-car/verified-hero.jpg', 'images/models/duo-thru-car/verified-hero.jpg?v=duo-thru-car-straight-v1')
    .replaceAll('images/models/trio-alta/drive-hero-gray.jpg', 'images/models/trio-alta/drive-hero-gray.jpg?v=trio-clean-v3')
    .replaceAll('images/models/trio-alta/professional-white-01.jpg', 'images/models/trio-alta/professional-white-01.jpg?v=trio-clean-v3')
    .replaceAll('images/models/duo-classic/drive-hero.jpg', 'images/models/duo-classic/drive-hero.jpg?v=classic-portrait-v4');
  if (route === '/stiltz-duo-alta-new-model/') {
    html = html
      .replace(/<section class="duo-white-finish-option">[\s\S]*?<\/section>(?=<section class="alta-story">)/, '')
      .replace(
        'Available in gray and white. White was recently added, and custom paint is available.',
        'The standard factory finish is gray. Custom Paint is available as part of your project plan.',
      );
  }
  if (route === '/custom-colors/') {
    html = html
      .replaceAll('Custom colors', 'Custom Paint')
      .replaceAll('Custom-color', 'Custom Paint')
      .replaceAll('custom-colored', 'custom-painted')
      .replace('A lift can match the character of the home.', 'Custom Paint makes the lift part of the home.')
      .replace('These completed projects show how custom-painted Stiltz lifts can be integrated into a home with more intention. Available finishes are confirmed with the Stiltz of Florida team for the selected model and project.', 'These completed Florida projects show how a custom-painted Stiltz lift can be tailored to the home around it. Color and finish availability are confirmed with the Stiltz of Florida team for the selected model and project.')
      .replace('Real custom-color installations', 'Real Custom Paint installations')
      .replace('Use the arrows to explore the full-color collection. Every image is a real installation—not a mocked-up finish.', 'Use the arrows to explore real Custom Paint installations. Every image is a completed Florida home—not a mocked-up finish.')
      .replace('aria-label="Custom Paint home lift photo gallery"', 'aria-label="Custom Paint home lift photo gallery"');
  }
  html = html.replace(
    /(<a href=("|')(?:\.\/)?videos\/\2>Videos<\/a>)/,
    '<a href="custom-colors/">Custom Paint</a>$1',
  );
  html = html.split(rescueOrigin).join(origin);
  // The rescue export's financing video is hosted on the retained staging
  // release. Point directly at that MP4 instead of the new static origin,
  // where an unknown /videos route would return the homepage HTML.
  html = html.replaceAll(`${origin}/videos/stiltz-financing-overview.mp4`, `${rescueOrigin}/videos/stiltz-financing-overview.mp4`);
  html = html.replaceAll('content="noindex, nofollow"', 'content="index, follow"');
  html = html.replace(/<meta property="og:url" content="[^"]*"[^>]*>/gi, `<meta property="og:url" content="${canonical}">`);
  // Serve the same artifact both from the GitHub project preview and, later,
  // from the custom domain root. Relative URLs follow this runtime base.
  html = html.replace(/\b(href|src|action)=("|')\/(?!\/)([^"']*)\2/gi, (_match, name, quote, url) => `${name}=${quote}${url || './'}${quote}`);
  html = html.replace('<head>', '<head><script>(function(){var b=document.createElement("base");b.href=location.hostname.endsWith("github.io")?"/stiltz-preview/":"/";document.head.appendChild(b)}())</script>');
  html = html.replace(/static-navigation\.js\?v=[^"']+/i, `static-navigation.js?v=${buildStamp}`);
  html = html.replace(/(<script src=(\"|')static-navigation\.js[^>]*><\/script>)/i, `$1${runtimePatch}`);
  if (html.includes('<behold-widget')) {
    html = html.replace('</head>', `<script type="module" src="https://w.behold.so/widget.js" data-behold-widget></script>\n<style>.instagram-feed-widget{background:#fff;border:1px solid #ced9d4;border-radius:28px;padding:20px;box-shadow:0 16px 38px rgba(37,48,47,.10);overflow:hidden}.instagram-feed-widget behold-widget{display:block;width:100%;min-height:300px}@media(max-width:640px){.instagram-feed-widget{border-radius:22px;padding:12px}}</style>\n</head>`);
  }
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
