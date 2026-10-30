/* OrderFlow Crypto Pro — geo.js
 * Geographic compliance checks for Google Play policy updates.
 * Current: Paper trading tool with no real-money implications, so geo-blocking is optional.
 * Future: If regulatory scope changes, uncomment ENABLE_HK_BLOCK and add detection logic.
 */
(function () {
  'use strict';
  var OF = window.OF;

  var GeoCompliance = function () {
    // Feature flag: set to true if HK geo-blocking is required per regulatory guidance.
    this.ENABLE_HK_BLOCK = false; // false = no blocking; true = show warning if HK detected

    // Restrictions: key = region code, value = restriction details.
    this.restrictions = {
      HK: {
        name: 'Hong Kong',
        message: 'OrderFlow Crypto Pro is not available in Hong Kong. This App is an educational tool only and is not regulated by the Hong Kong Securities and Futures Commission (SFC).',
        blocking: this.ENABLE_HK_BLOCK
      }
      // Additional regions can be added here as policy requires.
    };
  };

  GeoCompliance.prototype.check = function (detectedRegion) {
    if (!detectedRegion || !this.restrictions[detectedRegion]) return { blocked: false };

    var restriction = this.restrictions[detectedRegion];
    if (restriction.blocking) {
      console.warn('[geo] Region ' + detectedRegion + ' is blocked: ' + restriction.message);
      return { blocked: true, region: detectedRegion, message: restriction.message };
    } else {
      console.log('[geo] Region ' + detectedRegion + ' detected; warning shown but not blocked.');
      return { blocked: false, region: detectedRegion, message: restriction.message, warning: true };
    }
  };

  GeoCompliance.prototype.showWarning = function (region) {
    if (!region || !this.restrictions[region]) return;
    var msg = this.restrictions[region].message;
    var el = document.createElement('div');
    el.className = 'geo-warning';
    el.textContent = msg;
    el.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #7f1d1d; color: #fca5a5; padding: 12px; text-align: center; z-index: 100; font-size: 12px; font-weight: 600;';
    document.body.insertBefore(el, document.body.firstChild);
    console.log('[geo] Warning banner shown for region: ' + region);
  };

  GeoCompliance.prototype.blockUI = function (region) {
    if (!region || !this.restrictions[region]) return;
    var msg = this.restrictions[region].message;
    var overlay = document.createElement('div');
    overlay.id = 'geo-block-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1000;';

    var box = document.createElement('div');
    box.style.cssText = 'background: #111827; color: #e5e7eb; padding: 24px; border-radius: 8px; max-width: 320px; text-align: center; border: 1px solid #dc2626;';
    box.innerHTML = '<h2 style="margin: 0 0 12px; font-size: 18px; color: #ef4444;">Not Available</h2>' +
                    '<p style="margin: 0; font-size: 13px; line-height: 1.5;">' + msg + '</p>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Disable main app
    var app = document.getElementById('app');
    if (app) app.style.display = 'none';

    console.warn('[geo] App blocked for region: ' + region);
  };

  OF.GeoCompliance = GeoCompliance;
})();
