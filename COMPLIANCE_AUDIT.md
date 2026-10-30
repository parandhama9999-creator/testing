# Google Play Policy Compliance Audit — OrderFlow Crypto Pro

**Date:** October 30, 2026  
**Status:** 🚨 **COMPLIANCE GAPS IDENTIFIED** — Action required by indicated deadlines

---

## Executive Summary

OrderFlow Crypto Pro must address **7 mandatory compliance requirements** by their respective deadlines. Most critical: **cryptocurrency licensing (Hong Kong), subscription disclosure clarity, and payment trader status declaration (Nov 2026).**

---

## Policy Updates & Required Actions

### 1. **Cryptocurrency Policy — Hong Kong Virtual Asset Trading Platform License** 

**Status:** ⚠️ **REQUIRES AUDIT**

**Deadline:** Immediate (no grace period stated)

**What changed:** Hong Kong expanded beyond crypto exchange licensing to require Virtual Asset Trading Platform (VATP) license for apps serving HK users.

**Current state:**
- App does NOT currently detect or restrict by user region
- No geographic gating implemented
- Privacy Policy mentions educational use only, no money involvement

**Required actions:**
- [ ] **Audit:** Determine if app is marketed to/accessible in Hong Kong
  - Check App Store metadata (description, keywords, target audience)
  - Check if VPN users from HK access it
  - Current privacy policy disclaims trading/financial advice
- [ ] **If serving Hong Kong:**
  - Add geofence to disable real money trading features for HK users (not applicable here — paper trading only)
  - Add explicit disclaimer: "Not regulated by HK SFC. Paper trading only. Educational tool."
  - Consider disclaiming availability in HK entirely
- [ ] **If NOT serving Hong Kong:**
  - Add to Privacy Policy: "Not available in Hong Kong" OR "For educational purposes only, not a trading platform"

**Recommended approach:** Add geo-blocking check in UI initialization:
```javascript
// In app.js or config.js
const HK_BLOCKED = true; // or check IP/user location
if (HK_BLOCKED && someDetectionOfHK) {
  console.log('App not available in Hong Kong');
}
```

---

### 2. **Subscriptions with Ongoing Discounts — Eligibility Disclosure** 

**Status:** ⚠️ **NEEDS CLARIFICATION**

**Deadline:** Immediate (new policy)

**What changed:** Subscriptions with ongoing eligibility-based discounts (e.g., student plans, regional pricing) must clearly disclose:
- Eligibility criteria
- Verification process
- Post-eligibility pricing and benefit changes

**Current state:**
- App has 3 products: `pro_monthly`, `pro_yearly`, `pro_lifetime`
- No mention of discounts or regional pricing in code
- Mock prices in browser: $4.99 (monthly), $29.99 (yearly), $49.99 (lifetime)
- Prices pulled from Google Play Store (no hardcoding)

**Action required:**
- [ ] **Audit Play Console listing:** Check if subscriptions have regional pricing, discounts, or eligibility tiers
- [ ] **If NO discounts/eligibility:** No action needed; current setup compliant
- [ ] **If discounts exist:**
  - Add to app: "Eligibility notice" dialog before checkout
  - Show discount terms, verification steps, post-discount pricing
  - Example: "Student Discount: Valid for 2 years. Renewal at full price ($4.99/month)."
  - Update Privacy Policy with full terms

**For now:** Proceed with assumption of **no ongoing discounts** (standard flat pricing). If Play Console has regional pricing, will need to add disclosure.

---

### 3. **Location Permission — Mandatory Android Location Button (Android 17+ / API 37+)**

**Status:** ✅ **COMPLIANT** (not applicable)

**Deadline:** January 27, 2027

**What changed:**
- Location scope must be minimum necessary
- Android 17+ apps using `ACCESS_FINE_LOCATION` must use Android location button for one-time/infrequent requests
- Apps using `ACCESS_COARSE_LOCATION` must justify why fine-grained is insufficient

**Current state:**
- **App does NOT request any location permissions**
- No GPS, location, geolocation APIs in use
- No `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION` in AndroidManifest
- `capacitor.config.json` has no location plugins

**Action:** ✅ **None required.** Document this compliance for audit trail.

---

### 4. **Trader Status Declaration** — New Console Requirement

**Status:** 🚨 **CRITICAL — ACTION REQUIRED**

**Deadline:** November 2026 (next month)

**What changed:** Starting November 2026, all developers must declare their trader status in Play Console per new requirements.

**What this means:**
- Google is tracking which apps facilitate trading/investing
- Declaration is per-app in Play Console settings
- Affects how app is categorized, reviewed, and potentially flagged for compliance

**Current state:**
- App is a **paper trading (simulated) tool** — no real money changes hands
- Is explicitly educational ("OrderFlow Crypto Pro — Educational tool. Not financial advice.")
- No real trading, only demo positions with virtual $100k USDT

**Action required:**
- [ ] **In Play Console → [OrderFlow Crypto Pro] → App content → Additional information:**
  - Find "Trader status" field (new, rolling out November 2026)
  - **Declare:** "This app facilitates SIMULATED/PAPER trading only. Real money is not used. Educational tool."
  - Provide link to Privacy Policy stating this
  - May need to declare as "Demo/Paper Trading App" vs. "Real Trading Platform"
