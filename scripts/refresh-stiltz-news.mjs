import fs from 'node:fs';
import path from 'node:path';

const endpoint = 'https://www.stiltzlifts.com/wp-json/wp/v2/posts?per_page=12';
const destination = path.resolve('assets/stiltz-news-feed.json');

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–').replace(/&#8216;/g, '‘').replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”').replace(/&nbsp;/g, ' ');
}

function plainText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\[&hellip;\]|&hellip;/g, '…'))
    .replace(/\s+/g, ' ').trim();
}

const response = await fetch(endpoint, {
  headers: { 'user-agent': 'Stiltz of Florida news sync (website refresh)' },
});
if (!response.ok) throw new Error(`Official Stiltz News returned ${response.status}`);

const posts = await response.json();
const feed = {
  source: 'https://www.stiltzlifts.com/stiltz-news/',
  fetchedAt: new Date().toISOString(),
  items: posts.map((post) => ({
    title: plainText(post.title?.rendered ?? ''),
    excerpt: plainText(post.excerpt?.rendered ?? '').slice(0, 220),
    date: post.date,
    url: post.link,
  })),
};

fs.writeFileSync(destination, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Refreshed ${feed.items.length} official Stiltz News articles.`);
