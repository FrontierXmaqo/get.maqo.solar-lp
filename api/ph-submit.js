// Receives form submissions from the Philippines copy (philippines/assets/js/restore.js)
// and forwards them to the Philippines lead webhook in GoHighLevel's contact JSON, the same
// shape the Malaysia site's leads have (api/_webhookTemplate.js). The webhook URL stays in
// Vercel's environment and never reaches the browser. The Malaysia handler, api/submit.js,
// is separate; the checks below are copied from it.
//
// Environment variables:
//   PH_LEAD_WEBHOOK_URL   leads from both Philippines forms (FREE Consultation, and
//                         Co-Investors, EPCs & Landowners)
//   LARK_WEBHOOK_URL      Lark Base workflow webhook ("When a webhook is received"); gets
//                         every lead as a flat record (see toLarkRecord). Either webhook
//                         can be left unset; the lead goes to whichever are set.
//   TESTING_WEBHOOK_URL   the CRM lead goes here instead when the browser has the cookie
//                         test_webhook=1 (set by visiting any page with ?test_webhook=1);
//                         Lark still gets it, with test_lead "Yes"
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret, shared with the Malaysia site;
//                         checks are skipped when unset
//
// Philippine leads are not saved to the Malaysia site's Supabase tables.

import forms from './_ph-forms.json' with { type: 'json' };
import { buildCiLeadWebhookPayload } from './_webhookTemplate.js';

// Sent as contact_source.
const SOURCE_PAGE = 'MAQO Philippines Website';

// GoHighLevel field ids, the same custom fields the Malaysia forms use.
const F = {
  companyName: 'vPXFJP5D02F99FyuQeyq',
  siteLocation: 'BHVAa4Nzg0oXDtd4LNFH',
  details: 'XofuwE6yYXeTMt1NqP7G',
  salespartner: 'WI4mKAjX45RWNmgkndBD',
  bizpartner: 'nnrTLGESGUwIl9RKRY9o',
  maqo: '1RB2AqI58o9oUEV6TGAu',
};

const MAX_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory fixed-window rate limit: per warm instance only, but it stops
// rapid-fire bursts from one client.
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

// WhatsApp digit format ("639171234567"). The browser sends E.164 from the country picker,
// which starts on the Philippines but allows any country, like the live form; a bare local
// number ("0917…") is taken as Philippine.
function toLeadPhone(raw) {
  const value = clean(raw, 30);
  let digits = value.replace(/\D/g, '');
  if (!value.startsWith('+') && digits.startsWith('0')) digits = '63' + digits.slice(1);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

// ISO country of the phone number, from the picker ("PH"); the Philippines when the
// picker didn't report one and the number starts with 63.
function toCountry(raw, phone) {
  const iso = clean(raw, 2).toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) return iso;
  return phone.startsWith('63') ? 'PH' : '';
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
// "https://get.maqosolar.com/philippines/". The domain comes from the request so it
// can't be spoofed; only the path is taken from the page's report.
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

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Please check the form and try again.' });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (clean(body.website)) return res.status(200).json({ ok: true });

  const form = forms[body.formId];
  if (!form) return res.status(400).json({ error: 'Unknown form' });

  const v = validate(form, body.fields || {});
  const phone = toLeadPhone(v && (v.phone ?? ''));
  const email = v ? v.email : '';
  if (!v || !phone || !EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Please check the form and try again.' });

  if (!(await verifyTurnstileToken(clean(body.token, 2000), clientIp))) {
    return res.status(403).json({ error: 'Verification failed. Please try again.' });
  }

  const a = body.attribution || {};
  const siteLocation = v[F.siteLocation] || '';
  const details = v[F.details] || '';
  const payload = buildCiLeadWebhookPayload({
    salutation: '',
    fullName: (v.full_name || '').replace(/[\p{Cc}\p{Cf}]/gu, ''),
    phone,
    email,
    country: toCountry(body.phoneCountry, phone),
    timezone: toTimezone(body.timezone),
    state: siteLocation,
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
    sourcePage: SOURCE_PAGE,
    landingPageSource: getLandingPageSource(req, body.landingPageSource),
    salespartner: v[F.salespartner] || '',
    maqo: v[F.maqo] || '',
    referer: '',
    remarks: '',
    companyName: v[F.companyName] || '',
    industry: [],
    roleInOrganization: [],
    monthlyBillRange: [],
    isBess: false,
  });
  // The Philippines forms' own fields, under the template's keys for them.
  payload['Site Location'] = siteLocation;
  payload['Details'] = details;
  payload['bizpartner'] = v[F.bizpartner] || '';
  payload.customData['Site Location'] = siteLocation;
  payload.customData['Details'] = details;
  payload.customData['Form'] = form.name;

  // A "test_webhook" cookie (set by visiting any page with ?test_webhook=1)
  // sends the CRM lead to TESTING_WEBHOOK_URL instead; Lark still gets it, marked as a test.
  const testMode = getCookie(req, 'test_webhook') === '1';
  const sends = [];
  const crmEnv = testMode ? 'TESTING_WEBHOOK_URL' : 'PH_LEAD_WEBHOOK_URL';
  if (process.env[crmEnv]) sends.push(forwardToWebhook(crmEnv, payload));
  if (process.env.LARK_WEBHOOK_URL) {
    sends.push(forwardToWebhook('LARK_WEBHOOK_URL', toLarkRecord({
      payload, form, siteLocation, details, testMode,
      bizpartner: v[F.bizpartner] || '',
      sessionSource: payload.attributionSource.sessionSource || '',
    })));
  }
  if (!sends.length) {
    console.error(`Lead (ph, ${body.formId}) not sent: neither ${crmEnv} nor LARK_WEBHOOK_URL is set.`);
    return res.status(502).json({ error: "We couldn't send your details. Please try again." });
  }
  const results = await Promise.all(sends);
  console.log(`Lead (ph, ${body.formId}) -> ${[process.env[crmEnv] && crmEnv, process.env.LARK_WEBHOOK_URL && 'LARK_WEBHOOK_URL'].filter(Boolean).join(' + ')}: ${results.map((ok) => (ok ? 'ok' : 'FAILED')).join(', ')}`);

  // One destination that took the lead is enough; a retry would only duplicate it there.
  if (!results.some(Boolean)) {
    return res.status(502).json({ error: "We couldn't send your details. Please try again." });
  }
  return res.status(200).json({ ok: true });
}

// The flat record sent to the Lark Base workflow ("When a webhook is received" → "Add record"):
// one key per table column, all plain text, so each maps straight onto a column.
function toLarkRecord({ payload, form, siteLocation, details, bizpartner, sessionSource, testMode }) {
  const submittedAt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(',', '');
  return {
    name: payload.full_name,
    company: payload['Name of Company'],
    phone: payload.phone ? '+' + payload.phone : '',
    email: payload.email,
    site_location: siteLocation,
    details,
    form: form.name,
    country: payload.country,
    lead_source: sessionSource,
    utm_source: payload.customData['UTM Source'],
    utm_medium: payload.customData['UTM Medium'],
    utm_campaign: payload.customData['UTM Campaign'],
    sales_partner: payload.salespartner,
    biz_partner: bizpartner,
    maqo: payload.MAQO,
    page_url: payload.customData['Landing Page Source'],
    submitted_at: submittedAt, // Philippine time, "2026-10-01 15:04"
    test_lead: testMode ? 'Yes' : 'No',
  };
}
