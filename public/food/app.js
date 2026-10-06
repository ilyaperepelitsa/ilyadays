(() => {
  // Remembered per page: scroll position and ticked items. Restored on reload and back/forward, and when the
  // page is reopened within a cooking session (12 h) — e.g. the phone dropped the tab while you were cooking.
  const KEY = `page:${location.pathname}`;
  const SESSION_MS = 12 * 60 * 60 * 1000;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } };
  const save = (patch) => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch, t: Date.now() })); } catch (_) { /* storage blocked */ }
  };
  const tickable = () => [...document.querySelectorAll('.ingredients li, li.step')];
  const nav = (performance.getEntriesByType('navigation')[0] || {}).type;
  const saved = load();
  const resume = nav === 'reload' || nav === 'back_forward' || (saved.t && Date.now() - saved.t < SESSION_MS);

  if (resume && Array.isArray(saved.done)) {
    const items = tickable();
    saved.done.forEach((i) => items[i] && items[i].classList.add('done'));
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (resume && saved.y > 0 && !location.hash) {
    // Pictures load lazily, so re-apply until the page settles or the reader scrolls themselves.
    let userMoved = false;
    const go = () => { if (!userMoved) window.scrollTo(0, saved.y); };
    const stop = () => { userMoved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, stop, { once: true, passive: true }));
    go();
    requestAnimationFrame(go);
    window.addEventListener('load', go, { once: true });
    setTimeout(go, 600);
  }
  let pending = 0;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = setTimeout(() => { pending = 0; save({ y: Math.round(window.scrollY) }); }, 250);
  }, { passive: true });
  window.addEventListener('pagehide', () => save({ y: Math.round(window.scrollY) }));

  // Tap ingredients and steps to tick them off while cooking.
  document.addEventListener('click', (e) => {
    if (e.target.closest('a, input, label, summary, table')) return;
    const li = e.target.closest('.ingredients li, li.step');
    if (!li) return;
    li.classList.toggle('done');
    save({ done: tickable().map((el, i) => (el.classList.contains('done') ? i : -1)).filter((i) => i >= 0) });
  });

  // Label table cells so wide tables can stack into cards on phones.
  document.querySelectorAll('table.stack').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) =>
      [...tr.cells].forEach((td, i) => { td.dataset.label = heads[i] || ''; }));
  });

  // Vinegar picker (cucumber pickle): swap amounts to match rice vinegar's acidity.
  const picker = document.querySelector('[data-vinegar-picker]');
  if (picker && window.VINEGARS) {
    const apply = (key) => {
      const v = window.VINEGARS[key];
      if (!v) return;
      document.querySelectorAll('[data-v]').forEach((el) => { el.textContent = v[el.dataset.v] || '—'; });
      document.querySelectorAll('[data-v-row]').forEach((el) => {
        const li = el.closest('li');
        if (li) li.hidden = !v[el.dataset.vRow];
      });
      document.querySelectorAll('[data-v-show]').forEach((el) => { el.hidden = !v[el.dataset.vShow]; });
      try { localStorage.setItem('vinegar', key); } catch (_) { /* storage blocked */ }
    };
    picker.addEventListener('change', (e) => apply(e.target.value));
    let saved = 'rice';
    try { saved = localStorage.getItem('vinegar') || 'rice'; } catch (_) { /* storage blocked */ }
    const input = picker.querySelector(`input[value="${saved}"]`);
    if (input) input.checked = true;
    apply(input ? saved : 'rice');
  }
})();
