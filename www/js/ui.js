/* OrderFlow Crypto Pro — ui.js
 * Toolbar, settings modal, paywall, about, paper-trading panel, whale tape, rotation,
 * dialogs (confirm / mock ads / CSV) and toasts. Talks to the app only through OF.app.
 */
(function () {
  'use strict';
  var OF = window.OF, C = OF.config, S = OF.storage, U = OF.util;
  var $ = function (id) { return document.getElementById(id); };
  var UI = (OF.ui = {});
  var app = null;
  var audioCtx = null;
  var whaleCount = 0;
  var lastHistLen = -1;
  var paperTimer = 0;

  UI.init = function (theApp) {
    app = theApp;
    buildSelects();
    bindTopbar();
    buildWatchStrip();
    bindPanel();
    bindTrade();
    bindSettings();
    bindPaywall();
    bindModals();
    bindRotate();
    bindStudy();
    bindAlerts();
    $('aboutVersion').textContent = 'v' + C.VERSION;
    $('privacyLink').href = C.PRIVACY_POLICY_URL;
    $('affiliates').innerHTML = app.monet.affiliateHTML();
    // AudioContext may only be created after a user gesture (autoplay policy).
    document.addEventListener('pointerdown', function () { if (app.settings.whaleSound) ensureAudio(); }, { passive: true });
    window.addEventListener('resize', UI.updateLayout);
    if (window.matchMedia) {
      var mq = window.matchMedia('(orientation: landscape)');
      if (mq.addEventListener) mq.addEventListener('change', UI.updateLayout);
    }
    UI.updateLayout();
    UI.refreshPro();
    UI.renderPaper(true);
  };

  // ---- Toolbar -------------------------------------------------------------------------------
  function opt(value, label) { var o = document.createElement('option'); o.value = value; o.textContent = label; return o; }

  function buildSelects() {
    var s = app.settings;
    C.SYMBOLS.forEach(function (sym) { $('selSymbol').appendChild(opt(sym, sym.replace('USDT', '/USDT'))); });
    Object.keys(C.TIMEFRAMES).forEach(function (tf) { $('selTf').appendChild(opt(tf, tf)); });
    Object.keys(C.CLUSTER_MODES).forEach(function (m) { $('selMode').appendChild(opt(m, C.CLUSTER_MODES[m])); });
    Object.keys(C.PRESETS).forEach(function (k) { $('setPreset').appendChild(opt(k, C.PRESETS[k].name)); });
    $('setPreset').appendChild(opt('custom', 'Custom'));
    C.WHALE_THRESHOLDS.forEach(function (v) { $('setWhale').appendChild(opt(v, '≥ $' + v / 1000 + 'k')); });
    $('selSymbol').value = s.symbol;
    $('selTf').value = s.tf;
    $('selMode').value = s.mode;
    UI.buildBinSelect();
  }

  UI.buildBinSelect = function () {
    var inp = $('inBin'), meta = app.meta(), s = app.settings;
    if (inp) inp.value = U.roundSig(meta.baseBin * (+s.mult || 1), 4);
  };

  function bindTopbar() {
    $('selSymbol').addEventListener('change', function (e) { app.setSymbol(e.target.value); UI.buildBinSelect(); UI.setActiveSymbol(e.target.value); });
    $('selTf').addEventListener('change', function (e) { app.setTf(e.target.value); });
    $('selMode').addEventListener('change', function (e) { app.setMode(e.target.value); });
    $('inBin').addEventListener('change', function (e) {
      var absSize = parseFloat(e.target.value);
      if (!absSize || absSize <= 0) { UI.buildBinSelect(); return; }
      var meta = app.meta();
      var m = Math.max(0.01, absSize / (meta.baseBin || absSize));
      if (m > 5 && !app.monet.isPro) {
        UI.buildBinSelect();
        UI.toast('Large bin sizes are a Pro feature');
        UI.openPaywall();
        return;
      }
      app.setMult(m);
    });
    $('btnDraw').addEventListener('click', function () { app.setDrawMode(!app.state.drawMode); });
    $('btnSettings').addEventListener('click', UI.openSettings);
    $('btnPro').addEventListener('click', UI.openPaywall);
    $('btnAbout').addEventListener('click', function () { open('mAbout'); });
  }

  // ---- Status --------------------------------------------------------------------------------
  UI.setStatus = function (state, text) {
    var el = $('srcStatus');
    el.className = state;
    el.textContent = text;
  };
  UI.setPrice = function (price, dec, up) {
    var el = $('lastPrice');
    el.textContent = price ? U.fmtPrice(price, dec) : '—';
    el.className = up == null ? '' : up ? 'pos-txt' : 'neg-txt';
    var ps = $('wprice-' + (app && app.state ? app.state.symbol : ''));
    if (ps && price) ps.textContent = U.fmtPrice(price, dec);
  };
  UI.showDemo = function (on, text) {
    var el = $('demoBanner');
    el.classList.toggle('hidden', !on);
    if (text) el.textContent = text;
  };

  // ---- Panel tabs ----------------------------------------------------------------------------
  function bindPanel() {
    var tabs = document.querySelectorAll('.tab'), panel = $('panel');
    if (S.get('panelCollapsed', true)) panel.classList.add('collapsed');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var wasActive = t.classList.contains('active');
        if (wasActive) panel.classList.toggle('collapsed');
        else panel.classList.remove('collapsed');
        tabs.forEach(function (x) { x.classList.toggle('active', x === t); $(x.dataset.pane).classList.toggle('hidden', x !== t); });
        S.set('panelCollapsed', panel.classList.contains('collapsed'));
        if (t.dataset.pane === 'paneWhales') renderWhaleInfo();
        if (t.dataset.pane === 'paneAlerts') UI.renderAlerts(app.state.symbol);
        setTimeout(function () { app.renderer.resize(); }, 0);
      });
    });
  }

  // ---- Paper trading panel -------------------------------------------------------------------
  function markOrderEntry(on) {
    clearTimeout(markOrderEntry.t);
    app.monet.orderEntryActive = on;
    if (on) markOrderEntry.t = setTimeout(function () {
      var a = document.activeElement;
      app.monet.orderEntryActive = !!(a && $('paneTrade').contains(a) && a.tagName === 'INPUT');
    }, 4000);
  }

  function bindTrade() {
    var prefs = S.get('tradePrefs', { margin: 1000, lev: 10 });
    $('inMargin').value = prefs.margin;
    $('inLev').value = prefs.lev;
    $('levVal').textContent = prefs.lev + 'x';
    var savePrefs = function () { S.set('tradePrefs', { margin: +$('inMargin').value || 1000, lev: +$('inLev').value || 10 }); };
    $('inLev').addEventListener('input', function () { $('levVal').textContent = $('inLev').value + 'x'; savePrefs(); });
    $('inMargin').addEventListener('change', savePrefs);
    $('paneTrade').addEventListener('focusin', function () { markOrderEntry(true); });
    $('paneTrade').addEventListener('focusout', function () { markOrderEntry(true); });
    $('paneTrade').addEventListener('pointerdown', function () { markOrderEntry(true); });
    $('btnLong').addEventListener('click', function () { app.openTrade('long', +$('inMargin').value, +$('inLev').value); });
    $('btnShort').addEventListener('click', function () { app.openTrade('short', +$('inMargin').value, +$('inLev').value); });
    $('btnClose').addEventListener('click', function () { app.closeTrade(); });
    $('btnSetSLTP').addEventListener('click', function () {
      var sl = $('inSL').value.trim(), tp = $('inTP').value.trim();
      app.setSLTP(sl === '' ? null : +sl, tp === '' ? null : +tp);
    });
    $('btnPlaceLines').addEventListener('click', function () { app.placeDefaultLines(); });
    $('btnRewarded').addEventListener('click', function () { app.watchRewarded(); });
    $('btnCSV').addEventListener('click', function () { app.exportCSV(); });
    $('btnResetAcct').addEventListener('click', function () { app.resetAccount(); });
  }

  // Throttled (~4/s) unless forced.
  UI.renderPaper = function (force) {
    if (!force) {
      if (paperTimer) return;
      paperTimer = setTimeout(function () { paperTimer = 0; UI.renderPaper(true); }, 250);
      return;
    }
    var paper = app.paper, st = app.state, sym = st.symbol, meta = app.meta(), last = st.lastPrice;
    $('pBalance').textContent = U.fmtUsd(paper.st.balance);
    $('pEquity').textContent = U.fmtUsd(paper.equity(st.prices));
    var p = paper.position(sym);
    $('posBox').classList.toggle('hidden', !p);
    $('btnLong').disabled = $('btnShort').disabled = !!p;
    if (p) {
      var u = paper.unrealized(p, last);
      $('posSide').textContent = (p.side === 'long' ? 'LONG ' : 'SHORT ') + p.lev + 'x ' + sym;
      $('posSide').className = p.side === 'long' ? 'pos-txt' : 'neg-txt';
      $('posSize').textContent = U.fmtQty(p.qty) + ' · margin ' + U.fmtUsd(p.margin, 0);
      $('posEntry').textContent = U.fmtPrice(p.entry, meta.dec);
      $('posLiq').textContent = U.fmtPrice(p.liq, meta.dec);
      $('posPnl').textContent = U.fmtUsd(u.pnl);
      $('posPnl').className = u.pnl >= 0 ? 'pos-txt' : 'neg-txt';
      $('posRoe').textContent = u.roe.toFixed(2) + '%';
      $('posRoe').className = u.roe >= 0 ? 'pos-txt' : 'neg-txt';
      if (document.activeElement !== $('inSL')) $('inSL').value = p.sl != null ? U.fmtPrice(p.sl, meta.dec) : '';
      if (document.activeElement !== $('inTP')) $('inTP').value = p.tp != null ? U.fmtPrice(p.tp, meta.dec) : '';
    }
    var others = paper.positions().filter(function (x) { return x.sym !== sym; });
    $('otherPos').textContent = others.length
      ? 'Other open: ' + others.map(function (x) { return x.sym + ' ' + x.side + ' ' + x.lev + 'x'; }).join(', ') + ' (checked when that symbol is active)'
      : '';
    var left = app.monet.rewardedLeft();
    $('btnRewarded').textContent = '🎬 Watch ad → +$50,000 virtual margin (' + left + '/' + C.REWARDED_MAX_PER_DAY + ' left today)';
    $('btnRewarded').disabled = left <= 0;
    var s = paper.stats();
    $('stTrades').textContent = s.trades;
    $('stWin').textContent = s.winRate.toFixed(1) + '%';
    $('stPF').textContent = s.trades ? (isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞') : '–';
    $('stPnl').textContent = U.fmtUsd(s.totalPnl);
    $('stPnl').className = s.totalPnl >= 0 ? 'pos-txt' : 'neg-txt';
    $('stDD').textContent = s.maxDD.toFixed(2) + '%';
    $('stGrants').textContent = U.fmtUsd(paper.st.grants || 0, 0);
    if (paper.st.history.length !== lastHistLen) {
      lastHistLen = paper.st.history.length;
      var h = paper.st.history.slice(-50).reverse();
      $('historyList').innerHTML = h.length ? h.map(function (t) {
        var d = U.symbolMeta(t.sym, app.state.liveMeta).dec;
        return '<div class="hist"><span>' + U.fmtTime(t.closeTs) + '</span><span>' + t.sym + ' ' + t.side + ' ' + t.lev + 'x · ' +
          U.fmtPrice(t.entry, d) + '→' + U.fmtPrice(t.exit, d) + ' <span class="muted">' + t.reason + '</span></span><b class="' +
          (t.pnl >= 0 ? 'pos-txt' : 'neg-txt') + '">' + U.fmtUsd(t.pnl) + '</b></div>';
      }).join('') : '<div class="small muted">No closed trades yet.</div>';
    }
  };

  // ---- Whale tape ----------------------------------------------------------------------------
  function renderWhaleInfo() {
    var pro = app.monet.isPro;
    $('whaleInfo').textContent = 'Trades ≥ ' + U.fmtUsd(app.settings.whaleUsd, 0) + ' notional on ' + app.state.symbol +
      (pro ? ' · unlimited (Pro)' : ' · free: ' + Math.min(whaleCount, C.FREE_WHALE_ALERTS) + '/' + C.FREE_WHALE_ALERTS + ' alerts this session');
  }

  UI.resetWhales = function () { $('whaleList').innerHTML = ''; renderWhaleInfo(); };

  UI.addWhale = function (t, dec) {
    var pro = app.monet.isPro;
    if (!pro && whaleCount >= C.FREE_WHALE_ALERTS) {
      if (whaleCount === C.FREE_WHALE_ALERTS) {
        whaleCount++;
        var up = document.createElement('div');
        up.className = 'small muted';
        up.textContent = 'Free whale-alert limit reached for this session — upgrade to Pro for unlimited alerts.';
        $('whaleList').prepend(up);
      }
      return;
    }
    whaleCount++;
    var row = document.createElement('div'), notional = t.price * t.qty;
    row.className = 'whale';
    row.innerHTML = '<span>' + U.fmtTime(t.ts, true) + '</span><span><span class="' + t.aggressor + '">' + (t.aggressor === 'buy' ? 'BUY' : 'SELL') +
      '</span> ' + U.fmtQty(t.qty) + ' @ ' + U.fmtPrice(t.price, dec) + '</span><b>' + U.fmtUsd(notional, 0) + '</b>';
    var list = $('whaleList');
    list.prepend(row);
    while (list.children.length > C.WHALE_TAPE_MAX) list.removeChild(list.lastChild);
    renderWhaleInfo();
    if (app.settings.whaleSound) UI.ping(t.aggressor === 'buy' ? 1046 : 659);
  };

  function ensureAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  UI.ping = function (freq) {
    if (!audioCtx) return; // only created after a user tap
    var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
    o.type = 'sine';
    o.frequency.value = freq || 880;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.2);
  };

  // ---- Settings ------------------------------------------------------------------------------
  function fillSettings() {
    var s = app.settings;
    $('setPreset').value = s.preset;
    $('setBull').value = s.bull;
    $('setBear').value = s.bear;
    $('setAppTheme').value = s.appTheme || 'dark';
    $('setShading').value = s.shading;
    $('setImb').value = s.imbalance;
    $('setImbVal').textContent = Number(s.imbalance).toFixed(1);
    $('setWhale').value = String(s.whaleUsd);
    $('setSound').checked = !!s.whaleSound;
    $('setVolFilter').value = s.volFilter != null ? s.volFilter : 0;
    $('setStackedImb').value = s.stackedImb != null ? s.stackedImb : 3;
    $('setStackedImbVal').textContent = s.stackedImb != null ? s.stackedImb : 3;
    $('setShowPOC').checked = s.showPOC !== false;
    $('setShowImb').checked = s.showImb !== false;
    $('setShowProfile').checked = s.showProfile !== false;
    $('setShowVA').checked = s.showVA !== false;
    $('setShowCVD').checked = s.showCVD !== false;
    $('setShowMatrix').checked = s.showMatrix !== false;
    $('setShowVWAP').checked = !!s.showVWAP;
    $('setShowSMA').checked = !!s.showSMA;
    $('setSmaPeriod').value = s.smaPeriod != null ? s.smaPeriod : 20;
    $('setShowEMA').checked = !!s.showEMA;
    $('setEmaPeriod').value = s.emaPeriod != null ? s.emaPeriod : 9;
    $('setShowCPR').checked = !!s.showCPR;
    $('setShowVolBars').checked = s.showVolBars !== false;
    $('setShowSessions').checked = s.showSessions !== false;
    $('setAlertSound').checked = !!s.alertSound;
  }
  UI.openSettings = function () { fillSettings(); open('mSettings'); };

  function bindSettings() {
    $('setPreset').addEventListener('change', function (e) {
      var p = C.PRESETS[e.target.value];
      app.updateSettings(p ? { preset: e.target.value, bull: p.bull, bear: p.bear } : { preset: 'custom' });
      fillSettings();
    });
    $('setBull').addEventListener('input', function (e) { app.updateSettings({ bull: e.target.value, preset: 'custom' }); $('setPreset').value = 'custom'; });
    $('setBear').addEventListener('input', function (e) { app.updateSettings({ bear: e.target.value, preset: 'custom' }); $('setPreset').value = 'custom'; });
    $('setAppTheme').addEventListener('change', function (e) { app.setAppTheme(e.target.value); });
    $('setShading').addEventListener('change', function (e) { app.updateSettings({ shading: e.target.value }); });
    $('setImb').addEventListener('input', function (e) {
      $('setImbVal').textContent = Number(e.target.value).toFixed(1);
      app.updateSettings({ imbalance: +e.target.value });
    });
    $('setWhale').addEventListener('change', function (e) { app.updateSettings({ whaleUsd: +e.target.value }); renderWhaleInfo(); });
    $('setSound').addEventListener('change', function (e) {
      if (e.target.checked) { ensureAudio(); UI.ping(880); }
      app.updateSettings({ whaleSound: e.target.checked });
    });
    $('setVolFilter').addEventListener('change', function (e) { app.updateSettings({ volFilter: Math.max(0, +e.target.value || 0) }); });
    $('setStackedImb').addEventListener('input', function (e) {
      $('setStackedImbVal').textContent = e.target.value;
      app.updateSettings({ stackedImb: +e.target.value });
    });
    $('setShowPOC').addEventListener('change', function (e) { app.updateSettings({ showPOC: e.target.checked }); });
    $('setShowImb').addEventListener('change', function (e) { app.updateSettings({ showImb: e.target.checked }); });
    $('setShowProfile').addEventListener('change', function (e) { app.updateSettings({ showProfile: e.target.checked }); setTimeout(function () { app.renderer.resize(); }, 0); });
    $('setShowVA').addEventListener('change', function (e) { app.updateSettings({ showVA: e.target.checked }); });
    $('setShowCVD').addEventListener('change', function (e) { app.updateSettings({ showCVD: e.target.checked }); setTimeout(function () { app.renderer.resize(); }, 0); });
    $('setShowMatrix').addEventListener('change', function (e) { app.updateSettings({ showMatrix: e.target.checked }); setTimeout(function () { app.renderer.resize(); }, 0); });
    $('setShowVWAP').addEventListener('change', function (e) { app.updateSettings({ showVWAP: e.target.checked }); });
    $('setShowSMA').addEventListener('change', function (e) { app.updateSettings({ showSMA: e.target.checked }); });
    $('setSmaPeriod').addEventListener('change', function (e) { app.updateSettings({ smaPeriod: Math.max(2, +e.target.value || 20) }); });
    $('setShowEMA').addEventListener('change', function (e) { app.updateSettings({ showEMA: e.target.checked }); });
    $('setEmaPeriod').addEventListener('change', function (e) { app.updateSettings({ emaPeriod: Math.max(2, +e.target.value || 9) }); });
    $('setShowCPR').addEventListener('change', function (e) { app.updateSettings({ showCPR: e.target.checked }); });
    $('setShowVolBars').addEventListener('change', function (e) { app.updateSettings({ showVolBars: e.target.checked }); setTimeout(function () { app.renderer.resize(); }, 0); });
    $('setShowSessions').addEventListener('change', function (e) { app.updateSettings({ showSessions: e.target.checked }); });
    $('setAlertSound').addEventListener('change', function (e) { app.updateSettings({ alertSound: e.target.checked }); });
    $('btnResetSettings').addEventListener('click', function () {
      app.resetSettings();
      fillSettings();
      $('selMode').value = app.settings.mode;
      UI.buildBinSelect();
      UI.toast('Settings reset to defaults');
    });
  }

  // ---- Paywall -------------------------------------------------------------------------------
  UI.openPaywall = function () { UI.renderPaywall(); open('mPaywall'); };

  UI.renderPaywall = function () {
    var m = app.monet, list = $('productList');
    list.innerHTML = '';
    C.PRODUCTS.forEach(function (p) {
      var row = document.createElement('div'), btn = document.createElement('button');
      row.className = 'product';
      row.innerHTML = '<div><b>' + p.label + '</b><div class="small muted">' +
        (p.type === 'subscription' ? 'Auto-renewing subscription' : 'One-time purchase') + '</div></div>';
      btn.textContent = m.isPro && m.ent.productId === p.id ? 'Owned' : m.priceLabel(p.id);
      btn.disabled = m.isPro || (!m.native && !m.mockAllowed) || (m.native && !m.storeReady);
      btn.addEventListener('click', async function () {
        $('payStatus').textContent = 'Working…';
        var r = await m.buy(p.id);
        $('payStatus').textContent = r.msg || '';
        UI.renderPaywall();
      });
      row.appendChild(btn);
      list.appendChild(row);
    });
    $('btnRevokeMock').classList.toggle('hidden', !(m.ent.source === 'mock' && m.isPro));
    if (m.native && !m.storeReady) $('payStatus').textContent = 'Loading prices from Google Play…';
    else if (!m.native) $('payStatus').textContent = m.mockAllowed ? 'Browser preview: purchases are simulated (debug only).' : 'Purchases are available in the Android app.';
  };

  function bindPaywall() {
    $('btnRestore').addEventListener('click', async function () {
      $('payStatus').textContent = 'Restoring…';
      var r = await app.monet.restore();
      $('payStatus').textContent = r.msg;
      UI.renderPaywall();
    });
    $('btnRevokeMock').addEventListener('click', function () { app.monet.revokeMock(); UI.renderPaywall(); });
  }

  UI.refreshPro = function () {
    var pro = app.monet.isPro;
    document.body.classList.toggle('pro', pro);
    $('btnPro').textContent = pro ? '⭐ Pro ✓' : '⭐ Pro';
    $('btnRewarded').classList.toggle('hidden', false);
    UI.buildBinSelect();
    renderWhaleInfo();
    if ($('mPaywall').classList.contains('open')) UI.renderPaywall();
    setTimeout(function () { app.renderer.resize(); }, 0);
  };

  // ---- Modals / dialogs ----------------------------------------------------------------------
  function open(id) { $(id).classList.add('open'); }
  function close(id) { $(id).classList.remove('open'); }
  UI.open = open;
  UI.close = close;

  function bindModals() {
    document.querySelectorAll('.modal-back').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m && m.id !== 'mMockAd' && m.id !== 'mConfirm') close(m.id); });
      m.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { close(m.id); }); });
    });
    $('btnCopyCSV').addEventListener('click', function () {
      var ta = $('csvText');
      ta.select();
      var done = function () { UI.toast('CSV copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { document.execCommand('copy'); done(); });
      else { document.execCommand('copy'); done(); }
    });
  }

  UI.confirm = function (msg) {
    return new Promise(function (resolve) {
      $('confirmMsg').textContent = msg;
      open('mConfirm');
      var finish = function (v) {
        close('mConfirm');
        $('confirmYes').onclick = $('confirmNo').onclick = null;
        resolve(v);
      };
      $('confirmYes').onclick = function () { finish(true); };
      $('confirmNo').onclick = function () { finish(false); };
    });
  };

  UI.toast = function (msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(UI.toast.t);
    UI.toast.t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };

  UI.mockInterstitial = function () {
    $('mockAdTitle').textContent = 'Ad (mock interstitial)';
    $('mockAdBody').textContent = 'Mock interstitial — real AdMob test ads appear in the Android app.';
    $('mockAdClose').disabled = false;
    $('mockAdClose').onclick = function () { close('mMockAd'); };
    open('mMockAd');
  };

  // Resolves true only if the user watches the full countdown.
  UI.mockRewarded = function (seconds) {
    return new Promise(function (resolve) {
      var left = seconds, done = false;
      $('mockAdTitle').textContent = 'Rewarded ad (mock)';
      var tick = function () {
        $('mockAdBody').textContent = left > 0 ? 'Mock rewarded ad… reward in ' + left + 's' : 'Reward earned! Close to continue.';
      };
      tick();
      var iv = setInterval(function () { left--; tick(); if (left <= 0) { clearInterval(iv); done = true; } }, 1000);
      $('mockAdClose').onclick = function () { clearInterval(iv); close('mMockAd'); resolve(done); };
      open('mMockAd');
    });
  };

  UI.showCSV = function (csv) {
    var name = 'orderflow-paper-trades-' + U.today() + '.csv';
    if (!app.monet.native) {
      try {
        var blob = new Blob([csv], { type: 'text/csv' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        UI.toast('Downloaded ' + name);
        return;
      } catch (e) { /* fall through to the copy dialog */ }
    }
    $('csvText').value = csv;
    open('mCSV');
  };

  // ---- Orientation ---------------------------------------------------------------------------
  var forcedCompact = false;

  UI.updateLayout = function () {
    var landscape = window.innerWidth > window.innerHeight && window.innerHeight <= 600;
    document.body.classList.toggle('compact', forcedCompact || landscape);
    if (app && app.renderer) app.renderer.resize();
  };

  // ---- Watchlist strip -----------------------------------------------------------------------
  function buildWatchStrip() {
    var strip = $('watchStrip');
    strip.innerHTML = '';
    C.SYMBOLS.forEach(function (sym) {
      var chip = document.createElement('button');
      chip.className = 'wchip' + (sym === app.state.symbol ? ' active' : '');
      chip.id = 'wchip-' + sym;
      chip.innerHTML = sym.replace('USDT', '') + '<span class="wprice" id="wprice-' + sym + '">—</span>';
      chip.addEventListener('click', function () {
        $('selSymbol').value = sym;
        $('selSymbol').dispatchEvent(new Event('change'));
        UI.setActiveSymbol(sym);
      });
      strip.appendChild(chip);
    });
  }

  UI.setDrawActive = function (on) {
    var btn = $('btnDraw');
    if (btn) btn.classList.toggle('active-tool', !!on);
  };

  UI.setActiveSymbol = function (sym) {
    document.querySelectorAll('.wchip').forEach(function (c) {
      c.classList.toggle('active', c.id === 'wchip-' + sym);
    });
  };

  UI.updateWatchStrip = function () {
    C.SYMBOLS.forEach(function (sym) {
      var ps = $('wprice-' + sym);
      if (!ps) return;
      var meta = U.symbolMeta(sym, app.state.liveMeta);
      if (app.state.prices[sym]) ps.textContent = U.fmtPrice(app.state.prices[sym], meta.dec);
    });
  };

  // ---- Study / replay controls ---------------------------------------------------------------
  function bindStudy() {
    $('btnStudy').addEventListener('click', function () { app.startStudy(); });
    $('studyBack5').addEventListener('click', function () { if (app.study) app.study.step(-5); });
    $('studyBack1').addEventListener('click', function () { if (app.study) app.study.step(-1); });
    $('studyPlayPause').addEventListener('click', function () {
      if (!app.study) return;
      if (app.study.playing) app.study.pause(); else app.study.play();
      $('studyPlayPause').textContent = app.study.playing ? '⏸' : '▶';
    });
    $('studyFwd1').addEventListener('click', function () { if (app.study) app.study.step(1); });
    $('studyFwd5').addEventListener('click', function () { if (app.study) app.study.step(5); });
    $('studyStop').addEventListener('click', function () { app.stopStudy(); });
    $('studySlider').addEventListener('input', function (e) {
      if (app.study) app.study.seek(+e.target.value / 1000);
    });
  }

  UI.onStudyChange = function (idx, total, price, timeMs) {
    if (idx < 0) { $('studyInfo').textContent = '—'; $('studyPlayPause').textContent = '▶'; return; }
    $('studySlider').value = total > 1 ? Math.round(idx / (total - 1) * 1000) : 1000;
    var pStr = price != null ? U.fmtPrice(price, app.meta().dec) : '—';
    var tStr = timeMs ? U.fmtTime(timeMs) : '—';
    $('studyInfo').textContent = tStr + '  ' + pStr + '  ' + (idx + 1) + '/' + total;
    $('studyPlayPause').textContent = app.study && app.study.playing ? '⏸' : '▶';
  };

  UI.showStudyOverlay = function (on) {
    $('studyOverlay').classList.toggle('hidden', !on);
    setTimeout(function () { app.renderer.resize(); }, 0);
  };

  // ---- Alerts pane ---------------------------------------------------------------------------
  function bindAlerts() {
    $('btnAddAlert').addEventListener('click', function () {
      var price = parseFloat($('alertPrice').value);
      if (!price || isNaN(price)) { UI.toast('Enter a valid price'); return; }
      var r = app.alerts.add(app.state.symbol, price);
      if (r.ok) {
        $('alertPrice').value = '';
        UI.renderAlerts(app.state.symbol);
        UI.toast('Alert set @ ' + U.fmtPrice(price, app.meta().dec));
      } else {
        UI.toast(r.msg);
      }
    });
  }

  UI.renderAlerts = function (sym) {
    var el = $('alertList'), sl = $('alertSymLabel');
    if (sl) sl.textContent = 'Alerts for ' + (sym || '—');
    if (!el || !app || !app.alerts) return;
    var list = app.alerts.list(sym);
    if (!list.length) { el.innerHTML = '<div class="small muted">No alerts for ' + (sym || '—') + '.</div>'; return; }
    var meta = app.meta();
    el.innerHTML = list.map(function (a) {
      var eid = a.id.replace(/'/g, '');
      return '<div class="alert-row">' +
        '<span class="a-price">' + U.fmtPrice(a.price, meta.dec) + '</span>' +
        (a.triggered ? '<span class="a-trig">✓ triggered</span>' : '<span></span>') +
        '<button onclick="OF.app.alerts.remove(\'' + sym.replace(/'/g, '') + '\',\'' + eid + '\');OF.ui.renderAlerts(\'' + sym.replace(/'/g, '') + '\')">✕</button>' +
        '</div>';
    }).join('');
  };

  function bindRotate() {
    var btn = $('btnRotate'), lp = 0, longFired = false;
    btn.addEventListener('pointerdown', function () {
      longFired = false;
      lp = setTimeout(function () { longFired = true; UI.unlockOrientation(); }, 650);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, function () { clearTimeout(lp); }); });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () { if (longFired) { longFired = false; return; } UI.toggleOrientation(); });
  }

  UI.toggleOrientation = async function () {
    var target = window.innerWidth > window.innerHeight ? 'portrait' : 'landscape';
    var SO = U.plugin('ScreenOrientation');
    if (U.isNative() && SO) {
      try {
        await SO.lock({ orientation: target });
        UI.toast('Locked ' + target + ' — long-press 🔄 to unlock');
        return;
      } catch (e) { console.warn('[rotate] native lock failed', e); }
    }
    if (forcedCompact) { UI.unlockOrientation(); return; }
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      if (!screen.orientation || !screen.orientation.lock) throw new Error('Orientation lock unsupported');
      await screen.orientation.lock(target);
      UI.toast('Locked ' + target + ' — long-press 🔄 to unlock');
    } catch (e) {
      forcedCompact = true;
      UI.toast('Orientation lock unavailable — compact landscape layout applied (tap 🔄 again to undo)');
    }
    UI.updateLayout();
  };

  UI.unlockOrientation = async function () {
    var SO = U.plugin('ScreenOrientation');
    if (U.isNative() && SO) { try { await SO.unlock(); } catch (e) { /* ignore */ } }
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
    if (document.fullscreenElement && document.exitFullscreen) { try { await document.exitFullscreen(); } catch (e) { /* ignore */ } }
    forcedCompact = false;
    UI.updateLayout();
    UI.toast('Orientation unlocked');
  };
})();
