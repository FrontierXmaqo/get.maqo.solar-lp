// Replaces the bits of the GoHighLevel runtime the Philippines copy still needs.
// Based on the Malaysia site's assets/js/restore.js; forms post to /api/ph-submit and
// the phone field starts on the Philippines. The live site has no tracking tags, so none load.

// Entrance animations: elements ship with opacity:0 and a data-animation-class
// that the runtime applies when they scroll into view.
(function () {
  var pending = Array.prototype.slice.call(document.querySelectorAll('[data-animation-class*="animate__"]'));
  function reveal(el) {
    el.style.opacity = '';
    el.getAttribute('data-animation-class').split(/\s+/).forEach(function (c) {
      if (c) el.classList.add(c);
    });
  }
  function check() {
    var limit = window.innerHeight * 0.95;
    pending = pending.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < limit && r.bottom > 0) { reveal(el); return false; }
      return true;
    });
    if (!pending.length) {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
  }
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  check();
})();

// Mobile menu: the icon opens #nav-menu-popup filled with the nav links.
(function () {
  var popup = document.getElementById('nav-menu-popup');
  if (!popup) return;
  var list = popup.querySelector('.nav-menu');
  function close() {
    popup.classList.remove('show');
    setTimeout(function () { popup.style.display = 'none'; }, 300);
  }
  document.querySelectorAll('.nav-menu-mobile .menu-icon').forEach(function (icon) {
    function open() {
      var src = icon.closest('.nav-menu-mobile').parentNode.querySelector('.nav-menu');
      if (src) list.innerHTML = src.innerHTML;
      popup.style.display = 'block';
      requestAnimationFrame(function () { popup.classList.add('show'); });
    }
    icon.addEventListener('click', open);
    icon.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  popup.querySelector('.close-menu').addEventListener('click', close);
  list.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
})();

// Mobile menu (v2): the toggle shows .nav-menu-desktop as a full-screen panel.
(function () {
  document.querySelectorAll('.c-nav-menu-v2').forEach(function (nav) {
    var panel = nav.querySelector('.nav-menu-desktop');
    var toggle = nav.querySelector('.nav-menu-mobile');
    var x = nav.querySelector('.x-icon [role="button"]');
    if (!panel || !toggle) return;
    function set(open) { panel.classList.toggle('hide-popup', !open); }
    toggle.addEventListener('click', function () { set(true); });
    if (x) x.addEventListener('click', function () { set(false); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  });
})();

// Buttons: what each one does when clicked (scroll to a form, open a page), from the
// #button-actions JSON that scripts/snapshot-philippines.mjs saves from the live page.
(function () {
  var el = document.getElementById('button-actions');
  if (!el) return;
  var ACTIONS = JSON.parse(el.textContent);
  Object.keys(ACTIONS).forEach(function (id) {
    var action = ACTIONS[id];
    var button = document.getElementById(id + '_btn') || document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', function (e) {
      if (action.scroll) {
        var target = document.getElementById(action.scroll);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (action.url) {
        e.preventDefault();
        if (action.newTab) window.open(action.url, '_blank', 'noopener');
        else location.href = action.url;
      }
    });
  });
})();

// Ad-campaign attribution, as on the Malaysia site (ported from the landingpage project's
// lib/attribution.ts). UTM params and click ids only exist on the page an ad links to, so
// they are captured on the first page of the visit and kept for 30 days. First touch wins:
// later visits never overwrite them. Stored under its own keys so the two sites, which share
// a domain, don't take each other's. The cookie carries no data; its absence means the
// stored attribution has expired.
var attribution = (function () {
  var STORAGE_KEY = 'maqo_ph_attribution';
  var TTL_COOKIE = 'maqo_ph_attribution_ttl';
  var TTL_DAYS = 30;
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_matchtype'];
  var CLICK_IDS = ['gclid', 'fbclid', 'gbraid', 'wbraid'];
  var EXCLUDED_REFERRER_HOSTS = ['vercel.app', 'vercel.com'];

  // The referring site's origin (https://l.facebook.com, android-app://…), blank for direct traffic, our own domain or Vercel.
  function externalReferrer() {
    if (!document.referrer) return '';
    try {
      var url = new URL(document.referrer);
      if (url.hostname === location.hostname) return '';
      if (EXCLUDED_REFERRER_HOSTS.some(function (s) { return url.hostname === s || url.hostname.slice(-s.length - 1) === '.' + s; })) return '';
      // Non-http schemes (android-app://com.google.android.googlequicksearchbox) have an opaque origin of "null".
      return url.origin !== 'null' ? url.origin : url.protocol + '//' + url.host;
    } catch (e) { return ''; }
  }
  function read() {
    var stores = [function () { return localStorage; }, function () { return sessionStorage; }];
    for (var i = 0; i < stores.length; i++) {
      try { var raw = stores[i]().getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* blocked or corrupt */ }
    }
    return null;
  }
  function write(data) {
    var raw = JSON.stringify(data);
    try { localStorage.setItem(STORAGE_KEY, raw); } catch (e) { /* sessionStorage still has it */ }
    try { sessionStorage.setItem(STORAGE_KEY, raw); } catch (e) { /* best effort */ }
  }
  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }
  function fromUrl() {
    var params = new URLSearchParams(location.search);
    var data = { referrer: externalReferrer(), captured_at: new Date().toISOString(), landing_url: location.origin + location.pathname + location.search };
    UTM.concat(CLICK_IDS).forEach(function (k) { data[k] = params.get(k) || ''; });
    return data;
  }

  try {
    var ttlValid = document.cookie.split('; ').some(function (c) { return c === TTL_COOKIE || c.indexOf(TTL_COOKIE + '=') === 0; });
    var existing = read();
    if (existing && !ttlValid) { clear(); existing = null; }
    if (!existing) {
      var data = fromUrl();
      var hasSignal = UTM.concat(CLICK_IDS).some(function (k) { return data[k]; }) || data.referrer;
      if (hasSignal) {
        write(data);
        document.cookie = TTL_COOKIE + '=1; Max-Age=' + TTL_DAYS * 86400 + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
      }
    }
  } catch (e) { /* tracking must never break the page */ }

  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  // Meta's _fbc cookie when a pixel set one, else built from the fbclid the same way ("fb.1.<ms>.<fbclid>").
  function fbc(a) {
    if (cookie('_fbc')) return cookie('_fbc');
    var ts = Date.parse(a.captured_at);
    return a.fbclid && ts ? 'fb.1.' + ts + '.' + a.fbclid : '';
  }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
    return '';
  }

  // What a form sends at submit time. campaign_id in the URL always wins.
  return function resolve() {
    var a = read() || fromUrl();
    var params = new URLSearchParams(location.search);
    return {
      campaignId: params.get('campaign_id') || a.utm_campaign || a.gclid || '',
      gclid: a.gclid || '',
      fbclid: a.fbclid || '',
      referrer: a.referrer || '',
      utmSource: a.utm_source || '',
      utmMedium: a.utm_medium || '',
      utmCampaign: a.utm_campaign || '',
      utmTerm: a.utm_term || '',
      utmContent: a.utm_content || '',
      utmMatchtype: a.utm_matchtype || '',
      gbraid: a.gbraid || '',
      wbraid: a.wbraid || '',
      landingUrl: a.landing_url || location.origin + location.pathname + location.search,
      pageUrl: location.origin + location.pathname + location.search,
      fbc: fbc(a),
      fbp: cookie('_fbp'),
      gaClientId: cookie('_ga'),
      fbEventId: uuid()
    };
  };
})();

// QA test mode, shared with the Malaysia site: ?test_webhook=1 on any page sets the
// test_webhook cookie for this domain, and ?test_webhook=0 clears it.
// api/ph-submit.js then sends leads to TESTING_WEBHOOK_URL.
(function () {
  var mode = new URLSearchParams(location.search).get('test_webhook');
  if (mode === '1') document.cookie = 'test_webhook=1; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  if (mode === '0') document.cookie = 'test_webhook=; Max-Age=0; Path=/';
  if (/(^|;\s*)test_webhook=1/.test(document.cookie) && window.console) console.info('Test mode: form submissions go to TESTING_WEBHOOK_URL.');
})();

// Forms: dropdowns, phone input, validation and submission to /api/ph-submit.
// Field definitions come from the #form-meta JSON that scripts/snapshot-philippines.mjs
// saves from the live page.
(function () {
  var metaEl = document.getElementById('form-meta');
  if (!metaEl) return;
  var META = JSON.parse(metaEl.textContent);
  var MAX_UPLOAD = 3 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB; base64 adds a third.
  var params = new URLSearchParams(location.search);

  var style = document.createElement('style');
  style.textContent =
    '.multi_select_form .multiselect__content-wrapper{max-height:370px}' +
    '.multi_select_form .multiselect__option{display:block;padding:16px 12px;min-height:40px;line-height:20px;font-size:16px;color:#697386;cursor:pointer;white-space:normal}' +
    '.multi_select_form .multiselect__option--highlight{background:#d1e7fd;color:#188bf6}' +
    '.multi_select_form .multiselect__option--selected{background:#f3f3f3;color:#35495e;font-weight:400}' +
    '.multi_select_form .multiselect__option--selected.multiselect__option--highlight{background:#d1e7fd;color:#188bf6}' +
    '.multi_select_form .multiselect__tags-wrap{display:inline}' +
    '.multi_select_form .multiselect__tag{display:inline-block;position:relative;margin:0 6px 6px 0;padding:4px 26px 4px 10px;border-radius:5px;background:#188bf6;color:#fff;font-size:14px;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top}' +
    '.multi_select_form .multiselect__tag-icon:after{content:"\\00d7";color:#fff;font-size:14px}' +
    '.restore-error{color:#e93d3d;font-size:13px;margin-top:4px}' +
    '.restore-form-error{color:#e93d3d;font-size:14px;margin:10px 0;text-align:center}' +
    '.restore-honeypot{position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden}' +
    '.restore-turnstile{display:flex;justify-content:center}' +
    '.restore-turnstile iframe{margin:10px 0}' +
    '.restore-thankyou{background:#fff;color:#000;border-radius:10px;padding:30px 20px;font-size:18px;text-align:center}';
  document.head.appendChild(style);

  // Cloudflare Turnstile, the Malaysia site's key. GoHighLevel's own forms run an invisible
  // check, so this one only shows itself when Cloudflare needs the visitor to click. The site
  // key is public by design; the secret key stays in Vercel as TURNSTILE_SECRET_KEY.
  var TURNSTILE_SITE_KEY = '0x4AAAAAAFJwP8-9jS534EFE';
  var turnstile = new Promise(function (resolve) {
    window.__onTurnstile = function () { resolve({ api: window.turnstile, key: TURNSTILE_SITE_KEY }); };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstile';
    s.async = true;
    document.head.appendChild(s);
  });

  function whenReady(test, fn, tries) {
    if (test()) return fn();
    if ((tries || 0) < 100) setTimeout(function () { whenReady(test, fn, (tries || 0) + 1); }, 100);
  }

  function wrapperFor(root, field) {
    return root.querySelector('[id^="el_"][id*="_' + field.id + '_"]');
  }

  function showError(wrapper, message) {
    if (!wrapper) return;
    var el = wrapper.querySelector('.restore-error');
    if (!message) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'restore-error';
      (wrapper.querySelector('.flex-col') || wrapper).appendChild(el);
    }
    el.textContent = message;
  }

  // Rebuilds GoHighLevel's vue-multiselect dropdown on the server-rendered shell.
  function dropdown(ms, field) {
    var multiple = field.type === 'multiple_options';
    var input = ms.querySelector('.multiselect__input');
    var tags = ms.querySelector('.multiselect__tags');
    var tagsWrap = ms.querySelector('.multiselect__tags-wrap');
    var placeholder = ms.querySelector('.multiselect__placeholder');
    var selected = [];
    var highlight = 0;

    var list = document.createElement('div');
    list.className = 'multiselect__content-wrapper';
    list.tabIndex = -1;
    list.style.display = 'none';
    var ul = document.createElement('ul');
    ul.className = 'multiselect__content';
    ul.setAttribute('role', 'listbox');
    ul.id = 'listbox-' + field.id;
    if (multiple) ul.setAttribute('aria-multiselectable', 'true');
    field.options.forEach(function (opt, i) {
      var li = document.createElement('li');
      li.className = 'multiselect__element';
      li.setAttribute('role', 'option');
      li.id = field.id + '-' + i;
      var span = document.createElement('span');
      span.className = 'multiselect__option';
      span.textContent = opt;
      li.appendChild(span);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
      li.addEventListener('mouseenter', function () { highlight = i; paint(); });
      ul.appendChild(li);
    });
    list.appendChild(ul);
    ms.appendChild(list);

    function paint() {
      [].forEach.call(ul.children, function (li, i) {
        var on = selected.indexOf(field.options[i]) >= 0;
        li.setAttribute('aria-selected', on ? 'true' : 'false');
        li.firstChild.className = 'multiselect__option' +
          (i === highlight ? ' multiselect__option--highlight' : '') +
          (on ? ' multiselect__option--selected' : '');
      });
      input.setAttribute('aria-activedescendant', field.id + '-' + highlight);
      if (multiple) {
        tagsWrap.innerHTML = '';
        selected.forEach(function (value) {
          var tag = document.createElement('span');
          tag.className = 'multiselect__tag';
          tag.innerHTML = '<span></span><i class="multiselect__tag-icon" aria-label="Remove"></i>';
          tag.firstChild.textContent = value;
          tag.lastChild.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            selected.splice(selected.indexOf(value), 1);
            paint();
          });
          tagsWrap.appendChild(tag);
        });
        tagsWrap.style.display = selected.length ? '' : 'none';
      } else {
        var single = tags.querySelector('.multiselect__single');
        if (!single) {
          single = document.createElement('span');
          single.className = 'multiselect__single';
          tags.insertBefore(single, placeholder);
        }
        single.textContent = selected[0] || '';
        single.style.display = selected.length ? '' : 'none';
      }
      placeholder.style.display = selected.length ? 'none' : '';
    }

    function isOpen() { return list.style.display !== 'none'; }
    function open() {
      if (isOpen()) return;
      list.style.display = 'block';
      var r = ms.getBoundingClientRect();
      var below = window.innerHeight - r.bottom;
      var above = below < 300 && r.top > below;
      ms.classList.toggle('multiselect--above', above);
      ms.classList.add('multiselect--active');
      ms.setAttribute('aria-expanded', 'true');
      var first = field.options.indexOf(selected[0]);
      highlight = first >= 0 ? first : 0;
      paint();
      scrollToHighlight();
    }
    function close() {
      list.style.display = 'none';
      ms.classList.remove('multiselect--active', 'multiselect--above');
      ms.setAttribute('aria-expanded', 'false');
    }
    function scrollToHighlight() {
      var li = ul.children[highlight];
      if (!li) return;
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
    }
    function choose(i) {
      var value = field.options[i];
      if (multiple) {
        var at = selected.indexOf(value);
        if (at >= 0) selected.splice(at, 1); else selected.push(value);
      } else {
        selected = [value];
        close();
      }
      highlight = i;
      paint();
      showError(wrapperFor(ms.closest('.c-form'), field), '');
    }

    ms.addEventListener('mousedown', function (e) {
      if (list.contains(e.target)) return;
      e.preventDefault();
      if (isOpen()) close(); else { input.focus(); open(); }
    });
    input.addEventListener('focus', open);
    input.addEventListener('blur', close);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen()) return open();
        highlight = Math.max(0, Math.min(field.options.length - 1, highlight + (e.key === 'ArrowDown' ? 1 : -1)));
        paint();
        scrollToHighlight();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isOpen()) choose(highlight); else open();
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        close();
      }
    });
    input.setAttribute('role', 'combobox');
    paint();

    return function () { return multiple ? selected.slice() : selected[0] || ''; };
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve({ name: file.name, type: file.type, data: String(r.result).split(',')[1] }); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  document.querySelectorAll('.c-form').forEach(function (root) {
    var meta = META[root.id];
    if (!meta) return;
    var button = root.querySelector('button[type="submit"]');
    if (!button) return;
    var loader = root.querySelector('.loader-submit');
    var getters = {};

    meta.fields.forEach(function (field) {
      var wrapper = wrapperFor(root, field);
      if (field.hidden) {
        getters[field.id] = function () { return field.query ? params.get(field.query) || '' : ''; };
        return;
      }
      if (field.options && field.type !== 'file_upload') {
        var ms = wrapper && wrapper.querySelector('.multiselect');
        if (ms) getters[field.id] = dropdown(ms, field);
        return;
      }
      if (field.type === 'file_upload') {
        var fileInput = wrapper && wrapper.querySelector('input[type="file"]');
        if (!fileInput) return;
        var label = wrapper.querySelector('.custom-file-upload');
        var nameBox = wrapper.querySelector('.file-placeholder');
        fileInput.id = fileInput.id || 'file-' + field.id;
        if (label) label.setAttribute('for', fileInput.id);
        fileInput.addEventListener('change', function () {
          if (nameBox) nameBox.textContent = [].map.call(fileInput.files, function (f) { return f.name; }).join(', ');
          showError(wrapper, '');
        });
        getters[field.id] = function () { return fileInput.files; };
        return;
      }
      var el = root.querySelector('[id="' + field.id + '"]');
      if (!el) return;
      if (el.type === 'tel') {
        // intl-tel-input loads async from cdnjs; plain text until it arrives. Like GoHighLevel's
        // form: a flag dropdown with every country, starting on the Philippines.
        var iti = null;
        whenReady(function () { return window.intlTelInput; }, function () {
          iti = window.intlTelInput(el, {
            initialCountry: 'ph',
            preferredCountries: ['ph'],
            autoPlaceholder: 'off',
            utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.12/js/utils.min.js'
          });
        });
        // Only phone characters, and no more digits than the picked country's
        // numbers can have: its example mobile number in national format
        // (with the leading 0), plus one for longer variants. A number typed
        // with its own "+" code is capped at 15, the E.164 maximum.
        var maxDigits = function () {
          var utils = window.intlTelInputUtils;
          if (!iti || !utils) return 15;
          var iso = iti.getSelectedCountryData().iso2;
          var example = utils.getExampleNumber(iso, true, utils.numberType.MOBILE) || '';
          var digits = example.replace(/\D/g, '').length;
          return digits ? Math.min(digits + 1, 15) : 15;
        };
        el.addEventListener('input', function () {
          var value = el.value.replace(/[^\d\s()+-]/g, '');
          var limit = value.trim().charAt(0) === '+' ? 15 : maxDigits();
          var kept = '', count = 0;
          for (var i = 0; i < value.length; i++) {
            var c = value.charAt(i);
            if (/\d/.test(c)) { if (count >= limit) continue; count++; }
            kept += c;
          }
          if (kept !== el.value) el.value = kept;
        });
        getters[field.id] = function () { return el.value.trim() ? (iti ? iti.getNumber() : el.value.trim()) : ''; };
        getters[field.id].country = function () { return iti ? iti.getSelectedCountryData().iso2 || '' : ''; };
        getters[field.id].valid = function () { return !iti || !window.intlTelInputUtils || iti.isValidNumber(); };
      } else {
        getters[field.id] = function () { return el.value.trim(); };
      }
      el.addEventListener('input', function () { showError(wrapper, ''); });
    });

    // Bots fill every input; people never see this one.
    var honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'website';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.className = 'restore-honeypot';
    honeypot.setAttribute('aria-hidden', 'true');
    root.appendChild(honeypot);

    var submitBox = button.closest('.form-builder--item');
    var formError = document.createElement('div');
    formError.className = 'restore-form-error';
    formError.setAttribute('role', 'alert');
    formError.style.display = 'none';
    submitBox.parentNode.insertBefore(formError, submitBox);

    var widget = null, token = '';
    turnstile.then(function (ts) {
      if (!ts) return;
      var box = document.createElement('div');
      box.className = 'restore-turnstile';
      submitBox.parentNode.insertBefore(box, submitBox);
      widget = {
        api: ts.api,
        id: ts.api.render(box, {
          sitekey: ts.key,
          theme: 'light', // 'auto' would turn the widget dark on dark-mode devices
          appearance: 'interaction-only',
          callback: function (t) { token = t; },
          'expired-callback': function () { token = ''; }
        })
      };
    });

    function fail(message) {
      formError.textContent = message;
      formError.style.display = '';
    }

    button.addEventListener('click', function (e) {
      e.preventDefault();
      formError.style.display = 'none';
      var values = {}, files = [], firstBad = null, uploadSize = 0;

      meta.fields.forEach(function (field) {
        var get = getters[field.id];
        if (!get) return;
        var wrapper = wrapperFor(root, field);
        var v = get();
        var message = '';
        if (field.type === 'file_upload') {
          [].forEach.call(v || [], function (f) { uploadSize += f.size; files.push({ field: field, file: f }); });
          if (field.required && !(v && v.length)) message = 'Please upload a file.';
          else if (uploadSize > MAX_UPLOAD) message = 'Files must be 3 MB or smaller in total.';
        } else {
          var empty = Array.isArray(v) ? !v.length : !v;
          if (field.required && empty) message = 'This field is required.';
          else if (!empty && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) message = 'Please enter a valid email address.';
          else if (!empty && get.valid && !get.valid()) message = 'Please enter a valid phone number.';
          values[field.id] = v;
        }
        if (!field.hidden) showError(wrapper, message);
        if (message && !firstBad) firstBad = wrapper;
      });

      if (firstBad) { firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (widget && !token) return fail('Please complete the verification check.');

      button.disabled = true;
      if (loader) {
        loader.style.display = '';
        var spin = loader.querySelector('.v-spinner');
        if (spin) spin.style.display = '';
      }
      Promise.all(files.map(function (f) {
        return readFile(f.file).then(function (data) { data.field = f.field.label; return data; });
      })).then(function (uploads) {
        return fetch('/api/ph-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formId: root.id,
            fields: values,
            files: uploads,
            attribution: attribution(),
            landingPageSource: location.origin + location.pathname,
            phoneCountry: (function () {
              for (var id in getters) if (getters[id].country) return getters[id].country();
              return '';
            })(),
            timezone: (function () {
              try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
            })(),
            token: token,
            website: honeypot.value
          })
        });
      }).then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (out) {
            throw new Error(out.error || '');
          });
        }
        if (meta.redirect) {
          location.href = meta.redirect;
          return;
        }
        var wrap = root.querySelector('.ghl-form-wrap') || root;
        var thanks = document.createElement('div');
        thanks.className = 'restore-thankyou';
        thanks.setAttribute('role', 'status');
        thanks.textContent = meta.thankyou || 'Thank you for taking the time to complete this form.';
        wrap.innerHTML = '';
        wrap.appendChild(thanks);
      }).catch(function (err) {
        fail(err.message || "We couldn't send your details. Please try again.");
        if (widget) { widget.api.reset(widget.id); token = ''; }
      }).then(function () {
        button.disabled = false;
        if (loader) loader.style.display = 'none';
      });
    });
  });
})();

// Privacy Policy link at the bottom of every page (the snapshot's footers differ page to page).
(function () {
  var bar = document.createElement('div');
  bar.style.cssText = 'padding:12px 16px;text-align:center;font:14px Montserrat,sans-serif;background:#fff;';
  bar.innerHTML = '<a href="/privacy-policy/" style="color:#2c3345;text-decoration:underline;">Privacy Policy</a>';
  document.body.appendChild(bar);
})();
