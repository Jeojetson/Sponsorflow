/** Optional shared planner snapshot. Install alongside the CURRENT Code.gs. */
const SF_PLANNER_SNAPSHOT_KEY_ = 'SF_PLANNER_SNAPSHOT_V5';
const SF_PLANNER_EPOCH_KEY_ = 'SF_PLANNER_SNAPSHOT_EPOCH_V5';

function plannerBootstrapCached_() {
  const cache = CacheService.getScriptCache();
  const epoch = cache.get(SF_PLANNER_EPOCH_KEY_) || '';
  try {
    const manifest = JSON.parse(cache.get(SF_PLANNER_SNAPSHOT_KEY_) || 'null');
    if (manifest && manifest.epoch === epoch && manifest.keys.length <= 20) {
      const chunks = manifest.keys.map((key) => cache.get(key));
      if (chunks.every((chunk) => chunk !== null))
        return JSON.parse(chunks.join(''));
    }
  } catch (_) {}
  const data = plannerBootstrap_();
  try {
    const text = JSON.stringify(data);
    // 20,000 UTF-16 code units stay below the per-entry byte limit, including
    // non-ASCII member names. Large snapshots simply use the normal response.
    if (
      text.length <= 400000 &&
      (cache.get(SF_PLANNER_EPOCH_KEY_) || '') === epoch
    ) {
      const batch = Utilities.getUuid();
      const keys = [];
      for (let offset = 0; offset < text.length; offset += 20000) {
        const key = 'SF_PLANNER_PART_' + batch + '_' + keys.length;
        cache.put(key, text.slice(offset, offset + 20000), 60);
        keys.push(key);
      }
      // Publish only after every chunk is stored. The epoch also prevents a
      // read that overlapped an edit from becoming the next cached snapshot.
      cache.put(SF_PLANNER_SNAPSHOT_KEY_, JSON.stringify({ epoch, keys }), 60);
    }
  } catch (_) {} // Cache availability never prevents reading the sheet.
  return data;
}

function invalidatePlannerSnapshot_() {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(SF_PLANNER_EPOCH_KEY_, Utilities.getUuid(), 21600);
    cache.remove(SF_PLANNER_SNAPSHOT_KEY_);
  } catch (_) {}
}
