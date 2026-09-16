// Set this to the shared OneDrive folder when the resource library is ready.
window.ASME_RESOURCES = { url: '' };
(() => {
  const url = window.ASME_RESOURCES.url;
  if (!url) return;
  let target;
  try { target = new URL(url); } catch (_) { return; }
  if (target.protocol !== 'https:') return;
  const link = document.getElementById('resourceLink');
  if (!link) return;
  link.href = target.href;
  link.classList.remove('is-hidden');
  document.getElementById('resourceStatus').hidden = true;
  document.getElementById('resourceDescription').textContent = 'Brand files, templates, and reference material for the team.';
})();
