/* The site's header on the static Stoic pages (public/apps/stoic-*.html): brand, the four sections and the EN · RU pill,
   drawn as src/components/site/SiteHeader.tsx draws them on every other page (tests/site/static-chrome.test.mjs keeps the
   two in step). Load it as the first thing in <body> with a plain <script src="/apps/site-chrome.js"></script>: it writes the
   header in place before anything paints, so nothing moves. Styles: /apps/site-chrome.css.

   Language: ?lang=en|ru, else the choice kept by these pages, else the site's own choice, else English. The pill switches this
   page's language (same page, same query and hash, ?lang changed) and remembers it for these pages and for the site, as the
   site's own switch does (localStorage, never a cookie). The page reads the result from window.siteChrome.lang. */
(function () {
  'use strict';
  var PAGE_KEY = 'stoic-constitution:lang', SITE_KEY = 'site-lang';
  var ICONS = {
    food: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18M18 3c-3 3-3 7 0 9h2M20 3v18',
    travel: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-3 5-5 3 3-5 5-3Z',
    fitness: 'M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12',
    science: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-3-1-7-1-10 1V5Z'
  };
  var WORDS = {
    en: {sections: 'Site sections', language: 'Language', food: 'Food', travel: 'Travel', fitness: 'Fitness', stoicism: 'Stoicism'},
    ru: {sections: 'Разделы сайта', language: 'Язык', food: 'Еда', travel: 'Поездки', fitness: 'Фитнес', stoicism: 'Стоицизм'}
  };
  // [key, path, icon, class]: the order, paths, icons and classes of SiteHeader.tsx.
  var SECTIONS = [
    ['food', '/food', 'food', ''],
    ['travel', '/travel', 'travel', 'nav-section'],
    ['fitness', '/fitness', 'fitness', 'nav-section nav-fitness'],
    ['stoicism', null, 'science', 'nav-section nav-stoicism']
  ];
  var stored = function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } };
  var keep = function (key, value) { try { localStorage.setItem(key, value); } catch (e) { /* the link carries the choice for this visit */ } };
  var lang = (function () {
    var asked = new URLSearchParams(location.search).get('lang');
    if (asked === 'en' || asked === 'ru') { keep(PAGE_KEY, asked); return asked; }
    var page = stored(PAGE_KEY), site = stored(SITE_KEY);
    return page === 'en' || page === 'ru' ? page : site === 'ru' ? 'ru' : 'en';
  })();
  var local = function (path) { return lang === 'ru' ? (path === '/' ? '/ru' : '/ru' + path) : path; };
  var escape = function (text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  // This page in the other language: the same query with ?lang changed, and the same hash.
  var switched = function (to) {
    var query = new URLSearchParams(location.search);
    query.set('lang', to);
    return location.pathname + '?' + query.toString() + location.hash;
  };
  var icon = function (name) {
    return '<svg class="action-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>';
  };
  var words = WORDS[lang];
  var html = '<header class="site-header" lang="' + lang + '">'
    + '<a class="brand" href="' + local('/') + '"><span class="brand-mark" aria-hidden="true"></span>ilyadays</a>'
    + '<nav class="site-primary-nav" aria-label="' + escape(words.sections) + '">';
  SECTIONS.forEach(function (section) {
    var href = section[1] ? local(section[1]) : '/apps/stoic-constitution.html?lang=' + lang;
    html += '<a href="' + escape(href) + '"' + (section[3] ? ' class="' + section[3] + '"' : '') + (section[0] === 'stoicism' ? ' aria-current="page"' : '')
      + '>' + icon(section[2]) + '<span>' + escape(words[section[0]]) + '</span></a>';
  });
  html += '</nav><div class="header-end"><nav class="lang" aria-label="' + escape(words.language) + '">';
  ['en', 'ru'].forEach(function (code, i) {
    if (i) html += '<span class="sep" aria-hidden="true">·</span>';
    html += code === lang ? '<span class="on" aria-current="true">' + code.toUpperCase() + '</span>'
      : '<a href="' + escape(switched(code)) + '" hreflang="' + code + '" lang="' + code + '" data-lang="' + code + '">' + code.toUpperCase() + '</a>';
  });
  html += '</nav></div></header>';

  var script = document.currentScript;
  if (script && script.parentNode) script.insertAdjacentHTML('beforebegin', html);
  else document.body.insertAdjacentHTML('afterbegin', html);

  // The switch: remember the choice here and for the rest of the site, then open this page in that language. The page may
  // have rewritten its query since (a chapter, a voice), so the address is taken at the moment of the click.
  var links = document.querySelectorAll('.site-header .lang a[data-lang]');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function (event) {
      var to = this.getAttribute('data-lang');
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      keep(PAGE_KEY, to);
      keep(SITE_KEY, to);
      location.assign(switched(to));
    });
  }
  // The header is sticky; pages pin their own bars below it at top: var(--chrome-h).
  var header = document.querySelectorAll('.site-header')[0], root = document.documentElement;
  var measure = function () { if (header && root) root.style.setProperty('--chrome-h', header.offsetHeight + 'px'); };
  measure();
  if (header && window.ResizeObserver) new ResizeObserver(measure).observe(header);
  else if (window.addEventListener) window.addEventListener('resize', measure);
  window.siteChrome = {lang: lang};
})();
