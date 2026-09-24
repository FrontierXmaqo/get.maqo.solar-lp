// Snapshots get.maqosolar.com pages into a static copy: saves the server-rendered HTML,
// downloads CSS, images and fonts into assets/, and rewrites URLs to local paths.
// The GoHighLevel/Nuxt runtime and tracking scripts are removed.
// Usage: node scripts/snapshot.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const SITE = 'https://get.maqosolar.com/';
const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';

const cache = new Map();

async function fetchBuf(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || '' };
}

function extFor(url, type) {
  if (type.includes('webp')) return '.webp';
  if (type.includes('png')) return '.png';
  if (type.includes('jpeg')) return '.jpg';
  if (type.includes('svg')) return '.svg';
  if (type.includes('gif')) return '.gif';
  if (type.includes('css')) return '.css';
  if (type.includes('woff2')) return '.woff2';
  if (type.includes('woff')) return '.woff';
  if (type.includes('icon')) return '.ico';
  const m = new URL(url).pathname.match(/\.[a-z0-9]{2,5}$/i);
  return m ? m[0] : '';
}

// Downloads url into assets/<dir>/ and returns the path relative to `from` dir.
async function localize(url, dir, fromDir = ROOT) {
  url = url.replace(/&amp;/g, '&');
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      const { buf, type } = await fetchBuf(url);
      const hash = createHash('sha1').update(url).digest('hex').slice(0, 12);
      let body = buf;
      const ext = extFor(url, type);
      const file = path.join(ROOT, 'assets', dir, hash + ext);
      if (ext === '.css') body = Buffer.from(await rewriteCss(buf.toString('utf8'), url, path.dirname(file)));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      return file;
    })().catch((e) => { console.warn('skip', e.message); return null; }));
  }
  const file = await cache.get(url);
  if (!file) return url;
  return path.relative(fromDir, file).split(path.sep).join('/');
}

async function replaceAsync(str, re, fn) {
  const jobs = [];
  str.replace(re, (...m) => { jobs.push(fn(...m)); return ''; });
  const out = await Promise.all(jobs);
  let i = 0;
  return str.replace(re, () => out[i++]);
}

function kindOf(url) {
  if (/fonts\.gstatic|\.woff2?|\.ttf|\.otf/i.test(url)) return 'fonts';
  if (/\.css|fonts\.googleapis/i.test(url)) return 'css';
  return 'img';
}

async function rewriteCss(css, base, fromDir) {
  return replaceAsync(css, /url\((['"]?)([^'")]+)\1\)/g, async (m, q, u) => {
    if (u.startsWith('data:') || u.startsWith('#')) return m;
    const abs = new URL(u.replace(/\\u002F/g, '/'), base).href;
    return `url("${await localize(abs, kindOf(abs), fromDir)}")`;
  });
}

// The crawl starts here and follows every get.maqosolar.com link. Each page is
// saved to <slug>/index.html. '-842225' is the residential page; nothing links to it.
const SEEDS = ['', '-842225', 'commercial-industry', 'career', 'let-the-sun-pay-for-you-blog', 'solar-battery-energy-storage-system'];
const LINK_RE = /href="(?:https:\/\/get\.maqosolar\.com)?\/([^"#?]*)"/g;
const raw = new Map();

const cleanSlug = (s) => decodeURI(s).replace(/\/$/, '');

async function crawl() {
  const queue = [...SEEDS];
  while (queue.length) {
    const slug = queue.shift();
    if (raw.has(slug)) continue;
    try {
      raw.set(slug, (await fetchBuf(SITE + slug)).buf.toString('utf8'));
    } catch (e) {
      console.warn('skip page', e.message);
      continue;
    }
    for (const m of raw.get(slug).matchAll(LINK_RE)) {
      const next = cleanSlug(m[1]);
      if (!raw.has(next) && !/\.[a-z0-9]{2,5}$/i.test(next)) queue.push(next);
    }
  }
}

async function snapshotPage(slug) {
  const url = SITE + slug;
  const dir = path.join(ROOT, slug);
  let html = raw.get(slug);

  // Strip the Nuxt runtime, its state blob, module preloads and GTM.
  html = html
    .replace(/<script type="application\/json" data-nuxt-data[\s\S]*?<\/script>/g, '')
    .replace(/<script>window\.__NUXT__[\s\S]*?<\/script>/g, '')
    .replace(/<script type="module"[^>]*><\/script>/g, '')
    .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '')
    .replace(/<link[^>]*href="[^"]*\.js"[^>]*>/g, '')
    .replace(/<noscript><iframe src="https:\/\/www\.googletagmanager\.com[\s\S]*?<\/noscript>/g, '')
    .replace(/<script[^>]*>[^<]*googletagmanager[\s\S]*?<\/script>/g, '');

  // Stylesheets.
  html = await replaceAsync(html, /<link([^>]*?)href="([^"]+)"([^>]*)>/g, async (m, a, href, b) => {
    const attrs = a + b;
    if (/rel="(stylesheet|icon|shortcut icon|apple-touch-icon)"/.test(attrs) || /as="style"/.test(attrs)) {
      const abs = new URL(href.replace(/&amp;/g, '&'), url).href;
      return `<link${a}href="${await localize(abs, /icon/.test(attrs) ? 'img' : 'css', dir)}"${b}>`;
    }
    if (/rel="(preconnect|dns-prefetch)"/.test(attrs)) return '';
    return m;
  });

  // Inline <style> blocks and style="" attributes.
  html = await replaceAsync(html, /(<style[^>]*>)([\s\S]*?)(<\/style>)/g, async (m, o, css, c) => o + await rewriteCss(css, url, dir) + c);
  html = await replaceAsync(html, /style="([^"]*url\([^"]*)"/g, async (m, css) =>
    `style="${(await rewriteCss(css.replace(/&quot;/g, '"'), url, dir)).replace(/"/g, '&quot;')}"`);

  // Images.
  html = await replaceAsync(html, /\b(src|data-src|poster)="(https?:[^"]+\.(?:png|jpe?g|webp|gif|svg)[^"]*|https:\/\/images\.leadconnectorhq\.com[^"]+)"/gi,
    async (m, attr, u) => `${attr}="${await localize(u, 'img', dir)}"`);
  html = await replaceAsync(html, /\b(srcset|data-srcset)="([^"]+)"/g, async (m, attr, set) => {
    const parts = await Promise.all(set.split(/,\s+(?=https?:)/).map(async (p) => {
      const [u, ...d] = p.trim().split(/\s+/);
      return [await localize(u, 'img', dir), ...d].join(' ');
    }));
    return `${attr}="${parts.join(', ')}"`;
  });

  // Internal links: crawled pages point at their local copies, others stay live.
  const rel = (s) => encodeURI((path.relative(dir, path.join(ROOT, s)).split(path.sep).join('/') || '.') + '/');
  html = html.replace(LINK_RE, (m, s) => {
    s = cleanSlug(s);
    if (raw.has(s)) return `href="${rel(s)}"`;
    return `href="https://get.maqosolar.com/${s}"`;
  });

  // assets/js/restore.js stands in for the runtime (animations, menus).
  const js = path.relative(dir, path.join(ROOT, 'assets/js/restore.js')).split(path.sep).join('/');
  html = html.replace('</body>', `<script src="${js}"></script></body>`);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
  console.log(`${slug || '/'} written`);
}

await crawl();
console.log(`${raw.size} pages found`);
for (const slug of raw.keys()) await snapshotPage(slug);
console.log(`${cache.size} assets`);
