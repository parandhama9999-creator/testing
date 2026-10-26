/* OrderFlow Crypto Pro — alerts.js
 * Price alert management. Alerts persist to localStorage and fire once when price crosses the level.
 */
(function () {
  'use strict';
  var OF = window.OF, S = OF.storage, C = OF.config;

  function AlertManager() {
    this._store = S.get('priceAlerts', {});
  }
  var P = AlertManager.prototype;

  P._save = function () { S.set('priceAlerts', this._store); };

  P.add = function (sym, price) {
    if (!this._store[sym]) this._store[sym] = [];
    var list = this._store[sym];
    if (list.length >= C.ALERT_MAX) return { ok: false, msg: 'Max ' + C.ALERT_MAX + ' alerts per symbol' };
    var id = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 6);
    list.push({ id: id, price: price, triggered: false });
    this._save();
    return { ok: true, id: id };
  };

  P.remove = function (sym, id) {
    if (!this._store[sym]) return;
    this._store[sym] = this._store[sym].filter(function (a) { return a.id !== id; });
    this._save();
  };

  // Returns newly triggered alerts (price crossed from prev to current).
  P.check = function (sym, price, prev) {
    var list = this._store[sym];
    if (!list || !list.length || prev == null || prev === price) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.triggered) continue;
      if ((prev < a.price && price >= a.price) || (prev > a.price && price <= a.price)) {
        a.triggered = true;
        out.push(a);
      }
    }
    if (out.length) this._save();
    return out;
  };

  P.list = function (sym) { return (this._store[sym] || []).slice(); };

  P.clearTriggered = function (sym) {
    if (!this._store[sym]) return;
    this._store[sym] = this._store[sym].filter(function (a) { return !a.triggered; });
    this._save();
  };

  P.clearAll = function (sym) { this._store[sym] = []; this._save(); };

  OF.AlertManager = AlertManager;
})();
