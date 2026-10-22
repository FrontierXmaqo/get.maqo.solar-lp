// Residential sales links (?r=S02): the salesperson's emoji pair goes at the end of every
// WhatsApp message on this page, so respond.io can assign the chat to them.
// Loaded only by the residential pages; restore.js reads window.__maqoRef.sig.
(function () {
  var KEY = 'maqo_ref';
  var TTL_MS = 30 * 86400000;
  var DEFAULT_TEXT = "Hi Maqo, I'd like a free solar quote for my home";
  window.__maqoRef = { code: '', sig: '' };

  var wanted = (new URLSearchParams(location.search).get('r') || '').trim().toUpperCase();
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* blocked or corrupt */ }
  if (!saved || !(saved.at > Date.now() - TTL_MS)) saved = null;

  fetch('/malaysia/ref/salespeople.json').then(function (res) { return res.json(); }).then(function (people) {
    var find = function (code) {
      return code && people.filter(function (p) { return p.code.toUpperCase() === String(code).toUpperCase(); })[0];
    };
    // First valid code wins: an unexpired stored code is never replaced by a newer link.
    var person = saved && find(saved.code);
    if (!person) {
      person = find(wanted);
      if (!person) return;
      try { localStorage.setItem(KEY, JSON.stringify({ code: person.code, at: Date.now() })); } catch (e) { /* this page still has it */ }
    }
    window.__maqoRef = { code: person.code, sig: person.emoji_signature };

    document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
      var url = new URL(a.href);
      var text = url.searchParams.get('text') || DEFAULT_TEXT;
      // wa.me's redirect garbles emoji (shows ��), so go straight to the page it redirects to.
      a.href = 'https://api.whatsapp.com/send?phone=' + url.pathname.replace(/\D/g, '') + '&text=' + encodeURIComponent(text + ' ' + person.emoji_signature);
    });
  }).catch(function () { /* no config: messages stay as they are */ });
})();
