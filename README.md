# GET MAQO Solar Landing Page

This repository contains a backup copy of the **GET MAQO Solar landing page**.

The original landing page is no longer accessible, so this repository was created to preserve and maintain a copy of the website.

## Purpose

The main purpose of this repository is to:

* Keep a backup of the original GET MAQO Solar landing page
* Preserve the original website design, layout, and content
* Allow the landing page to be restored or redeployed if needed
* Provide a reference for future maintenance and updates

## Website

**Original Website:** `get.maqosolar.com`

> This repository is intended to reproduce the original GET MAQO Solar landing page as closely as possible.

## Backup Scope

The backup aims to maintain:

* Original page layout
* Website styling and visual design
* Images and media assets
* Text and website content
* Interactive elements
* Responsive behaviour
* Existing landing page functionality

## Development

This repository should be treated as a **backup/archive of the original landing page**.

When making changes, avoid modifying the original design or content unless the change is intentionally required for restoration, compatibility, or maintenance.

## Deployment

The landing page can be redeployed from this repository if the original website becomes unavailable.

Before deployment, verify:

1. All required assets are included.
2. External dependencies are still available.
3. Environment variables/configuration are correctly set.
4. The deployed page matches the original GET MAQO Solar landing page.

## Notes

This repository is maintained as a backup for MAQO Solar's GET landing page.

**Original site:** `get.maqosolar.com`
**Repository purpose:** Backup / Restoration

## Snapshot

The whole site is copied as static pages. `scripts/snapshot.mjs` crawls get.maqosolar.com from the home page and the main pages, follows every internal link, and saves each page as `<slug>/index.html`. Shared CSS, images and fonts go in `assets/`. That covers 88 pages: the main pages, contact and landing pages, the blog, its posts, and its category, author and tag pages. The residential page is `-842225/`.

To regenerate them:

```bash
node scripts/snapshot.mjs
```

The script removes the GoHighLevel runtime and Google Tag Manager. `assets/js/restore.js` adds back what the page still needs: entrance animations, number counters, both mobile menu styles, image slider controls, the YouTube embeds and the forms.

To preview locally with the form functions, use the Vercel CLI:

```bash
npx vercel dev
```

Known gaps:
- All internal links are local. The exception is `/post/new-blog-post`, which also returns 404 on the live site.

## Forms

`scripts/snapshot.mjs` saves each form's fields, dropdown options and submit action into the page as `#form-meta`. `assets/js/restore.js` uses it to rebuild the dropdowns, check required fields, and post submissions to `/api/submit`. After a successful submit, forms either show their thank-you message or go to the thank-you page, the same as on the live site.

- Salutation also offers "Tun". Extra options are listed in `EXTRA_OPTIONS` in the snapshot script.
- Hidden tracking fields (`salespartner`, `maqo`, `referer`, `campaign_id`) are filled from the page URL's query string.
- The career form's résumé is sent as base64. Uploads are limited to 3 MB in total.

`api/submit.js` runs on Vercel and follows the landingpage project's `submitLead` action:
- **Checks:** a rate limit of 5 submissions per minute per IP, a hidden honeypot field, and Cloudflare Turnstile. Every dropdown value must be one of that form's real options (read from `api/_forms.json`, which the snapshot script writes).
- **Payload:** GoHighLevel's contact JSON, built by `api/_webhookTemplate.js` from landingpage's `lib/leadWebhookTemplate.ts` template (the same 115 keys). Every key this site has data for is filled.
- **Phone format:** phones are sent in WhatsApp digit format (`60123456789`).
- **Attribution:** the first-touch UTM, `gclid`, `fbclid` and referrer are captured by `restore.js` (ported from landingpage's `lib/attribution.ts`) and kept for 30 days.

Each form goes to its own webhook, with its own payload shape:

| Form | Pages | Shape | Webhook |
|---|---|---|---|
| Residential | home, `-842225`, contact, residential landing, commercial-solar, BESS Malaysia, blog | `buildLeadWebhookPayload` | `LEAD_WEBHOOK_URL` |
| C&I | commercial-industry, C&I landing, solar-battery-energy-storage-system | `buildCiLeadWebhookPayload` (Industry, Electric Bill and Role as arrays) | `CI_LEAD_WEBHOOK_URL` |
| Career | career | Template's career keys, résumé as base64 in `Upload Resume` | `CAREER_WEBHOOK_URL` |

Set these in Vercel → Project → Settings → Environment Variables. Webhook URLs must start with `https://`.

| Variable | Purpose |
|---|---|
| `LEAD_WEBHOOK_URL` | Residential leads |
| `CI_LEAD_WEBHOOK_URL` | C&I leads |
| `CAREER_WEBHOOK_URL` | Career applications |
| `TESTING_WEBHOOK_URL` | Receives every lead instead of the real webhooks while test mode is on (see below) |
| `TURNSTILE_SECRET_KEY` | Turnstile secret. The check is skipped while it is unset. (The public site key is a constant in `assets/js/restore.js`.) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | The landing page CMS Supabase project. Every real lead is also saved to `atap_leads` (residential) or `ci_leads` (C&I, BESS); those tables allow the anon role to insert only. Career applications have no table. |
| `GTM_ID` | Google Tag Manager container, loaded by `/api/tags` |
| `META_PIXEL_ID` | Meta pixel id. The loader never starts the pixel twice when the GTM container starts it too. |

To test without touching the CRM, open any page with `?test_webhook=1` (for example `https://get.maqosolar.com/?test_webhook=1`) and submit a form. This sets a `test_webhook` cookie for that domain, and every lead type then goes to `TESTING_WEBHOOK_URL`. Open any page with `?test_webhook=0` to turn it off. Each submission logs which webhook it went to in the Vercel logs.

`contact_source` is set per form type in `SOURCE_PAGE` in `api/submit.js`.

## Career page

`career/` is currently a maintenance page (career applications are switched off). The original page is in git history: restore it with `git checkout bc84bde -- career/index.html`.

## Lead storage

`api/submit.js` sends the lead to the CRM webhook, then saves it to Supabase (`atap_leads` with `segment = 'residential'`, or `ci_leads`). `extra_fields` holds what the tables have no column for (site, form id, salutation, landing page, click ids, UTM values, `webhookOk`). If the webhook fails but the row is saved, the visitor is not asked to retry; find those rows with `extra_fields->>'webhookOk' = 'false'` and re-send them. Test-mode leads (`?test_webhook=1`) are never saved.
