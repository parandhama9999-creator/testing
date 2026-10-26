/* OrderFlow Crypto Pro — footprint.js
 * Bar / cluster aggregation, POC, diagonal imbalances, session volume profile (VPOC + 70% VA), CVD.
 * Clusters are always stored at the BASE bin (1x) with integer keys; multiplier views (2x..25x)
 * are derived on demand: floor(floor(p/b)/m) === floor(p/(b*m)) for integer m.
 */
(function () {
  'use strict';
  var OF = window.OF, C = OF.config;

  function binKey(price, binSize) {
    return Math.floor(price / binSize + 1e-9);
  }

  function FootprintEngine(opts) {
    this.configure(opts || {});
  }
  var P = FootprintEngine.prototype;

  P.configure = function (o) {
    this.symbol = o.symbol || 'BTCUSDT';
    this.tfMs = o.tfMs || 60000;
    this.baseBin = o.baseBin || 1;
    this.tick = o.tick || 0.01;
    this.lot = o.lot || 0.001;
    this.dec = o.dec != null ? o.dec : 2;
    this.reset();
  };

  P.reset = function () {
    this.bars = [];
    this.version = 0;
    this.lastPrice = null;
    this.isSeed = false;
    this._profile = null;
    this._cvd = null;
  };

  P._newBar = function (t, price, withFP) {
    return {
      t: t, o: price, h: price, l: price, c: price,
      v: 0, buyV: 0, sellV: 0, delta: 0, minDelta: 0, maxDelta: 0,
      deltaKnown: !!withFP, clusters: withFP ? new Map() : null, hasFP: !!withFP,
      partial: false, seed: false, firstTs: 0, ver: 0, view: null
    };
  };

  P._trim = function () {
    var max = C.MAX_BARS;
    if (this.bars.length > max) this.bars.splice(0, this.bars.length - max);
  };

  P._touch = function () {
    this.version++;
  };

  P._findBar = function (t) {
    for (var i = this.bars.length - 1; i >= 0; i--) {
      if (this.bars[i].t === t) return this.bars[i];
      if (this.bars[i].t < t) return null;
    }
    return null;
  };

  P._resetFP = function (bar) {
    bar.clusters = new Map();
    bar.hasFP = true;
    bar.deltaKnown = true;
    bar.klineV = bar.v;
    bar.v = bar.buyV = bar.sellV = bar.delta = bar.minDelta = bar.maxDelta = 0;
    bar.firstTs = 0;
    bar.ver++;
  };

  P._add = function (bar, tr) {
    var p = tr.price, q = tr.qty;
    if (!(p > 0) || !(q > 0)) return;
    if (!bar.firstTs) bar.firstTs = tr.ts;
    if (p > bar.h) bar.h = p;
    if (p < bar.l) bar.l = p;
    bar.c = p;
    bar.v += q;
    var k = binKey(p, this.baseBin);
    var cell = bar.clusters.get(k);
    if (!cell) { cell = { bid: 0, ask: 0 }; bar.clusters.set(k, cell); }
    if (tr.aggressor === 'buy') { cell.ask += q; bar.buyV += q; bar.delta += q; }
    else { cell.bid += q; bar.sellV += q; bar.delta -= q; }
    if (bar.delta < bar.minDelta) bar.minDelta = bar.delta;
    if (bar.delta > bar.maxDelta) bar.maxDelta = bar.delta;
    bar.ver++;
  };

  // Bars roll on EXCHANGE timestamps (tr.ts), never the device clock.
  P.applyTrade = function (tr) {
    var t = Math.floor(tr.ts / this.tfMs) * this.tfMs;
    var last = this.bars[this.bars.length - 1];
    var bar, isNew = false;
    if (!last || t > last.t) {
      bar = this._newBar(t, tr.price, true);
      this.bars.push(bar);
      this._trim();
      isNew = true;
    } else if (t === last.t) {
      bar = last;
    } else {
      bar = this._findBar(t);
      if (!bar || !bar.hasFP) return { applied: false, newBar: false };
    }
    if (!bar.hasFP) {
      // Kline-only bar receiving live trades before backfill: footprint is incomplete.
      this._resetFP(bar);
      bar.partial = true;
    }
    this._add(bar, tr);
    if (bar.partial && bar.klineV > bar.v) bar.v = bar.klineV;
    if (!this.isSeed) this.lastPrice = tr.price;
    this._touch();
    return { applied: true, newBar: isNew };
  };

  // Replace everything with real OHLCV. Footprint bars that completed before `preserveBefore`
  // (e.g. when the app was hidden) keep their clusters.
  P.loadKlines = function (klines, preserveBefore) {
    var old = new Map(), tf = this.tfMs, self = this;
    if (preserveBefore && !this.isSeed) {
      this.bars.forEach(function (b) {
        if (b.hasFP && !b.partial && b.t + tf <= preserveBefore) old.set(b.t, b);
      });
    }
    this.bars = klines.map(function (k) {
      var kept = old.get(k.t);
      if (kept) return kept;
      var b = self._newBar(k.t, k.o, false);
      b.h = k.h; b.l = k.l; b.c = k.c; b.v = k.v;
      if (k.takerBuy != null && isFinite(k.takerBuy)) {
        b.buyV = k.takerBuy;
        b.sellV = k.v - k.takerBuy;
        b.delta = b.buyV - b.sellV;
        b.deltaKnown = true;
      }
      return b;
    });
    this._trim();
    this.isSeed = false;
    var lb = this.bars[this.bars.length - 1];
    this.lastPrice = lb ? lb.c : null;
    this._touch();
  };

  // Rebuild the footprint of the last `coverBars` bars from REST trades, then apply the live
  // trades buffered while the backfill was in flight (deduplicated).
  P.backfill = function (trades, buffered, coverBars) {
    var n = this.bars.length;
    if (!n) { for (var j = 0; j < buffered.length; j++) this.applyTrade(buffered[j]); return; }
    var startIdx = Math.max(0, n - coverBars);
    var startTs = this.bars[startIdx].t;
    var i;
    for (i = startIdx; i < n; i++) this._resetFP(this.bars[i]);
    var liveIds = new Set(), firstLiveTs = Infinity;
    for (i = 0; i < buffered.length; i++) {
      liveIds.add(buffered[i].id);
      if (buffered[i].ts < firstLiveTs) firstLiveTs = buffered[i].ts;
    }
    for (i = 0; i < trades.length; i++) {
      var tr = trades[i];
      if (tr.ts < startTs) continue;
      if (tr.ts >= firstLiveTs || liveIds.has(tr.id)) continue;
      this.applyTrade(tr);
    }
    for (i = 0; i < buffered.length; i++) this.applyTrade(buffered[i]);
    var tol = Math.max(2000, this.tfMs * 0.03);
    for (i = startIdx; i < this.bars.length; i++) {
      var b = this.bars[i];
      if (b.klineV == null) continue;
      b.partial = !b.firstTs || b.firstTs - b.t > tol;
      if (b.partial && b.klineV > b.v) b.v = b.klineV;
      b.ver++;
    }
    this._touch();
  };

  // ---- Demo seed (clearly labelled in the UI, never presented as real) -----------------------
  P.seed = function (count, price) {
    this.reset();
    var rnd = mulberry32(42), tf = this.tfMs, now = Math.floor(Date.now() / tf) * tf;
    var p = price, vol = price * 0.0012;
    for (var i = count - 1; i >= 0; i--) {
      var t = now - i * tf, bar = this._newBar(t, p, true);
      bar.seed = true;
      var trades = 40 + Math.floor(rnd() * 40), drift = (rnd() - 0.5) * vol;
      for (var k = 0; k < trades; k++) {
        p = Math.max(this.tick, p + drift / trades + (rnd() - 0.5) * vol * 0.35);
        this._add(bar, { ts: t + k, price: p, qty: this.lot * (1 + Math.floor(rnd() * 40)), aggressor: rnd() < 0.5 ? 'buy' : 'sell' });
      }
      this.bars.push(bar);
    }
    this.isSeed = true;
    this.lastPrice = p;
    this._touch();
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Views ---------------------------------------------------------------------------------
  // Aggregated cells for a bar at multiplier `mult` with POC, diagonal imbalances (ratio R),
  // optional volume filter `vf` (hide cells below threshold) and stacked-imbalance count `si`.
  P.barView = function (bar, mult, R, vf, si) {
    var vw = bar.view;
    if (vw && vw.ver === bar.ver && vw.mult === mult && vw.R === R && vw.lot === this.lot && vw.vf === vf && vw.si === si) return vw;
    var cells = new Map();
    bar.clusters.forEach(function (c, k) {
      var ak = Math.floor(k / mult);
      var a = cells.get(ak);
      if (!a) { a = { bid: 0, ask: 0 }; cells.set(ak, a); }
      a.bid += c.bid;
      a.ask += c.ask;
    });
    // Apply volume filter after aggregation.
    if (vf > 0) {
      cells.forEach(function (_c, k) { if ((_c.bid + _c.ask) < vf) cells.delete(k); });
    }
    var keys = Array.from(cells.keys()).sort(function (a, b) { return b - a; });
    var poc = null, maxV = 0, maxAbs = 0, imb = new Map(), lot = this.lot;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], c = cells.get(k), v = c.bid + c.ask, d = Math.abs(c.ask - c.bid);
      if (v > maxV) { maxV = v; poc = k; }
      if (d > maxAbs) maxAbs = d;
      var below = cells.get(k - 1), above = cells.get(k + 1);
      // Buy imbalance: ask[p] >= R * bid[p-1 bin]; Sell: bid[p] >= R * ask[p+1 bin].
      var buy = c.ask > 0 && c.ask >= R * Math.max(below ? below.bid : 0, lot);
      var sell = c.bid > 0 && c.bid >= R * Math.max(above ? above.ask : 0, lot);
      if (buy || sell) imb.set(k, buy && sell ? 'both' : buy ? 'buy' : 'sell');
    }
    // Stacked imbalances: mark keys that belong to a run of si+ consecutive same-direction imbalances.
    var stacked = _computeStacked(keys, imb, si);
    vw = { ver: bar.ver, mult: mult, R: R, lot: lot, vf: vf, si: si, cells: cells, keys: keys, poc: poc, maxV: maxV, maxAbsDelta: maxAbs, imb: imb, stacked: stacked };
    bar.view = vw;
    return vw;
  };

  function _computeStacked(keys, imb, n) {
    var out = new Map();
    if (!(n >= 2)) return out;
    var run = [], runDir = null;
    function flush() {
      if (run.length >= n) run.forEach(function (k) { out.set(k, runDir); });
      run = []; runDir = null;
    }
    for (var i = 0; i < keys.length; i++) {
      var d = imb.get(keys[i]);
      var dir = (d === 'buy' || d === 'both') ? 'buy' : (d === 'sell' ? 'sell' : null);
      if (!dir) { flush(); continue; }
      if (dir !== runDir) { flush(); runDir = dir; }
      run.push(keys[i]);
    }
    flush();
    return out;
  }

  // Session volume profile over all bars with footprint data. VA via the standard method:
  // start at the POC and repeatedly add the larger of the next two rows above / below until 70%.
  P.profile = function (mult) {
    var pc = this._profile;
    if (pc && pc.version === this.version && pc.mult === mult) return pc;
    var map = new Map(), total = 0;
    this.bars.forEach(function (b) {
      if (!b.hasFP || !b.clusters) return;
      b.clusters.forEach(function (c, k) {
        var ak = Math.floor(k / mult), v = c.bid + c.ask, a = map.get(ak);
        if (!a) { a = { bid: 0, ask: 0, v: 0 }; map.set(ak, a); }
        a.bid += c.bid; a.ask += c.ask; a.v += v;
        total += v;
      });
    });
    var res = { version: this.version, mult: mult, map: map, total: total, poc: null, vah: null, val: null, maxV: 0 };
    if (map.size) {
      var minK = Infinity, maxK = -Infinity;
      map.forEach(function (a, k) {
        if (a.v > res.maxV) { res.maxV = a.v; res.poc = k; }
        if (k < minK) minK = k;
        if (k > maxK) maxK = k;
      });
      var vol = function (k) { var a = map.get(k); return a ? a.v : 0; };
      var hi = res.poc, lo = res.poc, acc = vol(res.poc), target = total * 0.7;
      while (acc < target && (hi < maxK || lo > minK)) {
        var nUp = Math.min(2, maxK - hi), nDn = Math.min(2, lo - minK);
        var up = 0, dn = 0, j;
        for (j = 1; j <= nUp; j++) up += vol(hi + j);
        for (j = 1; j <= nDn; j++) dn += vol(lo - j);
        if (nUp > 0 && (nDn === 0 || up >= dn)) { hi += nUp; acc += up; }
        else { lo -= nDn; acc += dn; }
      }
      res.vah = hi;
      res.val = lo;
    }
    this._profile = res;
    return res;
  };

  // Cumulative volume delta aligned with bars (null until the first bar with known delta).
  P.cvd = function () {
    if (this._cvd && this._cvd.version === this.version) return this._cvd.values;
    var out = new Array(this.bars.length), sum = null;
    for (var i = 0; i < this.bars.length; i++) {
      var b = this.bars[i];
      if (b.deltaKnown) sum = (sum || 0) + b.delta;
      out[i] = b.deltaKnown ? sum : null;
    }
    this._cvd = { version: this.version, values: out };
    return out;
  };

  // ---- Indicators ----------------------------------------------------------------------------
  P.vwap = function () {
    if (this._vwapCache && this._vwapCache.version === this.version) return this._vwapCache.values;
    var out = new Array(this.bars.length), cumVol = 0, cumTP = 0, lastDay = -1;
    for (var i = 0; i < this.bars.length; i++) {
      var b = this.bars[i], day = Math.floor(b.t / 86400000);
      if (day !== lastDay) { cumVol = 0; cumTP = 0; lastDay = day; }
      cumVol += b.v;
      cumTP += (b.h + b.l + b.c) / 3 * b.v;
      out[i] = cumVol > 0 ? cumTP / cumVol : null;
    }
    this._vwapCache = { version: this.version, values: out };
    return out;
  };

  P.sma = function (period) {
    var ck = '_sma' + period;
    if (this[ck] && this[ck].version === this.version) return this[ck].values;
    var n = this.bars.length, out = new Array(n), sum = 0;
    for (var i = 0; i < n; i++) {
      sum += this.bars[i].c;
      if (i >= period) sum -= this.bars[i - period].c;
      out[i] = i >= period - 1 ? sum / period : null;
    }
    this[ck] = { version: this.version, values: out };
    return out;
  };

  P.ema = function (period) {
    var ck = '_ema' + period;
    if (this[ck] && this[ck].version === this.version) return this[ck].values;
    var n = this.bars.length, out = new Array(n), k = 2 / (period + 1), prev = null, sum = 0;
    for (var i = 0; i < n; i++) {
      var c = this.bars[i].c;
      if (prev == null) {
        sum += c;
        if (i >= period - 1) { prev = sum / period; out[i] = prev; } else out[i] = null;
      } else { prev = c * k + prev * (1 - k); out[i] = prev; }
    }
    this[ck] = { version: this.version, values: out };
    return out;
  };

  P.cpr = function () {
    if (this._cprCache && this._cprCache.version === this.version) return this._cprCache.values;
    var n = this.bars.length, dayMap = new Map();
    for (var i = 0; i < n; i++) {
      var b = this.bars[i], day = Math.floor(b.t / 86400000), d = dayMap.get(day);
      if (!d) { d = { h: b.h, l: b.l, c: b.c }; dayMap.set(day, d); }
      else { if (b.h > d.h) d.h = b.h; if (b.l < d.l) d.l = b.l; d.c = b.c; }
    }
    var keys = Array.from(dayMap.keys()).sort(function (a, bb) { return a - bb; });
    var cprByDay = new Map();
    for (var j = 1; j < keys.length; j++) {
      var pd = dayMap.get(keys[j - 1]);
      var piv = (pd.h + pd.l + pd.c) / 3, bc = (pd.h + pd.l) / 2, tc = piv * 2 - bc;
      cprByDay.set(keys[j], { p: piv, bc: Math.min(bc, tc), tc: Math.max(bc, tc) });
    }
    var out2 = new Array(n);
    for (var ii = 0; ii < n; ii++) out2[ii] = cprByDay.get(Math.floor(this.bars[ii].t / 86400000)) || null;
    this._cprCache = { version: this.version, values: out2 };
    return out2;
  };

  FootprintEngine.binKey = binKey;
  OF.FootprintEngine = FootprintEngine;
})();