- [ ] **Update app Privacy Policy to explicitly state:**
  ```
  Paper Trading Disclaimer
  ─────────────────────────
  OrderFlow Crypto Pro simulates cryptocurrency trading with virtual $100,000 USD Tether (USDT).
  NO REAL MONEY is used. This is an EDUCATIONAL TOOL only and does NOT facilitate actual trading.
  All positions, profits, and losses are simulated.
  
  Disclaimer: This app is for educational purposes only. Not financial advice. 
  Cryptocurrency and derivatives trading carry high risk and may be restricted in your country.
  ```

**Example Play Console location (once visible):**
```
App > Store listing > Additional information > (scroll to) Trader status / Trading declaration
→ Select: "Paper/Demo Trading" (not "Real Money Trading")
→ Add: Link to Privacy Policy
→ Save
```

---

### 5. **Memory & Code Optimization — February 2027 Quality Deadline**

**Status:** ⚠️ **MONITOR (February 2027 deadline)**

**Deadline:** February 2027 (compliance deadline for app visibility)

**What changed:** New app quality requirements regarding memory and code optimization. Apps not meeting thresholds may lose visibility or publishing capability.

**Current metrics to test:**
- Initial memory footprint (app startup)
- Runtime memory usage under load
- Code size and efficiency
- Startup time

**Current state:**
- App is Capacitor 7 + vanilla JavaScript (no React/Vue bloat)
- Minimal dependencies: AdMob, Screen Orientation, Google Play Billing only
- JavaScript files are small (largest: `renderer.js` 42KB, `ui.js` 38KB, `app.js` 17KB)
- Canvas-based rendering (efficient for trading charts)

**Action required:**
- [ ] **Run Memory Audit (February 2027 test):**
  ```bash
  # In Android Studio or via adb
  adb shell dumpsys meminfo com.parandama.orderflow
  # Check PSS (Proportional Set Size), RSS
  # Target: < 150 MB on startup for a chart app
  ```
- [ ] **Lint & dead code removal:**
  - Already run: `npm run check` (syntax check)
  - Already run: `npx eslint www/js/*.js` (in CI)
  - Add: unused variable detection, tree-shake unused code paths
- [ ] **Startup time target:** < 2 seconds to first chart render
  - Current: likely ~800ms (Capacitor boot + WebView load + JS init)
  - Monitor in CI with performance test
- [ ] **Likely compliant**, but add monitoring job to CI:
  ```yaml
  # In .github/workflows/build_apk.yml, add a "Performance Audit" step
  - name: Check code size
    run: |
      du -sh android/app/build/outputs/apk/debug/ | tee code-size.txt
      # Parse and warn if exceeds threshold
  ```

**For now:** ✅ **Likely passing.** Will revisit in January 2027 before deadline.

---

### 6. **Payments Policy — AI/Agentic Purchases Guidance**

**Status:** ✅ **COMPLIANT** (not applicable)

**Deadline:** Immediate

**What changed:** New guidance on facilitating digital purchases through AI or agentic experiences.

**Current state:**
- App has **NO AI or agentic features**
- Purchases are standard Google Play Billing (cordova-plugin-purchase)
- User manually selects subscription/lifetime option and clicks "Buy"
- No AI upsell, no agentic order recommendations

**Action:** ✅ **None required.** Document compliance.

---

### 7. **AppFunctions API — Deception/Manipulation Prevention**

**Status:** ✅ **COMPLIANT** (not applicable)

**Deadline:** Immediate

**What changed:** AppFunctions developers must not:
- Deceive or manipulate AI agents
- Bypass security controls
- Interfere with other applications

**Current state:**
- App does **NOT use Google's AppFunctions API**
- No custom intents for AI agents
- No interapp manipulation

**Action:** ✅ **None required.**

---

### 8. **Local Network Permission (Android 17+ / API 37+)**

**Status:** ✅ **COMPLIANT** (not applicable)

**Deadline:** Immediate (restricted for Android 17+)

**What changed:** `ACCESS_LOCAL_NETWORK` is now restricted and requires Play Console declaration if genuinely needed for core functionality (otherwise forbidden).

**Current state:**
- App does **NOT request `ACCESS_LOCAL_NETWORK`**
- All data: Binance/Bybit public REST APIs (HTTPS) or WebSocket (WSS)
- No local device discovery, mDNS, or LAN communication

**Action:** ✅ **None required.**

---

### 9. **Manage Contacts Permission**

**Status:** ✅ **COMPLIANT** (not applicable)

**Deadline:** Immediate

**What changed:** Restricted to apps needing it for core functionality; must submit declaration. All others must use system pickers.

**Current state:**
- App does **NOT request `READ_CONTACTS` or `WRITE_CONTACTS`**
- No contact access needed

**Action:** ✅ **None required.**

---

## Compliance Checklist

