// Replaces the bits of the GoHighLevel runtime the static copy still needs.

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

// Number counters: count up from 0 to the value held in the hidden spacer.
(function () {
  var sections = Array.prototype.slice.call(document.querySelectorAll('.counter-value-section'));
  function run(section) {
    var target = section.querySelector('.counter-value-spacer').textContent;
    var out = section.querySelector('.counter-value-animated');
    var m = target.match(/\d+/);
    if (!m) { out.textContent = target; return; }
    var end = parseInt(m[0], 10), start = null;
    function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / 2000, 1);
      out.textContent = target.replace(m[0], Math.round(end * p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function check() {
    sections = sections.filter(function (s) {
      var r = s.getBoundingClientRect();
      if (r.height && r.top < window.innerHeight && r.bottom > 0) { run(s); return false; }
      return true;
    });
    if (!sections.length) window.removeEventListener('scroll', check);
  }
  window.addEventListener('scroll', check, { passive: true });
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

// YouTube videos: the runtime swaps the thumbnail placeholder for an embed.
(function () {
  document.querySelectorAll('.video-container.youtube [data-bg-src]').forEach(function (el) {
    var m = el.getAttribute('data-bg-src').match(/vi\/([^/]+)\//) || [];
    var id = el.getAttribute('data-video-id') || m[1] || '2dYRKkFv3es';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;';
    wrap.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?rel=0&controls=1" title="YouTube video"' +
      ' style="position:absolute;inset:0;width:100%;height:100%;border:0" loading="lazy"' +
      ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    el.replaceWith(wrap);
  });
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

// Image sliders: arrows and dots; slides are wrapped by a clone at each end.
(function () {
  var ARROWS = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"></path></svg>' +
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"></path></svg>';
  document.querySelectorAll('.c-image-slider .carousel').forEach(function (carousel) {
    var track = carousel.querySelector('.carousel__slides');
    var count = track.children.length - 2;
    if (count < 1) return;
    var index = 1, busy = false;

    // The server usually renders the controls; build them only if missing.
    var arrows = carousel.querySelector('.carousel__arrow');
    if (!arrows) {
      arrows = document.createElement('div');
      arrows.className = 'carousel__arrow';
      arrows.innerHTML = ARROWS;
      arrows.setAttribute('data-v-cbdc8153', '');
      carousel.appendChild(arrows);
    }
    var dots = carousel.querySelector('.carousel__pagination-container');
    if (!dots) {
      dots = document.createElement('div');
      dots.className = 'carousel__pagination-container';
      dots.setAttribute('data-v-cbdc8153', '');
      for (var i = 0; i < count; i++) dots.appendChild(document.createElement('div'));
      carousel.appendChild(dots);
    }

    function render(animate) {
      track.style.transitionDuration = animate ? '300ms' : '0ms';
      track.style.transform = 'translateX(' + (-100 * index) + '%)';
      [].forEach.call(dots.children, function (d, i) {
        d.className = 'carousel__pagination ' + (i === (index - 1 + count) % count ? 'carousel__pagination-active' : 'carousel__pagination-inactive');
      });
    }
    function go(to) {
      if (busy) return;
      busy = true;
      index = to;
      render(true);
      setTimeout(function () {
        if (index === 0) index = count;
        if (index === count + 1) index = 1;
        render(false);
        busy = false;
      }, 320);
    }
    track.addEventListener('click', function (e) { if (e.target.closest('a[href="#"]')) e.preventDefault(); });
    arrows.children[0].addEventListener('click', function () { go(index - 1); });
    arrows.children[1].addEventListener('click', function () { go(index + 1); });
    [].forEach.call(dots.children, function (d, i) { d.addEventListener('click', function () { go(i + 1); }); });
    render(false);
  });
})();
