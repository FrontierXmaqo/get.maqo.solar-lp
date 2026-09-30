// Receives form submissions from assets/js/restore.js and forwards them to
// the CRM webhook in GoHighLevel's contact JSON, the same way the landingpage
// project's submitLead action does. Webhook URLs stay in Vercel's
// environment and never reach the browser.
//
// Environment variables:
//   LEAD_WEBHOOK_URL      residential leads (home, residential, contact, blog forms)
//   CI_LEAD_WEBHOOK_URL   C&I leads (commercial-industry, C&I landing page, BESS)
//   CAREER_WEBHOOK_URL    career applications
//   TESTING_WEBHOOK_URL   every lead goes here instead when the browser has the
//                         cookie test_webhook=1 (set by visiting ?test_webhook=1)
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret; checks are skipped when unset
//   SUPABASE_URL          Supabase project URL. With SUPABASE_ANON_KEY, every real lead is
//   SUPABASE_ANON_KEY     also saved to the landing page CMS tables (atap_leads, ci_leads).
//                         Those tables let the anon role insert only; staff read them in the CMS.

import forms from './_forms.json' with { type: 'json' };
import { buildLeadWebhookPayload, buildCiLeadWebhookPayload, buildCareerWebhookPayload } from './_webhookTemplate.js';

// Which workflow each form belongs to. Forms not listed are residential.
const FORM_KIND = {
  'form-jQ2mVN2RQA': 'ci', // commercial-industry, commercial-and-industrial-landing-page
  'form-N2UahvzGF4': 'ci', // solar-battery-energy-storage-system (commercial bill bands)
  'form-TgCf89fCzi': 'career',
};

// Sent as contact_source, like landingpage's "MAQO Main Site" / "MAQO C&I Landing Page".
const SOURCE_PAGE = {
  resi: 'MAQO GET Landing Page',
  ci: 'MAQO GET C&I Landing Page',
  career: 'MAQO GET Career Page',
};

const WEBHOOK_ENV = { resi: 'LEAD_WEBHOOK_URL', ci: 'CI_LEAD_WEBHOOK_URL', career: 'CAREER_WEBHOOK_URL' };

// GoHighLevel field ids, stable across every page that reuses the field.
const F = {
  salutation: 'n6nUk6y6gNKKc1N9SPJG',
  location: 'jL9WuX0N3H7Da1Pdi6GS',
  propertyType: 'UDjUPaSAZ4pz2K1UA4kK',
  resiBill: 'j8uui1j6YR9xEhVpgCXx',
  electricSupply: 'ulrCiRmDZe65WUXAbHXu',
  language: 'Co4aUJUAz3RJ017uwDWg',
  companyName: 'vPXFJP5D02F99FyuQeyq',
  industry: 's7yWW2vuAo4ClIB8C0IX',
  role: 'UE5lwl3TVh4lSYiHyYr7',
  ciBill: '7y1E8uZUG2Uti6PAQaS6',
  bessBill: 'HVZq8fkaKuPLKBDbIVmy',
  position: 'OdjE8arXf9MkwJaidHp7',
  message: 'g968wZ57MKH5Qy8jq1Vu',
  salespartner: 'WI4mKAjX45RWNmgkndBD',
  maqo: '1RB2AqI58o9oUEV6TGAu',
  referer: 'vTUlK7SiiZPHrs4hGfxW',
};

const MAX_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory fixed-window rate limit, as in landingpage's lib/rateLimit.ts:
// per warm instance only, but it stops rapid-fire bursts from one client.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const buckets = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

async function verifyTurnstileToken(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification request failed', err);
    return false;
  }
}

function clean(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value ?? '').trim().slice(0, maxLength);
}

// WhatsApp digit format ("60123456789"), as landingpage stores phones.
// The browser sends E.164 from the country picker; a bare local number
// ("012…") is taken as Malaysian. Anything that isn't a Malaysian number is dropped.
function toLeadPhone(raw) {
  let digits = clean(raw, 30).replace(/\D/g, '');
  if (!clean(raw).startsWith('+') && digits.startsWith('0')) digits = '60' + digits.slice(1);
  // Malaysian numbers only: 60 plus 8 to 10 digits. The form's phone picker is locked to Malaysia too.
  return /^60\d{8,10}$/.test(digits) ? digits : '';
}

