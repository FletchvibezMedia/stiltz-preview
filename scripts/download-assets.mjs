import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'release-source');
const origin = process.argv[3] ?? 'https://stiltz-florida-rescue-replica.carolina-qua-8173.chatgpt.site';
const prefixes = ['/_next/', '/images/', '/videos/', '/brochures/', '/favicon', '/rescue-overrides', '/static-navigation'];
const queue = [];
const seen = new Set();

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

for (const file of walk(root)) discover(file);
for (let index = 0; index < queue.length; index += 1) {
  const asset = queue[index];
  const destination = path.join(root, asset);
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const response = await fetch(new URL(asset, origin));
    if (!response.ok) throw new Error(`Could not download ${asset}: ${response.status}`);
    fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  }
  discover(destination);
}
console.log(JSON.stringify({ assetsMirrored: seen.size }, null, 2));
