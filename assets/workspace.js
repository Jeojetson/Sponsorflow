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
    const compact = matchMedia('(max-width:720px)');
    if (explorer) {
      explorer.open = !compact.matches;
      compact.addEventListener('change', event => { explorer.open = !event.matches; });
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelectorAll('.filter-disclosure[open],.board-more-actions[open],.calendar-more-actions[open]').forEach(item => { item.open = false; item.querySelector('summary')?.focus(); });
    });
  });
})();
