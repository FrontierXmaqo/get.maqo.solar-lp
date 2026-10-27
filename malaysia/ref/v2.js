// Referral landing page, V2 design. Runs only when the page is opened with a valid sales link
// (?r=S03 in the URL): it replaces the page's sections with the V2 layout (photo hero, next steps,
// credentials, closing band, footer) and moves the page's own lead form into the hero. The form is
// the same element, not a copy: its fields, validation, WhatsApp message and /api/submit call are
// untouched. Visitors without ?r= in the URL (even with a saved code) see the page exactly as before.
(function () {
  var root = document.documentElement;
  var HERO = 'section-r95p7c9bBO';        // the old "You've Been Referred" hero; V2 goes in its place
  var LOGO = '/assets/img/044cb7c6c078.webp';
  var PHOTO = '/assets/img/51884e82508c.webp';
  var HOME = 'https://www.maqosolar.com';

  var TX = {
    en: {
      lang: 'en', fallback: 'A Maqo consultant', cred: 'ST Class A · SEDA', invited: 'Your invitation from',
      h1rest: 'invited you to a free home solar assessment.',
      sub: 'Tell us about your home. A Maqo energy consultant will call you within 1 business day to arrange a free rooftop visit. No obligation.',
      chips: ['1,000+ customers served', 'In-house licensed wiremen', 'Turnkey design and install'],
      nextTag: 'What happens next', nextTitle: 'Three steps to your free assessment',
      steps: [['Fill in the form', 'WhatsApp opens with your details filled in. Press Send.'], ['We call you', 'A Maqo energy consultant calls you within 1 business day.'], ['Free rooftop visit', 'We arrange a free rooftop assessment at your home. No obligation.']],
      whyTag: 'Why Maqo', whyTitle: 'The Q in Maqo is Quality.',
      creds: [['ST Class A', 'The highest electrical contractor class in Malaysia.'], ['CIDB G7', 'The highest construction grade in Malaysia.'], ['SEDA + ISO 9001', 'Registered solar installer, ISO 9001:2015 certified.'], ['In-house wiremen', 'Licensed wiremen and chargemen. No outsourcing of critical works.']],
      homeTag: 'About Maqo', homeTitle: 'Energizing a cleaner future, one solar panel at a time.', homeBody: 'See our residential, commercial and industrial solar work, and the Maqorians behind it.',
      toForm: 'Start my assessment', homeBtn: 'Visit MaqoSolar.com', cta: 'Get My Free Home Assessment'
    },
    zh: {
      lang: 'zh-Hans', fallback: 'Maqo 顾问', cred: 'ST A 级 · SEDA', invited: '邀请人',
      h1rest: '邀请您获取免费住家太阳能评估。',
      sub: '告诉我们您的住家情况。Maqo 能源顾问将在 1 个工作日内致电您，安排免费屋顶勘察，无需任何承诺。',
      chips: ['已服务逾 1,000 位客户', '自有持牌电工', '一站式设计与安装'],
      nextTag: '接下来', nextTitle: '三个步骤，获取免费评估',
      steps: [['填写表格', 'WhatsApp 会自动带入您的资料，按发送即可。'], ['我们致电您', 'Maqo 能源顾问将在 1 个工作日内致电您。'], ['免费屋顶勘察', '我们安排到府免费屋顶评估，无需任何承诺。']],
      whyTag: '为什么选择 Maqo', whyTitle: 'Maqo 的 Q 代表 Quality（品质）。',
      creds: [['ST A 级', '马来西亚最高等级的电气承包商资格。'], ['CIDB G7', '马来西亚最高等级的建筑承包商级别。'], ['SEDA + ISO 9001', '注册太阳能安装商，ISO 9001:2015 认证。'], ['自有电工团队', '持牌电工与主管，关键工程绝不外包。']],
      homeTag: '关于 Maqo', homeTitle: '点亮更洁净的未来，一片太阳能板接一片。', homeBody: '了解我们的住家、商业与工业太阳能项目，以及背后的 Maqo 团队。',
      toForm: '开始评估', homeBtn: '访问 MaqoSolar.com', cta: '获取免费住家评估'
    },
    ms: {
      lang: 'ms', fallback: 'Perunding Maqo', cred: 'ST Kelas A · SEDA', invited: 'Jemputan daripada',
      h1rest: 'menjemput anda untuk penilaian solar rumah percuma.',
      sub: 'Beritahu kami tentang rumah anda. Perunding tenaga Maqo akan menghubungi anda dalam 1 hari bekerja untuk mengatur lawatan bumbung percuma. Tiada obligasi.',
      chips: ['1,000+ pelanggan dilayan', 'Wireman berlesen dalaman', 'Reka bentuk dan pemasangan turnkey'],
      nextTag: 'Langkah seterusnya', nextTitle: 'Tiga langkah ke penilaian percuma anda',
      steps: [['Isi borang', 'WhatsApp dibuka dengan butiran anda. Tekan Hantar.'], ['Kami hubungi anda', 'Perunding tenaga Maqo menghubungi anda dalam 1 hari bekerja.'], ['Lawatan bumbung percuma', 'Kami atur penilaian bumbung percuma di rumah anda. Tiada obligasi.']],
      whyTag: 'Mengapa Maqo', whyTitle: 'Q dalam Maqo bermaksud Quality (Kualiti).',
      creds: [['ST Kelas A', 'Kelas kontraktor elektrik tertinggi di Malaysia.'], ['CIDB G7', 'Gred pembinaan tertinggi di Malaysia.'], ['SEDA + ISO 9001', 'Pemasang solar berdaftar, diperakui ISO 9001:2015.'], ['Wireman dalaman', 'Wireman dan chargeman berlesen. Kerja kritikal tidak dialih keluar.']],
      homeTag: 'Tentang Maqo', homeTitle: 'Menyalakan masa depan yang lebih bersih, satu panel solar pada satu masa.', homeBody: 'Lihat kerja solar kediaman, komersial dan industri kami, serta Maqorian di sebaliknya.',
      toForm: 'Mula penilaian saya', homeBtn: 'Layari MaqoSolar.com', cta: 'Dapatkan Penilaian Rumah Percuma'
    }
  };
  var TABS = { en: 'EN', zh: '中文', ms: 'BM' };
  var CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c842b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

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

    var go = 'href="#' + form.id + '" data-go';
    var el = document.createElement('div');
    el.id = 'v2';
    el.innerHTML =
      '<div class="v2-top"><div class="v2-bg" id="v2-bg" style="background-image:url(' + PHOTO + ')"></div><div class="v2-gut">' +
      '<header class="v2-head"><a class="v2-logolink" href="' + HOME + '" aria-label="MAQO Solar homepage"><img class="v2-logo" src="' + LOGO + '" alt="MAQO Solar" width="150" height="33"></a>' +
      '<div class="v2-head-r"><span class="v2-cred" data-k="cred"></span><div class="v2-langs" role="group" aria-label="Language">' +
      ['en', 'zh', 'ms'].map(function (k) { return '<button type="button" class="v2-lng" data-lang="' + k + '">' + TABS[k] + '</button>'; }).join('') +
      '</div></div></header>' +
      '<div class="v2-grid">' +
      '<section class="v2-intro" id="v2-intro"><div class="v2-pill"><div class="v2-ini" id="v2-ini"></div><div><div class="v2-inv" data-k="invited"></div><div class="v2-pname" id="v2-pname"></div></div></div>' +
      '<h1 class="v2-h1"><span class="v2-nm" id="v2-name"></span> <span data-k="h1rest"></span></h1>' +
      '<p class="v2-sub" data-k="sub"></p><div class="v2-chips" id="v2-chips"></div></section>' +
      '<div class="v2-formslot" id="v2-formslot"></div>' +
      '<div class="v2-more"><section><div class="v2-eyebrow" data-k="nextTag"></div><h2 class="v2-h2" data-k="nextTitle"></h2><ol class="v2-steps" id="v2-steps"></ol></section>' +
      '<section><div class="v2-eyebrow" data-k="whyTag"></div><h2 class="v2-h2" data-k="whyTitle"></h2><div class="v2-creds" id="v2-creds"></div></section></div>' +
      '</div></div></div>' +
      '<section class="v2-close"><div class="v2-gut v2-close-in"><div><div class="v2-eyebrow" data-k="homeTag"></div><h2 class="v2-h2" data-k="homeTitle"></h2><p data-k="homeBody"></p></div>' +
      '<div class="v2-btns"><a class="v2-btn v2-btn-o" ' + go + ' data-k="toForm"></a><a class="v2-btn v2-btn-w" href="' + HOME + '" target="_blank" rel="noopener" data-k="homeBtn"></a></div></div></section>' +
      '<footer class="v2-foot"><div class="v2-gut v2-foot-in"><div>Maqo Engineering Sdn Bhd · 27, Jalan TPP 1/1, Taman Perindustrian Puchong, 47100 Puchong, Selangor</div>' +
      '<div>admin@maqo.asia · Office 603-8069 1706 · Tel 6018-777 1095</div></div></footer>' +
      '<div class="v2-mbar"><a class="v2-btn v2-btn-o" ' + go + ' data-k="cta"></a></div>';

    hero.parentNode.insertBefore(el, hero);
    document.getElementById('v2-formslot').appendChild(form);   // the same form element, moved
    root.classList.add('ref-v2');

    var raw = (ref.name || '').trim();
    // The photo covers the header and the intro; the form card floats over it and runs on below.
    function fit() {
      var top = el.getBoundingClientRect().top;
      var intro = document.getElementById('v2-intro').getBoundingClientRect().bottom;
      document.getElementById('v2-bg').style.height = Math.round(intro - top + 40) + 'px';
    }
    function paint(lang) {
      var T = TX[lang];
      el.setAttribute('lang', T.lang);
      [].forEach.call(el.querySelectorAll('[data-k]'), function (n) { n.textContent = T[n.getAttribute('data-k')]; });
      var name = raw || T.fallback;
      document.getElementById('v2-name').textContent = name;
      document.getElementById('v2-pname').textContent = name;
      document.getElementById('v2-ini').textContent = raw ? raw.charAt(0).toUpperCase() : 'M';
      document.getElementById('v2-chips').innerHTML = T.chips.map(function (c) { return '<span class="v2-chip">' + CHECK + esc(c) + '</span>'; }).join('');
      document.getElementById('v2-steps').innerHTML = T.steps.map(function (s, i) { return '<li class="v2-step"><div class="v2-num">' + (i + 1) + '</div><div><h3>' + esc(s[0]) + '</h3><p>' + esc(s[1]) + '</p></div></li>'; }).join('');
      document.getElementById('v2-creds').innerHTML = T.creds.map(function (c) { return '<div class="v2-c"><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>'; }).join('');
      [].forEach.call(el.querySelectorAll('.v2-lng'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false'); });
      fit();
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.v2-lng');
      if (b) { paint(b.getAttribute('data-lang')); return; }
      var a = e.target.closest && e.target.closest('[data-go]');
      if (a) { e.preventDefault(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    paint('en');
    window.addEventListener('resize', fit);
    window.addEventListener('load', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    // Phones: the sticky button is for getting to the form, so hide it while the form is on screen.
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        el.querySelector('.v2-mbar').classList.toggle('v2-mbar-off', entries[0].isIntersecting);
      }).observe(form);
    }
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
