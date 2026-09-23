(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SFReels = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function text(value, max, label, min = 0) {
    const clean = String(value == null ? '' : value).trim().replace(/\r\n/g, '\n');
    if (clean.length < min || clean.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
    return clean;
  }
  function name(value) {
    const clean = String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'’\-]{1,39}$/u.test(clean)) throw new Error('Enter a name with 2–40 letters, numbers, spaces, apostrophes, or hyphens.');
    return clean;
  }
  const nameKey = value => name(value).toLowerCase();
  function videoId(value) {
    let link = String(value || '').trim();
    if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
    const match = link.match(/^https:\/\/(?:www\.|m\.)?(youtube\.com|youtu\.be)(\/[^\s#]*)?(?:#[^\s]*)?$/i);
    if (!match || link.length > 1000) throw new Error('Paste a YouTube Shorts, watch, or youtu.be link.');
    const path = match[2] || '/';
    let id = '';
    if (match[1].toLowerCase() === 'youtu.be') id = path.match(/^\/([\w-]{11})\/?(?:\?|$)/)?.[1] || '';
    else id = path.match(/^\/shorts\/([\w-]{11})\/?(?:\?|$)/)?.[1] || '';
    if (!id && /^\/watch\?/.test(path)) {
      const values = path.slice(7).split('&').filter(pair => pair.startsWith('v='));
      if (values.length === 1) id = values[0].slice(2);
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('That YouTube link does not contain a valid video ID.');
    return id;
  }
  const url = id => 'https://www.youtube.com/shorts/' + id;
  const orderKey = row => row.createdAt + '|' + row.id;
  function compare(a, b) { return orderKey(b).localeCompare(orderKey(a)); }
  // A deterministic mix of community submissions, never a claim about YouTube recommendations.
  function kartingFirst(rows) {
    const karting = rows.filter(r => r.category === 'karting'), other = rows.filter(r => r.category !== 'karting');
    const result = [];
    while (karting.length || other.length) {
      for (let i = 0; i < 2 && karting.length; i++) result.push(karting.shift());
      if (other.length) result.push(other.shift());
    }
    return result;
  }
  return { text, name, nameKey, videoId, url, orderKey, compare, kartingFirst };
});
