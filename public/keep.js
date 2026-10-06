// Keep the scroll position when the page is reloaded or reopened via back/forward.
(() => {
  const KEY = `page:${location.pathname}`;
  const nav = (performance.getEntriesByType('navigation')[0] || {}).type;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { /* storage blocked */ }
  if ((nav === 'reload' || nav === 'back_forward') && saved.y > 0 && !location.hash) {
    const go = () => window.scrollTo(0, saved.y);
    go(); window.addEventListener('load', go, { once: true });
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ y: Math.round(scrollY), t: Date.now() })); } catch (_) { /* blocked */ } };
  let pending = 0;
  addEventListener('scroll', () => { if (!pending) pending = setTimeout(() => { pending = 0; save(); }, 250); }, { passive: true });
  addEventListener('pagehide', save);
})();
