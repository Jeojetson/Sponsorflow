const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
module.exports = function backend(
  origin = 'https://jeojetson.github.io',
  options = {},
) {
  const sheets = new Map(),
    properties = new Map([
      ['SPREADSHEET_ID', 'EXISTING-SPONSORFLOW'],
      ['FRONTEND_ORIGIN', origin],
      ['ADMIN_PASSWORD_HASH', 'existing-admin-hash'],
      ['SCHEMA_VERSION', '1.9.0'],
    ]),
    cache = new Map();
  function sheet(name) {
    const rows = [];
    return {
      rows,
      getName: () => name,
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map((row) => row.length)),
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
    getId: () => 'EXISTING-SPONSORFLOW',
    insertSheet(name) {
      const s = sheet(name);
      sheets.set(name, s);
      return s;
    },
    getSheetByName: (name) => sheets.get(name),
    getSheets: () => [...sheets.values()],
    deleteSheet(s) {
      throw new Error('Games must never delete a sheet');
    },
  };
  for (const name of [
    'Contacts',
    'Templates',
    'Requests',
    'Revisions',
    'Audit',
    'Planner Teams',
    'Planner Boards',
    'Planner Tasks',
    'Planner Comments',
    'Planner Activity',
    'Planner Calendars',
    'Attendance Meetings',
    'Attendance Records',
  ]) {
    const existing = book.insertSheet(name);
    existing.appendRow(['id', 'preserved']);
    existing.appendRow([name + '-existing', 'Officer-edited data']);
  }
  cache.set('ATTENDANCE_PUBLIC_BOOTSTRAP_V21', 'existing attendance cache');
  cache.set('ADMIN_SESSION_existing', 'existing session');
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
    SpreadsheetApp: {
      create: () => {
        throw new Error('Games must never create a spreadsheet');
      },
      openById: (id) => {
        if (id !== 'EXISTING-SPONSORFLOW') throw new Error('Wrong spreadsheet');
        return book;
      },
    },
    validateFrontendOrigin_: (value) => {
      if (
        value !== properties.get('FRONTEND_ORIGIN') &&
        !/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(value)
      )
        throw new Error(
          'This website is not allowed to use the SponsorFlow data service.',
        );
    },
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
  const source = fs.readFileSync(
    path.join(__dirname, '../games-backend/Games.gs'),
    'utf8',
  );
  vm.runInContext(source, context);
  // Route contracts copied from the supplied 2.1 Code.gs, with the two Games
  // hooks installed. Non-game handlers are sentinels; no live Google calls.
  const legacyActions = [
    'bootstrap',
    'checkSponsorHistory',
    'createRequest',
    'getRequestsByName',
    'getRequestByName',
    'reviseRequest',
    'plannerBootstrap',
    'attendanceBootstrap',
    'attendanceCheckIn',
    'attendanceAdminLogin',
    'attendanceAdminData',
    'attendanceSaveMeeting',
    'attendanceArchiveMeeting',
    'attendanceRemoveRecord',
    'savePlannerTeam',
    'savePlannerBoard',
    'savePlannerTask',
    'movePlannerTask',
    'archivePlannerTask',
    'getPlannerTaskDetail',
    'addPlannerComment',
    'savePlannerCalendar',
    'archivePlannerCalendar',
  ];
  context.doGet = (e) => {
    const gamesResponse = context.asmeGamesGet_(e);
    if (gamesResponse) return gamesResponse;
    const p = (e && e.parameter) || {};
    if (p.action && p.callback) {
      const ok = [
        'bootstrap',
        'plannerBootstrap',
        'attendanceBootstrap',
      ].includes(p.action);
      return output(
        p.callback +
          '(' +
          JSON.stringify(
            ok
              ? { ok: true, data: { legacy: p.action } }
              : { ok: false, error: 'This read action is unavailable.' },
          ) +
          ');',
      );
    }
    if (p.view === 'admin') return output('existing Admin.html');
    if (p.feed === 'calendar') return output('existing calendar feed');
    return output('ASME Indy SponsorFlow data service is running.');
  };
  context.doPost = (e) => {
    const gamesResponse = context.asmeGamesPost_(e);
    if (gamesResponse) return gamesResponse;
    const p = (e && e.parameter) || {};
    return output(
      JSON.stringify({
        type: 'sponsorflow-api',
        ok: legacyActions.includes(p.action),
        data: { legacy: p.action },
      }),
    );
  };
  if (options.setup !== false) context.setupGames();
  return {
    context,
    book,
    legacyActions,
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
