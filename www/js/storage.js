/* OrderFlow Crypto Pro — storage.js
 * Versioned localStorage wrapper. Keys are namespaced `of.v1.<key>`, JSON parsing never throws,
 * and an in-memory fallback is used when localStorage is unavailable (private mode, quota).
 */
(function () {
  'use strict';
  var OF = window.OF;
  var PREFIX = 'of.v1.';
  var SCHEMA_KEY = 'of.schema';
  var SCHEMA_VERSION = 1;
  var mem = {};

  var ls = (function () {
    try {
      var k = '__of_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();

  function rawGet(fullKey) {
    try { return ls ? ls.getItem(fullKey) : (fullKey in mem ? mem[fullKey] : null); } catch (e) { return null; }
  }
  function rawSet(fullKey, value) {
    try {
      if (ls) ls.setItem(fullKey, value); else mem[fullKey] = value;
      return true;
    } catch (e) {
      mem[fullKey] = value; // quota exceeded: keep it for this session at least
      console.warn('[storage] write failed for', fullKey, e && e.message);
      return false;
    }
  }
  function rawRemove(fullKey) {
    try { if (ls) ls.removeItem(fullKey); } catch (e) { /* ignore */ }
    delete mem[fullKey];
  }

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function get(key, def) {
    var raw = rawGet(PREFIX + key);
    if (raw == null) return clone(def);
    try {
      var v = JSON.parse(raw);
      return v === null && def !== undefined ? clone(def) : v;
    } catch (e) {
      console.warn('[storage] corrupt value for', key, '- using default');
      return clone(def);
    }
  }

  function set(key, value) {
    var s;
    try { s = JSON.stringify(value); } catch (e) { console.warn('[storage] cannot serialise', key); return false; }
    return rawSet(PREFIX + key, s);
  }

  function remove(key) { rawRemove(PREFIX + key); }

  // ---- Migrations: index N migrates from schema N-1 to N. ----------------------------------
  var MIGRATIONS = {
    1: function () {
      // v0 -> v1: earlier prototypes stored un-prefixed keys. Move them under `of.v1.`.
      ['settings', 'paper', 'entitlement'].forEach(function (k) {
        var legacy = rawGet('of_' + k);
        if (legacy != null && rawGet(PREFIX + k) == null) {
          try { JSON.parse(legacy); rawSet(PREFIX + k, legacy); } catch (e) { /* drop corrupt legacy */ }
        }
        rawRemove('of_' + k);
      });
    }
  };

  function migrate() {
    var current = parseInt(rawGet(SCHEMA_KEY) || '0', 10);
    if (!isFinite(current) || current < 0) current = 0;
    for (var v = current + 1; v <= SCHEMA_VERSION; v++) {
      try { if (MIGRATIONS[v]) MIGRATIONS[v](); } catch (e) { console.warn('[storage] migration', v, 'failed', e); }
    }
    if (current !== SCHEMA_VERSION) rawSet(SCHEMA_KEY, String(SCHEMA_VERSION));
  }

  migrate();

  OF.storage = {
    get: get,
    set: set,
    remove: remove,
    persistent: !!ls,
    SCHEMA_VERSION: SCHEMA_VERSION
  };
})();
