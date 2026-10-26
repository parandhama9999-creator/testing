/* OrderFlow Crypto Pro — renderer.js
 * High-DPI canvas footprint chart. Draws only when marked dirty (coalesced via requestAnimationFrame).
 * Layout: [chart | session profile | order-book ladder | price axis], bottom matrix + CVD + time axis.
 * Input: drag = pan, pinch = zoom x/y, long-press = crosshair, double-tap = reset, wheel = zoom.
 */
(function () {
  'use strict';
  var OF = window.OF, U = OF.util;
  var BG = '#0b0f17', BG_RGB = U.hexToRgb(BG), PANEL = '#0f1520', GRID = 'rgba(148,163,184,0.07)';
  var TOOLTIP_BG = 'rgba(15,21,32,0.92)', TOOLTIP_TEXT = '#e2e8f0', CROSS_COL = 'rgba(226,232,240,0.6)';
  var MUTED = '#94a3b8', POC_COL = '#f59e0b', IMB_BUY = '#06b6d4', IMB_SELL = '#d946ef';
  var MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  var ABSORPTION_VOL_MULT = 3.0, ABSORPTION_SIDE_RATIO = 0.85;
  var MATRIX_ROWS = ['Volume', 'Delta', 'Delta %', 'Min Δ', 'Max Δ'];

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = null;
    this.book = null;
    this.lines = [];
    this.crosshair = null;
    this.mode = 'bidask';
    this.mult = 1;
    this.imbalance = 3;
    this.shading = 'dark';
    this.volFilter = 0;
    this.stackedImb = 3;
    this.showPOC = false;
    this.showImb = true;
    this.showProfile = false;
    this.showVA = false;
    this.showCVD = false;
    this.showMatrix = false;
    this.showVWAP = false;
    this.showSMA = false;
    this.smaPeriod = 20;
    this.showEMA = false;
    this.emaPeriod = 9;
    this.showCPR = false;
    this.view = { barW: 64, rowH: 16, offset: 0, center: null, follow: true };
    this.W = 0; this.H = 0; this.dpr = 1;
    this.raf = 0;
    this.drawCount = 0;
    this.ptrs = new Map();
    this.drag = null;
    this.pinch = null;
    this.lpTimer = 0;
    this.lastTap = 0;
    this.onLineDrag = null;
    this.onLineDragEnd = null;
    this.L = null;
    this.S = null;
    this.setColors('#10b981', '#ef4444');
    this._bindPointer();
    this._bindResize();
  }
  var P = Renderer.prototype;

  P.setEngine = function (e) { this.engine = e; this.markDirty(); };
  P.setBook = function (b) { this.book = b; this.markDirty(); };
  P.setLines = function (lines) { if (!(this.drag && this.drag.type === 'line')) { this.lines = lines || []; this.markDirty(); } };

  P.setColors = function (bull, bear) {
    this.bull = bull; this.bear = bear;
    this.bullHSL = U.rgbToHsl(U.hexToRgb(bull));
    this.bearHSL = U.rgbToHsl(U.hexToRgb(bear));
    this._shadeCache = {};
    this.markDirty();
  };
  P.setOptions = function (o) {
    if (o.mode) this.mode = o.mode;
    if (o.mult) this.mult = o.mult;
    if (o.imbalance) this.imbalance = o.imbalance;
    if (o.shading && o.shading !== this.shading) { this.shading = o.shading; this._shadeCache = {}; }
    if (o.volFilter != null) this.volFilter = +o.volFilter || 0;
    if (o.stackedImb != null) this.stackedImb = +o.stackedImb || 0;
    if (o.showPOC != null) this.showPOC = !!o.showPOC;
    if (o.showImb != null) this.showImb = !!o.showImb;
    if (o.showProfile != null) this.showProfile = !!o.showProfile;
    if (o.showVA != null) this.showVA = !!o.showVA;
    if (o.showCVD != null) this.showCVD = !!o.showCVD;
    if (o.showMatrix != null) this.showMatrix = !!o.showMatrix;
    if (o.showVWAP != null) this.showVWAP = !!o.showVWAP;
    if (o.showSMA != null) this.showSMA = !!o.showSMA;
    if (o.smaPeriod) this.smaPeriod = Math.max(2, +o.smaPeriod || 20);
    if (o.showEMA != null) this.showEMA = !!o.showEMA;
    if (o.emaPeriod) this.emaPeriod = Math.max(2, +o.emaPeriod || 9);
    if (o.showCPR != null) this.showCPR = !!o.showCPR;
    this.markDirty();
  };

  P.markDirty = function () {
    if (this.raf) return;
    var self = this;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.draw(); });
  };

  P.resetView = function () {
    this.view.barW = this.W < 500 ? 100 : 112; // wide enough for "bid × ask" text at 1x
    this.view.rowH = 16;
    this.view.offset = 0;
    this.view.center = null;
    this.view.follow = true;
    this.crosshair = null;
    this.markDirty();
  };

  // Keep the visible window stable when a new bar is appended while scrolled back.
  P.onNewBar = function () { if (this.view.offset > 0.5) this.view.offset += 1; this.markDirty(); };

  // ---- Shading -------------------------------------------------------------------------------
  // ratio = min(1, |cellDelta| / maxAbsDeltaInBar), quantised to 20 steps, cached per shading mode.
  P.shade = function (delta, maxAbs) {
    var ratio = maxAbs > 0 ? Math.min(1, Math.abs(delta) / maxAbs) : 0;
    var q = Math.round(ratio * 20), bull = delta >= 0;
    var key = this.shading + (bull ? 'b' : 's') + q;
    var c = this._shadeCache[key];
    if (c) return c;
    var base = bull ? this.bullHSL : this.bearHSL, r = q / 20, l, s, a = 1, rgb, comp;
    var mono = base.s < 0.15;
    if (this.shading === 'dark') {
      // Dark theme: weak cell → near-black, strong cell → vivid red/green
      l = 0.06 + 0.36 * r;
      s = mono ? base.s : Math.min(1, 0.65 + 0.35 * r);
      rgb = U.hslToRgb(base.h, s, l);
      comp = rgb;
    } else if (this.shading === 'light') {
      // Light theme: weak cell → near-white, strong cell → vivid red/green
      l = 0.92 - 0.50 * r;
      s = mono ? base.s : Math.min(1, 0.28 + 0.72 * r);
      rgb = U.hslToRgb(base.h, s, l);
      comp = rgb;
    } else {
      // heat: neon glow on dark background
      l = 0.14 + 0.46 * r; s = Math.min(1, 0.45 + 0.55 * r); a = 0.40 + 0.55 * r;
      rgb = U.hslToRgb(base.h, s, l);
      comp = { r: rgb.r * a + BG_RGB.r * (1 - a), g: rgb.g * a + BG_RGB.g * (1 - a), b: rgb.b * a + BG_RGB.b * (1 - a) };
    }
    c = { fill: 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a.toFixed(3) + ')', text: U.textOn(comp) };
    this._shadeCache[key] = c;
    return c;
  };

  P.setAppTheme = function (theme) {
    if (theme === 'light') {
      BG = '#f0f4f8'; BG_RGB = U.hexToRgb(BG);
      PANEL = '#dde4ed'; GRID = 'rgba(30,41,59,0.09)';
      TOOLTIP_BG = 'rgba(241,245,249,0.96)'; TOOLTIP_TEXT = '#0f172a';
      CROSS_COL = 'rgba(30,41,59,0.55)';
    } else {
      BG = '#0b0f17'; BG_RGB = U.hexToRgb(BG);
      PANEL = '#0f1520'; GRID = 'rgba(148,163,184,0.07)';
      TOOLTIP_BG = 'rgba(15,21,32,0.92)'; TOOLTIP_TEXT = '#e2e8f0';
      CROSS_COL = 'rgba(226,232,240,0.6)';
    }
    this._shadeCache = {};
    this.markDirty();
  };

  // ---- Geometry ------------------------------------------------------------------------------
  P._layout = function () {
    var W = this.W, H = this.H, narrow = W < 460;
    var axisW = narrow ? 58 : 68, bookW = narrow ? 28 : 44;
    var profW = (!this.showProfile || W < 340) ? 0 : narrow ? 40 : 70;
    var timeH = 16;
    var mRow = (!this.showMatrix || H < 260) ? 0 : 13;
    var cvdH = (!this.showCVD || !mRow || H < 380) ? 0 : 34;
    var matrixH = mRow ? mRow * MATRIX_ROWS.length + cvdH : 0;
    var chartW = Math.max(40, W - axisW - bookW - profW), chartH = Math.max(40, H - timeH - matrixH);
    return {
      W: W, H: H, chartW: chartW, chartH: chartH, profX: chartW, profW: profW, bookX: chartW + profW, bookW: bookW,
      axisX: W - axisW, axisW: axisW, mY: chartH, mRow: mRow, cvdY: chartH + mRow * MATRIX_ROWS.length, cvdH: cvdH,
      timeY: H - timeH, timeH: timeH
    };
  };

  P._scales = function (L) {
    var e = this.engine, v = this.view, n = e.bars.length;
    var bin = e.baseBin * this.mult, ppp = v.rowH / bin;
    var last = e.lastPrice != null ? e.lastPrice : n ? e.bars[n - 1].c : 0;
    if (v.center == null) v.center = last;
    if (v.follow && last) {
      var yl = L.chartH / 2 - (last - v.center) * ppp;
      if (yl < L.chartH * 0.12 || yl > L.chartH * 0.88) v.center = last;
    }
    var rightPad = v.barW * 1.5, S = { n: n, bin: bin, ppp: ppp, last: last, barW: v.barW, dec: e.dec };
    S.xOf = function (i) { return L.chartW - rightPad - (n - 1 - i - v.offset) * v.barW; };
    S.yOf = function (p) { return L.chartH / 2 - (p - v.center) * ppp; };
    S.priceAt = function (y) { return v.center + (L.chartH / 2 - y) / ppp; };
    S.idxAt = function (x) { return Math.round(n - 1 - v.offset - (L.chartW - rightPad - x) / v.barW); };
    S.i0 = Math.max(0, S.idxAt(0) - 1);
    S.i1 = Math.min(n - 1, S.idxAt(L.chartW) + 1);
    // Price grid step: bin * {1,2,5}·10^k with at least 22px spacing.
    var seq = [1, 2, 5], si = 0, dec = 1;
    while (bin * seq[si] * dec * ppp < 22 && dec < 1e9) { si++; if (si === 3) { si = 0; dec *= 10; } }
    S.pStep = bin * seq[si] * dec;
    S.pDec = Math.max(e.dec, U.decimalsOf(Number(S.pStep.toPrecision(10))));
    if (S.pDec > 8) S.pDec = 8;
    var steps = [1, 2, 3, 5, 10, 15, 30, 60, 120], ti = 0;
    while (ti < steps.length - 1 && steps[ti] * v.barW < 64) ti++;
    S.tStep = steps[ti];
    return S;
  };

  // ---- Draw ----------------------------------------------------------------------------------
  P.draw = function () {
    var ctx = this.ctx;
    if (!this.W || !this.H) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.W, this.H);
    var e = this.engine;
    if (!e || !e.bars.length) {
      ctx.fillStyle = MUTED; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Waiting for market data…', this.W / 2, this.H / 2);
      this.drawCount++;
      return;
    }
    var L = (this.L = this._layout()), S = (this.S = this._scales(L));
    S.prof = e.profile(this.mult);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, L.chartW, L.chartH); ctx.clip();
    this._grid(L, S);
    this._valueArea(L, S);
    this._bars(L, S);
    this._indicators(L, S);
    this._lastLine(L, S);
    this._tradeLines(L, S);
    if (e.isSeed) this._watermark(L);
    ctx.restore();
    this._profile(L, S);
    this._book(L, S);
    this._axis(L, S);
    this._matrix(L, S);
    this._timeAxis(L, S);
    this._crosshair(L, S);
    this.drawCount++;
  };

  P._grid = function (L, S) {
    var ctx = this.ctx, p0 = Math.floor(S.priceAt(L.chartH) / S.pStep), p1 = Math.ceil(S.priceAt(0) / S.pStep);
    ctx.fillStyle = GRID;
    for (var j = p0; j <= p1 && p1 - p0 < 400; j++) ctx.fillRect(0, Math.round(S.yOf(j * S.pStep)), L.chartW, 1);
    for (var i = S.i0; i <= S.i1; i++) {
      if (i % S.tStep === 0) ctx.fillRect(Math.round(S.xOf(i) - S.barW / 2), 0, 1, L.chartH);
    }
  };

  P._valueArea = function (L, S) {
    var pr = S.prof, ctx = this.ctx;
    if (!this.showVA || pr.vah == null) return;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(148,163,184,0.35)';
    ctx.lineWidth = 1;
    [S.yOf((pr.vah + 1) * S.bin), S.yOf(pr.val * S.bin)].forEach(function (y) {
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(L.chartW, Math.round(y) + 0.5); ctx.stroke();
    });
    ctx.restore();
  };

  P._bars = function (L, S) {
    var ctx = this.ctx, e = this.engine, bw = S.barW, gap = Math.max(1, Math.round(bw * 0.08));
    var rowH = this.view.rowH, font = Math.max(7, Math.min(12, Math.floor(rowH * 0.72)));
    ctx.font = font + 'px ' + MONO;
    ctx.textBaseline = 'middle';
    var charW = ctx.measureText('0').width;
    for (var i = S.i0; i <= S.i1; i++) {
      var bar = e.bars[i], xc = S.xOf(i), left = xc - bw / 2 + gap / 2, w = bw - gap;
      if (bar.hasFP && bar.clusters && bar.clusters.size) this._cluster(bar, left, w, S, L, font, charW);
      else this._candle(bar, xc, w, S, !bar.hasFP);
    }
  };

  P._candle = function (bar, xc, w, S, noFP) {
    var ctx = this.ctx, up = bar.c >= bar.o, col = up ? this.bull : this.bear;
    var bodyW = Math.max(1, Math.min(w * 0.55, 18)), x = Math.round(xc - bodyW / 2);
    var yh = S.yOf(bar.h), yl = S.yOf(bar.l), yt = S.yOf(Math.max(bar.o, bar.c)), yb = S.yOf(Math.min(bar.o, bar.c));
    ctx.globalAlpha = noFP ? 0.55 : 1;
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(xc), yh, 1, Math.max(1, yl - yh));
    if (noFP) { // subtle "no footprint" style: hollow-ish body
      ctx.globalAlpha = 0.28;
      ctx.fillRect(x, yt, bodyW, Math.max(1, yb - yt));
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, yt + 0.5, Math.max(1, bodyW - 1), Math.max(1, yb - yt - 1));
    } else {
      ctx.fillRect(x, yt, bodyW, Math.max(1, yb - yt));
    }
    ctx.globalAlpha = 1;
  };

  P._cluster = function (bar, left, w, S, L, font, charW) {
    var ctx = this.ctx, vw = this.engine.barView(bar, this.mult, this.imbalance, this.volFilter, this.stackedImb);
    var candleW = w >= 36 ? 4 : Math.max(1, Math.floor(w * 0.18));
    this._miniCandle(bar, left, candleW, S);
    var cx = left + candleW + 1, cw = w - candleW - 1;
    if (cw < 1) return;
    var rowH = this.view.rowH, hh = Math.max(1, rowH >= 6 ? rowH - 1 : rowH);
    var showText = rowH >= 9;
    var mode = this.mode, mid = cx + cw / 2;
    var showImb = this.showImb;
    var avgCellVol = 0;
    if (vw.keys.length) {
      var totalCellVol = 0;
      for (var jj = 0; jj < vw.keys.length; jj++) { var cjj = vw.cells.get(vw.keys[jj]); if (cjj) totalCellVol += cjj.bid + cjj.ask; }
      avgCellVol = totalCellVol / vw.keys.length;
    }
    for (var j = 0; j < vw.keys.length; j++) {
      var k = vw.keys[j], c = vw.cells.get(k), yTop = S.yOf((k + 1) * S.bin);
      if (yTop > L.chartH || yTop + rowH < 0) continue;
      // Stacked imbalance background highlight.
      var st = vw.stacked.get(k);
      if (st) {
        ctx.fillStyle = st === 'buy' ? 'rgba(6,182,212,0.18)' : 'rgba(217,70,239,0.18)';
        ctx.fillRect(cx, yTop, cw, hh);
      }
      var sh = this.shade(c.ask - c.bid, vw.maxAbsDelta);
      ctx.fillStyle = sh.fill;
      ctx.fillRect(cx, yTop, cw, hh);
      var im = vw.imb.get(k);
      if (showImb) {
        if (im === 'buy' || im === 'both') { ctx.fillStyle = IMB_BUY; ctx.fillRect(cx + cw - 2, yTop, 2, hh); }
        if (im === 'sell' || im === 'both') { ctx.fillStyle = IMB_SELL; ctx.fillRect(cx, yTop, 2, hh); }
      }
      // Absorption marker: high-vol cell skewed to one side.
      var cellVol = c.bid + c.ask;
      if (avgCellVol > 0 && cellVol > avgCellVol * ABSORPTION_VOL_MULT) {
        var bidRatio = cellVol > 0 ? c.bid / cellVol : 0, askRatio = cellVol > 0 ? c.ask / cellVol : 0;
        if (bidRatio >= ABSORPTION_SIDE_RATIO) {
          ctx.fillStyle = 'rgba(239,68,68,0.85)';
          ctx.fillRect(cx, yTop, 4, hh);
        } else if (askRatio >= ABSORPTION_SIDE_RATIO) {
          ctx.fillStyle = 'rgba(16,185,129,0.85)';
          ctx.fillRect(cx + cw - 4, yTop, 4, hh);
        }
      }
      if (!showText) continue;
      var ty = yTop + hh / 2 + 0.5;
      if (mode === 'bidask') {
        var lt = U.fmtQty(c.bid), rt = U.fmtQty(c.ask);
        if (Math.max(lt.length, rt.length) * charW * 2 + 10 > cw) continue;
        ctx.fillStyle = sh.text;
        ctx.textAlign = 'right';
        if (showImb && (im === 'sell' || im === 'both')) ctx.font = 'bold ' + font + 'px ' + MONO;
        ctx.fillText(lt, mid - 4, ty);
        ctx.font = font + 'px ' + MONO;
        ctx.textAlign = 'left';
        if (showImb && (im === 'buy' || im === 'both')) ctx.font = 'bold ' + font + 'px ' + MONO;
        ctx.fillText(rt, mid + 4, ty);
        ctx.font = font + 'px ' + MONO;
        if (cw > (lt.length + rt.length + 1) * charW + 14) { ctx.textAlign = 'center'; ctx.fillText('×', mid, ty); }
      } else {
        var delta = c.ask - c.bid, total = c.bid + c.ask;
        var txt;
        if (mode === 'delta') txt = (delta > 0 ? '+' : '') + U.fmtQty(delta);
        else if (mode === 'delta%') txt = (delta > 0 ? '+' : '') + (total > 0 ? (delta / total * 100).toFixed(0) : '0') + '%';
        else if (mode === 'bid') txt = U.fmtQty(c.bid);
        else if (mode === 'ask') txt = U.fmtQty(c.ask);
        else txt = U.fmtQty(total);
        if (txt.length * charW + 6 > cw) continue;
        ctx.fillStyle = sh.text;
        ctx.textAlign = 'center';
        ctx.fillText(txt, mid, ty);
      }
    }
    if (this.showPOC && vw.poc != null) {
      var py = S.yOf((vw.poc + 1) * S.bin);
      ctx.strokeStyle = POC_COL; ctx.lineWidth = 1.5;
      ctx.strokeRect(cx + 0.75, py + 0.75, Math.max(1, cw - 1.5), Math.max(1, hh - 1.5));
    }
    if (bar.partial && w >= 40) {
      ctx.fillStyle = MUTED; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('partial', left + w / 2, S.yOf((vw.keys[0] + 1) * S.bin) - 6);
      ctx.font = font + 'px ' + MONO;
    }
  };

  P._indicators = function (L, S) {
    var ctx = this.ctx, e = this.engine;
    function series(vals, col, w) {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w || 1.5;
      ctx.beginPath();
      var go = false;
      for (var i = S.i0; i <= S.i1; i++) {
        var v = vals[i]; if (v == null) { go = false; continue; }
        var x = S.xOf(i), y = S.yOf(v);
        if (!go) { ctx.moveTo(x, y); go = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.restore();
    }
    function tag(label, vals, col) {
      var last = Math.min(S.i1, e.bars.length - 1), v = vals[last];
      if (v == null) return;
      ctx.save(); ctx.fillStyle = col; ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, S.xOf(last) + S.barW * 0.6 + 2, S.yOf(v));
      ctx.restore();
    }
    if (this.showVWAP) { var vw = e.vwap(); series(vw, '#f59e0b'); tag('VWAP', vw, '#f59e0b'); }
    if (this.showSMA)  { var sm = e.sma(this.smaPeriod);  series(sm, '#60a5fa'); tag('SMA' + this.smaPeriod, sm, '#60a5fa'); }
    if (this.showEMA)  { var em = e.ema(this.emaPeriod);  series(em, '#c084fc'); tag('EMA' + this.emaPeriod, em, '#c084fc'); }
    if (this.showCPR && e.bars.length) {
      var cprs = e.cpr(), segDay = null, segCpr = null, segX0 = null, segs = [];
      for (var i = S.i0; i <= S.i1; i++) {
        var day = Math.floor(e.bars[i].t / 86400000), cpr = cprs[i];
        if (day !== segDay) {
          if (segCpr) segs.push({ cpr: segCpr, x0: segX0, x1: S.xOf(i - 1) + S.barW / 2 });
          segDay = day; segCpr = cpr; segX0 = cpr ? S.xOf(i) - S.barW / 2 : null;
        }
      }
      if (segCpr) segs.push({ cpr: segCpr, x0: segX0, x1: S.xOf(Math.min(S.i1, e.bars.length - 1)) + S.barW / 2 });
      segs.forEach(function (seg) {
        [{ v: seg.cpr.p, c: '#fbbf24', l: 'P' }, { v: seg.cpr.bc, c: '#34d399', l: 'BC' }, { v: seg.cpr.tc, c: '#f87171', l: 'TC' }].forEach(function (ln) {
          var y = Math.round(S.yOf(ln.v)) + 0.5;
          ctx.save(); ctx.strokeStyle = ln.c; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(seg.x0, y); ctx.lineTo(seg.x1, y); ctx.stroke();
          ctx.fillStyle = ln.c; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText(ln.l, seg.x0 + 3, y); ctx.restore();
        });
      });
    }
  };

  P._miniCandle = function (bar, left, cw, S) {
    var ctx = this.ctx, col = bar.c >= bar.o ? this.bull : this.bear, xm = Math.round(left + cw / 2);
    var yh = S.yOf(bar.h), yl = S.yOf(bar.l), yt = S.yOf(Math.max(bar.o, bar.c)), yb = S.yOf(Math.min(bar.o, bar.c));
    ctx.fillStyle = col;
    ctx.fillRect(xm, yh, 1, Math.max(1, yl - yh));
    ctx.fillRect(Math.round(left), yt, Math.max(1, cw), Math.max(1, yb - yt));
  };

  P._lastLine = function (L, S) {
    if (!S.last) return;
    var ctx = this.ctx, y = Math.round(S.yOf(S.last)) + 0.5, lb = this.engine.bars[S.n - 1];
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = lb && lb.c < lb.o ? this.bear : this.bull;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.chartW, y); ctx.stroke();
    ctx.restore();
  };

  P._tradeLines = function (L, S) {
    var ctx = this.ctx;
    this.lines.forEach(function (ln) {
      var y = Math.round(U.clamp(S.yOf(ln.price), 1, L.chartH - 1)) + 0.5;
      ctx.save();
      ctx.strokeStyle = ln.color;
      ctx.lineWidth = ln.draggable ? 1.5 : 1;
      ctx.setLineDash(ln.dash || []);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.chartW, y); ctx.stroke();
      if (ln.draggable) { // grab handle
        ctx.setLineDash([]);
        ctx.fillStyle = ln.color;
        ctx.fillRect(L.chartW - 34, y - 6, 26, 12);
        ctx.fillStyle = '#000'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⇕', L.chartW - 21, y + 0.5);
      }
      ctx.restore();
    });
  };

  P._watermark = function (L) {
    var ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(245,158,11,0.10)';
    ctx.font = 'bold ' + Math.max(18, Math.min(48, L.chartW / 9)) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DEMO DATA', L.chartW / 2, L.chartH / 2);
    ctx.restore();
  };

  P._profile = function (L, S) {
    if (!L.profW) return;
    var ctx = this.ctx, pr = S.prof, w = L.profW - 4;
    ctx.fillStyle = PANEL;
    ctx.fillRect(L.profX, 0, L.profW, L.chartH);
    if (!pr.map.size) return;
    var rowH = this.view.rowH, hh = Math.max(1, rowH >= 6 ? rowH - 1 : rowH);
    pr.map.forEach(function (a, k) {
      var y = S.yOf((k + 1) * S.bin);
      if (y > L.chartH || y + rowH < 0) return;
      var len = Math.max(1, (a.v / pr.maxV) * w);
      var inVA = k >= pr.val && k <= pr.vah;
      ctx.fillStyle = k === pr.poc ? POC_COL : inVA ? 'rgba(148,163,184,0.60)' : 'rgba(148,163,184,0.25)';
      ctx.fillRect(L.profX + 2, y, len, hh);
    });
    ctx.font = '9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var lbl = [['VAH', (pr.vah + 1) * S.bin], ['VAL', pr.val * S.bin], ['VPOC', (pr.poc + 0.5) * S.bin]];
    lbl.forEach(function (t) {
      var y = S.yOf(t[1]);
      if (y < 6 || y > L.chartH - 6) return;
      ctx.fillStyle = t[0] === 'VPOC' ? POC_COL : MUTED;
      ctx.fillText(t[0], L.profX + L.profW - 2, y);
    });
  };

  P._book = function (L, S) {
    var ctx = this.ctx, bk = this.book;
    ctx.fillStyle = '#0c121c';
    ctx.fillRect(L.bookX, 0, L.bookW, L.chartH);
    if (!bk) return;
    var agg = function (levels) {
      var m = new Map();
      for (var i = 0; i < levels.length; i++) {
        var k = Math.floor(levels[i][0] / S.bin + 1e-9);
        m.set(k, (m.get(k) || 0) + levels[i][1]);
      }
      return m;
    };
    var bids = agg(bk.bids), asks = agg(bk.asks), maxQ = 0;
    bids.forEach(function (q) { if (q > maxQ) maxQ = q; });
    asks.forEach(function (q) { if (q > maxQ) maxQ = q; });
    if (!maxQ) return;
    var rowH = this.view.rowH, hh = Math.max(1, rowH >= 6 ? rowH - 1 : rowH), w = L.bookW - 3, self = this;
    var draw = function (m, col) {
      ctx.fillStyle = col;
      m.forEach(function (q, k) {
        var y = S.yOf((k + 1) * S.bin);
        if (y > L.chartH || y + rowH < 0) return;
        ctx.fillRect(L.bookX + 1, y, Math.max(1, (q / maxQ) * w), hh);
      });
    };
    ctx.globalAlpha = 0.75;
    draw(bids, self.bull);
    draw(asks, self.bear);
    ctx.globalAlpha = 1;
  };

  P._axis = function (L, S) {
    var ctx = this.ctx;
    ctx.fillStyle = PANEL;
    ctx.fillRect(L.axisX, 0, L.axisW, L.chartH);
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    ctx.fillRect(L.axisX, 0, 1, L.H);
    ctx.font = '10px ' + MONO; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = MUTED;
    var p0 = Math.floor(S.priceAt(L.chartH) / S.pStep), p1 = Math.ceil(S.priceAt(0) / S.pStep);
    for (var j = p0; j <= p1 && p1 - p0 < 400; j++) {
      var y = S.yOf(j * S.pStep);
      if (y < 6 || y > L.chartH - 6) continue;
      ctx.fillText(U.fmtPrice(j * S.pStep, S.pDec), L.axisX + 4, y);
    }
    if (S.last) {
      var lb = this.engine.bars[S.n - 1];
      this._axisTag(L, S.yOf(S.last), U.fmtPrice(S.last, S.dec), lb && lb.c < lb.o ? this.bear : this.bull);
    }
    var self = this;
    this.lines.forEach(function (ln) {
      var y = U.clamp(S.yOf(ln.price), 7, L.chartH - 7);
      self._axisTag(L, y, ln.label + ' ' + U.fmtPrice(ln.price, S.dec), ln.color);
    });
  };

  P._axisTag = function (L, y, text, col) {
    var ctx = this.ctx;
    ctx.font = '10px ' + MONO;
    var tw = Math.min(L.axisW - 2, ctx.measureText(text).width + 6);
    ctx.fillStyle = col;
    ctx.fillRect(L.axisX + 1, Math.round(y - 7), tw, 14);
    ctx.fillStyle = U.textOn(U.hexToRgb(col));
    ctx.textAlign = 'left';
    ctx.fillText(text, L.axisX + 4, y, L.axisW - 6);
  };

  P._matrix = function (L, S) {
    if (!L.mRow) return;
    var ctx = this.ctx, e = this.engine, i, b, self = this;
    ctx.fillStyle = '#0d1320';
    ctx.fillRect(0, L.mY, L.W, L.H - L.mY);
    var maxV = 0, maxD = 0;
    for (i = S.i0; i <= S.i1; i++) {
      b = e.bars[i];
      if (b.v > maxV) maxV = b.v;
      if (b.deltaKnown) maxD = Math.max(maxD, Math.abs(b.delta), Math.abs(b.minDelta), Math.abs(b.maxDelta));
    }
    var bw = S.barW, showTxt = bw >= 34;
    ctx.font = '9px ' + MONO; ctx.textBaseline = 'middle';
    for (var r = 0; r < MATRIX_ROWS.length; r++) {
      var y = L.mY + r * L.mRow;
      ctx.fillStyle = 'rgba(148,163,184,0.12)';
      ctx.fillRect(0, y, L.W, 1);
      ctx.fillStyle = MUTED; ctx.textAlign = 'left';
      ctx.fillText(MATRIX_ROWS[r], L.profX + 4, y + L.mRow / 2 + 0.5);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y, L.chartW, L.mRow); ctx.clip();
      for (i = S.i0; i <= S.i1; i++) {
        b = e.bars[i];
        var x = S.xOf(i) - bw / 2 + 1, val = null, sh = null;
        if (r === 0) { val = b.v; var a = maxV ? 0.08 + 0.5 * (b.v / maxV) : 0.08; sh = { fill: 'rgba(148,163,184,' + a.toFixed(2) + ')', text: '#e5e7eb' }; }
        else if (b.deltaKnown) {
          if (r === 1) val = b.delta;
          else if (r === 2) val = b.v > 0 ? (b.delta / b.v) * 100 : 0;
          else if (b.hasFP) val = r === 3 ? b.minDelta : b.maxDelta;
          if (val != null) sh = self.shade(r === 2 ? b.delta : val, r === 2 ? b.v : maxD);
        }
        if (!sh) continue;
        ctx.fillStyle = sh.fill;
        ctx.fillRect(x, y + 1, bw - 2, L.mRow - 1);
        if (showTxt) {
          var t = r === 2 ? val.toFixed(1) + '%' : (r > 0 && val > 0 ? '+' : '') + U.fmtQty(val);
          ctx.fillStyle = sh.text; ctx.textAlign = 'center';
          ctx.fillText(t, x + (bw - 2) / 2, y + L.mRow / 2 + 0.5, bw - 4);
        }
      }
      ctx.restore();
    }
    if (L.cvdH) this._cvd(L, S);
  };

  P._cvd = function (L, S) {
    var ctx = this.ctx, cv = this.engine.cvd(), lo = Infinity, hi = -Infinity, i, lastV = null;
    for (i = S.i0; i <= S.i1; i++) if (cv[i] != null) { lo = Math.min(lo, cv[i]); hi = Math.max(hi, cv[i]); lastV = cv[i]; }
    var y0 = L.cvdY;
    ctx.fillStyle = 'rgba(148,163,184,0.12)';
    ctx.fillRect(0, y0, L.W, 1);
    ctx.fillStyle = MUTED; ctx.font = '9px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('CVD ' + (lastV != null ? U.fmtQty(lastV) : '–'), L.profX + 4, y0 + 8);
    if (!isFinite(lo)) return;
    if (hi === lo) { hi += 1; lo -= 1; }
    var pad = 4, h = L.cvdH - pad * 2, yOf = function (v) { return y0 + pad + (1 - (v - lo) / (hi - lo)) * h; };
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, L.chartW, L.cvdH); ctx.clip();
    if (lo < 0 && hi > 0) { ctx.fillStyle = 'rgba(148,163,184,0.2)'; ctx.fillRect(0, Math.round(yOf(0)), L.chartW, 1); }
    ctx.strokeStyle = POC_COL; ctx.lineWidth = 1.5; ctx.beginPath();
    var started = false;
    for (i = S.i0; i <= S.i1; i++) {
      if (cv[i] == null) { started = false; continue; }
      var x = S.xOf(i), y = yOf(cv[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  P._timeAxis = function (L, S) {
    var ctx = this.ctx, e = this.engine;
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, L.timeY, L.W, L.timeH);
    ctx.fillStyle = MUTED; ctx.font = '10px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = S.i0; i <= S.i1; i++) {
      if (i % S.tStep !== 0) continue;
      var x = S.xOf(i);
      if (x < 16 || x > L.chartW - 16) continue;
      ctx.fillText(U.fmtTime(e.bars[i].t), x, L.timeY + L.timeH / 2 + 0.5);
    }
  };

  P._crosshair = function (L, S) {
    var ch = this.crosshair;
    if (!ch || ch.x > L.chartW || ch.y > L.chartH) return;
    var ctx = this.ctx, e = this.engine, idx = U.clamp(S.idxAt(ch.x), 0, S.n - 1), bar = e.bars[idx];
    ctx.save();
    ctx.strokeStyle = CROSS_COL; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    var x = Math.round(S.xOf(idx)) + 0.5, y = Math.round(ch.y) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L.timeY); ctx.moveTo(0, y); ctx.lineTo(L.chartW, y); ctx.stroke();
    ctx.restore();
    this._axisTag(L, y, U.fmtPrice(S.priceAt(ch.y), S.dec), TOOLTIP_TEXT);
    var tl = U.fmtTime(bar.t);
    ctx.fillStyle = TOOLTIP_TEXT; ctx.fillRect(x - 22, L.timeY, 44, L.timeH);
    ctx.fillStyle = U.textOn(U.hexToRgb(TOOLTIP_TEXT));
    ctx.font = '10px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tl, x, L.timeY + L.timeH / 2 + 0.5);
    var vwC = bar.hasFP ? e.barView(bar, this.mult, this.imbalance, this.volFilter, this.stackedImb) : null;
    var pocStr = vwC && vwC.poc != null ? '  POC ' + U.fmtPrice((vwC.poc + 0.5) * S.bin, S.dec) : '';
    var dPct = bar.deltaKnown && bar.v > 0 ? (bar.delta / bar.v * 100).toFixed(1) + '%' : '';
    var info = 'O ' + U.fmtPrice(bar.o, S.dec) + ' H ' + U.fmtPrice(bar.h, S.dec) + ' L ' + U.fmtPrice(bar.l, S.dec) +
      ' C ' + U.fmtPrice(bar.c, S.dec) + '  V ' + U.fmtQty(bar.v) +
      (bar.deltaKnown ? '  Δ ' + U.fmtQty(bar.delta) + ' (' + dPct + ')' : '') + pocStr;
    var info2 = bar.deltaKnown && bar.hasFP ? 'MinΔ ' + U.fmtQty(bar.minDelta) + '  MaxΔ ' + U.fmtQty(bar.maxDelta) : '';
    ctx.font = '10px ' + MONO;
    var tw = Math.min(L.chartW - 8, ctx.measureText(info).width + 10);
    var th = info2 ? 30 : 16;
    ctx.fillStyle = TOOLTIP_BG; ctx.fillRect(4, 4, tw, th);
    ctx.fillStyle = TOOLTIP_TEXT; ctx.textAlign = 'left';
    ctx.fillText(info, 9, 12.5, tw - 8);
    if (info2) ctx.fillText(info2, 9, 26.5, tw - 8);
  };

  // ---- Input ---------------------------------------------------------------------------------
  P._pos = function (ev) {
    var r = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  P._hitLine = function (p) {
    if (!this.S || !this.L || p.x > this.L.chartW) return null;
    for (var i = 0; i < this.lines.length; i++) {
      var ln = this.lines[i];
      // Lines outside the view are drawn pinned to the edge, so hit-test the pinned position.
      if (ln.draggable && Math.abs(U.clamp(this.S.yOf(ln.price), 1, this.L.chartH - 1) - p.y) <= 14) return ln;
    }
    return null;
  };

  P._bindPointer = function () {
    var self = this, c = this.canvas;
    c.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      try { c.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      var p = self._pos(ev);
      self.ptrs.set(ev.pointerId, p);
      clearTimeout(self.lpTimer);
      if (self.ptrs.size === 1) {
        var hit = self._hitLine(p);
        if (hit) { self.drag = { type: 'line', line: hit }; return; }
        self.drag = { type: 'pending', x0: p.x, y0: p.y, off0: self.view.offset, c0: self.view.center, mouse: ev.pointerType === 'mouse' };
        if (ev.pointerType !== 'mouse') {
          self.lpTimer = setTimeout(function () {
            if (self.drag && self.drag.type === 'pending') {
              self.drag.type = 'cross';
              self.crosshair = { x: p.x, y: p.y };
              if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } }
              self.markDirty();
            }
          }, 450);
        }
      } else if (self.ptrs.size === 2) {
        var pts = Array.from(self.ptrs.values());
        self.drag = null;
        self.pinch = { dx0: Math.abs(pts[0].x - pts[1].x), dy0: Math.abs(pts[0].y - pts[1].y), bw0: self.view.barW, rh0: self.view.rowH };
      }
    });
    c.addEventListener('pointermove', function (ev) {
      var p = self._pos(ev);
      if (!self.ptrs.has(ev.pointerId)) {
        if (ev.pointerType === 'mouse' && self.S) { self.crosshair = { x: p.x, y: p.y }; self.markDirty(); }
        return;
      }
      self.ptrs.set(ev.pointerId, p);
      if (self.pinch && self.ptrs.size >= 2) {
        var pts = Array.from(self.ptrs.values()), pi = self.pinch;
        var dx = Math.abs(pts[0].x - pts[1].x), dy = Math.abs(pts[0].y - pts[1].y);
        self.view.barW = U.clamp(pi.bw0 * (dx / Math.max(pi.dx0, 20)), 3, 240);
        self.view.rowH = U.clamp(pi.rh0 * (dy / Math.max(pi.dy0, 20)), 2, 64);
        self.markDirty();
        return;
      }
      var d = self.drag;
      if (!d) return;
      if (d.type === 'line') {
        d.line.price = U.roundToTick(self.S.priceAt(U.clamp(p.y, 0, self.L.chartH)), self.engine.tick);
        if (self.onLineDrag) self.onLineDrag(d.line.id, d.line.price);
        self.markDirty();
        return;
      }
      if (d.type === 'pending' && Math.hypot(p.x - d.x0, p.y - d.y0) > 8) { d.type = 'pan'; clearTimeout(self.lpTimer); }
      if (d.type === 'pan') {
        var n = self.engine ? self.engine.bars.length : 0;
        self.view.offset = U.clamp(d.off0 + (p.x - d.x0) / self.view.barW, -5, Math.max(0, n - 2));
        if (Math.abs(p.y - d.y0) > 8 || !self.view.follow) {
          self.view.follow = false;
          var ppp = self.S ? self.S.ppp : 1;
          self.view.center = d.c0 + (p.y - d.y0) / ppp;
        }
        if (d.mouse) self.crosshair = null;
        self.markDirty();
      } else if (d.type === 'cross') {
        self.crosshair = { x: p.x, y: p.y };
        self.markDirty();
      }
    });
    var end = function (ev) {
      var d = self.drag;
      self.ptrs.delete(ev.pointerId);
      clearTimeout(self.lpTimer);
      if (self.pinch) { if (self.ptrs.size < 2) self.pinch = null; self.drag = null; return; }
      if (d && d.type === 'line') {
        if (self.onLineDragEnd) self.onLineDragEnd(d.line.id, d.line.price);
      } else if (d && d.type === 'pending' && ev.type === 'pointerup') {
        var now = Date.now();
        if (now - self.lastTap < 300) { self.lastTap = 0; self.resetView(); }
        else {
          self.lastTap = now;
          if (self.crosshair && !d.mouse) { self.crosshair = null; self.markDirty(); }
        }
      }
      self.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType === 'mouse' && !self.ptrs.size) { self.crosshair = null; self.markDirty(); }
    });
    c.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var f = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      if (ev.shiftKey || ev.ctrlKey || ev.altKey) self.view.rowH = U.clamp(self.view.rowH * f, 2, 64);
      else self.view.barW = U.clamp(self.view.barW * f, 3, 240);
      self.markDirty();
    }, { passive: false });
    c.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  };

  P._bindResize = function () {
    var self = this, fn = function () { self.resize(); };
    if (window.ResizeObserver) { this.ro = new ResizeObserver(fn); this.ro.observe(this.canvas.parentElement); }
    window.addEventListener('resize', fn);
    window.addEventListener('orientationchange', function () { setTimeout(fn, 150); });
    fn();
  };

  P.resize = function () {
    var r = this.canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(3, window.devicePixelRatio || 1), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.W && h === this.H && dpr === this.dpr) return;
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.draw(); // draw synchronously so a resize never shows a blank frame
  };

  OF.Renderer = Renderer;
})();
