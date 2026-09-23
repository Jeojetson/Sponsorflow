(() => {
  'use strict';
  const C = window.SFReels, api = window.SFReelsService, storage = window.SponsorFlowStorage;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let name = '', epoch = 0, tab = 'feed', feed = [], saved = [], selected = null, next = '', filterRun = 0;
  let peer = '', conversations = [], messages = [], before = '', attachment = null, shareReel = null, threadRun = 0, refreshing = false;
  let player = null, playerRun = 0, playerLoading = false, youtubePromise = null;
  let poll, touchY, savedRun = 0;
  const pendingSaves = new Set();
  const status = (id, message, error = false) => { $(id).textContent = message; $(id).classList.toggle('is-error', error); };
  const stamp = value => { const d = new Date(value); return isNaN(d.getTime()) ? '' : d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); };
  const permalink = item => new URL('reels.html?reel=' + encodeURIComponent(item.id), location.href).href;
  function openDialog(id) { stopPlayer(); $(id).showModal(); document.body.classList.add('dialog-open'); }
  function closeDialog(id) { $(id).close(); }
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeDialog(b.dataset.close));
  document.querySelectorAll('.reels-dialog').forEach(d => d.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open'); }));
  function eligible() {
    const rect = $('reelsStage').getBoundingClientRect();
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
    const mobileNav = document.querySelector('.mobile-app-nav')?.getBoundingClientRect();
    const bottom = mobileNav?.height ? Math.min(innerHeight, mobileNav.top) : innerHeight;
    const visible = Math.max(0, Math.min(bottom, rect.bottom) - Math.max(0, headerBottom, rect.top));
    return !document.hidden && !document.querySelector('dialog[open]') && tab !== 'messages' && rect.height > 0 && visible / rect.height > .5;
  }
  function stopPlayer() {
    playerRun++; playerLoading = false;
    if (player) { try { player.destroy(); } catch (_) {} player = null; }
    if (selected) poster();
  }
  function poster() {
    if (!selected) { $('reelsStage').replaceChildren(); return; }
    $('reelsStage').innerHTML = `<button type="button" class="reels-poster" aria-label="Play ${esc(selected.title)}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${esc(selected.videoId)}/hqdefault.jpg"><span>▶ Play Short</span></button>`;
    $('reelsStage').querySelector('button').onclick = () => play(false);
    $('reelsStage').querySelector('img').onerror = event => { event.currentTarget.hidden = true; };
  }
  function youtube() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubePromise) return youtubePromise;
    youtubePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); let finished = false;
      const fail = () => { if (finished) return; finished = true; clearTimeout(timeout); script.remove(); youtubePromise = null; reject(new Error('YouTube could not load. Try Play again or open the Short on YouTube.')); };
      const timeout = setTimeout(fail, 15000);
      window.onYouTubeIframeAPIReady = () => { if (finished) return; finished = true; clearTimeout(timeout); resolve(window.YT); };
      script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.onerror = fail; document.head.appendChild(script);
    });
    return youtubePromise;
  }
  async function play(automatic) {
    if (!selected || playerLoading || player || !eligible()) return;
    const run = ++playerRun, item = selected; playerLoading = true;
    status('reelsPlaybackStatus', 'Opening YouTube…');
    try {
      const YT = await youtube();
      if (run !== playerRun || !eligible()) { if (run === playerRun) playerLoading = false; return; }
      const frame = document.createElement('iframe'); frame.title = item.title + ' · YouTube';
      frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen = true;
      frame.src = 'https://www.youtube-nocookie.com/embed/' + item.videoId + '?' + new URLSearchParams({ enablejsapi:'1', origin:location.origin, playsinline:'1', controls:'1', autoplay:'0' });
      $('reelsStage').replaceChildren(frame);
      player = new YT.Player(frame, { events: {
        onReady(event) {
          if (run !== playerRun) return;
          playerLoading = false;
          if (!eligible()) { stopPlayer(); return; }
          if (automatic) event.target.mute();
          event.target.playVideo(); status('reelsPlaybackStatus', automatic ? 'Muted · use the YouTube controls for sound.' : 'Use the YouTube controls for playback and captions.');
        },
        onAutoplayBlocked() { if (run === playerRun) status('reelsPlaybackStatus', 'Tap Play in the YouTube player to continue.'); },
        onError(event) {
          if (run !== playerRun) return;
          const message = [100,101,150].includes(event.data) ? 'This Short is unavailable here. Open it on YouTube or choose the next reel.' : 'YouTube could not play this Short here. Try again or open it on YouTube.';
          stopPlayer(); status('reelsPlaybackStatus', message, true);
        }
      }});
    } catch (error) { if (run === playerRun) { playerLoading = false; poster(); status('reelsPlaybackStatus', error.message, true); } }
  }
  new IntersectionObserver(() => { if ((player || playerLoading) && !eligible()) stopPlayer(); }, { threshold:[0,.5,1] }).observe($('reelsStage'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayer(); else if (tab === 'messages') refreshMessages(); schedulePoll(); });
  window.addEventListener('pagehide', stopPlayer);
  function visibleItems() {
    const query = $('reelsSearch').value.trim().toLowerCase();
    return (tab === 'saved' ? saved : feed).filter(item => !query || `${item.title} ${item.caption} ${item.author}`.toLowerCase().includes(query));
  }
  function renderSaved() {
    $('reelsSavedCount').textContent = saved.length;
    const isSaved = selected && saved.some(r => r.id === selected.id);
    $('reelsSave').textContent = isSaved ? 'Saved ✓' : 'Save reel'; $('reelsSave').setAttribute('aria-pressed', String(Boolean(isSaved)));
    $('reelsSave').disabled = !name || Boolean(selected && pendingSaves.has(C.nameKey(name) + '|' + selected.id));
  }
  function choose(item, autoplay = false) {
    stopPlayer(); selected = item;
    if (!item) return;
    poster(); status('reelsPlaybackStatus', 'Tap Play to watch here.');
    $('reelsCategory').textContent = item.category === 'karting' ? 'Karting' : 'Community';
    $('reelsTitle').textContent = item.title; $('reelsCaption').textContent = item.caption;
    $('reelsAuthor').textContent = 'Shared by ' + item.author + ' · ' + stamp(item.createdAt);
    $('reelsYoutube').href = C.url(item.videoId); renderSaved(); renderPosition();
    if (autoplay && $('reelsAutoplay').checked && !matchMedia('(prefers-reduced-motion: reduce)').matches) play(true);
  }
  function renderPosition() {
    const rows = visibleItems(), i = rows.findIndex(r => r.id === selected?.id);
    $('reelsPosition').textContent = i >= 0 ? `${i + 1} / ${rows.length}` : '';
    $('reelsPrev').disabled = i <= 0; $('reelsNext').disabled = i < 0 || i >= rows.length - 1;
    $('reelsList').querySelectorAll('button').forEach(b => { if (b.dataset.id === selected?.id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }
  function renderWatch(preserve = true) {
    const rows = visibleItems();
    $('reelsViewer').hidden = !rows.length; $('reelsBrowse').hidden = !rows.length;
    $('reelsEmpty').hidden = !!rows.length;
    $('reelsEmpty').textContent = $('reelsSearch').value ? 'No matches among the loaded reels. Clear your search or load more.' : tab === 'saved' ? 'Your saved reels will appear here. Save something from the feed to watch or share later.' : 'No reels here yet. Add a YouTube Short to get the club feed started.';
    $('reelsMore').hidden = tab !== 'feed' || !next;
    $('reelsList').innerHTML = rows.map(r => `<button type="button" data-id="${esc(r.id)}"><small>${r.category === 'karting' ? 'Karting' : 'Community'} · ${esc(r.author)}</small><strong>${esc(r.title)}</strong></button>`).join('');
    $('reelsList').querySelectorAll('button').forEach(b => b.onclick = () => { choose(rows.find(r => r.id === b.dataset.id), true); $('reelsViewer').scrollIntoView({ block:'start' }); });
    const old = preserve && rows.find(r => r.id === selected?.id);
    if (!old) choose(rows[0] || null); else renderPosition();
    renderSaved();
  }
  async function loadFeed(more = false) {
    const run = ++filterRun, filter = $('reelsFilter').value;
    $('reelsRefresh').disabled = true; $('reelsMore').disabled = true; status('reelsStatus', 'Loading club reels…');
    try {
      const result = await api.read('reelsFeed', { filter, after:more ? next : '' });
      if (run !== filterRun) return;
      feed = more ? [...new Map([...feed,...result.items].map(r => [r.id,r])).values()] : result.items; next = result.next;
      if (tab === 'feed') renderWatch(more);
      status('reelsStatus', `${feed.length} of ${result.total} reels loaded.`); people();
    } catch (error) { if (run === filterRun) status('reelsStatus', error.message, true); }
    finally { if (run === filterRun) { $('reelsRefresh').disabled = false; $('reelsMore').disabled = false; } }
  }
  async function loadSaved() {
    if (!name) return;
    if ([...pendingSaves].some(key => key.startsWith(C.nameKey(name) + '|'))) return;
    const generation = epoch, owner = name, run = ++savedRun;
    try {
      const result = await api.read('reelsSaved', { name:owner });
      if (generation !== epoch || run !== savedRun) return;
      saved = result.items; renderSaved(); if (tab === 'saved') renderWatch();
    } catch (error) { if (generation === epoch && tab === 'saved') status('reelsStatus', error.message, true); }
  }
  async function saveSelected() {
    if (!selected || !name) return;
    const item = selected, owner = name, generation = epoch, key = C.nameKey(owner) + '|' + item.id;
    if (pendingSaves.has(key)) return;
    const active = !saved.some(r => r.id === item.id); savedRun++; api.invalidate('reelsSaved', { name:owner }); pendingSaves.add(key); renderSaved();
    try {
      await api.request('reelsSave', { name:owner, reelId:item.id, active });
      if (generation !== epoch) return;
      saved = active ? [item,...saved.filter(r => r.id !== item.id)] : saved.filter(r => r.id !== item.id);
      status('reelsStatus', active ? 'Saved under your name. Find it in Saved on any device.' : 'Removed from Saved.');
      if (tab === 'saved') renderWatch();
    } catch (error) { if (generation === epoch) status('reelsStatus', error.message, true); }
    finally { api.invalidate('reelsSaved', { name:owner }); pendingSaves.delete(key); renderSaved(); }
  }
  async function copySelected() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(permalink(selected)); status('reelsStatus', 'Reel link copied.'); }
    catch (_) { status('reelsStatus', 'Copy this link: ' + permalink(selected)); }
  }
  function switchTab(value) {
    persistDraft(); stopPlayer(); tab = value;
    $('reelsWatch').hidden = tab === 'messages'; $('reelsMessages').hidden = tab !== 'messages';
    document.querySelectorAll('[data-reels-tab]').forEach(b => { if (b.dataset.reelsTab === tab) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    $('reelsFilter').parentElement.hidden = tab !== 'feed'; $('reelsFeedHint').textContent = tab === 'saved' ? 'Saved under your SponsorFlow name, ready to watch or send.' : 'A mix of club submissions, with karting up front. Add a Short to shape the feed.';
    status('reelsStatus', ''); history.replaceState(null, '', location.pathname + location.search + (tab === 'feed' ? '' : '#' + tab));
    if (tab === 'messages') refreshMessages(); else { renderWatch(false); if (tab === 'saved') loadSaved(); }
    schedulePoll();
  }
  function step(delta) { const rows = visibleItems(), i = rows.findIndex(r => r.id === selected?.id); if (rows[i + delta]) choose(rows[i + delta], true); }
  $('reelsPrev').onclick = () => step(-1); $('reelsNext').onclick = () => step(1);
  document.addEventListener('keydown', event => {
    if (tab === 'messages' || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (['ArrowUp','ArrowDown'].includes(event.key)) { event.preventDefault(); step(event.key === 'ArrowUp' ? -1 : 1); }
  });
  $('reelsViewer').addEventListener('touchstart', e => { if (!e.target.closest('a,button,input,select,iframe')) touchY = e.changedTouches[0].clientY; }, { passive:true });
  $('reelsViewer').addEventListener('touchend', e => { if (touchY != null) { const delta = touchY - e.changedTouches[0].clientY; if (Math.abs(delta) > 90) step(delta > 0 ? 1 : -1); } touchY = null; }, { passive:true });
  function people() {
    const names = [...new Set([...feed.map(r => r.author),...conversations.map(c => c.name)])].filter(n => !name || C.nameKey(n) !== C.nameKey(name)).sort();
    $('reelsPeople').innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
  }
  const draftKey = (owner = name, recipient = peer) => 'asmeReelsDraft:' + C.nameKey(owner) + ':' + C.nameKey(recipient);
  function draft(owner = name, recipient = peer) { try { return JSON.parse(storage.getItem(draftKey(owner,recipient)) || '{}'); } catch (_) { return {}; } }
  function persistDraft() {
    if (!name || !peer) return;
    const old = draft(), body = $('reelsMessageBody').value;
    storage.setItem(draftKey(), JSON.stringify({ ...old, body, attachment }));
  }
  function renderAttachment() {
    $('reelsAttachment').hidden = !attachment;
    $('reelsAttachment').innerHTML = attachment ? `<span>Sharing: <strong>${esc(attachment.title)}</strong></span><button type="button" class="button button-secondary" aria-label="Remove attached reel">×</button>` : '';
    if (attachment) $('reelsAttachment').querySelector('button').onclick = () => { attachment = null; renderAttachment(); persistDraft(); };
  }
  function renderConversations() {
    $('reelsInboxName').textContent = name ? name + '’s inbox' : '';
    const total = conversations.reduce((n,c) => n + c.unread, 0);
    $('reelsUnread').textContent = total; $('reelsUnread').hidden = !total;
    $('reelsConversations').innerHTML = conversations.length ? conversations.map(c => `<button type="button" data-peer="${esc(c.name)}" ${peer && C.nameKey(peer) === c.peerKey ? 'aria-current="true"' : ''}><strong>${esc(c.name)}</strong>${c.unread ? ` · ${c.unread} unread` : ''}<small>${esc(c.preview)}</small></button>`).join('') : '<p class="reels-hint">No conversations yet. Send a message or share a reel to start one.</p>';
    $('reelsConversations').querySelectorAll('button').forEach(b => b.onclick = () => openPeer(b.dataset.peer)); people();
  }
  function renderMessages(scroll = false) {
    const key = name ? C.nameKey(name) : '';
    $('reelsMessageList').innerHTML = messages.length ? messages.map(m => `<article class="reels-bubble ${m.fromKey === key ? 'is-mine' : ''}"><small>${esc(m.fromName)}</small>${m.body ? `<p>${esc(m.body)}</p>` : ''}${m.reel ? `<a href="${esc(permalink(m.reel))}" data-reel="${esc(m.reel.id)}">▶ ${esc(m.reel.title)}</a>` : m.reelId ? '<p class="reels-hint">This reel was removed from the feed.</p>' : ''}<small>${esc(stamp(m.createdAt))}</small></article>`).join('') : '<p class="reels-hint">Start the conversation.</p>';
    $('reelsMessageList').querySelectorAll('[data-reel]').forEach(a => a.onclick = event => { event.preventDefault(); const item = messages.find(m => m.reel?.id === a.dataset.reel)?.reel; if (item) openReel(item); });
    $('reelsOlder').hidden = !before;
    if (scroll) $('reelsMessageList').scrollTop = $('reelsMessageList').scrollHeight;
  }
  async function loadThread(older = false) {
    if (!peer || !name) return;
    const generation = epoch, recipient = peer, owner = name, run = ++threadRun;
    $('reelsOlder').disabled = true;
    try {
      const result = await api.read('reelsThread', { name:owner, peer:recipient, before:older ? before : '', markRead:tab === 'messages' && !document.hidden });
      if (generation !== epoch || recipient !== peer || run !== threadRun) return;
      const latest = messages[messages.length-1]?.id;
      messages = [...new Map([...messages,...result.messages].map(m => [m.id,m])).values()].sort((a,b) => C.orderKey(a).localeCompare(C.orderKey(b)));
      if (older || messages.length <= 50) before = result.before;
      renderMessages(!older && latest !== messages[messages.length-1]?.id);
    } catch (error) { if (generation === epoch && recipient === peer && run === threadRun) status('reelsSendStatus', error.message, true); }
    finally { if (run === threadRun) $('reelsOlder').disabled = false; }
  }
  async function refreshMessages() {
    if (!name || document.hidden || refreshing) return;
    const generation = epoch, owner = name; refreshing = true;
    $('reelsRefreshMessages').disabled = true;
    try {
      if (peer) await loadThread();
      const result = await api.read('reelsInbox', { name:owner });
      if (generation !== epoch) return;
      conversations = result.conversations; renderConversations();
    } catch (error) { if (generation === epoch) status('reelsStatus', error.message, true); }
    finally { if (generation === epoch) { refreshing = false; $('reelsRefreshMessages').disabled = false; } }
  }
  function schedulePoll() { clearTimeout(poll); if (tab === 'messages' && !document.hidden) poll = setTimeout(async () => { await refreshMessages(); schedulePoll(); },30000); }
  function openPeer(recipient, reel = null) {
    persistDraft(); peer = C.name(recipient); messages = []; before = ''; threadRun++;
    $('reelsThreadEmpty').hidden = true; $('reelsThread').hidden = false; $('reelsPeer').textContent = peer;
    const savedDraft = draft(); $('reelsMessageBody').value = savedDraft.body || ''; attachment = reel || savedDraft.attachment || null;
    renderAttachment(); persistDraft(); status('reelsSendStatus', 'Loading conversation…'); renderMessages(); renderConversations();
    loadThread().then(() => { if ($('reelsSendStatus').textContent === 'Loading conversation…') status('reelsSendStatus',''); });
  }
  function recipientDialog(item) { shareReel = item; $('reelsRecipientForm').reset(); status('reelsRecipientStatus',''); people(); openDialog('reelsRecipientDialog'); }
  function openReel(item) { switchTab('feed'); if (!feed.some(r => r.id === item.id)) feed.unshift(item); $('reelsSearch').value = ''; renderWatch(); choose(item); $('main').scrollIntoView(); }
  $('reelsRecipientForm').onsubmit = event => {
    event.preventDefault();
    try { const recipient = C.name($('reelsRecipient').value); if (C.nameKey(recipient) === C.nameKey(name)) throw new Error('Choose another member. Use Saved for your own reels.'); closeDialog('reelsRecipientDialog'); const item = shareReel; shareReel = null; switchTab('messages'); openPeer(recipient, item); }
    catch (error) { status('reelsRecipientStatus',error.message,true); }
  };
  $('reelsMessageBody').oninput = persistDraft;
  $('reelsMessageForm').onsubmit = async event => {
    event.preventDefault(); if (!name || !peer || $('reelsMessageSubmit').disabled) return;
    const owner = name, recipient = peer, generation = epoch, body = $('reelsMessageBody').value.trim(), reelId = attachment?.id || '';
    if (!body && !reelId) return status('reelsSendStatus','Write a message or attach a reel.',true);
    const signature = JSON.stringify([C.nameKey(owner),C.nameKey(recipient),body,reelId]), old = draft(owner,recipient);
    const attempt = old.attempt?.signature === signature ? old.attempt : { signature, requestId:api.id() };
    storage.setItem(draftKey(owner,recipient),JSON.stringify({ ...old, body, attachment, attempt }));
    $('reelsMessageSubmit').disabled = true; $('reelsMessageBody').disabled = true; status('reelsSendStatus','Sending…');
    try {
      const result = await api.request('reelsSend',{ name:owner, peer:recipient, body, reelId, requestId:attempt.requestId });
      if (draft(owner,recipient).attempt?.signature === signature) storage.removeItem(draftKey(owner,recipient));
      if (generation !== epoch || peer !== recipient) return;
      $('reelsMessageBody').value = ''; attachment = null; renderAttachment();
      messages = [...new Map([...messages,result.message].map(m => [m.id,m])).values()].sort((a,b) => C.orderKey(a).localeCompare(C.orderKey(b)));
      renderMessages(true); status('reelsSendStatus','Sent.'); refreshMessages();
    } catch (error) { if (generation === epoch && peer === recipient) status('reelsSendStatus',error.message,true); }
    finally { if (generation === epoch) { $('reelsMessageSubmit').disabled = false; $('reelsMessageBody').disabled = false; } }
  };
  $('reelsAddForm').onsubmit = async event => {
    event.preventDefault(); const owner = name, generation = epoch;
    try { C.videoId($('reelsUrl').value); C.name(owner); } catch(error) { return status('reelsAddStatus',error.message,true); }
    $('reelsAddSubmit').disabled = true; status('reelsAddStatus','Sharing with the club…');
    try {
      const result = await api.request('reelsSubmit',{ name:owner, url:$('reelsUrl').value, title:$('reelsAddName').value, caption:$('reelsAddCaption').value, category:$('reelsAddCategory').value });
      if (generation !== epoch) return;
      closeDialog('reelsAddDialog'); $('reelsAddForm').reset(); openReel(result.item);
      status('reelsStatus',result.duplicate ? 'This Short is already in the club feed. Here it is.' : 'Shared to the club feed.');
    } catch (error) { if (generation === epoch) status('reelsAddStatus',error.message,true); }
    finally { $('reelsAddSubmit').disabled = false; }
  };
  function identity(value) {
    if (name && C.nameKey(name) === C.nameKey(value)) { name = value; return; }
    persistDraft(); name = C.name(value); epoch++; refreshing = false; peer = ''; messages = []; conversations = []; saved = []; attachment = null;
    threadRun++; $('reelsMessageBody').value = ''; $('reelsMessageSubmit').disabled = false; $('reelsMessageBody').disabled = false;
    $('reelsThread').hidden = true; $('reelsThreadEmpty').hidden = false; $('reelsMessageList').replaceChildren();
    $('reelsAddForm').reset(); status('reelsSendStatus',''); renderSaved(); renderConversations(); renderAttachment();
    document.querySelectorAll('.reels-dialog[open]').forEach(d => d.close());
    loadSaved(); refreshMessages();
  }
  window.SponsorFlowIdentity.ready.then(identity);
  window.addEventListener('sponsorflow:identity', event => identity(event.detail.name));
  document.querySelectorAll('[data-reels-tab]').forEach(b => b.onclick = () => switchTab(b.dataset.reelsTab));
  $('reelsAdd').onclick = () => { status('reelsAddStatus',''); openDialog('reelsAddDialog'); };
  $('reelsSave').onclick = saveSelected; $('reelsCopy').onclick = copySelected;
  $('reelsShare').hidden = !navigator.share;
  $('reelsShare').onclick = async () => { if (!selected) return; try { await navigator.share({ title:selected.title, url:permalink(selected) }); } catch (error) { if (error.name !== 'AbortError') copySelected(); } };
  $('reelsSend').onclick = () => recipientDialog(selected); $('reelsNewMessage').onclick = () => recipientDialog(null);
  $('reelsRefreshMessages').onclick = refreshMessages; $('reelsOlder').onclick = () => loadThread(true);
  $('reelsRefresh').onclick = () => tab === 'saved' ? loadSaved() : loadFeed();
  $('reelsMore').onclick = () => loadFeed(true); $('reelsFilter').onchange = () => loadFeed(); $('reelsSearch').oninput = () => renderWatch();
  loadFeed().then(async () => {
    const id = new URLSearchParams(location.search).get('reel');
    if (id && /^REEL-[\w-]{11}$/.test(id)) {
      try { const result = await api.read('reelsFeed',{ id }); if (result.items[0]) openReel(result.items[0]); else status('reelsStatus','That reel is no longer in the feed.',true); }
      catch (error) { status('reelsStatus',error.message,true); }
    } else if (['#saved','#messages'].includes(location.hash)) switchTab(location.hash.slice(1));
  });
})();
