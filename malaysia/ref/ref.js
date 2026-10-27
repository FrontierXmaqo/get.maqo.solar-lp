// Residential sales links (?r=S02): the salesperson's code (first link opened) is kept for 30 days and sent with
// the form (refCode), so the Lark row gets its Ref Code. Loaded only by the residential pages;
// restore.js reads window.__maqoRef.code; the home page hero shows .name (referralHero below).
(function () {
  var KEY = 'maqo_ref';
  var TTL_MS = 30 * 86400000;
  window.__maqoRef = { code: '' };

  var wanted = (new URLSearchParams(location.search).get('r') || '').trim().toUpperCase();
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* blocked or corrupt */ }
  if (!saved || !(saved.at > Date.now() - TTL_MS)) saved = null;

  fetch('/malaysia/ref/salespeople.json').then(function (res) { return res.json(); }).then(function (people) {
    var find = function (code) {
      return code && people.filter(function (p) { return p.code.toUpperCase() === String(code).toUpperCase(); })[0];
    };
    // First link wins: a stored code (30 days) is never replaced by a newer link, so the lead,
    // the Lark Ref Code and the chat all stay with the salesperson whose link came first.
    var kept = saved && find(saved.code);
    var linked = find(wanted);               // the code in this page's URL, if it is a real one
    var person = kept || linked;
    if (!person) { window.__maqoRefDone = true; window.dispatchEvent(new Event('maqorefnone')); return; }
    if (!kept) {
      try { localStorage.setItem(KEY, JSON.stringify({ code: person.code, at: Date.now() })); } catch (e) { /* this page still has it */ }
    }
    // fromUrl: this page was opened from a sales link. Only then does the page show the referral design.
    window.__maqoRef = { code: person.code, name: person.display_name || '', fromUrl: !!linked };
    window.__maqoRefDone = true;
    window.dispatchEvent(new Event('maqoref'));
    if (linked) referralHero(window.__maqoRef.name);
  }).catch(function () { /* no config: no Ref Code */ window.__maqoRefDone = true; window.dispatchEvent(new Event('maqorefnone')); });

  // Home page hero for sales-link visitors: the referral headline and the salesperson's name.
  // Matched by the snapshot's own text, so other pages (no such headings) are left alone.
  function referralHero(name) {
    if (!name) return;
    [].forEach.call(document.querySelectorAll('h1'), function (h) {
      var t = h.textContent.trim();
      if (t === 'Empowering Future With Clean Energy') {
        (h.querySelector('span') || h).textContent = "You've Been Referred to MAQO Solar!";
      } else if (t.indexOf('Power your home with reliable') === 0) {
        h.textContent = 'Complete the form below to explore your solar solutions. ';
        h.appendChild(document.createElement('strong')).textContent = name;
        h.appendChild(document.createTextNode(' will be in touch with you shortly.'));
      }
    });
  }
})();