| Policy | Applies? | Compliant? | Action | Deadline |
|--------|----------|-----------|--------|----------|
| **Cryptocurrency (HK license)** | ⚠️ Audit needed | 🔴 TBD | Audit Play Console metadata; add HK disclaimer if serving HK | Immediate |
| **Subscriptions + discounts** | ⚠️ Likely no | ✅ Probably | Audit Play Console for regional pricing; add disclosure if found | Immediate |
| **Location (Android 17+)** | ❌ No | ✅ Yes | None — app doesn't use location | Jan 27, 2027 |
| **Trader status declaration** | ✅ **Yes** | 🔴 **Missing** | **Add to Play Console; update Privacy Policy** | **Nov 2026** ⏰ |
| **Memory/code optimization** | ⚠️ Monitor | ✅ Likely | Add memory audit to CI; recheck in Jan 2027 | Feb 2027 |
| **Payments (AI/agentic)** | ❌ No | ✅ Yes | None — no AI features | Immediate |
| **AppFunctions API** | ❌ No | ✅ Yes | None — not used | Immediate |
| **Local Network permission** | ❌ No | ✅ Yes | None — not used | Immediate |
| **Manage Contacts permission** | ❌ No | ✅ Yes | None — not used | Immediate |

---

## Implementation Plan

### **Phase 1: Immediate (Before Next Build)**

1. **Audit Cryptocurrency Licensing**
   - Check Play Console: Is app available in Hong Kong?
   - If yes: Add geofence warning + HK disclaimer
   - If no: Add to Privacy Policy: "Not available in Hong Kong"

2. **Audit Subscriptions**
   - Check Play Console pricing for regional offers, discounts, or trials
   - If found: Add eligibility disclosure in app UI before checkout

3. **Update Privacy Policy**
   - Add explicit paper-trading disclaimer
   - Add "Not financial advice" statement
   - Add "Restricted regions" section (if applicable)

### **Phase 2: Before November 2026 (Next month)**

4. **Trader Status Declaration**
   - Log into Play Console
   - Navigate to: App > Store listing > Additional information
   - Look for new "Trader status" field (rolling out throughout Nov)
   - Declare: "Paper/Demo Trading (Simulated, No Real Money)"
   - Verify in submission preview

5. **CI/CD Improvements**
   - Add memory audit step to `build_apk.yml`
   - Add code-size check
   - Add startup-time profiling (optional, stretch goal)

### **Phase 3: January 2027 (Before Feb deadline)**

6. **Memory & Code Optimization**
   - Run full memory audit: `adb shell dumpsys meminfo`
   - Verify startup time < 2s
   - Remove unused code if needed
   - Retest on Android 15 emulator (API 35) and Android 17 (API 37) if available

---

## Files to Update

1. **`PRIVACY_POLICY.md`** — Add/clarify:
   - Paper trading disclaimer
   - No real money
   - Not financial advice
   - Geographic restrictions (if applicable)
   - Trader status declaration (link from app)

2. **`.github/workflows/build_apk.yml`** — Add step:
   ```yaml
   - name: Memory & Code Size Audit
     run: |
       echo "=== Code Size ==="
       du -sh android/app/build/outputs/apk/debug/ 
       echo "=== JS Bundle Size ==="
       wc -c www/js/*.js
   ```

3. **`www/js/app.js` or new `www/js/geo.js`** — Add (if serving HK):
   ```javascript
   // Geofence check on startup
   function checkHKRestriction() {
     // Simple check: if app metadata indicates HK availability, add warning
     // Note: Paper trading has no real-money implications, so restriction is optional
   }
   ```

4. **`www/js/ui.js`** — Add (if discounts found):
   - Eligibility notice dialog before subscription checkout
   - Show discount terms, renewal pricing, verification process

---

## Testing Checklist

- [ ] Build APK with updated code
- [ ] Test on Android 15 (API 35) and Android 16 (API 36)
- [ ] Verify memory footprint: `adb shell dumpsys meminfo | grep com.parandama.orderflow`
- [ ] Verify startup time (< 2 sec to first render)
- [ ] Test all 3 subscription options (monthly, yearly, lifetime)
- [ ] Confirm Privacy Policy displays and links correctly
- [ ] Check Play Console metadata for regional availability
- [ ] Validate trader status declaration appears in next build's Play Console review

---

## Next Steps

1. **Run Audit NOW:**
   - Check Play Console → App content → Geographic locations, pricing
   - Determine HK and discount status

2. **Update Privacy Policy:**
   - Add trader status disclaimer
   - Add HK geo restriction (if applicable)

3. **CI/CD Enhancement:**
   - Add memory/code-size audit to workflow

4. **November Deadline:**
   - Before submitting any update, verify trader status field is visible in Play Console
   - Declare paper-trading status

5. **February 2027:**
   - Re-run memory/code audit before app update
   - Ensure compliance with memory thresholds

---

## Questions for User

1. **Is the app marketed to Hong Kong users?** (Affects crypto licensing requirements)
2. **Any regional pricing or discounts in Play Console?** (Affects subscription disclosure)
3. **Target Android version for this update?** (API level affects location button requirements)
4. **When is the next app update planned?** (Affects trader status declaration timeline)

