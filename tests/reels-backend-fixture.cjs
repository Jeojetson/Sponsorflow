const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
module.exports = function makeReels(origin = 'https://jeojetson.github.io') {
  const b = require('./games-backend-fixture.cjs')(origin);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../reels-backend/Reels.gs'), 'utf8'), b.context);
  const oldGet = b.context.doGet, oldPost = b.context.doPost;
  b.context.doGet = e => b.context.asmeReelsGet_(e) || oldGet(e);
  b.context.doPost = e => b.context.asmeReelsPost_(e) || oldPost(e);
  b.context.setupReels();
  b.get = p => b.context.doGet({parameter:{origin,callback:'__asmeReels_'+'b'.repeat(32),...p}}).text;
  return b;
};
