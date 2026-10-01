// Snapshots phil.maqo.asia (Maqo's Philippines site) into a static copy in philippines/:
// saves each page as philippines/<slug>/index.html, downloads CSS, images and fonts into
// philippines/assets/, and rewrites URLs to the local copies. The GoHighLevel/Nuxt runtime,
// the Cloudflare beacon and the phone libraries' script tags are removed;
// philippines/assets/js/restore.js adds back what the pages need. Only philippines/ and
// api/_ph-forms.json are written: the Malaysia site (everything else) is never changed.
//
// Usage:
//   node scripts/snapshot-philippines.mjs                crawls the live site
//   node scripts/snapshot-philippines.mjs --saved <dir>  uses pages saved from a browser
//     ("Save page as" → "Webpage, Complete"; only the .html files are needed). Each file's
//     "saved from url" comment says which page it is. Links to pages that weren't saved
//     keep pointing at the live site.
import { mkdir, writeFile, readFile, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';

const SITE = 'https://phil.maqo.asia/';
const REPO = path.resolve(import.meta.dirname, '..');
const ROOT = path.join(REPO, 'philippines');
const MALAYSIA_ASSETS = path.join(REPO, 'assets');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
// The phone field library GoHighLevel's forms use, same version, from a public CDN.
const PHONE_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.12/js/intlTelInput.min.js';

const savedArg = process.argv.indexOf('--saved');
const SAVED_DIR = savedArg > 0 ? path.resolve(process.argv[savedArg + 1]) : null;

const hashOf = (url) => createHash('sha1').update(url).digest('hex').slice(0, 12);

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

// GoHighLevel serves the same media from several hosts; when one is out of reach, the next is tried.
// assets.cdn.filesafe.space is a CDN in front of its Cloud Storage bucket.
function mirrors(url) {
  const m = url.match(/^https:\/\/(?:assets\.)?cdn\.filesafe\.space\/([^/]+)\/media\/(.+)$/);
  return m ? [`https://storage.googleapis.com/msgsndr/${m[1]}/media/${m[2]}`] : [];
}

// images.leadconnectorhq.com/image/f_webp/q_80/r_640/u_<original> is the original as WebP at
// quality 80, at most 640px wide (never enlarged). Made here the same way when that host is out of reach.
const RESIZED = /^https:\/\/images\.leadconnectorhq\.com\/image\/f_webp\/q_(\d+)\/r_(\d+)\/u_(https?:.+)$/;

function toWebp(input, width, quality) {
  return new Promise((resolve, reject) => {
    const p = spawn('convert', ['-', '-auto-orient', '-resize', `${width}x>`, '-strip', '-quality', quality, 'webp:-']);
    const out = [];
    p.stdout.on('data', (d) => out.push(d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`convert exited with ${code}`))));
    p.stdin.end(input);
  });
}

async function download(url) {
  let firstError;
  for (const u of [url, ...mirrors(url)]) {
    try {
      return await fetchBuf(u);
    } catch (e) {
      firstError ??= e;
    }
  }
  const m = url.match(RESIZED);
  if (m) {
    const { buf } = await download(m[3]);
    return { buf: await toWebp(buf, m[2], m[1]), type: 'image/webp' };
  }
  throw firstError;
}

// The Malaysia snapshot names files the same way (sha1 of the URL), so a file it already got from
// GoHighLevel's CDN is copied as is, with the files its stylesheet points at.
let malaysiaFiles;
async function fromMalaysia(url) {
  if (!malaysiaFiles) {
    malaysiaFiles = new Map();
    for (const dir of ['css', 'img', 'fonts']) {
      for (const f of await readdir(path.join(MALAYSIA_ASSETS, dir)).catch(() => [])) malaysiaFiles.set(f.split('.')[0], `${dir}/${f}`);
    }
  }
  const rel = malaysiaFiles.get(hashOf(url));
  if (!rel) return null;
  const copy = async (r) => {
    const dest = path.join(ROOT, 'assets', r);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(MALAYSIA_ASSETS, r), dest);
    return dest;
  };
  const dest = await copy(rel);
  if (rel.endsWith('.css')) {
    for (const [, u] of (await readFile(dest, 'utf8')).matchAll(/url\("?(\.\.\/[^")?#]+)/g)) {
      await copy(path.posix.join(path.posix.dirname(rel), u)).catch((e) => console.warn('skip', e.message));
    }
  }
  return dest;
}

