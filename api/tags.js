// Serves the tracking loader (Google Tag Manager + Meta pixel) as JavaScript, so the ids
// stay in Vercel's environment and there is no endpoint that lists them.
//   GTM_ID         GTM container, e.g. GTM-XXXXXXX
//   META_PIXEL_ID  Meta pixel id (digits). Also fine when GTM starts the same pixel: the
//                  loader checks and never starts it twice.
// The browser still sends these ids to Google and Meta when the tags load; that cannot be hidden.

// Runs in the browser. Written as a function so it is syntax-checked, then sent as text.
function tags(gtmId, pixelId) {
  var settled = false;
  var settle;
  var pixelSettled = new Promise(function (resolve) { settle = resolve; });

  function pixelExists() {
    try {
      if (!window.fbq) return false;
      if (window.fbq.getState) return window.fbq.getState().pixels.some(function (p) { return String(p.id) === pixelId; });
      if (window.fbq.queue) return window.fbq.queue.some(function (a) { return a[0] === 'init' && String(a[1]) === pixelId; });
    } catch (e) { /* treat as not started */ }
    return false;
  }
  function loadPixelStub() {
    /* Meta's standard loader; a no-op when fbq already exists */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }
  // The pixel must never run twice: only init + PageView here when GTM has not started it.
  function startPixel() {
    if (settled) return;
    settled = true;
    if (pixelId) {
      loadPixelStub();
      if (!pixelExists()) { fbq('init', pixelId); fbq('track', 'PageView'); }
    }
    settle();
  }

  window.dataLayer = window.dataLayer || [];
  if (!gtmId) {
    startPixel();
  } else {
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtmId);
    g.onerror = startPixel; // blocked (ad blocker): no container, so the pixel is ours
    document.head.appendChild(g);
    // After the window has loaded and GTM has fired its tags, see whether it started the pixel.
    var afterGtm = function () {
      window.dataLayer.push({ event: 'maqo_gtm_settled', eventCallback: startPixel, eventTimeout: 2000 });
      setTimeout(startPixel, 4000); // GTM never answered
    };
    if (document.readyState === 'complete') afterGtm(); else window.addEventListener('load', afterGtm);
  }

  // "Lead" carries the fbEventId sent to the CRM, so Meta can de-duplicate.
  window.__maqoTagsReady({
    trackLead: function (formId, eventId) {
      return pixelSettled.then(function () {
        window.dataLayer.push({ event: 'generate_lead', form_id: formId, event_id: eventId });
        if (window.fbq) fbq('track', 'Lead', {}, eventId ? { eventID: eventId } : undefined);
      });
    },
  });
}

export default function handler(req, res) {
  const gtm = String(process.env.GTM_ID || '').trim();
  const pixel = String(process.env.META_PIXEL_ID || '').trim();
  const gtmId = /^GTM-[A-Z0-9]{4,10}$/.test(gtm) ? gtm : '';
  const pixelId = /^\d{8,20}$/.test(pixel) ? pixel : '';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(`(${tags.toString()})(${JSON.stringify(gtmId)},${JSON.stringify(pixelId)});`);
}
