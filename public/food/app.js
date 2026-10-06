(() => {
  // Tap ingredients and steps to tick them off while cooking.
  document.addEventListener('click', (e) => {
    if (e.target.closest('a, input, label, summary, table')) return;
    const li = e.target.closest('.ingredients li, li.step');
    if (li) li.classList.toggle('done');
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