// ISO country of the phone number, from the picker ("MY"); Malaysia when the
// picker didn't report one and the number starts with 60.
function toCountry(raw, phone) {
  const iso = clean(raw, 2).toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) return iso;
  return phone.startsWith('60') ? 'MY' : '';
}

// The visitor's IANA timezone as their browser reports it, if it's a real one.
function toTimezone(raw) {
  const tz = clean(raw, 64);
  try {
    return tz ? new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone : '';
  } catch {
    return '';
  }
}

function getCookie(req, name) {
  const match = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

// The page the form was sent from, without its query string, e.g.
// "https://get.maqosolar.com/commercial-industry/". The domain comes from the
// request so it can't be spoofed; only the path is taken from the page's
// report. Falls back to the reported URL's origin when no host header is present.
function getLandingPageSource(req, reported) {
  let reportedUrl = null;
  try {
    reportedUrl = new URL(clean(reported, 500));
  } catch {
    // no usable report: domain only
  }
  const path = reportedUrl ? reportedUrl.pathname.replace(/[^\w\-./~%]/g, '') || '/' : '/';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (host) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    return `${proto}://${host}${path}`;
  }
  return reportedUrl ? reportedUrl.origin + path : '';
}

// A page URL as the browser reports it, kept with its query string like
// GoHighLevel's attribution url. Anything that isn't http(s) is dropped.
function toPageUrl(raw, hash = '') {
  try {
    const u = new URL(clean(raw, 2000));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.origin + u.pathname + u.search + hash;
  } catch {
    return '';
  }
}

// Keeps a cookie-style id only when it has the expected shape.
function toId(raw, pattern) {
  const v = clean(raw, 300);
  return pattern.test(v) ? v : '';
}

const SOCIAL_HOSTS = /(^|\.)(facebook|instagram|threads|tiktok|twitter|x|linkedin|youtube|whatsapp|t)\.(com|co)$|^(fb|lnkd|wa)\.(me|in|com)$/;
const SEARCH_HOSTS = /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|syndicatedsearch)\.[a-z.]+$|^android-app:\/\/com\.google\.android\.googlequicksearchbox$/;

// GoHighLevel's session source buckets, worked out from the click ids and referrer.
function toSessionSource(a) {
  if (a.gclid || a.gbraid || a.wbraid) return 'Paid Search';
  const src = a.utmSource.toLowerCase();
  if (['fb', 'facebook', 'ig', 'instagram', 'tiktok', 'threads'].includes(src) || a.fbclid) return 'Social media';
  if (!a.referrer) return a.utmMedium ? 'Other' : 'Direct traffic';
  let host = '';
  try {
    host = new URL(a.referrer).hostname.replace(/^(www|m|l|lm)\./, '');
  } catch {
    // opaque referrers such as android-app:// are matched as a whole below
  }
  if (SOCIAL_HOSTS.test(host)) return 'Social media';
  if (SEARCH_HOSTS.test(host) || SEARCH_HOSTS.test(a.referrer)) return 'Organic Search';
  return 'Referral';
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

// Checks each submitted value against the form's published definition and
// returns them keyed by field id, or null when anything is missing or not
// one of the options the visitor was offered.
function validate(form, submitted) {
  const values = {};
  for (const field of form.fields) {
    if (field.type === 'file_upload') continue;
    const raw = submitted[field.id];
    let value;
    if (field.type === 'multiple_options') {
      value = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((v) => clean(v));
      if (value.some((v) => !field.options.includes(v))) return null;
      if (field.required && !value.length) return null;
    } else {
      value = clean(raw, field.type === 'large_text' ? MAX_MESSAGE_LENGTH : MAX_FIELD_LENGTH);
      if (field.options && value && !field.options.includes(value)) return null;
      if (field.required && !value) return null;
    }
    values[field.id] = value;
  }
  return values;
}

// Same categories the landing page CMS stores in lead_source (google / social / direct / other).
function toLeadSource(sessionSource) {
  if (sessionSource === 'Social media') return 'social';
  if (sessionSource === 'Paid Search' || sessionSource === 'Organic Search') return 'google';
  if (sessionSource === 'Direct traffic') return 'direct';
  return 'other';
}

// The row for the CMS table that holds this kind of lead, or null when there is none
// (career applications have no table). Empty text becomes null so nullable columns stay clean.
function toLeadRow(kind, common, extra) {
  const orNull = (v) => (v === '' || v === undefined ? null : v);
  const extra_fields = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== '' && v !== undefined));
  const base = {
    full_name: common.fullName,
    phone: common.phone,
    email: orNull(common.email),
    state: orNull(common.state),
    lead_source: toLeadSource(common.sessionSource),
    campaign_id: orNull(common.campaignId),
    extra_fields,
  };
  if (kind === 'resi') {
    return { table: 'atap_leads', row: { ...base, segment: 'residential', utm_source: orNull(common.utmSource), monthly_bill_range: orNull(extra.monthlyBillRange), property_type: orNull(extra.propertyType), electric_supply: orNull(extra.electricSupply), preferred_language: orNull(extra.preferredLanguage), extra_fields: { ...extra_fields, monthlyBillRange: undefined, propertyType: undefined, electricSupply: undefined, preferredLanguage: undefined } } };
  }
  if (kind === 'ci') {
    return { table: 'ci_leads', row: { ...base, company_name: extra.companyName, industry: orNull(extra.industry), monthly_bill_range: orNull(extra.monthlyBillRange), role_in_organization: orNull(extra.roleInOrganization), extra_fields: { ...extra_fields, companyName: undefined, industry: undefined, monthlyBillRange: undefined, roleInOrganization: undefined } } };
  }
  return null;
}

