/* OrderFlow Crypto Pro — monetization.js
 * MonetizationManager: AdMob (banner / interstitial / rewarded, UMP consent first), Google Play
 * Billing via cordova-plugin-purchase (CdvPurchase), and optional affiliate cards.
 * Browser/preview: clearly-labelled mock ads; mock purchases only when DEBUG_MOCK_BILLING is on.
 * Native app: real plugins only — Pro can never be unlocked without a real Play purchase.
 */
(function () {
  'use strict';
  var OF = window.OF, C = OF.config, S = OF.storage, U = OF.util;

  function MonetizationManager() {
    this.native = U.isNative();
    this.mockAllowed = !this.native && C.DEBUG_MOCK_BILLING === true;
    this.listeners = [];
    this.prices = {};
    this.storeReady = false;
    this.adsReady = false;
    this.orderEntryActive = false;
    this.startedAt = Date.now();
    this._pendingReward = null;
    this._billingInit = false;
    var ent = S.get('entitlement', { pro: false });
    // Never trust a cached mock entitlement inside the native app; Play is the source of truth.
    if (this.native && ent.source !== 'play') ent = { pro: false };
    if (!this.native && ent.source === 'mock' && !this.mockAllowed) ent = { pro: false };
    this.ent = ent;
  }
  var P = MonetizationManager.prototype;

  Object.defineProperty(P, 'isPro', { get: function () { return !!(this.ent && this.ent.pro); } });

  P.onChange = function (fn) { this.listeners.push(fn); };
  P._emit = function () { var self = this; this.listeners.forEach(function (fn) { fn(self); }); };

  P._setEnt = function (ent) {
    var was = this.isPro;
    this.ent = ent;
    S.set('entitlement', ent);
    if (was !== this.isPro) {
      if (this.isPro) this.hideBanner(); else this.showBanner();
    }
    this._emit();
  };

  P.init = function () {
    this._applyAdArea();
    if (this.native) {
      this._initAds();
      this._initBilling();
    } else {
      this._renderMockBanner();
    }
  };

  // ---- Banner area (50px + 4px separator reserved at the bottom; canvas shrinks) -------------
  P._applyAdArea = function () {
    document.body.classList.toggle('pro', this.isPro);
  };
  P._setAdHeight = function (h) {
    var hh = Math.max(C.BANNER_HEIGHT, Math.round(h || C.BANNER_HEIGHT));
    document.documentElement.style.setProperty('--ad-h', (hh + C.BANNER_SEPARATOR) + 'px');
    window.dispatchEvent(new Event('resize'));
  };
  P._renderMockBanner = function () {
    var slot = document.getElementById('adSlot');
    if (slot) slot.innerHTML = '<div class="mock-ad">Ad (mock banner) — test placement, shown only in the free version</div>';
  };

  P.showBanner = function () {
    this._applyAdArea();
    if (this.isPro || !this.native || !this.adsReady) return;
    this.AdMob.showBanner({
      adId: C.ADMOB.BANNER, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: C.ADMOB.TESTING
    }).catch(function (e) { console.warn('[ads] banner failed', e); });
  };
  P.hideBanner = function () {
    this._applyAdArea();
    window.dispatchEvent(new Event('resize'));
    if (this.native && this.AdMob) this.AdMob.removeBanner().catch(function () { /* not shown */ });
  };

  P._initAds = async function () {
    var AdMob = U.plugin('AdMob');
    if (!AdMob) { console.warn('[ads] AdMob plugin not available'); return; }
    this.AdMob = AdMob;
    var self = this;
    try {
      await AdMob.initialize({ initializeForTesting: C.ADMOB.TESTING });
      // UMP consent BEFORE any ad request.
      try {
        var info = await AdMob.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
        if (info && info.canRequestAds === false) { console.warn('[ads] consent does not allow ads'); return; }
      } catch (e) {
        console.warn('[ads] UMP consent flow failed', e);
      }
      AdMob.addListener('bannerAdSizeChanged', function (size) { self._setAdHeight(size && size.height); });
      AdMob.addListener('onRewardedVideoAdReward', function () { self._onReward(); });
      AdMob.addListener('onRewardedVideoAdDismissed', function () { self._pendingReward = null; });
      AdMob.addListener('onRewardedVideoAdFailedToLoad', function () { self._pendingReward = null; });
      this.adsReady = true;
      this.showBanner();
    } catch (e) {
      console.warn('[ads] AdMob init failed', e);
    }
  };

  // ---- Interstitial: only after a CLOSED paper trade, ≤ 1 per 5 min, never at start or during order entry.
  P.onTradeClosed = function () {
    if (this.isPro) return;
    var now = Date.now(), last = S.get('lastInterstitial', 0), self = this;
    if (now - last < C.INTERSTITIAL_COOLDOWN_MS) return;
    if (now - this.startedAt < C.NO_INTERSTITIAL_AFTER_START_MS) return;
    setTimeout(function () {
      if (self.orderEntryActive || document.hidden || self.isPro) return;
      if (Date.now() - S.get('lastInterstitial', 0) < C.INTERSTITIAL_COOLDOWN_MS) return;
      S.set('lastInterstitial', Date.now());
      if (self.native) {
        if (!self.adsReady) return;
        self.AdMob.prepareInterstitial({ adId: C.ADMOB.INTERSTITIAL, isTesting: C.ADMOB.TESTING })
          .then(function () { return self.AdMob.showInterstitial(); })
          .catch(function (e) { console.warn('[ads] interstitial failed', e); });
      } else if (OF.ui && OF.ui.mockInterstitial) {
        OF.ui.mockInterstitial();
      }
    }, 1500);
  };

  // ---- Rewarded: +$50,000 virtual margin, granted ONLY in the reward callback, max 5/day. -----
  P.rewardedLeft = function () {
    var r = S.get('rewarded', { date: '', count: 0 });
    return r.date === U.today() ? Math.max(0, C.REWARDED_MAX_PER_DAY - r.count) : C.REWARDED_MAX_PER_DAY;
  };
  P._countReward = function () {
    var r = S.get('rewarded', { date: '', count: 0 }), today = U.today();
    if (r.date !== today) r = { date: today, count: 0 };
    r.count++;
    S.set('rewarded', r);
  };
  P._onReward = function () {
    var fn = this._pendingReward;
    if (!fn) return;
    this._pendingReward = null;
    this._countReward();
    fn(C.REWARDED_GRANT_USDT);
  };

  P.showRewarded = async function (onGrant) {
    if (this.rewardedLeft() <= 0) return { ok: false, msg: 'Daily limit reached (' + C.REWARDED_MAX_PER_DAY + '/day).' };
    if (this.native) {
      if (!this.adsReady) return { ok: false, msg: 'Ads are not available right now.' };
      this._pendingReward = onGrant;
      try {
        await this.AdMob.prepareRewardVideoAd({ adId: C.ADMOB.REWARDED, isTesting: C.ADMOB.TESTING });
        await this.AdMob.showRewardVideoAd();
        return { ok: true };
      } catch (e) {
        this._pendingReward = null;
        return { ok: false, msg: 'Rewarded ad failed to load.' };
      }
    }
    this._pendingReward = onGrant;
    var completed = OF.ui && OF.ui.mockRewarded ? await OF.ui.mockRewarded(5) : false;
    if (completed) this._onReward(); else this._pendingReward = null;
    return { ok: completed, msg: completed ? '' : 'Closed early — no reward.' };
  };

  // ---- Billing ------------------------------------------------------------------------------
  P._initBilling = function () {
    var self = this;
    if (this._billingInit) return;
    if (!window.CdvPurchase) {
      // Cordova plugins become available after `deviceready`.
      if (!this._waitingDeviceReady) {
        this._waitingDeviceReady = true;
        document.addEventListener('deviceready', function () { self._initBilling(); }, { once: true });
      }
      return;
    }
    this._billingInit = true;
    var CP = window.CdvPurchase, store = CP.store, PT = CP.ProductType, PL = CP.Platform;
    this.store = store;
    this.PL = PL;
    store.register(C.PRODUCTS.map(function (p) {
      return { id: p.id, platform: PL.GOOGLE_PLAY, type: p.type === 'subscription' ? PT.PAID_SUBSCRIPTION : PT.NON_CONSUMABLE };
    }));
    store.when()
      .productUpdated(function () { self._refreshStore(); })
      .approved(function (t) { return t.verify(); })
      .verified(function (r) { return r.finish(); })
      .finished(function () { self._refreshStore(); })
      .receiptUpdated(function () { self._refreshStore(); });
    store.error(function (err) { console.warn('[billing]', err && err.message); });
    store.initialize([PL.GOOGLE_PLAY]).then(function () {
      self.storeReady = true;
      self._refreshStore();
    }).catch(function (e) { console.warn('[billing] init failed', e); });
  };

  P._refreshStore = function () {
    var store = this.store, PL = this.PL, self = this;
    if (!store) return;
    var owned = null;
    C.PRODUCTS.forEach(function (p) {
      var prod = store.get(p.id, PL.GOOGLE_PLAY);
      if (prod) {
        var price = prod.pricing && prod.pricing.price;
        if (!price && prod.offers && prod.offers[0] && prod.offers[0].pricingPhases && prod.offers[0].pricingPhases[0]) {
          price = prod.offers[0].pricingPhases[0].price;
        }
        if (price) self.prices[p.id] = price;
      }
      if (!owned && store.owned(p.id)) owned = p.id;
    });
    if (owned) {
      if (!this.isPro || this.ent.productId !== owned) this._setEnt({ pro: true, source: 'play', productId: owned, ts: Date.now() });
      else this._emit();
    } else if (this.storeReady && this.isPro) {
      this._setEnt({ pro: false }); // subscription expired / refunded
    } else {
      this._emit();
    }
  };

  P.priceLabel = function (id) {
    if (this.native) return this.prices[id] || (this.storeReady ? 'Unavailable' : 'Loading…');
    var p = C.PRODUCTS.filter(function (x) { return x.id === id; })[0];
    return this.mockAllowed ? p.mockPrice + ' (mock)' : 'Android app only';
  };

  P.buy = async function (id) {
    if (this.native) {
      if (!this.store) return { ok: false, msg: 'Store not ready yet.' };
      var prod = this.store.get(id, this.PL.GOOGLE_PLAY), offer = prod && prod.getOffer();
      if (!offer) return { ok: false, msg: 'Product not available.' };
      var err = await offer.order();
      if (err) return { ok: false, msg: err.message || 'Purchase cancelled.' };
      return { ok: true, msg: 'Processing purchase…' };
    }
    if (!this.mockAllowed) return { ok: false, msg: 'Purchases are only available in the Android app.' };
    var yes = OF.ui && OF.ui.confirm ? await OF.ui.confirm('Simulate purchase of ' + id + '? (debug/browser only — no payment)') : false;
    if (!yes) return { ok: false, msg: 'Cancelled.' };
    this._setEnt({ pro: true, source: 'mock', productId: id, ts: Date.now() });
    return { ok: true, msg: 'Pro unlocked (mock).' };
  };

  P.restore = async function () {
    if (this.native) {
      if (!this.store) return { ok: false, msg: 'Store not ready yet.' };
      try { await this.store.restorePurchases(); } catch (e) { return { ok: false, msg: 'Restore failed.' }; }
      this._refreshStore();
      return { ok: true, msg: this.isPro ? 'Pro restored.' : 'No previous purchases found.' };
    }
    return { ok: true, msg: this.isPro ? 'Pro is active (mock).' : 'No purchases in browser mode.' };
  };

  P.revokeMock = function () {
    if (this.native || this.ent.source !== 'mock') return;
    this._setEnt({ pro: false });
  };

  // ---- Affiliates (disabled by default) -----------------------------------------------------
  P.affiliateHTML = function () {
    if (!C.ENABLE_AFFILIATES) return '';
    return C.AFFILIATES.map(function (a) {
      return '<div class="aff"><span class="sponsored">Sponsored</span><b>' + a.name + '</b><div class="small">' + a.blurb +
        '</div><a href="' + a.url + '" target="_blank" rel="noopener sponsored">Visit ' + a.name + '</a>' +
        '<div class="small muted">Crypto derivatives are high risk and may be restricted in your country. Not financial advice.</div></div>';
    }).join('');
  };

  OF.MonetizationManager = MonetizationManager;
})();
