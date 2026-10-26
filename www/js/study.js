/* OrderFlow Crypto Pro — study.js
 * Bar-replay / backtest engine.  When active, replaces the FootprintEngine's live bars with a
 * growing snapshot so the user can step through history while paper-trading against replayed prices.
 */
(function () {
  'use strict';
  var OF = window.OF, U = OF.util;

  function StudyEngine(footprintEngine, paperEngine) {
    this.fe = footprintEngine;
    this.pe = paperEngine;
    this.active = false;
    this._liveBars = null;
    this._livePrice = null;
    this._allBars = null;
    this.sym = null;
    this.idx = 0;
    this.total = 0;
    this.playing = false;
    this.speed = 400;
    this._timer = 0;
    this.onChange = null; // function(idx, total, price, timeMs)
  }
  var P = StudyEngine.prototype;

  P.start = function (sym) {
    if (this.active) this.stop();
    this._liveBars = this.fe.bars;
    this._livePrice = this.fe.lastPrice;
    this._allBars = this.fe.bars.slice(); // snapshot
    this.sym = sym;
    this.total = this._allBars.length;
    this.idx = Math.max(1, this.total - 30);
    this.active = true;
    this.playing = false;
    this._apply();
  };

  P._apply = function () {
    this.fe.bars = this._allBars.slice(0, this.idx + 1);
    this.fe.version++;
    this.fe._profile = null;
    this.fe._cvd = null;
    var bar = this._allBars[this.idx];
    if (bar) {
      this.fe.lastPrice = bar.c;
      if (this.pe) this.pe.onPrice(this.sym, bar.c);
    }
    if (this.onChange) this.onChange(this.idx, this.total, bar ? bar.c : null, bar ? bar.t : null);
  };

  P.stop = function () {
    clearTimeout(this._timer);
    this.playing = false;
    if (this.active && this._liveBars !== null) {
      this.fe.bars = this._liveBars;
      this.fe.lastPrice = this._livePrice;
      this.fe.version++;
      this.fe._profile = null;
      this.fe._cvd = null;
    }
    this.active = false;
    this._liveBars = null;
    this._allBars = null;
    if (this.onChange) this.onChange(-1, 0, null, null);
  };

  P.play = function () {
    if (!this.active || this.playing) return;
    this.playing = true;
    var self = this;
    function tick() {
      if (!self.playing || !self.active) return;
      if (self.idx < self.total - 1) {
        self.idx++;
        self._apply();
        self._timer = setTimeout(tick, self.speed);
      } else {
        self.playing = false;
        if (self.onChange) self.onChange(self.idx, self.total, null, null);
      }
    }
    self._timer = setTimeout(tick, self.speed);
  };

  P.pause = function () {
    clearTimeout(this._timer);
    this.playing = false;
    if (this.onChange) this.onChange(this.idx, this.total, null, null);
  };

  P.step = function (n) {
    if (!this.active) return;
    clearTimeout(this._timer);
    this.playing = false;
    this.idx = U.clamp(this.idx + (n || 1), 0, this.total - 1);
    this._apply();
  };

  // fraction: 0..1
  P.seek = function (fraction) {
    if (!this.active) return;
    clearTimeout(this._timer);
    this.playing = false;
    this.idx = U.clamp(Math.round(fraction * (this.total - 1)), 0, this.total - 1);
    this._apply();
  };

  P.setSpeed = function (ms) { this.speed = Math.max(50, ms | 0); };

  OF.StudyEngine = StudyEngine;
})();
