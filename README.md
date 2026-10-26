# OrderFlow Crypto Pro

Zero-cost crypto **order-flow / footprint / paper-trading** app for Android, built with Capacitor 7 and plain JavaScript (no bundler, no build step, no CDN).

- App ID: `com.parandama.orderflow`
- Market data: public Binance USDⓈ-M Futures feeds, with automatic fallback to Bybit v5 public linear feeds. No API keys needed.
- **Educational tool. Not financial advice.** Paper trading is simulated, so there is no real money and no real orders.

## Features

- **Footprint chart** (Canvas, high-DPI). Three cluster modes: Bid × Ask, Delta and Volume. Each bar has a POC outline, cyan/magenta diagonal imbalances and delta shading (Dark-to-Light or heatmap). Cell text hides automatically when cells are too small to read.
- **Session volume profile** with VPOC and 70% value area (VAH/VAL). Bottom matrix shows Volume, Delta, Delta %, Min Δ, Max Δ and a CVD line. Slim depth20 order-book ladder.
- **Touch**: drag to pan, pinch to zoom (x and y), long-press for crosshair, double-tap to reset. On desktop: mouse wheel (shift/ctrl for y), drag, hover crosshair.
- **Anti-blank start**: 20 demo bars, clearly labelled "Demo data — loading live market…", are drawn in the first frame. Then real klines load, then a footprint backfill for the last 3 bars, then the live stream.
- **Robust feeds**: exponential backoff with jitter (1 s → 30 s), 15 s heartbeat, connection-ID guard against stale messages, pause on background and re-backfill on resume. Switches to Bybit on HTTP 451/403 or after 3 WebSocket failures.
- **Paper trading** with $100,000 virtual USDT. One isolated-margin position per symbol, leverage 1–50x, ±1 tick slippage and 0.05% taker fee per side. SL/TP can be typed in or dragged on the chart; liquidation is automatic. Stats cover win rate, profit factor, total PnL and max drawdown. History exports to CSV.
- **Monetization** (policy-safe): AdMob test IDs with the UMP consent flow, a 50 px reserved banner area, capped interstitials, rewarded "+$50,000 virtual margin" (5/day), Google Play Billing (monthly, yearly, lifetime) and optional affiliate cards (off by default).

## Project layout

```
www/index.html          layout, CSS, modals, <script defer> tags (fixed load order)
www/js/config.js        constants, symbols, bins, endpoints, ad IDs, feature flags, helpers
www/js/storage.js       versioned localStorage wrapper (of.v1.*), safe JSON, migrations
www/js/market.js        REST backfill + WebSockets + reconnect + Binance→Bybit fallback
www/js/footprint.js     bars/clusters, POC, imbalances, session profile, CVD
www/js/renderer.js      canvas drawing, pan/zoom, crosshair, SL/TP lines
www/js/paper.js         paper-trading engine and stats
www/js/monetization.js  MonetizationManager (AdMob, billing, affiliates)
www/js/ui.js            toolbar, settings, paywall, whale tape, rotation, dialogs
www/js/app.js           bootstrap and wiring
scripts/patch_android.sh  patches AndroidManifest after `cap add android`
run_local.py            local dev server (stdlib only)
.github/workflows/build_apk.yml  CI: debug APK + signed release AAB
```

All modules share the global namespace `window.OF`.

## Run locally (browser)

```bash
cd ~/orderflow_crypto_pro && python3 run_local.py
```

Open `http://localhost:8080`. To test on a phone on the same Wi-Fi, open the printed LAN URL. In the browser, ads and purchases are clearly labelled mocks.

Exchanges sometimes block browser requests by region (HTTP 451, or a CORS error). The app then falls back to Bybit. If both are blocked where you are, the demo bars stay visible and are labelled as demo. Inside the Android app, requests go through Capacitor's native HTTP stack, so CORS doesn't apply.

## Build the Android app

Requirements: Node 20+, JDK 21 (required by Capacitor 7), Android SDK.

```bash
npm install
npx cap add android            # generates android/ (not committed)
bash scripts/patch_android.sh  # AdMob APPLICATION_ID meta-data + fullSensor rotation
npx cap sync android
cd android && ./gradlew assembleDebug
```

`scripts/patch_android.sh` is required. Without the `com.google.android.gms.ads.APPLICATION_ID` meta-data, the AdMob SDK crashes the app on launch. Rotation (`android:screenOrientation="fullSensor"`) is also set here, because `capacitor.config.json` has no such key.

### CI (GitHub Actions)

