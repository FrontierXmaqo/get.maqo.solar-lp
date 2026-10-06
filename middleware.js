// get.maqosolar.com/homepage/... is a copy of the get.maqo.asia site (the landingpage
// repo built with basePath "/homepage"), deployed as its own Vercel project. This
// forwards those paths to it; everything else is this static site, untouched.
//
// Environment variables:
//   HOMEPAGE_ORIGIN   that project's production URL, e.g. https://landingpage-homepage.vercel.app
//   HOMEPAGE_BYPASS   its "Protection Bypass for Automation" secret: its vercel.app URLs sit
//                     behind Vercel Authentication, so without it every page is a 401
//   LP_PROXY_SECRET   shared with that project. Vercel replaces x-forwarded-for and Host on
//                     the hop between projects, so the visitor's IP and this domain go in
//                     x-maqo-client-ip / x-maqo-forwarded-host, trusted only with this secret
//                     (the forms need both: rate limit and the Turnstile hostname check).
import { rewrite } from '@vercel/functions/middleware';

export const config = {
  matcher: ['/homepage', '/homepage/:path*'],
};

export default function middleware(request) {
  const origin = process.env.HOMEPAGE_ORIGIN;
  if (!origin) return new Response('Not found', { status: 404 });

  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  // Never let a visitor supply these themselves.
  headers.delete('x-maqo-client-ip');
  headers.delete('x-maqo-forwarded-host');
  headers.delete('x-maqo-proxy-secret');

  const secret = process.env.LP_PROXY_SECRET;
  if (secret) {
    const ip = (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    if (ip) headers.set('x-maqo-client-ip', ip);
    headers.set('x-maqo-forwarded-host', url.host);
    headers.set('x-maqo-proxy-secret', secret);
  }
  if (process.env.HOMEPAGE_BYPASS) headers.set('x-vercel-protection-bypass', process.env.HOMEPAGE_BYPASS);

  return rewrite(new URL(url.pathname + url.search, origin), { request: { headers } });
}
