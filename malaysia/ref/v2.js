// Referral landing page, V2 design. Runs only when the page is opened with a valid sales link
// (?r=S03 in the URL): it replaces the page's sections with the V2 layout (sticky header, photo hero,
// steps beside the form, credentials, closing strip, footer) and moves the page's own lead form into
// the "Book your free assessment" card. The form is
// the same element, not a copy: its fields, validation, WhatsApp message and /api/submit call are
// untouched. Visitors without ?r= in the URL (even with a saved code) see the page exactly as before.
(function () {
  var root = document.documentElement;
  var HERO = 'section-r95p7c9bBO';        // the old "You've Been Referred" hero; V2 goes in its place
  var LOGO = '/assets/img/044cb7c6c078.webp';
  var PHOTO = '/assets/img/51884e82508c.webp';
  var HOME = 'https://www.maqosolar.com';

  var ICONS = [
    '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
    '<path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"/><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5"/>',
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'
  ];
  var svg = function (p) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c842b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var TX = {
    en: { lang: 'en', fallback: 'A Maqo consultant', headCta: 'Free Assessment', invited: 'Invited by', h1rest: 'invited you to a free home solar assessment.',
      sub: 'Tell us about your home. A Maqo energy consultant will call you within 1 business day to arrange a free rooftop visit. No obligation.',
      cta: 'Get my free assessment', how: 'How it works', photoAlt: 'A landed home with rooftop solar panels at sunset',
      facts: [['1,000+', 'customers served'], ['ST Class A', 'electrical contractor'], ['CIDB G7', 'construction grade']],
      badgeT: 'In-house licensed wiremen', badgeS: 'No outsourcing of critical works',
      nextTag: 'How it works', nextTitle: 'Your free assessment in three steps', nextLead: 'Fill in the form once. We take it from there.',
      steps: [['Fill in the form', 'WhatsApp opens with your details filled in. Press Send.'], ['We call you', 'A Maqo energy consultant calls you within 1 business day.'], ['Free rooftop visit', 'We arrange a free rooftop assessment at your home. No obligation.']],
      formTitle: 'Book your free assessment',
      whyTag: 'Why Maqo', whyTitle: 'The Q in Maqo is Quality.',
      creds: [['ST Class A', 'The highest electrical contractor class in Malaysia.'], ['CIDB G7', 'The highest construction grade in Malaysia.'], ['SEDA + ISO 9001', 'Registered solar installer, ISO 9001:2015 certified.'], ['In-house wiremen', 'Licensed wiremen and chargemen. No outsourcing of critical works.']],
      homeTitle: 'Energizing a cleaner future, one solar panel at a time.', homeBody: 'See our residential, commercial and industrial solar work, and the Maqorians behind it.',
      toForm: 'Start my assessment', homeBtn: 'Visit MaqoSolar.com' },
    zh: { lang: 'zh-Hans', fallback: 'Maqo 顾问', headCta: '免费评估', invited: '邀请人', h1rest: '邀请您获取免费住家太阳能评估。',
      sub: '告诉我们您的住家情况。Maqo 能源顾问将在 1 个工作日内致电您，安排免费屋顶勘察，无需任何承诺。',
      cta: '获取免费评估', how: '流程说明', photoAlt: '夕阳下屋顶装有太阳能板的有地住宅',
      facts: [['1,000+', '位已服务客户'], ['ST A 级', '电气承包商'], ['CIDB G7', '建筑等级']],
      badgeT: '自有持牌电工', badgeS: '关键工程绝不外包',
      nextTag: '流程说明', nextTitle: '三个步骤，获取免费评估', nextLead: '只需填写一次表格，其余交给我们。',
      steps: [['填写表格', 'WhatsApp 会自动带入您的资料，按发送即可。'], ['我们致电您', 'Maqo 能源顾问将在 1 个工作日内致电您。'], ['免费屋顶勘察', '我们安排到府免费屋顶评估，无需任何承诺。']],
      formTitle: '预约免费评估',
      whyTag: '为什么选择 Maqo', whyTitle: 'Maqo 的 Q 代表 Quality（品质）。',
      creds: [['ST A 级', '马来西亚最高等级的电气承包商资格。'], ['CIDB G7', '马来西亚最高等级的建筑承包商级别。'], ['SEDA + ISO 9001', '注册太阳能安装商，ISO 9001:2015 认证。'], ['自有电工团队', '持牌电工与主管，关键工程绝不外包。']],
      homeTitle: '点亮更洁净的未来，一片太阳能板接一片。', homeBody: '了解我们的住家、商业与工业太阳能项目，以及背后的 Maqo 团队。',
      toForm: '开始评估', homeBtn: '访问 MaqoSolar.com' },
    ms: { lang: 'ms', fallback: 'Perunding Maqo', headCta: 'Penilaian Percuma', invited: 'Dijemput oleh', h1rest: 'menjemput anda untuk penilaian solar rumah percuma.',
      sub: 'Beritahu kami tentang rumah anda. Perunding tenaga Maqo akan menghubungi anda dalam 1 hari bekerja untuk mengatur lawatan bumbung percuma. Tiada obligasi.',
      cta: 'Dapatkan penilaian percuma', how: 'Cara ia berfungsi', photoAlt: 'Rumah landed dengan panel solar di bumbung ketika matahari terbenam',
      facts: [['1,000+', 'pelanggan dilayan'], ['ST Kelas A', 'kontraktor elektrik'], ['CIDB G7', 'gred pembinaan']],
      badgeT: 'Wireman berlesen dalaman', badgeS: 'Kerja kritikal tidak dialih keluar',
      nextTag: 'Cara ia berfungsi', nextTitle: 'Penilaian percuma anda dalam tiga langkah', nextLead: 'Isi borang sekali sahaja. Selebihnya kami uruskan.',
      steps: [['Isi borang', 'WhatsApp dibuka dengan butiran anda. Tekan Hantar.'], ['Kami hubungi anda', 'Perunding tenaga Maqo menghubungi anda dalam 1 hari bekerja.'], ['Lawatan bumbung percuma', 'Kami atur penilaian bumbung percuma di rumah anda. Tiada obligasi.']],
      formTitle: 'Tempah penilaian percuma anda',
      whyTag: 'Mengapa Maqo', whyTitle: 'Q dalam Maqo bermaksud Quality (Kualiti).',
      creds: [['ST Kelas A', 'Kelas kontraktor elektrik tertinggi di Malaysia.'], ['CIDB G7', 'Gred pembinaan tertinggi di Malaysia.'], ['SEDA + ISO 9001', 'Pemasang solar berdaftar, diperakui ISO 9001:2015.'], ['Wireman dalaman', 'Wireman dan chargeman berlesen. Kerja kritikal tidak dialih keluar.']],
      homeTitle: 'Menyalakan masa depan yang lebih bersih, satu panel solar pada satu masa.', homeBody: 'Lihat kerja solar kediaman, komersial dan industri kami, serta Maqorian di sebaliknya.',
      toForm: 'Mula penilaian saya', homeBtn: 'Layari MaqoSolar.com' }
  };
  var TABS = { en: 'EN', zh: '中文', ms: 'BM' };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stopWaiting() { root.classList.remove('ref-v2-wait'); }

  function activate() {
    var ref = window.__maqoRef || {};
    var hero = document.getElementById(HERO);
    var form = document.querySelector('.c-form');
    if (!ref.code || !ref.fromUrl || !hero || !form || document.getElementById('v2')) { stopWaiting(); return; }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;600;800&display=swap';
    document.head.appendChild(link);

    var go = 'href="#v2-card" data-go';
    var el = document.createElement('div');
    el.id = 'v2';
    el.innerHTML =
      '<header class="v2-head"><div class="v2-gut v2-head-in">' +
      '<a class="v2-logo" href="' + HOME + '" aria-label="MAQO Solar homepage"><img src="' + LOGO + '" alt="MAQO Solar" width="144" height="32"></a>' +
      '<div class="v2-head-r"><div class="v2-langs" role="group" aria-label="Language">' +
      ['en', 'zh', 'ms'].map(function (k) { return '<button type="button" class="v2-lng" data-lang="' + k + '">' + TABS[k] + '</button>'; }).join('') +
      '</div><a class="v2-btn v2-btn-o" ' + go + ' data-k="headCta"></a></div></div></header>' +
      '<section class="v2-hero"><div class="v2-gut v2-hero-in"><div>' +
      '<div class="v2-pill"><div class="v2-ini" id="v2-ini"></div><div><small data-k="invited"></small><strong id="v2-pname"></strong></div></div>' +
      '<h1 class="v2-h1"><span class="v2-nm" id="v2-name"></span> <span data-k="h1rest"></span></h1>' +
      '<p class="v2-sub" data-k="sub"></p>' +
      '<div class="v2-ctas"><a class="v2-btn v2-btn-o v2-btn-lg" ' + go + ' data-k="cta"></a><a class="v2-btn v2-btn-g v2-btn-lg" href="#v2-how" data-go-how data-k="how"></a></div>' +
      '<div class="v2-facts" id="v2-facts"></div></div>' +
      '<div class="v2-shot"><img src="' + PHOTO + '" alt="" id="v2-photo" width="896" height="1344">' +
      '<div class="v2-badge"><i>' + svg('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>') + '</i><div><b data-k="badgeT"></b><span data-k="badgeS"></span></div></div></div>' +
      '</div></section>' +
      '<section class="v2-band" id="v2-how"><div class="v2-gut v2-band-in">' +
      '<div class="v2-side"><div class="v2-eyebrow" data-k="nextTag"></div><h2 class="v2-h2" data-k="nextTitle"></h2><p class="v2-lead" data-k="nextLead"></p><ol class="v2-steps" id="v2-steps"></ol></div>' +
      '<div class="v2-card" id="v2-card"><h2 class="v2-card-h" data-k="formTitle"></h2><div id="v2-formslot"></div></div>' +
      '</div></section>' +
      '<section class="v2-why"><div class="v2-gut v2-why-in"><div class="v2-eyebrow" data-k="whyTag"></div><h2 class="v2-h2" data-k="whyTitle"></h2><div class="v2-creds" id="v2-creds"></div></div></section>' +
      '<section class="v2-closing"><div class="v2-gut v2-closing-in"><div class="v2-strip"><div><h2 class="v2-h2" data-k="homeTitle"></h2><p data-k="homeBody"></p></div>' +
      '<div class="v2-btns"><a class="v2-btn v2-btn-o v2-btn-lg" ' + go + ' data-k="toForm"></a><a class="v2-btn v2-btn-g v2-btn-lg" href="' + HOME + '" target="_blank" rel="noopener" data-k="homeBtn"></a></div></div></div></section>' +
      '<footer class="v2-foot"><div class="v2-gut v2-foot-in"><div>Maqo Engineering Sdn Bhd · 27, Jalan TPP 1/1, Taman Perindustrian Puchong, 47100 Puchong, Selangor</div>' +
      '<div>admin@maqo.asia · Office 603-8069 1706 · Tel 6018-777 1095</div></div></footer>';

    hero.parentNode.insertBefore(el, hero);
    document.getElementById('v2-formslot').appendChild(form);   // the same form element, moved
    root.classList.add('ref-v2');

    var raw = (ref.name || '').trim();
    function paint(lang) {
      var T = TX[lang];
      el.setAttribute('lang', T.lang);
      [].forEach.call(el.querySelectorAll('[data-k]'), function (n) { n.textContent = T[n.getAttribute('data-k')]; });
      var name = raw || T.fallback;
      document.getElementById('v2-name').textContent = name;
      document.getElementById('v2-pname').textContent = name;
      document.getElementById('v2-ini').textContent = raw ? raw.charAt(0).toUpperCase() : 'M';
      document.getElementById('v2-photo').alt = T.photoAlt;
      document.getElementById('v2-facts').innerHTML = T.facts.map(function (f) { return '<div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>'; }).join('');
      document.getElementById('v2-steps').innerHTML = T.steps.map(function (s, i) { return '<li class="v2-step"><div class="v2-num">' + (i + 1) + '</div><div><h3>' + esc(s[0]) + '</h3><p>' + esc(s[1]) + '</p></div></li>'; }).join('');
      document.getElementById('v2-creds').innerHTML = T.creds.map(function (c, i) { return '<div class="v2-c"><i>' + svg(ICONS[i]) + '</i><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>'; }).join('');
      [].forEach.call(el.querySelectorAll('.v2-lng'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false'); });
    }
    el.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var b = t.closest('.v2-lng');
      if (b) { paint(b.getAttribute('data-lang')); return; }
      var a = t.closest('[data-go], [data-go-how]');
      if (a) {
        e.preventDefault();
        document.getElementById(a.hasAttribute('data-go') ? 'v2-card' : 'v2-how').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    paint('en');
    window.dispatchEvent(new Event('resize'));   // let the form lay itself out in its new spot
    stopWaiting();
  }

  function decide() {
    var ref = window.__maqoRef || {};
    if (ref.code && ref.fromUrl) activate(); else stopWaiting();
  }
  window.addEventListener('maqoref', decide);
  window.addEventListener('maqorefnone', decide);
  if (window.__maqoRefDone) decide();
})();