const cache = new Map();

// Downloads url into philippines/assets/<dir>/ and returns its path relative to `fromDir`.
async function localize(url, dir, fromDir) {
  url = url.replace(/&amp;/g, '&').replace(/\\u002F/g, '/');
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      const known = await fromMalaysia(url);
      if (known) return known;
      const { buf, type } = await download(url);
      const ext = extFor(url, type);
      const file = path.join(ROOT, 'assets', dir, hashOf(url) + ext);
      const body = ext === '.css' ? Buffer.from(await rewriteCss(buf.toString('utf8'), url, path.dirname(file))) : buf;
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

// Decodes the page's __NUXT_DATA__ blob (devalue format: a flat array where
// objects and arrays hold indices into it).
function nuxtData(html) {
  const m = html.match(/<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const a = JSON.parse(m[1]);
  const memo = new Map();
  const WRAPPERS = ['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef', 'EmptyRef', 'EmptyShallowRef'];
  function rev(i) {
    if (typeof i !== 'number' || i < 0) return undefined;
    if (memo.has(i)) return memo.get(i);
    const v = a[i];
    if (Array.isArray(v)) {
      if (WRAPPERS.includes(v[0])) { const r = rev(v[1]); memo.set(i, r); return r; }
      if (typeof v[0] === 'string' && /^[A-Z]/.test(v[0]) && v.length <= 2) return null; // Date, Set, …
      const out = [];
      memo.set(i, out);
      for (const x of v) out.push(rev(x));
      return out;
    }
    if (v && typeof v === 'object') {
      const o = {};
      memo.set(i, o);
      for (const k in v) o[k] = rev(v[k]);
      return o;
    }
    return v;
  }
  return rev(0);
}

// Pages by slug ('' is the home page, which the site also serves at /home).
const raw = new Map();
const cleanSlug = (s) => {
  s = decodeURI(s).replace(/\/$/, '').split('/').map((p) => p.trim()).join('/');
  return s === 'home' ? '' : s;
};
const LINK_RE = /href="(?:https:\/\/phil\.maqo\.asia)?\/(?!\/)([^"#?]*)([#?][^"]*)?"/g;

// The thank-you page is only reachable through a form redirect, so it is seeded too.
const SEEDS = ['', 'blogs-press-release', 'thank-you-page'];

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

async function readSaved() {
  for (const f of await readdir(SAVED_DIR)) {
    if (!/\.html?$/i.test(f)) continue;
    const html = await readFile(path.join(SAVED_DIR, f), 'utf8');
    const from = html.match(/<!-- saved from url=\(\d+\)(\S+) -->/);
    if (!from || !from[1].startsWith(SITE)) { console.warn(`skip ${f}: not saved from ${SITE}`); continue; }
    raw.set(cleanSlug(new URL(from[1]).pathname.slice(1)), html);
  }
}

// Every object in the page data that has all the given keys (blog posts, for example).
function findAll(node, keys, out = [], seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);
  if (!Array.isArray(node) && keys.every((k) => k in node)) out.push(node);
  for (const v of Object.values(node)) findAll(v, keys, out, seen);
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// A page saved from a browser points at its "<name>_files/" folder, which isn't needed: this puts back
// the URLs GoHighLevel's server sends. Images come from their <picture> sources or the blog data.
function fromSaved(html, data) {
  const fonts = [...new Set(JSON.stringify(data).match(/https:\/\/fonts\.googleapis\.com\/css[^"\\ ]*/g) || [])];
  let fontsPlaced = false;
  const body = html.indexOf('<body');
  const app = html.indexOf('<div id="__nuxt"');
  // The empty cart/quick-view drawers the runtime teleported in front of the app.
  if (body > 0 && app > body) {
    const start = html.indexOf('>', body) + 1;
    html = html.slice(0, start) + html.slice(start, app).replace(/<!--teleport (?:start )?anchor-->|<div><div class="drawer">[\s\S]*?<\/div><\/div><\/div>/g, '') + html.slice(app);
  }
  html = html
    .replace(/<!-- saved from url=[^>]*-->\s*/, '')
    .replace(/<link([^>]*?)href="\.\/[^"/]+_files\/([^"]+)"([^>]*)>/g, (m, a, name, b) => {
      if (!/rel="stylesheet"/.test(a + b)) return ''; // preload hints for the same files
      if (/^css(\(\d+\))?$/.test(name)) {
        if (fontsPlaced) return '';
        fontsPlaced = true;
        return fonts.map((u) => `<link rel="stylesheet" href="${u.replace(/&/g, '&amp;')}">`).join('');
      }
      if (/^style\.[\w-]+\.css$/.test(name)) return `<link${a}href="https://stcdn.leadconnectorhq.com/_preview/${name}"${b}>`;
      if (name === 'intlTelInput.min.css') return `<link${a}href="https://stcdn.leadconnectorhq.com/intl-tel-input/17.0.12/css/intlTelInput.min.css"${b}>`;
      return ''; // stylesheets of components the runtime loaded later (drawers, modals); page styles are inline
    });

  // <img> in a <picture>: its src is the 1200px version of the image in the <source> tags.
  html = html.replace(/(<picture\b[^>]*>)([\s\S]*?)(<\/picture>)/g, (m, open, inner, close) => {
    const src = inner.match(/srcset="(https:\/\/images\.leadconnectorhq\.com\/image\/f_webp\/q_\d+\/r_)\d+(\/u_[^"\s,]+)/);
    if (!src) return m;
    return open + inner.replace(/(<img\b[^>]*?\ssrc=")\.\/[^"/]+_files\/[^"]*"/, `$1${src[1]}1200${src[2]}"`) + close;
  });
  // Blog cards: the post's image, found by the post title in the alt text.
  const posts = findAll(data, ['title', 'imageUrl', 'urlSlug']);
  html = html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = tag.match(/\ssrc="\.\/[^"/]+_files\/[^"]*"/);
    if (!m) return tag;
    const alt = decode((tag.match(/\salt="([^"]*)"/) || [, ''])[1]).trim();
    const post = posts.find((p) => String(p.title).trim() === alt && p.imageUrl);
    if (!post) { console.warn('no original found for image', alt || m[0]); return tag; }
    return tag.replace(m[0], ` src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_${post.imageUrl}"`);
  });
  return html;
}

// Relative link from a page's folder to another page's folder.
const relDir = (dir, slug) => encodeURI((path.relative(dir, path.join(ROOT, slug)).split(path.sep).join('/') || '.') + '/');

// A phil.maqo.asia URL as the copy should link it: local when that page was copied, else live.
function linkFor(url, dir) {
  const own = url.match(/^https:\/\/phil\.maqo\.asia\/([^?#]*)([?#].*)?$/);
  if (!own) return url;
  const slug = cleanSlug(own[1]);
  return raw.has(slug) ? relDir(dir, slug) + (own[2] || '') : url;
}

// What restore.js needs to run each form: fields, options and what happens after submitting.
// The page's own submit action for the form element ("go to URL") wins over the form's default.
function formMeta(data, dir) {
  const els = data?.data?.pageData?.elements;
  if (!els) return {};
  const meta = {};
  for (const el of Object.values(els)) {
    const form = el?.formData?.form;
    if (!form?.fields) continue;
    const action = form.formAction || {};
    let redirect = '';
    if (el.extra?.action?.value === 'url') redirect = el.extra.visitWebsite?.value?.url || '';
    else if (action.actionType === '1') redirect = action.redirectUrl || '';
    meta[el.id] = {
      name: el.formData.name || form.name || el.id,
      redirect: redirect && linkFor(redirect, dir),
      thankyou: action.thankyouText || '',
      fields: form.fields.filter((f) => f.type !== 'submit').map((f) => ({
        id: f.tag || f.id,
        key: f.fieldKey || f.tag,
        label: f.label,
        type: f.type,
        required: !!f.required,
        hidden: !!f.hidden,
        query: f.hiddenFieldQueryKey || '',
        options: f.picklistOptions ? [...f.picklistOptions] : undefined,
      })),
    };
  }
  return meta;
}

// What each button does when clicked, which the runtime used to handle.
function buttonActions(data, dir) {
  const out = {};
  for (const el of Object.values(data?.data?.pageData?.elements || {})) {
    const extra = el?.extra;
    if (!el?.id || el.formData || !extra?.action?.value) continue;
    const act = extra.action.value;
    if (act === 'scroll-to-element' && extra.scrollToElement?.value) out[el.id] = { scroll: extra.scrollToElement.value };
    else if (act === 'url' && extra.visitWebsite?.value?.url) out[el.id] = { url: linkFor(extra.visitWebsite.value.url, dir), newTab: !!extra.visitWebsite.value.newTab };
    else if (act !== 'none') console.warn(`button ${el.id}: action "${act}" is not handled by restore.js`);
  }
  return out;
}

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// Every form on the site by element id; written to api/_ph-forms.json so
// api/ph-submit.js can check submissions against the real fields.
const allForms = {};
const liveLinks = new Set();

async function snapshotPage(slug) {
  const url = SITE + slug;
  const dir = path.join(ROOT, slug);
  let html = raw.get(slug);
  const data = nuxtData(html);
  if (SAVED_DIR) html = fromSaved(html, data);

  // Keep the form definitions and button actions before the Nuxt data is removed.
  const forms = formMeta(data, dir);
  Object.assign(allForms, forms);
  const actions = buttonActions(data, dir);

  // Strip every script (the Nuxt runtime and its state, the Cloudflare beacon, the phone
  // libraries, which are added back below) and the hints that preload them.
  html = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]*rel="(?:modulepreload|preconnect|dns-prefetch)"[^>]*>/g, '')
    .replace(/<link[^>]*as="script"[^>]*>/g, '')
    .replace(/<link[^>]*href="[^"]*\.js"[^>]*>/g, '');

  // Tab icon: the Maqo sun icon, as on the Malaysia site, instead of GoHighLevel's default one.
  const imgDir = path.join(ROOT, 'assets/img');
  await mkdir(imgDir, { recursive: true });
  for (const f of ['favicon.png', 'favicon.ico']) await copyFile(path.join(MALAYSIA_ASSETS, 'img', f), path.join(imgDir, f));
  const iconDir = path.relative(dir, imgDir).split(path.sep).join('/');
  html = html.replace(/<link[^>]*rel="(?:shortcut icon|icon|apple-touch-icon)"[^>]*>/g, '')
    .replace('</head>', `<link rel="icon" type="image/png" sizes="32x32" href="${iconDir}/favicon.png?v=2"><link rel="shortcut icon" href="${iconDir}/favicon.ico?v=2"></head>`);

  // Stylesheets.
  html = await replaceAsync(html, /<link([^>]*?)href="(https?:[^"]+)"([^>]*)>/g, async (m, a, href, b) => {
    if (!/rel="stylesheet"/.test(a + b) && !/as="style"/.test(a + b)) return m;
    return `<link${a}href="${await localize(new URL(href.replace(/&amp;/g, '&'), url).href, 'css', dir)}"${b}>`;
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

  // Internal links: copied pages point at their local copies, others stay live.
  html = html.replace(LINK_RE, (m, s, rest = '') => {
    s = cleanSlug(s);
    if (raw.has(s)) return `href="${relDir(dir, s)}${rest}"`;
    liveLinks.add(SITE + s);
    return `href="${SITE}${s}${rest}"`;
  });

  // restore.js stands in for the runtime: menus, button actions and the forms.
  const tags = [];
  if (Object.keys(forms).length) tags.push(`<script type="application/json" id="form-meta">${json(forms)}</script>`);
  if (Object.keys(actions).length) tags.push(`<script type="application/json" id="button-actions">${json(actions)}</script>`);
  if (/type="tel"/.test(html)) tags.push(`<script src="${PHONE_LIB}" async></script>`);
  tags.push(`<script src="${path.relative(dir, path.join(ROOT, 'assets/js/restore.js')).split(path.sep).join('/')}"></script>`);
  html = html.replace('</body>', tags.join('') + '</body>');

  const left = html.match(/\.\/[^"'\s)]+_files\/[^"'\s)]*/g);
  if (left) console.warn(`${slug || '/'}: still points at the saved files:`, [...new Set(left)].join(', '));

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
  console.log(`${slug || '/'} written`);
}

if (SAVED_DIR) await readSaved(); else await crawl();
console.log(`${raw.size} pages: ${[...raw.keys()].map((s) => '/' + s).join(', ')}`);
for (const slug of raw.keys()) await snapshotPage(slug);
await writeFile(path.join(REPO, 'api', '_ph-forms.json'), JSON.stringify(allForms, null, 2) + '\n');
console.log(`${cache.size} assets, ${Object.keys(allForms).length} forms`);
if (liveLinks.size) console.log('Not copied yet (links go to the live site):', [...liveLinks].join(', '));
