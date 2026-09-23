(() => {
  'use strict';
  const C = window.SFReels, api = window.SFReelsService, storage = window.SponsorFlowStorage;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {save:'<path d="M6 3h12v18l-6-4-6 4z"/>',send:'<path d="m21 3-7 18-4-7-7-4zM10 14 21 3"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'};
  const icon = key => `<span class="reels-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[key]}</svg></span>`;
  const initials = value => String(value).trim().split(/\s+/).slice(0,2).map(v => v[0]).join('').toUpperCase();
  let name = '', epoch = 0, tab = 'discover', saved = [], selected = null, savedRun = 0;
  const feeds = { discover:{rows:[],next:'',loaded:false,busy:false,seq:0}, club:{rows:[],next:'',loaded:false,busy:false,seq:0} };
  let peer = '', conversations = [], messages = [], before = '', attachment = null, shareReel = null, threadRun = 0, refreshing = false, threadVisible = false;
  let player = null, playerRun = 0, playerLoading = false, youtubePromise = null, playbackStarted = false;
  let poll, scrollTimer, noticeTimer;
  const pendingSaves = new Set(), failedVideos = new Set();
  const status = (id, message, error = false) => {
    $(id).textContent = message; $(id).classList.toggle('is-error', error);
    if (id === 'reelsStatus') { clearTimeout(noticeTimer); if (message && !error) noticeTimer = setTimeout(() => { if ($(id).textContent === message) $(id).textContent = ''; },3000); }
  };
  const stamp = value => { const d = new Date(value); return isNaN(d.getTime()) ? '' : d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); };
  const permalink = item => new URL('reels.html?reel=' + encodeURIComponent(item.id), location.href).href;
  const cardFor = item => item ? $('reelsStream').querySelector(`[data-card="${item.id}"]`) : null;
  const stage = () => cardFor(selected)?.querySelector('.reels-stage');
  const playbackStatus = (text, error = false) => { const node=cardFor(selected)?.querySelector('.reels-playback-status'); if(node){node.textContent=text;node.classList.toggle('is-error',error);} };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const [id,key] of [['reelsContinuous','asmeReelsContinuous'],['reelsAutoplay','asmeReelsAutoplay']]) { $(id).checked = storage.getItem(key) !== 'false'; $(id).onchange = () => { storage.setItem(key,String($(id).checked)); if(id==='reelsContinuous') maybeMore(); }; }
  if (reduced()) $('reelsAutoplay').checked=false;
  function openDialog(id) { stopPlayer(); $(id).showModal(); document.body.classList.add('dialog-open'); }
  function closeDialog(id) { $(id).close(); }
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeDialog(b.dataset.close));
  document.querySelectorAll('.reels-dialog').forEach(d => d.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open'); }));
  function eligible() {
    const rect=stage()?.getBoundingClientRect(), viewport=$('reelsStream').getBoundingClientRect();
    if(!rect)return false;
    const visible=Math.max(0,Math.min(viewport.bottom,rect.bottom,innerHeight)-Math.max(viewport.top,rect.top,0));
    return !document.hidden && !document.querySelector('dialog[open]') && tab !== 'messages' && rect.height >= 200 && visible/rect.height > .5;
  }
  function stopPlayer() {
    playerRun++; playerLoading=false;
    if(player){try{player.destroy();}catch(_){} player=null;}
    if(selected)poster();
  }
  function poster() {
    const host=stage();if(!host||!selected)return;
    host.innerHTML=`<button type="button" class="reels-poster" data-action="play" aria-label="Play ${esc(selected.title)}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${esc(selected.videoId)}/hqdefault.jpg"><span aria-hidden="true">▶</span></button>`;
    host.querySelector('img').onerror=e=>{e.currentTarget.hidden=true;};
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
    if (!selected || playerLoading || player || !eligible() || automatic && failedVideos.has(selected.id)) return;
    if (!automatic) failedVideos.delete(selected.id);
    const run = ++playerRun, item = selected; playerLoading = true; playbackStarted = true;
    playbackStatus( 'Opening YouTube…');
    try {
      const YT = await youtube();
      if (run !== playerRun || !eligible()) { if (run === playerRun) playerLoading = false; return; }
      const frame = document.createElement('iframe'); frame.title = item.title + ' · YouTube';
      frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen = true;
      frame.src = 'https://www.youtube-nocookie.com/embed/' + item.videoId + '?' + new URLSearchParams({ enablejsapi:'1', origin:location.origin, playsinline:'1', controls:'1', autoplay:'0' });
      stage().replaceChildren(frame);
      player = new YT.Player(frame, { events: {
        onReady(event) {
          if (run !== playerRun) return;
          playerLoading = false;
          if (!eligible()) { stopPlayer(); return; }
          if (automatic) event.target.mute();
          event.target.playVideo(); playbackStatus( '');
        },
        onStateChange(event) { if (event.data === 0 && run === playerRun && eligible() && $('reelsAutoplay').checked && !reduced()) step(1); },
        onAutoplayBlocked() { if (run === playerRun) playbackStatus( 'Tap Play in the YouTube player to continue.'); },
        onError(event) {
          if (run !== playerRun) return;
          const message = [100,101,150].includes(event.data) ? 'This Short is unavailable here. Open it on YouTube or choose the next reel.' : 'YouTube could not play this Short here. Try again or open it on YouTube.';
          failedVideos.add(item.id); stopPlayer(); playbackStatus( message, true);
        }
      }});
    } catch (error) { if (run === playerRun) { playerLoading = false; poster(); playbackStatus( error.message, true); } }
  }
  document.addEventListener('visibilitychange', () => { if(document.hidden)stopPlayer();else if(tab==='messages')refreshMessages();schedulePoll(); });
  window.addEventListener('pagehide',stopPlayer);
  function visibleItems() {
    const query=$('reelsSearch').value.trim().toLowerCase();
    return (tab==='saved'?saved:feeds[tab]?.rows||[]).filter(r=>!query||`${r.title} ${r.caption} ${r.author}`.toLowerCase().includes(query));
  }
  function renderSaved() {
    $('reelsSavedCount').textContent=saved.length;
    $('reelsStream').querySelectorAll('[data-action="save"]').forEach(b=>{
      const id=b.closest('[data-card]').dataset.card, active=saved.some(r=>r.id===id);
      b.setAttribute('aria-pressed',String(active));b.querySelector('.reels-action-label').textContent=active?'Saved':'Save';
      b.disabled=!name||pendingSaves.has(C.nameKey(name)+'|'+id);
    });
  }
  function renderPosition() {
    const rows=visibleItems(),i=rows.findIndex(r=>r.id===selected?.id);
    $('reelsPrev').disabled=i<=0;$('reelsNext').disabled=i<0||i>=rows.length-1&&!feeds[tab]?.next;
  }
  function choose(item, automatic=false) {
    if(!item||item.id===selected?.id)return;
    stopPlayer(); selected=item;poster(); renderPosition();
    $('reelsStream').querySelectorAll('[data-card]').forEach(c=>c.classList.toggle('is-current',c.dataset.card===item.id));
    if(automatic&&playbackStarted&&$('reelsAutoplay').checked&&!reduced())play(true);
    maybeMore();
  }
  function cardHTML(r) {
    return `<article class="reel-card" data-card="${esc(r.id)}" aria-label="${esc(r.title)}"><div class="reel-media"><div class="reels-stage"><button type="button" class="reels-poster" data-action="play" aria-label="Play ${esc(r.title)}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${esc(r.videoId)}/hqdefault.jpg"><span aria-hidden="true">▶</span></button></div><div class="reels-rail"><button type="button" data-action="save" aria-pressed="false">${icon('save')}<span class="reels-action-label">Save</span></button><button type="button" data-action="send">${icon('send')}<span>Send</span></button><button type="button" data-action="details" aria-label="Reel details and sharing options">${icon('more')}<span>More</span></button></div></div><div class="reel-meta"><span class="reels-author">${esc(r.author)}${r.source==='discover'?' · YouTube':' · Club'}</span><button class="reels-text-button" data-action="details" type="button"><h2>${esc(r.title)}</h2></button><p class="reels-playback-status" role="status"></p></div></article>`;
  }
  function renderEnd() {
    $('reelsStream').querySelector('.reels-end')?.remove();
    const f=feeds[tab], rows=visibleItems();if(!rows.length)return;
    const end=document.createElement('div');end.className='reels-end';
    if(f?.next)end.innerHTML=`<strong>${f.busy?'Loading more…':'Keep exploring'}</strong><button type="button" class="button button-secondary" data-load ${f.busy?'disabled':''}>${f.error?'Try again':'Load more'}</button>`;
    else end.innerHTML=`<strong>You’re caught up.</strong><p>${tab==='discover'?(f?.live?'New picks arrive daily.':'You’ve reached the starter picks. Fresh discovery can be enabled by an officer.') : tab==='saved'?'Save more videos to build your collection.':'That’s everything the club has shared.'}</p><button type="button" class="button button-secondary" data-restart>Back to the first reel</button>`;
    $('reelsStream').appendChild(end);
  }
  function renderWatch(preserve=true) {
    const rows=visibleItems(),host=$('reelsStream'),old=preserve&&rows.find(r=>r.id===selected?.id);
    if(!old){stopPlayer();selected=null;host.replaceChildren();host.scrollTop=0;}
    host.querySelector('.reels-end')?.remove();host.querySelector('.reels-empty')?.remove();
    const ids=new Set(rows.map(r=>r.id));host.querySelectorAll('[data-card]').forEach(c=>{if(!ids.has(c.dataset.card))c.remove();});
    const known=new Set([...host.querySelectorAll('[data-card]')].map(c=>c.dataset.card));
    rows.filter(r=>!known.has(r.id)).forEach(r=>host.insertAdjacentHTML('beforeend',cardHTML(r)));
    host.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.hidden=true;});
    if(!rows.length){const f=feeds[tab];host.innerHTML=`<div class="reels-empty"><strong>${f?.busy?'Finding your next watch…':$('reelsSearch').value?'No matches':tab==='saved'?'Keep the good ones.':tab==='club'?'Start the club feed.':f?.loaded?'No videos right now.':'Discover is loading.'}</strong><p>${f?.error?esc(f.error):$('reelsSearch').value?'Try another search in Feed options.':tab==='saved'?'Tap Save on a reel to find it here.':tab==='club'?'Share a YouTube Short using + above.':'Short videos, separate from club posts.'}</p>${f?.error?'<button type="button" data-load class="button button-secondary">Try again</button>':''}</div>`;}
    else {renderEnd();choose(old||rows[0]);}
    renderSaved();renderPosition();
  }
  async function loadFeed(which=tab,more=false) {
    const f=feeds[which];if(!f||f.busy||more&&!f.next)return;
    const run=++f.seq;f.busy=true;f.error='';
    if(tab===which&&!more)renderWatch();else if(tab===which)renderEnd();
    try{
      const result=await api.read(which==='discover'?'reelsDiscover':'reelsFeed',{after:more?f.next:'',...(which==='club'?{filter:$('reelsFilter').value}:{})});
      if(run!==f.seq)return;
      f.rows=more?[...new Map([...f.rows,...result.items].map(r=>[r.id,r])).values()]:result.items;
      if(f.anchor&&!f.rows.some(r=>r.id===f.anchor.id))f.rows.unshift(f.anchor);
      f.next=result.next;f.live=result.live;f.loaded=true;f.busy=false;
      if(tab===which)renderWatch(more||Boolean(f.anchor));f.anchor=null;people();
    }catch(error){if(run===f.seq){f.error=error.message;f.busy=false;if(tab===which){renderWatch();status('reelsStatus',error.message,true);}}}
    finally{if(run===f.seq)f.busy=false;}
  }
  function maybeMore(){const f=feeds[tab],rows=visibleItems();if(f&&!f.busy&&!f.error&&f.next&&$('reelsContinuous').checked&&!$('reelsSearch').value&&rows.findIndex(r=>r.id===selected?.id)>=rows.length-3)loadFeed(tab,true);}
  function syncScroll() {
    const host=$('reelsStream'),viewport=host.getBoundingClientRect();
    const current=[...host.querySelectorAll('[data-card]')].find(c=>{const r=c.getBoundingClientRect();return Math.max(0,Math.min(r.bottom,viewport.bottom)-Math.max(r.top,viewport.top))>r.height*.6;});
    if(current)choose(visibleItems().find(r=>r.id===current.dataset.card),true);
    if((player||playerLoading)&&!eligible())stopPlayer();
    if(current&&playbackStarted&&!player&&!playerLoading&&eligible()&&$('reelsAutoplay').checked&&!reduced())play(true);
    maybeMore();
  }
  $('reelsStream').addEventListener('scroll',()=>{if((player||playerLoading)&&!eligible())stopPlayer();clearTimeout(scrollTimer);scrollTimer=setTimeout(syncScroll,120);},{passive:true});
  async function step(delta) {
    let rows=visibleItems(),i=rows.findIndex(r=>r.id===selected?.id);
    if(!rows[i+delta]&&delta>0&&feeds[tab]?.next){await loadFeed(tab,true);rows=visibleItems();}
    const item=rows[i+delta];if(item){cardFor(item)?.scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});}
  }
  $('reelsPrev').onclick=()=>step(-1);$('reelsNext').onclick=()=>step(1);
  $('reelsStream').onclick=e=>{
    const action=e.target.closest('[data-action]');
    if(action){const item=visibleItems().find(r=>r.id===action.closest('[data-card]').dataset.card);choose(item);if(action.dataset.action==='play')play(false);if(action.dataset.action==='save')saveSelected();if(action.dataset.action==='send')recipientDialog(item);if(action.dataset.action==='details')showDetails();}
    if(e.target.closest('[data-load]'))loadFeed(tab,Boolean(feeds[tab]?.next));
    if(e.target.closest('[data-restart]')){$('reelsStream').scrollTo({top:0,behavior:'smooth'});}
  };
  document.addEventListener('keydown',e=>{if(tab==='messages'||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||e.target.isContentEditable)return;if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();step(e.key==='ArrowUp'?-1:1);}});
  function showDetails(){if(!selected)return;$('reelsTitle').textContent=selected.title;$('reelsCaption').textContent=selected.caption;$('reelsAuthor').textContent=selected.author;$('reelsYoutube').href=C.url(selected.videoId);openDialog('reelsDetailDialog');}
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
      status('reelsStatus', active ? 'Saved' : 'Removed from Saved');
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
    persistDraft();stopPlayer();tab=value;selected=null;
    $('reelsWatch').hidden=tab==='messages';$('reelsMessages').hidden=tab!=='messages';$('reelsOptions').hidden=tab==='messages';$('reelsAdd').hidden=tab==='messages';
    document.querySelectorAll('[data-reels-tab]').forEach(b=>{if(b.dataset.reelsTab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    $('reelsFilterField').hidden=tab!=='club';status('reelsStatus','');
    history.replaceState(null,'',location.pathname+location.search+(tab==='discover'?'':'#'+tab));
    if(tab==='messages')refreshMessages();else{renderWatch(false);if(tab==='saved')loadSaved();else if(!feeds[tab].loaded)loadFeed(tab);}
    schedulePoll();
  }
  function people() {
    const names=[...new Set([...feeds.club.rows.map(r=>r.author),...conversations.map(c=>c.name)])].filter(n=>{try{return !name||C.nameKey(n)!==C.nameKey(name);}catch(_){return false;}}).sort();
    $('reelsPeople').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');
    $('reelsRecentPeople').innerHTML=conversations.slice(0,6).map(c=>`<button type="button" data-recipient="${esc(c.name)}"><span class="reels-avatar">${esc(initials(c.name))}</span>${esc(c.name)}</button>`).join('');
    $('reelsRecentPeople').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('reelsRecipient').value=b.dataset.recipient;$('reelsRecipientForm').requestSubmit();});
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
    $('reelsConversations').innerHTML = conversations.length ? conversations.map(c => `<button type="button" data-peer="${esc(c.name)}" ${peer && C.nameKey(peer) === c.peerKey ? 'aria-current="true"' : ''}><span class="reels-avatar">${esc(initials(c.name))}</span><span class="reels-peer-copy"><strong>${esc(c.name)}</strong><small>${esc(c.preview)}</small></span>${c.unread ? `<span class="reels-unread-dot" aria-label="${c.unread} unread"></span>` : ''}</button>`).join('') : '<div class="reels-empty"><strong>Say hello.</strong><p>Tap + to message a teammate.</p></div>';
    $('reelsConversations').querySelectorAll('button').forEach(b => b.onclick = () => openPeer(b.dataset.peer)); people();
  }
  function renderMessages(scroll = false) {
    const key = name ? C.nameKey(name) : '';
    $('reelsMessageList').innerHTML = messages.length ? messages.map(m => `<article class="reels-bubble ${m.fromKey === key ? 'is-mine' : ''}">${m.body ? `<p>${esc(m.body)}</p>` : ''}${m.reel ? `<a href="${esc(permalink(m.reel))}" data-reel="${esc(m.reel.id)}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${esc(m.reel.videoId)}/hqdefault.jpg"><span>▶ ${esc(m.reel.title)}</span></a>` : m.reelId ? '<p class="reels-hint">This reel was removed from the feed.</p>' : ''}<small>${esc(stamp(m.createdAt))}</small></article>`).join('') : '<p class="reels-hint">Start the conversation.</p>';
    $('reelsMessageList').querySelectorAll('[data-reel]').forEach(a => a.onclick = event => { event.preventDefault(); const item = messages.find(m => m.reel?.id === a.dataset.reel)?.reel; if (item) openReel(item); });
    $('reelsMessageList').querySelectorAll('img').forEach(img => img.onerror = () => { img.hidden = true; });
    $('reelsOlder').hidden = !before;
    if (scroll) $('reelsMessageList').scrollTop = $('reelsMessageList').scrollHeight;
  }
  async function loadThread(older = false) {
    if (!peer || !name) return;
    const generation = epoch, recipient = peer, owner = name, run = ++threadRun;
    $('reelsOlder').disabled = true;
    try {
      const result = await api.read('reelsThread', { name:owner, peer:recipient, before:older ? before : '', markRead:tab === 'messages' && threadVisible && !document.hidden });
      if (generation !== epoch || recipient !== peer || run !== threadRun) return;
      const latest = messages[messages.length-1]?.id;
      messages = [...new Map([...messages,...result.messages].map(m => [m.id,m])).values()].sort((a,b) => C.orderKey(a).localeCompare(C.orderKey(b)));
      if (older || messages.length <= 50) before = result.before;
      renderMessages(!older && latest !== messages[messages.length-1]?.id);
      if (!older && tab === 'messages' && threadVisible && !document.hidden) { conversations.forEach(c => { if(c.peerKey === C.nameKey(recipient)) c.unread=0; }); renderConversations(); }
    } catch (error) { if (generation === epoch && recipient === peer && run === threadRun) status('reelsSendStatus', error.message, true); }
    finally { if (run === threadRun) $('reelsOlder').disabled = false; }
  }
  async function refreshMessages() {
    if (!name || document.hidden || refreshing) return;
    const generation = epoch, owner = name; refreshing = true;
    $('reelsRefreshMessages').disabled = true;
    try {
      if (peer && threadVisible && tab === 'messages') await loadThread();
      const result = await api.read('reelsInbox', { name:owner });
      if (generation !== epoch) return;
      conversations = result.conversations; renderConversations();
    } catch (error) { if (generation === epoch) status('reelsStatus', error.message, true); }
    finally { if (generation === epoch) { refreshing = false; $('reelsRefreshMessages').disabled = false; } }
  }
  function schedulePoll() { clearTimeout(poll); if (tab === 'messages' && !document.hidden) poll = setTimeout(async () => { await refreshMessages(); schedulePoll(); },30000); }
  function openPeer(recipient, reel = null) {
    persistDraft(); threadVisible = true; document.querySelector('.reels-messenger').classList.add('has-peer'); $('reelsMessageSubmit').disabled = false; $('reelsMessageBody').disabled = false; peer = C.name(recipient); messages = []; before = ''; threadRun++;
    $('reelsThreadEmpty').hidden = true; $('reelsThread').hidden = false; $('reelsPeer').textContent = peer;
    const savedDraft = draft(); $('reelsMessageBody').value = savedDraft.body || ''; attachment = reel || savedDraft.attachment || null;
    renderAttachment(); persistDraft(); status('reelsSendStatus', 'Loading conversation…'); renderMessages(); renderConversations();
    loadThread().then(() => { if ($('reelsSendStatus').textContent === 'Loading conversation…') status('reelsSendStatus',''); });
  }
  function recipientDialog(item) { shareReel = item; $('reelsRecipientForm').reset(); status('reelsRecipientStatus',''); people(); openDialog('reelsRecipientDialog'); }
  function openReel(item) {
    const target=item.source==='discover'?'discover':'club';$('reelsSearch').value='';feeds[target].anchor=feeds[target].busy||!feeds[target].loaded?item:null;
    if(!feeds[target].rows.some(r=>r.id===item.id))feeds[target].rows.unshift(item);
    switchTab(target);renderWatch(false);choose(item);
    requestAnimationFrame(()=>cardFor(item)?.scrollIntoView({block:'start'}));
  }
  $('reelsRecipientForm').onsubmit = event => {
    event.preventDefault();
    try { const recipient = C.name($('reelsRecipient').value); if (C.nameKey(recipient) === C.nameKey(name)) throw new Error('Choose another member. Use Saved for your own reels.'); closeDialog('reelsRecipientDialog'); const item = shareReel; shareReel = null; switchTab('messages'); openPeer(recipient, item); }
    catch (error) { status('reelsRecipientStatus',error.message,true); }
  };
  $('reelsMessageBody').oninput = () => { $('reelsMessageBody').style.height='auto'; $('reelsMessageBody').style.height=Math.min(110,$('reelsMessageBody').scrollHeight)+'px'; persistDraft(); };
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
      $('reelsMessageBody').value = ''; $('reelsMessageBody').style.height='auto'; attachment = null; renderAttachment();
      messages = [...new Map([...messages,result.message].map(m => [m.id,m])).values()].sort((a,b) => C.orderKey(a).localeCompare(C.orderKey(b)));
      renderMessages(true); status('reelsSendStatus','Sent.'); refreshMessages();
    } catch (error) { if (generation === epoch && peer === recipient) status('reelsSendStatus',error.message,true); }
    finally { if (generation === epoch && peer === recipient) { $('reelsMessageSubmit').disabled = false; $('reelsMessageBody').disabled = false; } }
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
    persistDraft(); name = C.name(value); epoch++; refreshing = false; threadVisible = false; document.querySelector('.reels-messenger').classList.remove('has-peer'); peer = ''; messages = []; conversations = []; saved = []; attachment = null;
    threadRun++; $('reelsMessageBody').value = ''; $('reelsMessageSubmit').disabled = false; $('reelsMessageBody').disabled = false;
    $('reelsThread').hidden = true; $('reelsThreadEmpty').hidden = false; $('reelsMessageList').replaceChildren();
    $('reelsAddForm').reset(); status('reelsSendStatus',''); renderSaved(); renderConversations(); renderAttachment();
    document.querySelectorAll('.reels-dialog[open]').forEach(d => d.close());
    if(tab==='saved')renderWatch(false); loadSaved(); refreshMessages();
  }
  window.SponsorFlowIdentity.ready.then(identity);
  window.addEventListener('sponsorflow:identity',e=>identity(e.detail.name));
  document.querySelectorAll('[data-reels-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.reelsTab));
  $('reelsAdd').onclick=()=>{status('reelsAddStatus','');openDialog('reelsAddDialog');};
  $('reelsOptions').onclick=()=>{$('reelsFilterField').hidden=tab!=='club';openDialog('reelsOptionsDialog');};
  $('reelsCopy').onclick=copySelected;$('reelsShare').hidden=!navigator.share;
  $('reelsShare').onclick=async()=>{if(!selected)return;try{await navigator.share({title:selected.title,url:permalink(selected)});}catch(e){if(e.name!=='AbortError')copySelected();}};
  $('reelsBack').onclick=()=>{persistDraft();threadVisible=false;document.querySelector('.reels-messenger').classList.remove('has-peer');};
  $('reelsNewMessage').onclick=()=>recipientDialog(null);$('reelsRefreshMessages').onclick=refreshMessages;$('reelsOlder').onclick=()=>loadThread(true);
  $('reelsRefresh').onclick=()=>{closeDialog('reelsOptionsDialog');status('reelsStatus','');if(tab==='saved')loadSaved();else loadFeed(tab);};
  $('reelsFilter').onchange=()=>{const f=feeds.club;f.seq++;f.busy=false;f.next='';f.rows=[];f.loaded=false;if(tab==='club')loadFeed('club');};
  $('reelsSearch').oninput=()=>renderWatch(false);
  const start=['club','saved','messages'].includes(location.hash.slice(1))?location.hash.slice(1):'discover';switchTab(start);
  const id=new URLSearchParams(location.search).get('reel');
  if(id&&/^REEL-[\w-]{11}$/.test(id))api.read('reelsFeed',{id}).then(r=>{if(r.items[0])openReel(r.items[0]);else status('reelsStatus','That reel is no longer available.',true);}).catch(e=>status('reelsStatus',e.message,true));
})();
