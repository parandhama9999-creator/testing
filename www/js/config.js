/* OrderFlow Crypto Pro — config.js
 * Constants, symbols, default bins, endpoints, ad unit IDs, feature flags and small shared helpers.
 * Loaded first; everything hangs off the global namespace window.OF.
 */
(function () {
  'use strict';
  var OF = (window.OF = window.OF || {});

  OF.config = {
    APP_NAME: 'OrderFlow Crypto Pro',
    VERSION: '1.0.0',

    // ---- Feature flags -------------------------------------------------------------------
    // RELEASE CHECKLIST — set to false before shipping any release build.
    // Simulated purchases are honoured ONLY outside the native app (browser / preview);
    // a native build always requires a real Google Play Billing purchase, whatever this says.
    DEBUG_MOCK_BILLING: true,
    // Affiliate cards (Binance/Bybit). ENABLE_AFFILIATES must stay false unless you have:
    //   (a) reviewed Google Play's Financial Services policy for your target countries, AND
    //   (b) confirmed neither exchange is restricted/unlicensed there (e.g. US, UK, Ontario CA).
    //   Geo-gate the cards or geo-restrict the app listing before enabling.
    ENABLE_AFFILIATES: false,
    // RELEASE CHECKLIST — replace with your hosted privacy-policy URL before submitting to Play.
    // Play Console will reject the app if this is still example.com.
    PRIVACY_POLICY_URL: 'https://example.com/orderflow-crypto-pro/privacy',

    // ---- Market --------------------------------------------------------------------------
    SYMBOLS: [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
      'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'MATICUSDT',
      'NEARUSDT', 'ATOMUSDT', 'UNIUSDT', 'AAVEUSDT', 'OPUSDT', 'ARBUSDT',
      'SUIUSDT', 'PEPEUSDT', 'FILUSDT', 'INJUSDT', 'SEIUSDT', 'MKRUSDT',
      'RENDERUSDT', 'FETUSDT', 'TIAUSDT', 'WIFUSDT', 'JUPUSDT', 'LDOUSDT'
    ],
    // tick/lot are fallbacks; live values are loaded from exchangeInfo / instruments-info.
    // baseBin is the 1x footprint row size; seed is only used for the clearly-labelled demo bars.
    SYMBOL_META: {
      BTCUSDT:    { tick: 0.1,       lot: 0.001,  baseBin: 10,       seed: 65000   },
      ETHUSDT:    { tick: 0.01,      lot: 0.001,  baseBin: 1,        seed: 3200    },
      SOLUSDT:    { tick: 0.01,      lot: 1,      baseBin: 0.05,     seed: 150     },
      BNBUSDT:    { tick: 0.01,      lot: 0.01,   baseBin: 0.1,      seed: 600     },
      XRPUSDT:    { tick: 0.0001,    lot: 0.1,    baseBin: 0.0005,   seed: 0.6     },
      DOGEUSDT:   { tick: 0.00001,   lot: 1,      baseBin: 0.00005,  seed: 0.15    },
      ADAUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.0005,   seed: 0.55    },
      AVAXUSDT:   { tick: 0.01,      lot: 0.1,    baseBin: 0.1,      seed: 38      },
      DOTUSDT:    { tick: 0.001,     lot: 0.1,    baseBin: 0.01,     seed: 8       },
      LINKUSDT:   { tick: 0.001,     lot: 0.1,    baseBin: 0.05,     seed: 15      },
      LTCUSDT:    { tick: 0.01,      lot: 0.01,   baseBin: 0.1,      seed: 85      },
      MATICUSDT:  { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 0.85    },
      NEARUSDT:   { tick: 0.001,     lot: 0.1,    baseBin: 0.01,     seed: 5       },
      ATOMUSDT:   { tick: 0.001,     lot: 0.1,    baseBin: 0.01,     seed: 8       },
      UNIUSDT:    { tick: 0.001,     lot: 0.1,    baseBin: 0.05,     seed: 8       },
      AAVEUSDT:   { tick: 0.01,      lot: 0.01,   baseBin: 0.5,      seed: 110     },
      OPUSDT:     { tick: 0.0001,    lot: 0.1,    baseBin: 0.005,    seed: 1.8     },
      ARBUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 0.85    },
      SUIUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 3       },
      PEPEUSDT:   { tick: 0.0000001, lot: 1000,   baseBin: 0.0000005, seed: 0.000015 },
      FILUSDT:    { tick: 0.001,     lot: 0.1,    baseBin: 0.01,     seed: 5       },
      INJUSDT:    { tick: 0.001,     lot: 0.1,    baseBin: 0.1,      seed: 25      },
      SEIUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 0.45    },
      MKRUSDT:    { tick: 0.01,      lot: 0.001,  baseBin: 0.5,      seed: 1800    },
      RENDERUSDT: { tick: 0.001,     lot: 0.1,    baseBin: 0.05,     seed: 5       },
      FETUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 1.5     },
      TIAUSDT:    { tick: 0.0001,    lot: 0.1,    baseBin: 0.005,    seed: 7       },
      WIFUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 2.5     },
      JUPUSDT:    { tick: 0.0001,    lot: 1,      baseBin: 0.001,    seed: 1.2     },
      LDOUSDT:    { tick: 0.001,     lot: 1,      baseBin: 0.01,     seed: 1.8     }
    },
    TIMEFRAMES: { '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000, '4h': 14400000 },
    BYBIT_INTERVAL: { '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240' },
    BIN_MULTIPLIERS: [1, 2, 5, 10, 25],
    PRO_MULTIPLIERS: [10, 25],
    CLUSTER_MODES: { bidask: 'Bid × Ask', delta: 'Delta', 'delta%': 'Delta %', volume: 'Volume', bid: 'Bid', ask: 'Ask' },
    ALERT_MAX: 20,
    BAR_CACHE_MAX: 200,
    BAR_CACHE_TTL_MS: 30 * 60 * 1000,
    ABSORPTION_VOL_MULT: 3.0,
    ABSORPTION_SIDE_RATIO: 0.85,
    MAX_BARS: 300,
    KLINE_LIMIT: 100,
    SEED_BARS: 20,
    FOOTPRINT_BACKFILL_BARS: 50,
    AGG_MAX_REQUESTS: 25,
    WS: {
      HEARTBEAT_MS: 15000,
      BACKOFF_MIN_MS: 1000,
      BACKOFF_MAX_MS: 30000,
      FAILS_BEFORE_FALLBACK: 3,
      BYBIT_PING_MS: 20000
    },
    ENDPOINTS: {
      binance: { rest: 'https://fapi.binance.com', ws: 'wss://fstream.binance.com/stream' },
      bybit: { rest: 'https://api.bybit.com', ws: 'wss://stream.bybit.com/v5/public/linear' }
    },

    // ---- AdMob: Google's official TEST IDs. Swap for real IDs only for a release (see README).
    ADMOB: {
      APP_ID: 'ca-app-pub-3940256099942544~3347511713',
      BANNER: 'ca-app-pub-3940256099942544/9214589741',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
      REWARDED: 'ca-app-pub-3940256099942544/5224354917',
      TESTING: true
    },
    BANNER_HEIGHT: 50,
    BANNER_SEPARATOR: 4,
    INTERSTITIAL_COOLDOWN_MS: 5 * 60 * 1000,
    NO_INTERSTITIAL_AFTER_START_MS: 60 * 1000,
    REWARDED_MAX_PER_DAY: 5,
    REWARDED_GRANT_USDT: 50000,

    // ---- Billing (cordova-plugin-purchase). mockPrice is shown ONLY in browser mock mode.
    PRODUCTS: [
      { id: 'pro_monthly', type: 'subscription', label: 'Pro Monthly', mockPrice: '$4.99' },
      { id: 'pro_yearly', type: 'subscription', label: 'Pro Yearly', mockPrice: '$29.99' },
      { id: 'pro_lifetime', type: 'non_consumable', label: 'Pro Lifetime', mockPrice: '$49.99' }
    ],

    // ---- Paper trading -------------------------------------------------------------------
    PAPER: {
      START_BALANCE: 100000,
      TAKER_FEE: 0.0005,
      MAINT_MARGIN_RATE: 0.004,
      MAX_LEVERAGE: 50,
      MAX_HISTORY: 500
    },

    // ---- Whale tape ----------------------------------------------------------------------
    WHALE_THRESHOLDS: [25000, 50000, 100000],
    FREE_WHALE_ALERTS: 25,
    WHALE_TAPE_MAX: 60,

    // ---- Appearance ----------------------------------------------------------------------
    PRESETS: {
      classic: { name: 'Classic Emerald/Crimson', bull: '#10b981', bear: '#ef4444' },
      cyber: { name: 'Cyber Cyan/Magenta', bull: '#22d3ee', bear: '#f472b6' },
      inst: { name: 'Institutional Blue/Orange', bull: '#3b82f6', bear: '#f97316' },
      mono: { name: 'Monochrome', bull: '#e5e7eb', bear: '#6b7280' }
    },
    DEFAULT_SETTINGS: {
      preset: 'classic',
      bull: '#10b981',
      bear: '#ef4444',
      shading: 'dark', // 'dark' = Dark-to-Light, 'heat' = Light-to-Dark heatmap
      imbalance: 3.0,
      whaleUsd: 50000,
      whaleSound: false,
      mode: 'bidask',
      mult: 1,
      symbol: 'BTCUSDT',
      tf: '1m',
      // ---- Cluster settings ---------------------------------------------------------------
      volFilter: 0,       // hide cells whose total volume is below this (0 = show all)
      stackedImb: 3,      // highlight N+ consecutive same-direction imbalances (0 = off)
      showPOC: false,     // draw the POC outline on each bar
      showImb: true,      // draw diagonal imbalance markers
      showProfile: false, // show the session volume profile panel
      showVA: false,      // draw VAH/VAL dashed lines
      showCVD: false,     // show cumulative volume delta strip
      showMatrix: false,  // show the bottom OHLCV matrix rows
      // ---- Indicators -----------------------------------------------------------------------
      showVWAP: false,    // session VWAP overlay (resets at UTC midnight)
      showSMA: false,     // simple moving average
      smaPeriod: 20,
      showEMA: false,     // exponential moving average
      emaPeriod: 9,
      showCPR: false      // central pivot range (P / BC / TC from previous day)
    },

    AFFILIATES: [
      { name: 'Binance', url: 'https://www.binance.com/', blurb: 'Global crypto exchange.' },
      { name: 'Bybit', url: 'https://www.bybit.com/', blurb: 'Crypto derivatives exchange.' }
    ]
  };

  // ---- Shared helpers ----------------------------------------------------------------------
  var U = (OF.util = {});

  U.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  U.decimalsOf = function (x) {
    if (!isFinite(x)) return 0;
    var s = String(x);
    var m = s.match(/e-(\d+)$/);
    if (m) {
      var mant = s.split('e')[0].split('.')[1];
      return parseInt(m[1], 10) + (mant ? mant.length : 0);
    }
    var p = s.split('.')[1];
    return p ? p.length : 0;
  };

  U.fmtPrice = function (p, dec) {
    if (p == null || !isFinite(p)) return '—';
    return Number(p).toFixed(dec == null ? 2 : dec);
  };

  U.fmtQty = function (v) {
    if (v == null || !isFinite(v)) return '–';
    var a = Math.abs(v), sign = v < 0 ? '-' : '';
    if (a === 0) return '0';
    if (a >= 1e6) return sign + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return sign + (a / 1e3).toFixed(1) + 'k';
    if (a >= 100) return sign + a.toFixed(0);
    if (a >= 10) return sign + a.toFixed(1);
    if (a >= 1) return sign + a.toFixed(2);
    return sign + a.toFixed(3);
  };

  U.fmtUsd = function (v, dec) {
    if (v == null || !isFinite(v)) return '—';
    var d = dec == null ? 2 : dec;
    var s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (v < 0 ? '-$' : '$') + s;
  };

  U.fmtTime = function (ts, withSec) {
    var d = new Date(ts);
    var hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    return withSec ? hh + ':' + mm + ':' + String(d.getSeconds()).padStart(2, '0') : hh + ':' + mm;
  };

  U.today = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  U.hexToRgb = function (hex) {
    var h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n)) n = 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  U.rgbToHsl = function (c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  };

  U.hslToRgb = function (h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1)), r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; } else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; } else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
    var m = l - c / 2;
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  };

  // WCAG relative luminance and best-contrast text colour (black or white).
  U.luminance = function (c) {
    function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  U.contrast = function (l1, l2) { var a = Math.max(l1, l2), b = Math.min(l1, l2); return (a + 0.05) / (b + 0.05); };
  U.textOn = function (rgb) {
    var L = U.luminance(rgb);
    return U.contrast(L, 0) >= U.contrast(L, 1) ? '#000000' : '#ffffff';
  };

  U.roundToTick = function (x, tick) {
    return Number((Math.round(x / tick) * tick).toFixed(U.decimalsOf(tick)));
  };

  U.isNative = function () {
    var C = window.Capacitor;
    return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  };
  U.plugin = function (name) {
    var C = window.Capacitor;
    return (C && C.Plugins && C.Plugins[name]) || null;
  };

  U.symbolMeta = function (sym, live) {
    var base = OF.config.SYMBOL_META[sym] || { tick: 0.01, lot: 0.001, baseBin: 1, seed: 100 };
    var m = Object.assign({}, base, (live && live[sym]) || {});
    // Base bin must be a whole multiple of the tick size.
    if (!(m.baseBin >= m.tick)) m.baseBin = m.tick;
    var ratio = Math.round(m.baseBin / m.tick);
    m.baseBin = Number((ratio * m.tick).toFixed(U.decimalsOf(m.tick)));
    m.dec = Math.max(U.decimalsOf(m.tick), U.decimalsOf(m.baseBin));
    return m;
  };
})();
