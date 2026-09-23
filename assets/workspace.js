(() => {
  'use strict';
  // Preserve the existing preference/draft keys; a blocked storage API must not stop the app.
  const memory = new Map();
  window.SponsorFlowStorage = {
    getItem(key) { if (memory.has(key)) return memory.get(key); try { return localStorage.getItem(key); } catch (_) { return null; } },
    setItem(key, value) { memory.set(key, String(value)); try { localStorage.setItem(key, value); return true; } catch (_) { return false; } },
    removeItem(key) { memory.delete(key); try { localStorage.removeItem(key); } catch (_) {} }
  };
  window.addEventListener('storage', event => { if (event.key) memory.delete(event.key); else memory.clear(); });
  const storage = window.SponsorFlowStorage;
  const nameKey = 'asmeMemberName';
  const cleanName = value => String(value || '').trim().replace(/\s+/g, ' ');
  const validName = value => /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'’\-]{1,39}$/u.test(value);
  let resolveIdentity;
  const ready = new Promise(resolve => { resolveIdentity = resolve; });
  let dialog, nameButton;
  function savedName() { return cleanName(storage.getItem(nameKey)); }
  function saveName(value) {
    const name = cleanName(value);
    if (!validName(name)) throw new Error('Enter 2–40 letters, numbers, spaces, apostrophes, or hyphens.');
    const changed = name !== savedName();
    // Keep the existing field keys for drafts and older page versions.
    for (const key of [nameKey, 'asmePlannerName', 'asmeSponsorFlowName']) storage.setItem(key, name);
    if (nameButton) nameButton.textContent = name;
    if (changed) window.dispatchEvent(new CustomEvent('sponsorflow:identity', { detail: { name } }));
    resolveIdentity(name);
    return name;
  }
  function suggestedName() {
    try {
      const player = JSON.parse(storage.getItem('asmeGamesV1') || 'null')?.profile;
      if (player?.name) return player.name;
    } catch (_) {}
    return storage.getItem('asmePlannerName') || storage.getItem('asmeSponsorFlowName') || '';
  }
  function openIdentity() {
    const name = savedName();
    dialog.querySelector('input').value = name || suggestedName();
    dialog.querySelector('[data-identity-status]').textContent = '';
    dialog.querySelector('[data-member-cancel]').hidden = !validName(name);
    dialog.querySelector('h2').textContent = name ? 'Your name' : 'Welcome to Purdue ASME';
    document.body.classList.add('dialog-open');
    dialog.showModal();
    dialog.querySelector('input').focus();
  }
  window.SponsorFlowIdentity = { ready, save: saveName, get name() { return savedName(); }, open: openIdentity };
  document.addEventListener('DOMContentLoaded', () => {
    dialog = document.createElement('dialog');
    dialog.id = 'memberWelcomeDialog';
    dialog.className = 'member-welcome';
    dialog.setAttribute('aria-labelledby', 'memberWelcomeTitle');
    dialog.setAttribute('aria-describedby', 'memberWelcomeDescription');
    dialog.innerHTML = `<form id="memberWelcomeForm">
      <p class="eyebrow">Indianapolis Student Section</p>
      <h2 id="memberWelcomeTitle">Welcome to Purdue ASME</h2>
      <p id="memberWelcomeDescription">Enter your name for attendance, project updates, and the club Games leaderboard. We’ll remember it on this browser.</p>
      <label class="field"><span>Your name</span><input id="memberWelcomeName" name="name" autocomplete="name" minlength="2" maxlength="40" required></label>
      <p class="member-privacy">Your name appears with your contributions and shared game scores.</p>
      <p class="form-status is-error" data-identity-status role="status"></p>
      <div class="member-welcome-actions"><button class="button button-primary" type="submit">Continue</button><button class="button button-secondary" type="button" data-member-cancel hidden>Cancel</button></div>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('cancel', event => { if (!validName(savedName())) event.preventDefault(); });
    dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open'); });
    dialog.querySelector('[data-member-cancel]').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      try { saveName(dialog.querySelector('input').value); dialog.close(); }
      catch (error) { dialog.querySelector('[data-identity-status]').textContent = error.message; }
    };
    nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'member-name-button';
    nameButton.setAttribute('aria-label', 'Edit your name');
    nameButton.onclick = openIdentity;
    document.querySelector('.site-header')?.appendChild(nameButton);
    if (validName(savedName())) { saveName(savedName()); }
    else openIdentity();
    nameButton.textContent = savedName() || 'Your name';
  });
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
