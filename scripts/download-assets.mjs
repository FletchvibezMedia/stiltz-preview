import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'release-source');
const origin = process.argv[3] ?? 'https://stiltz-florida-rescue-replica.carolina-qua-8173.chatgpt.site';
const prefixes = ['/_next/', '/images/', '/videos/', '/brochures/', '/favicon', '/rescue-overrides', '/static-navigation'];
const queue = [];
const seen = new Set();
const unavailable = [];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    entry.isDirectory() ? walk(file, files) : files.push(file);
  }
  return files;
}
function enqueue(value) {
  if (!value || !value.startsWith('/') || !prefixes.some((prefix) => value.startsWith(prefix))) return;
  const clean = value.split('#')[0].split('?')[0];
  if (!seen.has(clean)) { seen.add(clean); queue.push(clean); }
}
function discover(file) {
  const type = path.extname(file).toLowerCase();
  if (!['.html', '.css', '.js', '.mjs'].includes(type)) return;
  const contents = fs.readFileSync(file, 'utf8');
  for (const match of contents.matchAll(/(?:href|src)=[\"']([^\"']+)[\"']/g)) enqueue(match[1]);
  for (const match of contents.matchAll(/url\((?:[\"']?)([^\"')]+)(?:[\"']?)\)/g)) enqueue(match[1]);
  for (const match of contents.matchAll(/[\"'](\/(?:_next|images|videos|brochures)\/[^\"']+)[\"']/g)) enqueue(match[1]);
}

const dynamicGalleryAssets = [
  ...['gray-living-01.jpg','gray-living-02.jpg','gray-stairwell-01.jpg','gray-stairwell-02.jpg','white-home-01.jpg','white-home-04.jpg','duo-gallery-07.jpg','duo-gallery-08.png'].map((file) => '/images/models/duo-alta/' + file),
  ...Array.from({ length: 9 }, (_, index) => '/images/models/duo-alta/white-finish/white-install-' + String(index + 1).padStart(2, '0') + '.jpg'),
  ...['drive-gray-01.jpg','drive-gray-02.jpg','drive-white-01.jpg','drive-white-02.jpg','drive-white-03.jpg','installation-07.jpg','installation-08.jpg','installation-09.jpg','installation-10.jpg','installation-11.jpg','installation-12.jpg'].map((file) => '/images/models/trio-alta/' + file),
  ...Array.from({ length: 6 }, (_, index) => '/images/models/trio-alta/full-door-option/full-door-' + String(index + 1).padStart(2, '0') + '.jpg'),
  ...['4876.jpg','4877.jpg','4879.jpg','4880.jpg','4881.jpg','4882.jpg','4885.jpg','4891.png','4892.jpg','4893.jpg','4894.jpg','4895.jpg','4925.jpg','4926.jpg','4927.jpg','4928.jpg','4929.jpg','4930.jpg','4931.jpg','4932.jpg','4933.jpg','4934.png'].map((file) => '/images/installations/landing/' + file),
  '/images/build-down/build-down-living-room.jpg','/images/build-down/build-down-detail.jpg','/images/installations/build-down/4883.jpg','/images/build-down/landing-gallery-18.jpg','/images/build-down/landing-gallery-20.jpg','/images/build-down/landing-gallery-21.jpg','/images/build-down/landing-gallery-22.jpg','/images/build-down/landing-gallery-23.jpg','/images/build-down/landing-gallery-28.jpg',
  ...['4871.png','4872.jpg','4873.jpg','4874.jpg','4875.jpg'].map((file) => '/images/installations/finishes/black/' + file),
  '/images/models/duo-alta/white-finish/white-install-01.jpg','/images/models/duo-alta/white-finish/white-install-02.jpg','/images/models/duo-alta/white-finish/white-install-05.jpg','/images/models/duo-alta/white-finish/white-install-09.jpg',
  ...['4901.png','4902.jpg','4904.jpg','4906.jpg','4907.jpg','4908.jpg','4909.jpg','4910.jpg','4911.jpg','4912.jpg','4913.jpg','4914.jpg','4915.jpg','4916.jpg','4917.jpg','4918.jpg','4919.jpg','4920.jpg','4921.png','4922.jpg'].map((file) => '/images/installations/finishes/custom-colors/' + file),
];
for (const asset of dynamicGalleryAssets) enqueue(asset);

for (const file of walk(root)) discover(file);
for (let index = 0; index < queue.length; index += 1) {
  const asset = queue[index];
  const destination = path.join(root, asset);
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const response = await fetch(new URL(asset, origin));
    if (!response.ok) {
      unavailable.push({ asset, status: response.status });
      continue;
    }
    fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  }
  discover(destination);
}
const missingGalleryAssets = dynamicGalleryAssets.filter((asset) => !fs.existsSync(path.join(root, asset)));
if (missingGalleryAssets.length) throw new Error('Missing carousel gallery assets: ' + missingGalleryAssets.join(', '));
console.log(JSON.stringify({ assetsMirrored: seen.size, unavailable }, null, 2));
