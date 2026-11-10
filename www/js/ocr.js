/* Camera photos → text. Uses the Tesseract reader inside the app (free, no
   server). English is built in; other languages download once (2–15 MB). */
(function () {
  'use strict';

  var CODES = {
    en: 'eng', hi: 'hin', te: 'tel', ta: 'tam', kn: 'kan', ml: 'mal', mr: 'mar', bn: 'ben', gu: 'guj',
    pa: 'pan', or: 'ori', ur: 'urd', es: 'spa', fr: 'fra', de: 'deu', pt: 'por', it: 'ita', nl: 'nld',
    ru: 'rus', uk: 'ukr', ar: 'ara', fa: 'fas', he: 'heb', tr: 'tur', zh: 'chi_sim', ja: 'jpn', ko: 'kor',
    th: 'tha', vi: 'vie', id: 'ind', ms: 'msa', tl: 'tgl', sw: 'swa', af: 'afr', pl: 'pol', cs: 'ces',
    sk: 'slk', hu: 'hun', ro: 'ron', bg: 'bul', el: 'ell', sv: 'swe', da: 'dan', no: 'nor', fi: 'fin',
    et: 'est', lv: 'lav', lt: 'lit', hr: 'hrv', sl: 'slv', mk: 'mkd', sq: 'sqi', be: 'bel', ka: 'kat',
    ca: 'cat', gl: 'glg', cy: 'cym', ga: 'gle', is: 'isl', mt: 'mlt', ht: 'hat', eo: 'epo'
  };

  function abs(path) { return new URL(path, window.location.href).href; }

  // ---------- Getting a photo ----------
  function nativeCamera() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.Camera) || null;
  }

  // Resolves with an image URL, or null when the person cancels.
  function takePhoto(fallbackInput) {
    var cam = nativeCamera();
    if (cam) {
      return cam.getPhoto({
        quality: 88, resultType: 'dataUrl', source: 'PROMPT', width: 2200, correctOrientation: true,
        promptLabelHeader: 'Page photo', promptLabelPhoto: 'Choose from gallery', promptLabelPicture: 'Take a photo'
      }).then(function (photo) { return (photo && photo.dataUrl) || null; })
        .catch(function (e) {
          var msg = String((e && e.message) || e || '').toLowerCase();
          if (msg.indexOf('cancel') >= 0) return null;
          throw e;
        });
    }
    return new Promise(function (resolve) {
      fallbackInput.onchange = function () {
        var f = fallbackInput.files && fallbackInput.files[0];
        fallbackInput.value = '';
        resolve(f ? URL.createObjectURL(f) : null);
      };
      fallbackInput.click();
    });
  }

  // Shrinks big photos and boosts contrast so the words are easier to read.
  function prepareImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 2000, scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        var g = c.getContext('2d');
        g.filter = 'grayscale(1) contrast(1.35)';
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c);
      };
      img.onerror = function () { reject(new Error('bad-image')); };
      img.src = url;
    });
  }

  // ---------- Reading the words ----------
  function read(url, langCode, onProgress) {
    var T = window.Tesseract;
    var code = CODES[langCode];
    if (!T || !code) return Promise.reject(new Error('no-reader'));
    var opts = {
      workerPath: abs('vendor/tess/worker.min.js'),
      corePath: abs('vendor/tess/core/'),
      logger: function (m) {
        if (!onProgress || !m) return;
        if (m.status === 'recognizing text') onProgress('read', m.progress || 0);
        else if (/traineddata/.test(m.status || '')) onProgress('pack', m.progress || 0);
        else onProgress('start', 0);
      }
    };
    if (window.OCR_LANG_PATH) opts.langPath = window.OCR_LANG_PATH;
    else if (code === 'eng') opts.langPath = abs('vendor/tess/lang');

    var worker = null;
    return prepareImage(url).then(function (canvas) {
      return T.createWorker(code, 1, opts).then(function (w) {
        worker = w;
        return w.recognize(canvas);
      });
    }).then(function (res) {
      var text = (res && res.data && res.data.text) || '';
      if (worker) worker.terminate();
      return text;
    }, function (err) {
      if (worker) worker.terminate();
      throw err;
    });
  }

  window.Ocr = {
    supports: function (langCode) { return !!CODES[langCode]; },
    takePhoto: takePhoto,
    read: read
  };
})();
