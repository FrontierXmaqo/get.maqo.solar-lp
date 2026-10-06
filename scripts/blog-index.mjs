// Builds assets/blog-posts.json from the saved blog pages, so assets/js/restore.js can page
// through every saved post (the blog list's page numbers) and load more stories on the blog
// landing page. The live site loaded these from GoHighLevel; the snapshot only kept the
// first page of each list. Run after scripts/snapshot.mjs:
//
//   node scripts/blog-index.mjs
//
// Each post keeps the card markup the live site used: the list card is taken from a saved
// list page when one shows the post (else built from another card), the compact item from
// the blog landing page likewise. Paths are made root-relative so a card works on any page.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// The element starting at `start` (an opening <div), up to its matching </div>.
function element(html, start) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (!depth) return html.slice(start, re.lastIndex);
  }
  throw new Error('unbalanced div');
}
function elements(html, marker) {
  const out = [];
  for (let i = html.indexOf(marker); i >= 0; i = html.indexOf(marker, i + 1)) out.push(element(html, i));
  return out;
}

// "../../assets/img/x.webp" → "/assets/img/x.webp", relative to the page the markup came from.
function rootRelative(html, pageDir) {
  return html.replace(/(href|src|srcset)="([^"]+)"/g, (all, attr, url) => {
    if (/^(https?:|mailto:|tel:|#|\/|data:)/.test(url)) return all;
    return `${attr}="${path.posix.normalize('/' + pageDir + '/' + url)}"`;
  });
}

const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const slugOf = (href) => (href.match(/\/post\/([^/]+)\//) || [])[1];

// Cards as the saved list pages show them.
const listPages = ['solar-pv-self-consumption'];
for (const kind of ['tag', 'category', 'author']) {
  const dir = path.join(ROOT, 'solar-pv-self-consumption', kind);
  if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir)) listPages.push(`solar-pv-self-consumption/${kind}/${d}`);
}
const listCards = {};
for (const dir of listPages) {
  for (const card of elements(read(dir + '/index.html'), '<div class="blog-post-wrapper-list">')) {
    const html = rootRelative(card, dir);
    const slug = slugOf(html);
    if (slug && !listCards[slug]) listCards[slug] = html;
  }
}
const compactCards = {};
for (const item of elements(read('let-the-sun-pay-for-you-blog/index.html'), '<div class="blog-item blog-column">')) {
  const html = rootRelative(item, 'let-the-sun-pay-for-you-blog');
  const slug = slugOf(html);
  if (slug && !compactCards[slug]) compactCards[slug] = html;
}
const listTemplate = Object.values(listCards)[0];
const compactTemplate = Object.values(compactCards)[0];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const posts = [];
for (const slug of fs.readdirSync(path.join(ROOT, 'post'))) {
  const file = `post/${slug}/index.html`;
  if (!fs.existsSync(path.join(ROOT, file))) continue;
  const html = read(file);
  const title = text((html.match(/<h1[^>]*blog-content-title[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const dateText = text((html.match(/class="blog-date">([^<]*)</) || [])[1] || '');
  const readTime = text((html.match(/class="blog-read-time">([^<]*)</) || [])[1] || '');
  const category = text((html.match(/class="blog-category">[\s\S]*?<a[^>]*>([^<]*)<\/a>/) || [])[1] || '');
  const description = text((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  const tags = [...new Set([...html.matchAll(/href="[^"]*\/tag\/([^/"]+)\/"/g)].map((m) => decodeURIComponent(m[1])))];
  const cover = (html.match(/class="blog-cover-image-container">([\s\S]*?)<\/picture>/) || [])[1] || '';
  const image = rootRelative((cover.match(/<img[^>]*src="([^"]+)"/) || [])[0] || '', `post/${slug}`).match(/src="([^"]+)"/)?.[1] || '';
  const date = new Date(dateText + ' UTC');
  if (!title || isNaN(date)) { console.warn(`skipping ${slug}: no title or date`); continue; }
  const href = `/post/${slug}/`;
  const ddmmyyyy = date.toISOString().slice(0, 10).split('-').reverse().join('/');

  let card = listCards[slug];
  if (!card) {
    // Same markup as a saved card, with this post's title, link, image, date, description and tags.
    card = listTemplate
      .replace(/href="\/post\/[^"]+"/g, `href="${href}"`)
      .replace(/<picture[\s\S]*?<\/picture>/, `<picture class="hl-image-picture h-100 w-100" style="display:block;"><img src="${image}" alt="${esc(title)}" style="object-fit:cover;" class="blog-image-corner blog-standard-image-mobile hl-optimized mw-100" loading="lazy"></picture>`)
      .replace(/(<a class="no-text-decoration"[^>]*>)[\s\S]*?(<\/a>)/, `$1${esc(title)}$2`)
      .replace(/Published on: [0-9/]+/, `Published on: ${ddmmyyyy}`)
      .replace(/(<p class="blog-description[^"]*">)[\s\S]*?(<\/p>)/, `$1${esc(description)}$2`)
      .replace(/(<div class="flex flex-wrap"><!--\[-->)[\s\S]*?(<!--\]--><\/div>)/, `$1${tags.map((t) => `<span class="blog-tag bg-gray-200 text-gray-700 rounded-full px-2 py-1 text-xs mr-2 mb-2 font-sans">${esc(t)}</span>`).join('')}$2`);
  }
  let compact = compactCards[slug];
  if (!compact) {
    const short = description.length > 200 ? description.slice(0, 200).replace(/\s+\S*$/, '') + '...' : description;
    compact = compactTemplate
      .replace(/href="\/post\/[^"]+"/g, `href="${href}"`)
      .replace(/(<a aria-label=")[^"]*(" href="[^"]*">)[\s\S]*?(<\/a><\/strong>)/, `$1${esc(title)}$2${esc(title)}$3`)
      .replace(/(<p class="blog-item-description">)[\s\S]*?(<a aria-label="...more")/, `$1${esc(short)} $2`)
      .replace(/(<p class="blog-item-category"><!--\[--><span>)[^<]*(<\/span>)/, `$1${esc(category)} $2`)
      .replace(/(class="blog-item-date">)[^<]*/, `$1${dateText}`)
      .replace(/(class="blog-item-read-time">)[^<]*/, `$1${readTime}`)
      .replace(/<img src="[^"]*" alt="[^"]*"/, `<img src="${image}" alt="${esc(title)}"`);
  }
  posts.push({ slug, href, title, date: date.toISOString().slice(0, 10), category, tags, card, compact });
}

posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
fs.writeFileSync(path.join(ROOT, 'assets/blog-posts.json'), JSON.stringify(posts));
console.log(`${posts.length} posts → assets/blog-posts.json (${Object.keys(listCards).length} list cards and ${Object.keys(compactCards).length} compact items from saved pages)`);
