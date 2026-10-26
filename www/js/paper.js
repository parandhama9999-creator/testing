/* OrderFlow Crypto Pro — paper.js
 * Paper-trading engine: $100,000 virtual USDT, one isolated-margin position per symbol,
 * ±1 tick slippage, 0.05% taker fee per side, liquidation, SL/TP, stats and CSV export.
 * SIMULATED ONLY — this module never talks to any exchange trading API.
 */
(function () {
  'use strict';
  var OF = window.OF, C = OF.config, S = OF.storage, U = OF.util;
  var PC = C.PAPER;

  function PaperEngine() {
    this.listeners = [];
    this.load();
  }
  var P = PaperEngine.prototype;

  P._fresh = function () {
    return { balance: PC.START_BALANCE, startBalance: PC.START_BALANCE, positions: {}, history: [], grants: 0, created: Date.now() };
  };

  P.load = function () {
    var d = S.get('paper', null);
    if (!d || typeof d.balance !== 'number' || !isFinite(d.balance) || typeof d.positions !== 'object' || !Array.isArray(d.history)) d = this._fresh();
    this.st = d;
  };

  P.save = function () { S.set('paper', this.st); };
  P.on = function (fn) { this.listeners.push(fn); };
  P._emit = function (ev) { this.listeners.forEach(function (fn) { try { fn(ev); } catch (e) { console.warn('[paper] listener error', e); } }); };

  P.position = function (sym) { return this.st.positions[sym] || null; };
  P.positions = function () { var p = this.st.positions; return Object.keys(p).map(function (k) { return p[k]; }); };

  // Isolated margin liquidation (simplified, maintenance margin rate from config).
  P.liqPrice = function (side, entry, lev) {
    var mmr = PC.MAINT_MARGIN_RATE;
    return side === 'long' ? entry * (1 - 1 / lev + mmr) : entry * (1 + 1 / lev - mmr);
  };

  P.open = function (sym, side, margin, lev, last, tick) {
    if (this.st.positions[sym]) return { ok: false, msg: 'A ' + sym + ' position is already open (one per symbol).' };
    if (!(last > 0)) return { ok: false, msg: 'No live price yet.' };
    margin = +margin;
    lev = Math.round(U.clamp(+lev || 1, 1, PC.MAX_LEVERAGE));
    if (!(margin >= 1)) return { ok: false, msg: 'Margin must be at least 1 USDT.' };
    var fill = side === 'long' ? last + tick : last - tick; // simulated 1-tick slippage
    var notional = margin * lev, qty = notional / fill, fee = notional * PC.TAKER_FEE;
    if (margin + fee > this.st.balance + 1e-9) return { ok: false, msg: 'Insufficient virtual balance (need ' + U.fmtUsd(margin + fee) + ').' };
    this.st.balance -= margin + fee;
    var pos = {
      sym: sym, side: side, entry: fill, qty: qty, margin: margin, lev: lev, notional: notional,
      liq: this.liqPrice(side, fill, lev), sl: null, tp: null, openTs: Date.now(), openFee: fee, tick: tick
    };
    this.st.positions[sym] = pos;
    this.save();
    this._emit({ type: 'open', pos: pos });
    return { ok: true, pos: pos };
  };

  P.close = function (sym, price, reason) {
    var p = this.st.positions[sym];
    if (!p) return null;
    var dir = p.side === 'long' ? 1 : -1, exit, gross, exitFee, ret;
    if (reason === 'liquidation') {
      exit = p.liq; exitFee = 0; ret = 0; gross = -p.margin;
    } else {
      exit = p.side === 'long' ? price - p.tick : price + p.tick;
      gross = (exit - p.entry) * p.qty * dir;
      exitFee = exit * p.qty * PC.TAKER_FEE;
      ret = Math.max(0, p.margin + gross - exitFee); // isolated: never lose more than the margin
    }
    this.st.balance += ret;
    var trade = {
      id: Date.now() + '-' + Math.floor(Math.random() * 1e6), sym: sym, side: p.side, lev: p.lev, qty: p.qty,
      entry: p.entry, exit: exit, margin: p.margin, pnl: ret - p.margin - p.openFee, fees: p.openFee + exitFee,
      openTs: p.openTs, closeTs: Date.now(), reason: reason || 'manual'
    };
    this.st.history.push(trade);
    if (this.st.history.length > PC.MAX_HISTORY) this.st.history.splice(0, this.st.history.length - PC.MAX_HISTORY);
    delete this.st.positions[sym];
    this.save();
    this._emit({ type: 'close', trade: trade });
    return trade;
  };

  // Called on EVERY tick of the active symbol.
  P.onPrice = function (sym, price) {
    var p = this.st.positions[sym];
    if (!p || !(price > 0)) return null;
    if (p.side === 'long') {
      if (p.sl != null && price <= p.sl) return this.close(sym, price, 'stop-loss');
      if (price <= p.liq) return this.close(sym, price, 'liquidation');
      if (p.tp != null && price >= p.tp) return this.close(sym, price, 'take-profit');
    } else {
      if (p.sl != null && price >= p.sl) return this.close(sym, price, 'stop-loss');
      if (price >= p.liq) return this.close(sym, price, 'liquidation');
      if (p.tp != null && price <= p.tp) return this.close(sym, price, 'take-profit');
    }
    return null;
  };

  P.validateSLTP = function (p, sl, tp) {
    if (sl != null && !(sl > 0)) return 'Stop-loss must be a positive price.';
    if (tp != null && !(tp > 0)) return 'Take-profit must be a positive price.';
    if (p.side === 'long') {
      if (sl != null && sl >= p.entry) return 'Long: stop-loss must be below entry.';
      if (sl != null && sl <= p.liq) return 'Long: stop-loss must be above the liquidation price.';
      if (tp != null && tp <= p.entry) return 'Long: take-profit must be above entry.';
    } else {
      if (sl != null && sl <= p.entry) return 'Short: stop-loss must be above entry.';
      if (sl != null && sl >= p.liq) return 'Short: stop-loss must be below the liquidation price.';
      if (tp != null && tp >= p.entry) return 'Short: take-profit must be below entry.';
    }
    return null;
  };

  P.setSLTP = function (sym, sl, tp) {
    var p = this.st.positions[sym];
    if (!p) return { ok: false, msg: 'No open ' + sym + ' position.' };
    var err = this.validateSLTP(p, sl, tp);
    if (err) return { ok: false, msg: err };
    p.sl = sl; p.tp = tp;
    this.save();
    this._emit({ type: 'update', pos: p });
    return { ok: true };
  };

  // Default SL 1% / TP 2% from entry, kept inside the liquidation price.
  P.defaultLines = function (p) {
    var dir = p.side === 'long' ? 1 : -1, sl = p.entry * (1 - 0.01 * dir), tp = p.entry * (1 + 0.02 * dir);
    if (dir === 1 && sl <= p.liq) sl = p.liq + (p.entry - p.liq) * 0.5;
    if (dir === -1 && sl >= p.liq) sl = p.liq - (p.liq - p.entry) * 0.5;
    return { sl: U.roundToTick(sl, p.tick), tp: U.roundToTick(tp, p.tick) };
  };

  P.unrealized = function (p, price) {
    if (!(price > 0)) return { pnl: 0, roe: 0 };
    var pnl = (price - p.entry) * p.qty * (p.side === 'long' ? 1 : -1);
    return { pnl: pnl, roe: (pnl / p.margin) * 100 };
  };

  // prices: { SYM: lastPrice } — positions without a known price count at margin value.
  P.equity = function (prices) {
    var eq = this.st.balance, self = this;
    this.positions().forEach(function (p) {
      var px = prices && prices[p.sym];
      eq += p.margin + (px ? Math.max(-p.margin, self.unrealized(p, px).pnl) : 0);
    });
    return eq;
  };

  P.addMargin = function (amount) {
    this.st.balance += amount;
    this.st.grants = (this.st.grants || 0) + amount;
    this.save();
    this._emit({ type: 'grant', amount: amount });
  };

  P.stats = function () {
    var h = this.st.history, grossP = 0, grossL = 0, wins = 0, total = 0;
    var eq = this.st.startBalance, peak = eq, maxDD = 0;
    for (var i = 0; i < h.length; i++) {
      var pnl = h[i].pnl;
      total += pnl;
      if (pnl > 0) { wins++; grossP += pnl; } else grossL += -pnl;
      eq += pnl;
      if (eq > peak) peak = eq;
      if (peak > 0) maxDD = Math.max(maxDD, ((peak - eq) / peak) * 100);
    }
    return {
      trades: h.length,
      winRate: h.length ? (wins / h.length) * 100 : 0,
      profitFactor: grossL > 0 ? grossP / grossL : grossP > 0 ? Infinity : 0,
      totalPnl: total,
      maxDD: maxDD
    };
  };

  P.exportCSV = function () {
    var head = ['closed_at', 'opened_at', 'symbol', 'side', 'leverage', 'qty', 'entry', 'exit', 'margin_usdt', 'fees_usdt', 'pnl_usdt', 'reason'];
    var rows = this.st.history.map(function (t) {
      return [new Date(t.closeTs).toISOString(), new Date(t.openTs).toISOString(), t.sym, t.side, t.lev, t.qty.toFixed(6),
        t.entry, t.exit, t.margin.toFixed(2), t.fees.toFixed(4), t.pnl.toFixed(2), t.reason].join(',');
    });
    return '# Simulated paper trades - no real money\n' + head.join(',') + '\n' + rows.join('\n') + (rows.length ? '\n' : '');
  };

  P.reset = function () {
    this.st = this._fresh();
    this.save();
    this._emit({ type: 'reset' });
  };

  OF.PaperEngine = PaperEngine;
})();
