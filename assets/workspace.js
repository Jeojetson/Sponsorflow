(() => {
  'use strict';
  // Preserve the existing preference/draft keys; a blocked storage API must not stop the app.
  const memory = new Map();
  window.SponsorFlowStorage = {
    getItem(key) { try { return localStorage.getItem(key) ?? memory.get(key) ?? null; } catch (_) { return memory.get(key) ?? null; } },
    setItem(key, value) { memory.set(key, String(value)); try { localStorage.setItem(key, value); } catch (_) {} },
    removeItem(key) { memory.delete(key); try { localStorage.removeItem(key); } catch (_) {} }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const explorer = document.querySelector('.workspace-explorer');
    if (explorer) explorer.open = true;
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.top-nav .nav-link').forEach(link => {
      const active = link.getAttribute('href') === page;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelectorAll('.filter-disclosure[open],.board-more-actions[open],.calendar-more-actions[open]').forEach(item => { item.open = false; item.querySelector('summary')?.focus(); });
    });
  });
})();
