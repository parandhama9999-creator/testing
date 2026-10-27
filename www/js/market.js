/* OrderFlow Crypto Pro — market.js
 * REST backfill + WebSocket feeds for Binance USDⓈ-M Futures with automatic Bybit v5 fallback.
 * Both feeds are normalised to:
 *   trade: { id, ts, price, qty, aggressor: 'buy' | 'sell' }
 *   depth: { bids: [[price, qty]], asks: [[price, qty]] }
 */
(function () {
  'use strict';
  var OF = window.OF, C = OF.config, U = OF.util;

  // ---- HTTP ----------------------------------------------------------------------------------
  function httpError(status) {
    var e = new Error('HTTP ' + status);
    e.status = status;
    return e;
  }

  async function nativeGet(url, timeoutMs) {
    var CH = U.plugin('CapacitorHttp');
    if (!CH) return null;
    var r = await CH.get({ url: url, responseType: 'json', connectTimeout: timeoutMs, readTimeout: timeoutMs });
    if (r.status < 200 || r.status >= 300) throw httpError(r.status);
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }

  async function getJSON(url, timeoutMs) {
    var t = timeoutMs || 10000;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, t) : 0;
    try {
      var res = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) throw httpError(res.status);
      return await res.json();
    } catch (err) {
      if (err && err.status) throw err;
      // CORS / network failure. Inside the Capacitor app, retry through the native HTTP stack.
      if (U.isNative()) {
        var data = await nativeGet(url, t);
        if (data !== null) return data;
      }
      var e2 = new Error('Network/CORS error: ' + (err && err.message ? err.message : 'request failed'));
      e2.network = true;
      throw e2;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function num(pair) { return [+pair[0], +pair[1]]; }

  // ---- Normalisers (exposed for tests) -------------------------------------------------------
  // Binance aggTrade: m === true -> buyer is maker -> SELL aggressor (hits the bid).
  function normBinanceAgg(d) {
    return { id: d.a, ts: d.T, price: +d.p, qty: +d.q, aggressor: d.m ? 'sell' : 'buy' };
  }
  // Bybit publicTrade: S === 'Buy' -> BUY aggressor (lifts the ask).
  function normBybitTrade(t) {
    return { id: t.i, ts: +t.T, price: +t.p, qty: +t.v, aggressor: t.S === 'Buy' ? 'buy' : 'sell' };
  }
  function normBybitRest(t) {
    return { id: t.execId, ts: +t.time, price: +t.price, qty: +t.size, aggressor: t.side === 'Buy' ? 'buy' : 'sell' };
  }

  // ---- Market --------------------------------------------------------------------------------
  function Market(opts) {
    var saved = 'bybit';
    try { saved = OF.storage.get('marketSource', 'bybit'); } catch (e) {}
    this.source = saved;
    this.onSourceChange = (opts && opts.onSourceChange) || function () {};
    this.connId = 0;
    this.ws = null;
    this.sym = null;
    this.h = null;
    this.attempt = 0;
    this.wsFailures = 0;
    this.gotMsg = false;
    this.lastMsg = 0;
    this.everLive = false;
    this.timers = { reconnect: 0, heartbeat: 0, ping: 0 };
    this.book = null;
  }
  var P = Market.prototype;

  P.label = function () { return this.source === 'binance' ? 'Binance' : 'Bybit'; };

  P.switchSource = function (src, reason) {
    if (this.source === src) return;
    console.warn('[market] switching data source to', src, '-', reason);
    this.source = src;
    try { OF.storage.set('marketSource', src); } catch (e) {}
    this.onSourceChange(src, reason);
  };

  P._shouldFallback = function (err) {
    if (this.source !== 'binance' || !err) return false;
    if (err.network === true) return true;
    var s = err.status;
    return s === 403 || s === 451 || s === 503 || s === 521 || s === 522 || s === 523 || s === 524;
  };

  // Run fn(source); on a geo-block style failure from Binance, switch to Bybit and retry once.
  P._withFallback = async function (fn) {
    var src = this.source;
    try {
      return await fn(src);
    } catch (err) {
      if (src === 'binance' && this._shouldFallback(err)) {
        console.warn('[market] Binance REST unavailable (' + (err && err.message) + '), switching to Bybit');
        this.switchSource('bybit', 'Binance REST blocked');
        return await fn('bybit');
      }
      throw err;
    }
  };

  // ---- REST ----------------------------------------------------------------------------------
  P.fetchSymbolMeta = async function () {
    var out = {};
    try {
      var info = await getJSON(C.ENDPOINTS.binance.rest + '/fapi/v1/exchangeInfo', 15000);
      (info.symbols || []).forEach(function (s) {
        if (C.SYMBOLS.indexOf(s.symbol) < 0) return;
        var m = {};
        (s.filters || []).forEach(function (f) {
          if (f.filterType === 'PRICE_FILTER') m.tick = +f.tickSize;
          if (f.filterType === 'LOT_SIZE') m.lot = +f.stepSize;
        });
        if (m.tick > 0 && m.lot > 0) out[s.symbol] = m;
      });
      return out;
    } catch (e) {
      console.warn('[market] exchangeInfo failed, trying Bybit instruments:', e.message);
    }
    await Promise.all(C.SYMBOLS.map(async function (sym) {
      try {
        var r = await getJSON(C.ENDPOINTS.bybit.rest + '/v5/market/instruments-info?category=linear&symbol=' + sym, 10000);
        var it = r && r.result && r.result.list && r.result.list[0];
        if (it) {
          var tick = +it.priceFilter.tickSize, lot = +it.lotSizeFilter.qtyStep;
          if (tick > 0 && lot > 0) out[sym] = { tick: tick, lot: lot };
        }
      } catch (e) { /* keep config fallback */ }
    }));
    return out;
  };

  // Fetch current mark-price for all configured symbols at once (best-effort, no fallback).
  P.fetchAllPrices = async function () {
    var out = {};
    try {
      var syms = JSON.stringify(C.SYMBOLS);
      var arr = await getJSON(C.ENDPOINTS.binance.rest + '/fapi/v1/ticker/price?symbols=' + encodeURIComponent(syms), 8000);
      if (Array.isArray(arr)) arr.forEach(function (t) { if (t.symbol && t.price) out[t.symbol] = +t.price; });
    } catch (e) { /* best-effort — config fallbacks stay in place */ }
    return out;
  };

  // Returns ascending [{t,o,h,l,c,v,takerBuy|null}]
  // endTime is exclusive — pass oldest bar's t to page backwards.
  P.fetchKlines = function (sym, tf, limit, endTime) {
    return this._withFallback(async function (src) {
      if (src === 'binance') {
        var url = C.ENDPOINTS.binance.rest + '/fapi/v1/klines?symbol=' + sym + '&interval=' + tf + '&limit=' + limit;
        if (endTime) url += '&endTime=' + (endTime - 1);
        var arr = await getJSON(url);
        if (!Array.isArray(arr)) throw new Error('Bad klines payload');
        return arr.map(function (k) {
          return { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], takerBuy: +k[9] };
        });
      }
      var bu = C.ENDPOINTS.bybit.rest + '/v5/market/kline?category=linear&symbol=' + sym +
        '&interval=' + C.BYBIT_INTERVAL[tf] + '&limit=' + limit;
      if (endTime) bu += '&end=' + (endTime - 1);
      var r = await getJSON(bu);
      if (!r || r.retCode !== 0 || !r.result) { var e = new Error('Bybit kline error ' + (r && r.retMsg)); e.status = 502; throw e; }
      return r.result.list.map(function (k) {
        return { t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], takerBuy: null };
      }).sort(function (a, b) { return a.t - b.t; });
    });
  };

  // Trades from startTs to now, ascending. Binance: walks aggTrades BACKWARDS from the newest
  // (fromId pagination, limit=1000, capped) so the result always joins up with the live stream.
  P.fetchFootprintTrades = function (sym, startTs) {
    var self = this;
    // Always try Binance REST first for backfill — it supports pagination and covers 50+ bars.
    // Binance REST works in all regions; only its WebSocket is geo-blocked in some areas.
    return _fetchBinanceFootprint(sym, startTs).catch(function () {
      return self._withFallback(async function (src) {
        if (src === 'binance') throw new Error('binance already failed');
        var out = [];
        var r = await getJSON(C.ENDPOINTS.bybit.rest + '/v5/market/recent-trade?category=linear&symbol=' + sym + '&limit=1000');
        if (!r || r.retCode !== 0 || !r.result) throw new Error('Bybit recent-trade error');
        out = r.result.list.map(normBybitRest).filter(function (t) { return t.ts >= startTs; });
        out.sort(function (a, b) { return a.ts - b.ts; });
        out.capped = true;
        return out;
      });
    });
  };

  function _fetchBinanceFootprint(sym, startTs) {
    return (async function () {
      var out = [];
      var base = C.ENDPOINTS.binance.rest + '/fapi/v1/aggTrades?symbol=' + sym + '&limit=1000';
      var fromId = null;
      for (var req = 0; req < C.AGG_MAX_REQUESTS; req++) {
        var arr = await getJSON(fromId == null ? base : base + '&fromId=' + fromId);
        if (!Array.isArray(arr) || !arr.length) break;
        for (var i = 0; i < arr.length; i++) out.push(normBinanceAgg(arr[i]));
        var minId = arr[0].a, minTs = arr[0].T;
        if (minTs <= startTs || minId <= 0) break;
        fromId = Math.max(0, minId - 1000);
      }
      if (!out.length) throw new Error('Binance returned no trades');
      var seen = new Set();
      out = out.filter(function (t) {
        if (t.ts < startTs || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      out.sort(function (a, b) { return a.id - b.id; });
      out.capped = out.length > 0 && out[0].ts > startTs + 1000;
      return out;
    })();
  }

  // ---- WebSocket -----------------------------------------------------------------------------
  // handlers: { onTrade(t), onDepth(book), onStatus(state, text), onReconnect() }
  P.connect = function (sym, handlers) {
    this.stop();
    this.sym = sym;
    this.h = handlers;
    this.attempt = 0;
    this.wsFailures = 0;
    this.everLive = false;
    this._open();
  };

  P.stop = function () {
    this.connId++; // any late message from an older socket is now ignored
    this._closeSocket();
    clearTimeout(this.timers.reconnect);
    this.timers.reconnect = 0;
  };

  P._status = function (state, text) {
    if (this.h && this.h.onStatus) this.h.onStatus(state, text);
  };

  P._closeSocket = function () {
    clearInterval(this.timers.heartbeat);
    clearInterval(this.timers.ping);
    this.timers.heartbeat = this.timers.ping = 0;
    var ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (e) { /* ignore */ }
    }
  };

  P._open = function () {
    var self = this, id = ++this.connId, src = this.source, sym = this.sym;
    this._closeSocket();
    this.gotMsg = false;
    this.lastMsg = Date.now();
    this.book = { bids: new Map(), asks: new Map() };
    var url = src === 'binance'
      ? C.ENDPOINTS.binance.ws + '?streams=' + sym.toLowerCase() + '@aggTrade/' + sym.toLowerCase() + '@depth20@100ms'
      : C.ENDPOINTS.bybit.ws;
    this._status(this.attempt ? 'reconnecting' : 'connecting', this.attempt ? 'Reconnecting…' : 'Connecting to ' + this.label() + '…');
    var ws;
    try { ws = new WebSocket(url); } catch (e) { this._fail(id); return; }
    this.ws = ws;

    ws.onopen = function () {
      if (id !== self.connId) return;
      self.lastMsg = Date.now();
      if (src === 'bybit') {
        ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.' + sym, 'orderbook.50.' + sym] }));
        self.timers.ping = setInterval(function () {
          if (id === self.connId && ws.readyState === 1) ws.send(JSON.stringify({ op: 'ping' }));
        }, C.WS.BYBIT_PING_MS);
      }
    };
    ws.onmessage = function (ev) {
      if (id !== self.connId) return; // stale socket guard
      self.lastMsg = Date.now();
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (src === 'binance') self._onBinance(msg); else self._onBybit(msg, id);
    };
    ws.onerror = function () { /* onclose follows and handles the retry */ };
    ws.onclose = function () { if (id === self.connId) self._fail(id); };

    this.timers.heartbeat = setInterval(function () {
      if (id !== self.connId) return;
      if (Date.now() - self.lastMsg > C.WS.HEARTBEAT_MS) {
        console.warn('[market] heartbeat timeout, reconnecting');
        self._fail(id);
      }
    }, 3000);
  };

  P._markLive = function () {
    if (this.gotMsg) return;
    this.gotMsg = true;
    var wasReconnect = this.everLive && this.attempt > 0;
    this.attempt = 0;
    this.wsFailures = 0;
    this.everLive = true;
    this._status('live', this.label() + ' ● live');
    if (wasReconnect && this.h && this.h.onReconnect) this.h.onReconnect();
  };

  P._fail = function (id) {
    if (id !== this.connId) return;
    this.connId++;
    this._closeSocket();
    if (!this.gotMsg) this.wsFailures++;
    if (this.source === 'binance' && this.wsFailures >= C.WS.FAILS_BEFORE_FALLBACK) {
      this._status('reconnecting', 'Switching to Bybit…');
      this.switchSource('bybit', 'Binance WebSocket failed ' + this.wsFailures + '×');
      return;
    }
    var base = Math.min(C.WS.BACKOFF_MAX_MS, C.WS.BACKOFF_MIN_MS * Math.pow(2, this.attempt));
    var delay = Math.round(base * 0.5 + Math.random() * base * 0.5); // jitter
    this.attempt++;
    this._status('reconnecting', 'Reconnecting… (' + Math.ceil(delay / 1000) + 's)');
    var self = this;
    clearTimeout(this.timers.reconnect);
    this.timers.reconnect = setTimeout(function () { self._open(); }, delay);
  };

  P._onBinance = function (msg) {
    var d = msg && msg.data;
    if (!d) return;
    if (d.e === 'aggTrade') {
      this._markLive();
      if (this.h.onTrade) this.h.onTrade(normBinanceAgg(d));
    } else if (d.e === 'depthUpdate' || (d.b && d.a)) {
      this._markLive();
      if (this.h.onDepth) this.h.onDepth({ bids: (d.b || []).map(num), asks: (d.a || []).map(num) });
    }
  };

  P._onBybit = function (msg, id) {
    if (msg.op) {
      if (msg.op === 'subscribe' && msg.success === false) { console.warn('[market] Bybit subscribe failed', msg.ret_msg); this._fail(id); }
      return;
    }
    var topic = msg.topic || '';
    if (topic.indexOf('publicTrade.') === 0 && Array.isArray(msg.data)) {
      this._markLive();
      for (var i = 0; i < msg.data.length; i++) if (this.h.onTrade) this.h.onTrade(normBybitTrade(msg.data[i]));
    } else if (topic.indexOf('orderbook.') === 0 && msg.data) {
      this._markLive();
      var book = this.book, d = msg.data;
      if (msg.type === 'snapshot' || d.u === 1) { book.bids.clear(); book.asks.clear(); }
      applyLevels(book.bids, d.b);
      applyLevels(book.asks, d.a);
      if (this.h.onDepth) this.h.onDepth(topLevels(book, 20));
    }
  };

  function applyLevels(map, levels) {
    if (!levels) return;
    for (var i = 0; i < levels.length; i++) {
      var p = +levels[i][0], q = +levels[i][1];
      if (q === 0) map.delete(p); else map.set(p, q);
    }
  }
  function topLevels(book, n) {
    var bids = Array.from(book.bids.entries()).sort(function (a, b) { return b[0] - a[0]; }).slice(0, n);
    var asks = Array.from(book.asks.entries()).sort(function (a, b) { return a[0] - b[0]; }).slice(0, n);
    return { bids: bids, asks: asks };
  }

  Market.normBinanceAgg = normBinanceAgg;
  Market.normBybitTrade = normBybitTrade;
  Market.normBybitRest = normBybitRest;
  Market.getJSON = getJSON;
  OF.Market = Market;
})();