`.github/workflows/build_apk.yml` runs on every push and on manual dispatch. It always builds `OrderFlow-Crypto-Pro-debug.apk` and uploads it as an artifact. It builds `OrderFlow-Crypto-Pro-release.aab` only when the signing secrets exist. Google Play rejects unsigned bundles, so without the secrets the step is skipped with a notice.

### Signing (release AAB)

1. Generate an upload keystore once, and keep it and the passwords safe. Losing it locks you out of updates.
   ```bash
   keytool -genkeypair -v -keystore orderflow-upload.jks -alias orderflow \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Base64-encode it:
   ```bash
   base64 -w0 orderflow-upload.jks > keystore.b64     # macOS: base64 -i orderflow-upload.jks -o keystore.b64
   ```
3. In GitHub, go to **Settings → Secrets and variables → Actions** and add these secrets:
   `KEYSTORE_BASE64` (contents of keystore.b64), `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`orderflow`), `KEY_PASSWORD`.
4. Optionally, add an Actions **variable** `ADMOB_APP_ID` with your real AdMob app ID. If it is not set, the Google test app ID is used.
5. Push, then download the AAB from the workflow run's artifacts. Enrol in **Play App Signing** on the first upload.

Never commit `*.jks` files; `.gitignore` already excludes them.

## Go-live checklist

### AdMob
- [ ] Create the app and ad units (adaptive banner, interstitial, rewarded) in AdMob.
- [ ] In `www/js/config.js`, under `ADMOB`, replace `BANNER`, `INTERSTITIAL` and `REWARDED` with your unit IDs and set `TESTING: false`.
- [ ] Set your real AdMob **app ID** through the `ADMOB_APP_ID` variable (CI) or `ADMOB_APP_ID=... bash scripts/patch_android.sh` (local). It must match the `APP_ID` in config.js.
- [ ] Set up the GDPR/UMP consent message in AdMob (**Privacy & messaging**). The app calls `requestConsentInfo` / `showConsentForm` before loading any ad.
- [ ] Add your test device ID while you develop. Never click your own live ads.
- [ ] Publish `app-ads.txt` on your developer website.
- [ ] Ad placement rules built into the app: interstitials appear only after a paper trade closes, at most once per 5 minutes, never at app start and never during order entry. Rewarded grants happen only in the reward callback, at most 5 per day.

### Google Play Billing
- [ ] Create the products in Play Console with exactly these IDs: `pro_monthly` (subscription, $4.99), `pro_yearly` (subscription, $29.99), `pro_lifetime` (one-time, non-consumable, $49.99).
- [ ] Upload a signed build to an internal testing track first, because billing only works for builds installed from Play. Add license testers.
- [ ] Prices shown in the app come from the store. The values in config.js are used only for browser mocks.
- [ ] `DEBUG_MOCK_BILLING` only works outside the native app. In any native build, Pro needs a real Play purchase, and any cached mock entitlement is discarded.
- [ ] Recommended: add server-side receipt validation (`CdvPurchase.store.validator`). Without a validator, purchases are accepted locally.
- [ ] Test **Restore Purchases**, subscription expiry and refunds.

### Play listing and policy
- [ ] Host `PRIVACY_POLICY.md` (filled in) at a public URL. Set `PRIVACY_POLICY_URL` in config.js and enter the same URL in Play Console.
- [ ] Complete the Data safety form. AdMob collects the advertising ID and device data, and Play Billing handles purchase data.
- [ ] Declare ads in the app ("Contains ads") and fill in the content rating questionnaire.
- [ ] The app is a simulator: it never places real trades and never handles real funds. Keep the "Simulated — no real money" labels and the "Not financial advice" About text.
- [ ] **Affiliates**: `ENABLE_AFFILIATES` is `false` by default. Binance and Bybit are restricted or unlicensed in several countries (for example the US, UK and Ontario, Canada). Before enabling, review Google Play's **Financial Services** policy (crypto exchange and trading-app requirements, country licensing). Enabling may require geo-restricting the cards or the app. Cards are labelled "Sponsored" and carry a risk disclaimer.

## Notes

- Bin keys are integers (`Math.floor(price / binSize + 1e-9)`). Clusters are stored at the 1x base bin, and 2x–25x views are aggregated on demand.
- Aggressor mapping: Binance `m === true` (buyer is maker) is a **sell** aggressor and adds to bid volume. Bybit `S === "Buy"` is a **buy** aggressor and adds to ask volume.
- Memory is capped at 300 bars.
