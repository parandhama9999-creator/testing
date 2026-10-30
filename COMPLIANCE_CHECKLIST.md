# OrderFlow Crypto Pro — Google Play Compliance Checklist

**Last updated:** October 30, 2026  
**Compliance status:** ✅ 80% Complete | ⏰ 2 actionable items for next update

---

## ✅ Completed Actions

### Privacy Policy Updated ✅
- [x] Added explicit paper-trading disclaimer ("NO REAL MONEY")
- [x] Added trader status declaration (Paper/Demo Trading)
- [x] Added cryptocurrency risk disclaimer
- [x] Added "Not regulated by SFC" / Hong Kong restriction notice
- [x] Clarified subscription pricing (no ongoing discounts)
- [x] Added permission table (shows: only INTERNET, ACCESS_NETWORK_STATE used)
- [x] Added Google Play policy compliance section (13 sections total)
- [x] Documented geographic restrictions (Hong Kong)

**Location:** `/home/user/testing/PRIVACY_POLICY.md`

### CI/CD Audit Step Added ✅
- [x] Added "Memory & Code Size Audit" to `.github/workflows/build_apk.yml`
- [x] Checks APK size, JS bundle size, individual file sizes
- [x] Documents memory targets (< 150 MB startup, < 200 KB JS)
- [x] Confirms linting already in place

**Location:** `/home/user/testing/.github/workflows/build_apk.yml` (lines 80-108)

### Geo-Blocking Module Created ✅
- [x] Created `www/js/geo.js` with `GeoCompliance` class
- [x] Supports optional Hong Kong blocking/warning
- [x] Can be extended for other regions
- [x] Currently DISABLED (ENABLE_HK_BLOCK = false) — ready for activation if needed

**Location:** `/home/user/testing/www/js/geo.js`

### Compliance Audit Document ✅
- [x] Full audit of all 9 Google Play policy changes
- [x] Identified which apply to OrderFlow Crypto Pro
- [x] Documented compliance status for each
- [x] Provided implementation roadmap and deadlines

**Location:** `/home/user/testing/COMPLIANCE_AUDIT.md`

---

## ⏰ Action Items (Before Next App Update)

### 1. Audit Play Console Metadata (Required)
**Deadline:** Before next app submission  
**Effort:** 15 minutes  
**Steps:**
1. Log into Google Play Console
2. Select "OrderFlow Crypto Pro" app
3. Go to: **Store listing** → **Geographic location & platforms**
4. Check: Is the app available in Hong Kong?
5. Go to: **Store listing** → **Pricing and distribution** → **Pricing**
   - Check if there are regional pricing tiers, discounts, or trials
6. Go to: **Content rating**
   - Verify app is rated appropriate (likely 12+ or 16+ due to gambling/financial themes)

**Decision tree:**
- ✅ **If NOT available in Hong Kong AND no regional pricing:** No action needed
- ⚠️ **If available in Hong Kong:** Activate HK warning in `geo.js` or add HK geo-block in Play Console
- ⚠️ **If regional pricing/discounts found:** Add disclaimer dialog in `ui.js` before checkout

**Status:** 🔴 **NOT YET DONE**

### 2. Trader Status Declaration (CRITICAL — November 2026)
**Deadline:** November 2026 (NEXT MONTH)  
**Effort:** 10 minutes  
**Steps:**
1. Log into Google Play Console
2. Select "OrderFlow Crypto Pro"
3. Navigate to: **Store listing** → **Additional information** (scroll down)
4. Look for new field: **"Trader status"** or **"Trading declaration"** (rolling out throughout November)
5. Select: **"Paper/Demo Trading (Simulated, No Real Money)"**
6. Confirm in submission preview before uploading any new build

**Status:** 🔴 **NOT YET DONE** (field not yet visible in Play Console; will appear in November)

---

## ✅ Already Compliant (No Action Needed)

| Policy | Status | Reason |
|--------|--------|--------|
| **Location (Android 17+)** | ✅ Compliant | App does not request any location permissions |
| **Payments (AI/agentic)** | ✅ Compliant | No AI features; standard Google Play Billing |
| **AppFunctions API** | ✅ Compliant | Not used |
| **Local Network permission** | ✅ Compliant | Not requested |
| **Manage Contacts permission** | ✅ Compliant | Not requested |
| **Deceptive Behavior** | ✅ Compliant | Accurate descriptions, proper disclaimers |
| **Memory & Code Optimization** | ✅ Likely Compliant | Vanilla JS, small bundle (< 200 KB); added audit to CI |
| **Accessibility API** | ✅ Compliant | Not using AccessibilityAPI |

---

## 📅 Compliance Timeline

```
October 30, 2026 (TODAY)
├─ [x] Update Privacy Policy with all required disclosures
├─ [x] Add geo-blocking module (optional HK support)
├─ [x] Add memory/code audit to CI/CD
└─ [x] Create comprehensive compliance documentation

November 2026 (NEXT MONTH)
├─ [ ] Audit Play Console metadata (HK availability, regional pricing)
├─ [ ] Declare trader status in Play Console ("Paper Trading")
└─ [ ] Build and submit updated APK to Play Store

January 2027
├─ [ ] Re-run memory audit (before Feb deadline)
└─ [ ] Verify all 2027 quality thresholds still met

February 2027
└─ [ ] Confirm app passes new memory/code optimization checks
```

---

## 📋 Pre-Submission Checklist

Before uploading any new APK/AAB to Google Play:

- [ ] **Privacy Policy:**
  - [ ] Public URL is current and accessible
  - [ ] Paper-trading disclaimer is clear and prominent
  - [ ] Trader status declaration is included
  - [ ] Geographic restrictions (HK or others) are stated
  - [ ] Subscription pricing terms are accurate
  - [ ] Permission list is correct

- [ ] **Play Console Metadata:**
  - [ ] App category is appropriate (e.g., "Finance", "Tools")
  - [ ] Geographic availability is correctly set
  - [ ] Content rating is up to date
  - [ ] Trader status field is filled out (once visible)

- [ ] **App Code:**
  - [ ] All lint checks pass: `npm run check && npx eslint www/js/*.js`
  - [ ] No breaking changes to permissions in `AndroidManifest.xml`
  - [ ] No new network endpoints beyond Binance/Bybit
  - [ ] Geo-blocking module can be activated if needed

- [ ] **Build & Testing:**
  - [ ] APK/AAB builds successfully
  - [ ] Memory audit runs without errors
  - [ ] Code size is reasonable (APK < 50 MB)
  - [ ] Test on Android 15+ (API 35+) physically or emulator

---

## 📞 Questions / Next Steps

1. **Is the app marketed to Hong Kong?**
   - Answer determines if HK geo-blocking is needed

2. **When is the next app update planned?**
   - Affects urgency of trader status declaration (Nov deadline)

3. **Are there any regional pricing tiers in Play Console?**
   - Answer determines if subscription disclaimer dialog is needed

4. **Target Android SDK / API level for next build?**
   - Affects location button / Android 17+ requirements (not applicable now, but plan ahead)

---

## 📚 References

- **Full compliance audit:** `COMPLIANCE_AUDIT.md`
- **Updated Privacy Policy:** `PRIVACY_POLICY.md`
- **Geo-blocking module:** `www/js/geo.js`
- **CI/CD audit step:** `.github/workflows/build_apk.yml` (lines 80-108)
- **Google Play Policy Help Center:** https://support.google.com/googleplay/android-developer/answer/9859455

