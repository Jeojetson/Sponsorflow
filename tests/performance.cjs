const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cache = new Map();
let reads = 0,
  uuid = 0,
  duringRead = () => {};
let data = {
  tasks: [{ id: 'TASK-KEEP', title: 'Preserved title' }],
  version: '1.9.0',
};
const context = vm.createContext({
  CacheService: {
    getScriptCache: () => ({
      get: (k) => cache.get(k) ?? null,
      put: (k, v) => cache.set(k, v),
      remove: (k) => cache.delete(k),
    }),
  },
  Utilities: { getUuid: () => String(++uuid) },
  plannerBootstrap_: () => {
    reads++;
    const snapshot = JSON.parse(JSON.stringify(data));
    duringRead();
    return snapshot;
  },
});
vm.runInContext(fs.readFileSync('apps-script/Performance.gs', 'utf8'), context);
assert.deepEqual(context.plannerBootstrapCached_(), data);
context.plannerBootstrapCached_();
assert.equal(reads, 1);
context.invalidatePlannerSnapshot_();
data.tasks[0].title = 'Officer edit';
assert.equal(context.plannerBootstrapCached_().tasks[0].title, 'Officer edit');
assert.equal(reads, 2);
context.invalidatePlannerSnapshot_();
data = {
  tasks: Array.from({ length: 300 }, (_, i) => ({
    id: i,
    title: '工程'.repeat(50),
  })),
};
context.plannerBootstrapCached_();
context.plannerBootstrapCached_();
assert.equal(reads, 3);
const part =
  [...cache.keys()].find(
    (k) => k.startsWith('SF_PLANNER_PART_') && k.includes('_4_'),
  ) || [...cache.keys()].filter((k) => k.startsWith('SF_PLANNER_PART_')).at(-1);
cache.delete(part);
context.plannerBootstrapCached_();
assert.equal(reads, 4, 'Evicted chunk rebuilds safely');
context.invalidatePlannerSnapshot_();
duringRead = () => context.invalidatePlannerSnapshot_();
context.plannerBootstrapCached_();
duringRead = () => {};
context.plannerBootstrapCached_();
assert.equal(reads, 6, 'An overlapping edit invalidates the old snapshot');
console.log(
  'PASS: shared planner cache hit, edit invalidation, multi-part snapshot, eviction fallback, and overlapping edits.',
);