// Saves the lead in Supabase (PostgREST insert as the anon role). Returns whether it was stored.
async function saveLeadToSupabase(target) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!target || !url || !key) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${target.table}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(target.row),
      signal: controller.signal,
    });
    if (!res.ok) console.error(`Supabase insert into ${target.table} responded with`, res.status);
    return res.ok;
  } catch (err) {
    console.error(`Supabase insert into ${target.table} failed`, err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function forwardToWebhook(envVar, payload) {
  const url = process.env[envVar];
  if (!url) {
    console.error(`${envVar} is not set.`);
    return false;
  }
  if (!url.startsWith('https://')) {
    console.error(`${envVar} is not an https:// URL; refusing to send.`);
    return false;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) console.error('Lead webhook responded with', res.status);
    return res.ok;
  } catch (err) {
    console.error('Lead webhook request failed', err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) return res.status(429).json({ error: 'Too many submissions. Please wait a minute.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  // Honeypot: real visitors never fill this hidden field.
  if (clean(body.website)) return res.status(200).json({ ok: true });

  const form = forms[body.formId];
  if (!form) return res.status(400).json({ error: 'Unknown form' });
  const kind = FORM_KIND[body.formId] || 'resi';

  const v = validate(form, body.fields || {});
  const phone = toLeadPhone(v && (v.phone ?? ''));
  const email = v ? v.email : '';
  if (!v || !phone || !EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Please check the form and try again.' });

  if (!(await verifyTurnstileToken(clean(body.token, 2000), clientIp))) {
    return res.status(403).json({ error: 'Verification failed. Please try again.' });
  }

  const a = body.attribution || {};
  const common = {
    salutation: v[F.salutation] || '',
    fullName: (v.full_name || v.first_name || '').replace(/[\p{Cc}\p{Cf}]/gu, ''),
    phone,
    email,
    country: toCountry(body.phoneCountry, phone),
    timezone: toTimezone(body.timezone),
    state: v[F.location] || '',
    sourceOfLeads: clean(a.referrer, 500),
    campaignId: clean(a.campaignId, 100),
    gclid: clean(a.gclid, 255),
    fbclid: clean(a.fbclid, 200),
    utmSource: clean(a.utmSource, 100),
    utmMedium: clean(a.utmMedium, 100),
    utmCampaign: clean(a.utmCampaign, 100),
    utmTerm: clean(a.utmTerm, 150),
    utmContent: clean(a.utmContent, 150),
    utmMatchtype: clean(a.utmMatchtype, 50),
    gbraid: clean(a.gbraid, 255),
    wbraid: clean(a.wbraid, 255),
    attributionUrl: toPageUrl(a.landingUrl),
    lastAttributionUrl: toPageUrl(a.pageUrl, '#' + clean(body.formId, 40)),
    fbc: toId(a.fbc, /^fb\.\d\.\d+\.[\w-]+$/),
    fbp: toId(a.fbp, /^fb\.\d\.\d+\.\d+$/),
    gaClientId: toId(a.gaClientId, /^GA\d\.\d\.\d+\.\d+$/),
    fbEventId: toId(a.fbEventId, /^[0-9a-f-]{36}$/i),
    ip: clientIp === 'unknown' ? '' : clientIp,
    userAgent: clean(req.headers['user-agent'], 500),
    sessionSource: toSessionSource({
      gclid: clean(a.gclid, 255),
      gbraid: clean(a.gbraid, 255),
      wbraid: clean(a.wbraid, 255),
      fbclid: clean(a.fbclid, 200),
      utmSource: clean(a.utmSource, 100),
      utmMedium: clean(a.utmMedium, 100),
      referrer: clean(a.referrer, 500),
    }),
    sourcePage: SOURCE_PAGE[kind],
    landingPageSource: getLandingPageSource(req, body.landingPageSource),
    salespartner: v[F.salespartner] || '',
    maqo: v[F.maqo] || '',
    referer: v[F.referer] || '',
    remarks: '',
  };

  let payload;
  if (kind === 'ci') {
    payload = buildCiLeadWebhookPayload({
      ...common,
      companyName: v[F.companyName] || '',
      industry: v[F.industry] || [],
      roleInOrganization: v[F.role] || [],
      monthlyBillRange: v[F.ciBill] || v[F.bessBill] || [],
      isBess: !!v[F.bessBill],
    });
  } else if (kind === 'career') {
    payload = buildCareerWebhookPayload({
      ...common,
      position: v[F.position] || '',
      message: v[F.message] || '',
      files: (Array.isArray(body.files) ? body.files : []).slice(0, 5).map((f) => ({
        name: clean(f.name),
        type: clean(f.type, 100),
        data: String(f.data || ''), // base64
      })),
    });
  } else {
    payload = buildLeadWebhookPayload({
      ...common,
      monthlyBillRange: v[F.resiBill] || '',
      propertyType: v[F.propertyType] || '',
      electricSupply: v[F.electricSupply] || '',
      preferredLanguage: v[F.language] || '',
    });
  }

  // A "test_webhook" cookie (set by visiting any page with ?test_webhook=1)
  // sends every lead type to TESTING_WEBHOOK_URL instead of the real CRM.
  const testMode = getCookie(req, 'test_webhook') === '1';
  const envVar = testMode ? 'TESTING_WEBHOOK_URL' : WEBHOOK_ENV[kind];
  console.log(`Lead (${kind}, ${body.formId}) -> ${envVar}`);

  const webhookOk = await forwardToWebhook(envVar, payload);

  // Real leads are also kept in the CMS database, so a failed webhook doesn't lose them.
  // Test-mode leads stay out of it. extra_fields records what the CMS has no column for.
  let saved = false;
  if (!testMode) {
    const target = toLeadRow(kind, common, {
      site: 'get.maqosolar.com',
      formId: body.formId,
      salutation: common.salutation,
      landingPage: common.attributionUrl || common.landingPageSource,
      referrer: common.sourceOfLeads,
      sessionSource: common.sessionSource,
      gclid: common.gclid,
      fbclid: common.fbclid,
      utmMedium: common.utmMedium,
      utmCampaign: common.utmCampaign,
      utmTerm: common.utmTerm,
      utmContent: common.utmContent,
      country: common.country,
      timezone: common.timezone,
      webhookOk,
      monthlyBillRange: kind === 'ci' ? [].concat(payload.customData['Monthly Electric Bill'] || '').join(', ') : payload.customData['Monthly TNB Bill'],
      propertyType: payload['Property Type (Condo/Apartment not suitable)'],
      electricSupply: payload['Electric Supply'],
      preferredLanguage: payload['Preferred Communication Language 2'],
      companyName: payload['Name of Company'],
      industry: [].concat(payload['Industry'] || '').join(', '),
      roleInOrganization: [].concat(payload['What is your role in this  organization?'] || '').join(', '),
    });
    saved = await saveLeadToSupabase(target);
    console.log(`Lead (${kind}) webhook ${webhookOk ? 'ok' : 'FAILED'}, saved ${saved ? 'yes' : 'no'}`);
  }

  // A lead that reached the database is safe, so the visitor is not asked to retry
  // (a retry would only create a duplicate). It can be re-sent from the table.
  if (!webhookOk && !saved) {
    return res.status(502).json({ error: "We couldn't send your details. Please try again." });
  }
  return res.status(200).json({ ok: true });
}
