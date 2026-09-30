// Inlined in <head> so the theme is set before first paint (SPEC.md §5.1).
// Three states: system (no data-theme), light, dark; the choice survives reloads.
(() => {
  const root = document.documentElement;
  const key = 'tema';
  const themes = ['', 'light', 'dark'];
  const en = root.lang === 'en';
  const prefix = en ? 'Theme' : 'Tema';
  const labels = en ? { '': 'system', light: 'light', dark: 'dark' } : { '': 'sistema', light: 'chiaro', dark: 'scuro' };

  let theme = '';
  try {
    theme = localStorage.getItem(key) ?? '';
  } catch {}
  if (!themes.includes(theme)) theme = '';

  const apply = () => {
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.textContent = `${prefix}: ${labels[theme]}`;
    }
  };

  root.dataset.js = '';
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    apply();
    try {
      if (theme) localStorage.setItem(key, theme);
      else localStorage.removeItem(key);
    } catch {}
  });
})();
