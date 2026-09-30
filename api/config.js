// Public settings for the page. TURNSTILE_SITE_KEY is Cloudflare's public key,
// kept in Vercel so it can change without editing the site.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({ turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '' });
}
