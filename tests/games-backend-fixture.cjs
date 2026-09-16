const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
module.exports = function backend(origin = 'https://jeojetson.github.io') {
  const sheets = new Map(),
    properties = new Map(),
    cache = new Map();
  function sheet(name) {
    const rows = [];
    return {
      rows,
      getName: () => name,
      getLastRow: () => rows.length,
      getMaxRows: () => 1000,
      setFrozenRows() {},
      appendRow(row) {
        rows.push(row.slice());
      },
      getRange(r, c, count, width) {
        return {
          getValues: () =>
            Array.from({ length: count }, (_, i) =>
              Array.from(
                { length: width },
                (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '',
              ),
            ),
          setValues(values) {
            for (let i = 0; i < count; i++) {
              rows[r - 1 + i] ||= [];
              for (let j = 0; j < width; j++)
                rows[r - 1 + i][c - 1 + j] = values[i][j];
            }
          },
          setNumberFormat() {},
        };
      },
    };
  }
  const book = {
    getUrl: () => 'https://example.test/sheet',
    getId: () => 'TEST-GAMES',
    insertSheet(name) {
      const s = sheet(name);
      sheets.set(name, s);
      return s;
    },
    getSheetByName: (name) => sheets.get(name),
    getSheets: () => [...sheets.values()],
    deleteSheet(s) {
      sheets.delete(s.getName());
    },
  };
  const output = (text) => ({
    text,
    setMimeType() {
      return this;
    },
    setXFrameOptionsMode() {
      return this;
    },
  });
  const context = vm.createContext({
    console,
    Date,
    Intl,
    Map,
    Set,
    JSON,
    Math,
    Number,
    Array,
    Object,
    String,
    RegExp,
    Error,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => properties.get(k),
        setProperty(k, v) {
          properties.set(k, v);
        },
      }),
    },
    SpreadsheetApp: { create: () => book, openById: () => book },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_, text) => [
        ...crypto.createHash('sha256').update(text).digest(),
      ],
      formatDate: (d) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Indiana/Indianapolis',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k),
        put: (k, v) => cache.set(k, v),
        removeAll: (keys) => keys.forEach((k) => cache.delete(k)),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }),
    },
    ContentService: {
      createTextOutput: output,
      MimeType: { JAVASCRIPT: 'js' },
    },
    HtmlService: {
      createHtmlOutput: output,
      XFrameOptionsMode: { ALLOWALL: 'all' },
    },
  });
  const source = fs
    .readFileSync(path.join(__dirname, '../games-backend/Code.gs'), 'utf8')
    .replace(
      /ORIGIN:\s*'https:\/\/jeojetson\.github\.io'/,
      'ORIGIN:' + JSON.stringify(origin),
    );
  vm.runInContext(source, context);
  context.setupGames();
  return {
    context,
    sheets,
    properties,
    cache,
    post: (p) =>
      context.doPost({ parameter: { origin, callId: 'a'.repeat(32), ...p } })
        .text,
    get: (p) =>
      context.doGet({
        parameter: { origin, callback: '__asmeGames_' + 'b'.repeat(32), ...p },
      }).text,
  };
};
