// Public settings for the page, kept in Vercel so they can change without editing the site.
//   TURNSTILE_SITE_KEY  Cloudflare Turnstile public key
//   GTM_ID              Google Tag Manager container, e.g. GTM-XXXXXXX
//   META_PIXEL_ID       Meta pixel id (digits). Leave unset when the pixel is a tag inside GTM,
//                       otherwise it would fire twice.
export default function handler(req, res) {
  const gtm = String(process.env.GTM_ID || '').trim();
  const pixel = String(process.env.META_PIXEL_ID || '').trim();
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    gtmId: /^GTM-[A-Z0-9]{4,10}$/.test(gtm) ? gtm : '',
    metaPixelId: /^\d{8,20}$/.test(pixel) ? pixel : '',
  });
}
