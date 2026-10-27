/* OrderFlow Crypto Pro — app.js
 * Bootstrap and wiring: demo seed within the first frame -> klines -> footprint backfill -> live
 * stream. Guards every async step with a load token so symbol/timeframe switches never mix data.
 */
(function () {
  'use strict';
  var OF = window.OF, C = OF.config, S = OF.storage, U = OF.util;
  var $ = function (id) { return document.getElementById(id); };

  var app = (OF.app = {
    settings: null,
    engine: null,
    renderer: null,
    market: null,
    paper: null,
    monet: null,
    alerts: null,
    study: null,
    state: {
      symbol: null, tf: null, loadToken: 0, buffering: false, buffer: [], hiddenAt: 0,
      lastPrice: null, lastTradeTs: 0, prices: {}, liveMeta: {}, retryTimer: 0, firstPaintMs: null,
      fetchingMore: false
    },
    drawLines: []
  });
  var st = app.state;

  app.meta = function () { return U.symbolMeta(st.symbol, st.liveMeta); };

  function loadSettings() {
    var s = Object.assign({}, C.DEFAULT_SETTINGS, S.get('settings', {}));
    if (C.SYMBOLS.indexOf(s.symbol) < 0) s.symbol = C.DEFAULT_SETTINGS.symbol;
    if (!C.TIMEFRAMES[s.tf]) s.tf = C.DEFAULT_SETTINGS.tf;
    if (C.BIN_MULTIPLIERS.indexOf(+s.mult) < 0) s.mult = 1;
    if (!C.CLUSTER_MODES[s.mode]) s.mode = 'bidask';
    s.imbalance = U.clamp(+s.imbalance || 3, 2, 6);
    return s;
  }
  function saveSettings() { S.set('settings', app.settings); }

  function applySettings() {
    var s = app.settings, r = app.renderer;
    if (!app.monet.isPro && +s.mult > 5) s.mult = 1;
    r.setColors(s.bull, s.bear);
    r.setOptions({ mode: s.mode, mult: s.mult, imbalance: s.imbalance, shading: s.shading,
      volFilter: s.volFilter, stackedImb: s.stackedImb,
      showPOC: s.showPOC, showImb: s.showImb, showProfile: s.showProfile,
      showVA: s.showVA, showCVD: s.showCVD, showMatrix: s.showMatrix,
      showVolBars: s.showVolBars, showSessions: s.showSessions,
      showVWAP: s.showVWAP, showSMA: s.showSMA, smaPeriod: s.smaPeriod,
      showEMA: s.showEMA, emaPeriod: s.emaPeriod, showCPR: s.showCPR });
  }

  function saveDrawLines() { S.set('drawLines_' + st.symbol, app.drawLines); }
  function loadDrawLines() {
    app.drawLines = S.get('drawLines_' + st.symbol, []);
    app.renderer.userLines = app.drawLines.map(function (l) { return Object.assign({}, l); });
  }

  app.fetchMoreBars = async function () {
    if (st.fetchingMore || !app.engine || app.engine.isSeed || !app.engine.bars.length) return;
    if (app.engine.bars.length >= C.MAX_LOOKBACK_BARS) return;
    st.fetchingMore = true;
    var oldest = app.engine.bars[0].t, sym = st.symbol, tf = st.tf;
    try {
      var klines = await app.market.fetchKlines(sym, tf, C.KLINE_LIMIT, oldest);
      if (st.symbol !== sym || st.tf !== tf) { st.fetchingMore = false; return; }
      if (klines.length) { app.engine.prependKlines(klines); app.renderer.onBarsUpdated(); }
    } catch (err) { console.warn('[app] fetchMoreBars:', err.message); }
    st.fetchingMore = false;
  };

  app.setDrawMode = function (on) {
    st.drawMode = !!on;
    app.renderer.setDrawMode(on);
    OF.ui.setDrawActive(on);
  };

  function configureEngine() {
    var m = app.meta();
    app.engine.configure({ symbol: st.symbol, tfMs: C.TIMEFRAMES[st.tf], baseBin: m.baseBin, tick: m.tick, lot: m.lot, dec: m.dec });
  }

  function seedDemo() {
    configureEngine();
    app.engine.seed(C.SEED_BARS, app.meta().seed);
    OF.ui.showDemo(true, 'Demo data — loading live market…');
    app.renderer.resetView();
    app.renderer.setBook(null);
    updateLines();
  }

  function saveBarsToCache() {
    if (!app.engine || !app.engine.bars.length || app.engine.isSeed) return;
    var key = 'barcache_' + st.symbol + '_' + st.tf;
    var bars = app.engine.bars.slice(-C.BAR_CACHE_MAX);
    var klines = bars.map(function (b) { return [b.t, b.o, b.h, b.l, b.c, b.v]; });
    S.set(key, { ts: Date.now(), klines: klines });
  }

  function restoreBarsFromCache() {
    var key = 'barcache_' + st.symbol + '_' + st.tf;
    var cached = S.get(key, null);
    if (!cached || !cached.ts || !cached.klines || !cached.klines.length) return false;
    if (Date.now() - cached.ts > C.BAR_CACHE_TTL_MS) return false;
    app.engine.loadKlines(cached.klines, 0);
    return true;
  }

  // ---- Market loading ------------------------------------------------------------------------
  app.loadMarket = async function (opts) {
    if (app.study && app.study.active) return;
    var preserveBefore = (opts && opts.preserveBefore) || 0;
    var token = ++st.loadToken, sym = st.symbol, tf = st.tf, e = app.engine, mk = app.market;
    clearTimeout(st.retryTimer);
    mk.stop();
    st.buffering = true;
    st.buffer = [];
    OF.ui.setStatus('connecting', 'Loading ' + mk.label() + '…');
    if (restoreBarsFromCache()) { OF.ui.showDemo(false); setLast(e.lastPrice); app.renderer.markDirty(); }
    var klines;
    try {
      klines = await mk.fetchKlines(sym, tf, C.KLINE_LIMIT);
      st.wasOffline = false;
    } catch (err) {
      if (token !== st.loadToken) return;
      console.warn('[app] klines failed:', err.message);
      OF.ui.setStatus('offline', 'Offline — retrying…');
      if (!st.wasOffline) { st.wasOffline = true; OF.ui.toast('No market data — check your connection'); }
      if (e.isSeed) OF.ui.showDemo(true, 'Demo data — live market unavailable, retrying…');
      st.retryTimer = setTimeout(function () { if (token === st.loadToken) app.loadMarket(opts); }, 5000);
      return;
    }
    if (token !== st.loadToken) return;
    e.loadKlines(klines, preserveBefore);
    OF.ui.showDemo(false);
    setLast(e.lastPrice);
    app.renderer.markDirty();

    mk.connect(sym, {
      onTrade: function (t) { onTrade(token, t); },
      onDepth: function (b) { if (token === st.loadToken) app.renderer.setBook(b); },
      onStatus: function (state, text) { if (token === st.loadToken) OF.ui.setStatus(state, text); },
      onReconnect: function () { if (token === st.loadToken) app.loadMarket({ preserveBefore: st.lastTradeTs }); }
    });

    var cover = Math.min(C.FOOTPRINT_BACKFILL_BARS, e.bars.length);
    try {
      var startTs = e.bars[e.bars.length - cover].t;
      var trades = await mk.fetchFootprintTrades(sym, startTs);
      if (token !== st.loadToken) return;
      e.backfill(trades, st.buffer, cover);
    } catch (err) {
      if (token !== st.loadToken) return;
      console.warn('[app] footprint backfill failed:', err.message);
      e.backfill([], st.buffer, 1);
    }
    st.buffering = false;
    st.buffer = [];
    setLast(e.lastPrice);
    app.renderer.markDirty();
  };

  function onTrade(token, t) {
    if (token !== st.loadToken) return; // late message from an old symbol/timeframe
    var sym = st.symbol;
    st.lastTradeTs = t.ts;
    // Check price alerts before updating lastPrice.
    if (app.alerts) {
      var triggered = app.alerts.check(sym, t.price, st.lastPrice);
      for (var ai = 0; ai < triggered.length; ai++) {
        OF.ui.toast('⚡ Alert: ' + sym + ' @ ' + U.fmtPrice(triggered[ai].price, app.meta().dec));
        if (app.settings.alertSound) U.beep(880, 0.25);
        OF.ui.renderAlerts(sym);
      }
    }
    setLast(t.price);
    var closed = app.paper.onPrice(sym, t.price); // SL/TP/liquidation on every tick
    if (closed) onClosed(closed);
    if (t.price * t.qty >= app.settings.whaleUsd) OF.ui.addWhale(t, app.meta().dec);
    if (st.buffering) { st.buffer.push(t); return; }
    var r = app.engine.applyTrade(t);
    if (r.newBar) {
      app.renderer.onNewBar();
      // Delta divergence: check the just-completed bar.
      var bars = app.engine.bars;
      var prevBar = bars.length >= 2 ? bars[bars.length - 2] : null;
      if (prevBar && prevBar.deltaKnown && prevBar.v > 0 && Math.abs(prevBar.delta) / prevBar.v > 0.20) {
        var bullCandle = prevBar.c >= prevBar.o;
        if (bullCandle && prevBar.delta < 0) OF.ui.toast('↘ Bearish Δ divergence — ' + sym);
        else if (!bullCandle && prevBar.delta > 0) OF.ui.toast('↗ Bullish Δ divergence — ' + sym);
      }
    }
    app.renderer.markDirty();
    OF.ui.renderPaper();
  }

  function setLast(price) {
    if (!price) return;
    var prev = st.lastPrice;
    st.lastPrice = price;
    st.prices[st.symbol] = price;
    OF.ui.setPrice(price, app.meta().dec, prev == null ? null : price >= prev);
  }

  // ---- Symbol / timeframe / view -------------------------------------------------------------
  app.setSymbol = function (sym) {
    if (sym === st.symbol) return;
    st.symbol = app.settings.symbol = sym;
    st.lastPrice = st.prices[sym] || null;
    saveSettings();
    app.market.stop();
    st.loadToken++;
    st.lastTradeTs = 0;
    seedDemo();
    loadDrawLines();
    OF.ui.resetWhales();
    OF.ui.renderPaper(true);
    app.loadMarket();
  };

  app.setTf = function (tf) {
    if (tf === st.tf) return;
    st.tf = app.settings.tf = tf;
    saveSettings();
    app.market.stop();
    st.loadToken++;
    st.lastTradeTs = 0;
    seedDemo();
    app.loadMarket();
  };

  app.setMult = function (m) { app.settings.mult = m; saveSettings(); applySettings(); };
  app.setMode = function (m) { app.settings.mode = m; saveSettings(); applySettings(); };

  app.setAppTheme = function (theme) {
    app.settings.appTheme = theme;
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
    app.renderer.setAppTheme(theme);
    saveSettings();
  };

  app.updateSettings = function (patch) {
    Object.assign(app.settings, patch);
    saveSettings();
    applySettings();
  };

  app.resetSettings = function () {
    var keep = { symbol: st.symbol, tf: st.tf };
    app.settings = Object.assign({}, C.DEFAULT_SETTINGS, keep);
    saveSettings();
    applySettings();
  };

  // ---- Paper trading -------------------------------------------------------------------------
  function updateLines() {
    var p = app.paper.position(st.symbol), lines = [];
    if (p) {
      lines.push({ id: 'entry', price: p.entry, color: '#e2e8f0', label: 'ENTRY', dash: [6, 3] });
      lines.push({ id: 'liq', price: p.liq, color: '#f97316', label: 'LIQ', dash: [2, 3] });
      if (p.sl != null) lines.push({ id: 'sl', price: p.sl, color: '#ef4444', label: 'SL', draggable: true });
      if (p.tp != null) lines.push({ id: 'tp', price: p.tp, color: '#22c55e', label: 'TP', draggable: true });
    }
    app.renderer.setLines(lines);
  }

  function onClosed(trade) {
    var msg = 'Closed ' + trade.sym + ' ' + trade.side + ' (' + trade.reason + '): ' + U.fmtUsd(trade.pnl) + ' — simulated';
    OF.ui.toast(msg);
    app.monet.onTradeClosed();
  }

  app.openTrade = function (side, margin, lev) {
    if (app.engine.isSeed || st.buffering && !st.lastPrice) { OF.ui.toast('Wait for live market data'); return; }
    var r = app.paper.open(st.symbol, side, margin, lev, st.lastPrice, app.meta().tick);
    OF.ui.toast(r.ok ? 'Opened simulated ' + side.toUpperCase() + ' ' + st.symbol + ' @ ' + U.fmtPrice(r.pos.entry, app.meta().dec) : r.msg);
  };

  app.closeTrade = function () {
    var t = app.paper.close(st.symbol, st.lastPrice, 'manual');
    if (!t) OF.ui.toast('No open position');
  };

  app.setSLTP = function (sl, tp) {
    var r = app.paper.setSLTP(st.symbol, sl, tp);
    OF.ui.toast(r.ok ? 'SL/TP updated' : r.msg);
    updateLines();
    OF.ui.renderPaper(true);
  };

  app.placeDefaultLines = function () {
    var p = app.paper.position(st.symbol);
    if (!p) return;
    var d = app.paper.defaultLines(p);
    app.setSLTP(p.sl != null ? p.sl : d.sl, p.tp != null ? p.tp : d.tp);
  };

  app.watchRewarded = async function () {
    var r = await app.monet.showRewarded(function (amount) {
      app.paper.addMargin(amount);
      OF.ui.toast('+' + U.fmtUsd(amount, 0) + ' virtual margin added (simulated)');
    });
    if (!r.ok && r.msg) OF.ui.toast(r.msg);
    OF.ui.renderPaper(true);
  };

  app.exportCSV = function () { OF.ui.showCSV(app.paper.exportCSV()); };

  app.startStudy = function () {
    if (!app.study) return;
    app.study.start(st.symbol);
    OF.ui.showStudyOverlay(true);
  };

  app.stopStudy = function () {
    if (!app.study) return;
    app.study.stop();
    OF.ui.showStudyOverlay(false);
    app.loadMarket({ preserveBefore: st.lastTradeTs });
  };

  app.resetAccount = async function () {
    var yes = await OF.ui.confirm('Reset the simulated account to $100,000? All paper positions and history will be deleted.');
    if (!yes) return;
    app.paper.reset();
    OF.ui.toast('Paper account reset');
  };

  // ---- Bootstrap -----------------------------------------------------------------------------
  function init() {
    var t0 = performance.now();
    app.settings = loadSettings();
    st.symbol = app.settings.symbol;
    st.tf = app.settings.tf;
    st.liveMeta = S.get('symbolMeta', {});

    app.monet = new OF.MonetizationManager();
    app.paper = new OF.PaperEngine();
    app.engine = new OF.FootprintEngine();
    app.renderer = new OF.Renderer($('chart'));
    app.renderer.setEngine(app.engine);
    app.alerts = new OF.AlertManager();
    app.study = new OF.StudyEngine(app.engine, app.paper);
    app.study.onChange = function (idx, total, price, timeMs) {
      app.renderer.markDirty();
      OF.ui.onStudyChange(idx, total, price, timeMs);
    };
    applySettings();
    var initTheme = app.settings.appTheme || 'dark';
    document.documentElement.dataset.theme = initTheme === 'light' ? 'light' : '';
    app.renderer.setAppTheme(initTheme);
    seedDemo();
    loadDrawLines();
    app.renderer.onScrollLeft = function () { app.fetchMoreBars(); };
    app.renderer.onUserLineAdded = function (lines) { app.drawLines = lines.slice(); saveDrawLines(); };
    app.renderer.draw(); // first frame synchronously: demo bars visible immediately
    st.firstPaintMs = performance.now() - t0;

    app.paper.on(function (ev) {
      updateLines();
      OF.ui.renderPaper(true);
      if (ev.type === 'close') app.renderer.markDirty();
    });

    app.renderer.onLineDrag = function () { /* line follows the finger; validated on release */ };
    app.renderer.onLineDragEnd = function (id, price) {
      var p = app.paper.position(st.symbol);
      if (!p) return;
      var sl = id === 'sl' ? price : p.sl, tp = id === 'tp' ? price : p.tp;
      var r = app.paper.setSLTP(st.symbol, sl, tp);
      if (!r.ok) OF.ui.toast(r.msg);
      updateLines();
      OF.ui.renderPaper(true);
    };

    OF.ui.init(app);
    app.monet.onChange(function () { applySettings(); OF.ui.refreshPro(); });
    app.monet.init();

    app.market = new OF.Market({
      onSourceChange: function () { app.loadMarket({ preserveBefore: st.lastTradeTs }); }
    });
    app.loadMarket();

    app.market.fetchSymbolMeta().then(function (meta) {
      if (!meta || !Object.keys(meta).length) return;
      st.liveMeta = meta;
      S.set('symbolMeta', meta);
      var m = app.meta();
      if (m.tick !== app.engine.tick || m.lot !== app.engine.lot) {
        app.engine.tick = m.tick;
        app.engine.lot = m.lot;
        app.renderer.markDirty();
      }
      OF.ui.buildBinSelect();
    }).catch(function () { /* config fallbacks stay in place */ });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        saveBarsToCache();
        st.hiddenAt = Date.now();
        st.loadToken++;
        clearTimeout(st.retryTimer);
        app.market.stop();
        OF.ui.setStatus('offline', 'Paused');
      } else {
        app.loadMarket({ preserveBefore: st.hiddenAt });
      }
    });
    updateLines();

    app.market.fetchAllPrices().then(function (prices) {
      Object.assign(st.prices, prices);
      OF.ui.updateWatchStrip();
    }).catch(function () { /* best-effort */ });
  }

  // ---- Global error guards -------------------------------------------------------------------
  window.addEventListener('unhandledrejection', function (ev) {
    console.error('[app] unhandled promise rejection:', ev.reason);
    // Prevent white-screen crash — surface as a toast if UI is ready.
    try {
      var msg = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason);
      if (OF.ui && OF.ui.toast) OF.ui.toast('Error: ' + msg.slice(0, 80));
    } catch (e) { /* ignore */ }
    ev.preventDefault();
  });

  window.onerror = function (msg, src, line) {
    console.error('[app] uncaught error:', msg, src, line);
    return false; // let the default handler also log it
  };

  init();
})();
