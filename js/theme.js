(() => {
  const root = document.documentElement;
  const key = 'aiesec-denizli-theme';
  let theme = 'light';
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch { /* The toggle also works when storage is unavailable. */ }
  root.dataset.theme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    function updateButton() {
      const dark = root.dataset.theme === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Açık temaya geç' : 'Koyu temaya geç');
      button.title = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
    }
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch { /* Optional preference. */ }
      updateButton();
    });
    window.addEventListener('storage', event => {
      if (event.key === key) {
        root.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
        updateButton();
      }
    });
    updateButton();
  });
})();
