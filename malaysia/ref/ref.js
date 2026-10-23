// Residential sales links (?r=S02): the salesperson's code is kept for 30 days and sent with
// the form (refCode), so the Lark row gets its Ref Code. Loaded only by the residential pages;
// restore.js reads window.__maqoRef.code; the referral page also shows .name (event "maqoref").
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
    // First valid code wins: an unexpired stored code is never replaced by a newer link.
    var person = saved && find(saved.code);
    if (!person) {
      person = find(wanted);
      if (!person) return;
      try { localStorage.setItem(KEY, JSON.stringify({ code: person.code, at: Date.now() })); } catch (e) { /* this page still has it */ }
    }
    window.__maqoRef = { code: person.code, name: person.display_name || '' };
    window.dispatchEvent(new Event('maqoref'));
  }).catch(function () { /* no config: no Ref Code */ });
})();
