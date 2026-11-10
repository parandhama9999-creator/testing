/* Voice, on-device translation and keep-screen-on.
   On Android these use the phone's own free services through Capacitor plugins.
   In a desktop browser they fall back to the browser voice (for testing). */
(function () {
  'use strict';

  var cap = window.Capacitor;
  var isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

  function plugin(name) {
    if (!isNative) return null;
    try {
      if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
      return cap.registerPlugin ? cap.registerPlugin(name) : null;
    } catch (e) {
      return null;
    }
  }

  var tts = plugin('TextToSpeech');
  var mlkit = plugin('Translation');
  var awake = plugin('KeepAwake');

  // ---------- Voice ----------
  var speakToken = 0;
  var wordCallback = null;
  var fallbackTimer = null;

  if (tts && tts.addListener) {
    try {
      tts.addListener('onRangeStart', function (info) {
        if (wordCallback && info) wordCallback(info.start, info.end);
      });
    } catch (e) { /* word highlighting is optional */ }
  }

  function timedCaption(text, rate, onWord, token) {
    // No voice available: move the highlight at reading speed so the scene still plays.
    return new Promise(function (resolve) {
      var re = /\S+/g, words = [], m;
      while ((m = re.exec(text))) words.push([m.index, m.index + m[0].length]);
      var i = 0;
      (function step() {
        if (token !== speakToken) return resolve(false);
        if (i >= words.length) return resolve(true);
        var w = words[i++];
        if (onWord) onWord(w[0], w[1]);
        fallbackTimer = setTimeout(step, Math.max(260, (w[1] - w[0]) * 75) / rate);
      })();
    });
  }

  function hasVoice(langCode) {
    var tag = window.Lang.tts(langCode);
    if (tts) {
      return tts.isLanguageSupported({ lang: tag }).then(function (r) {
        return !!(r && r.supported);
      }).catch(function () { return false; });
    }
    if (window.speechSynthesis) {
      var voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) return Promise.resolve(true); // list not loaded yet, try anyway
      var short = tag.split('-')[0];
      return Promise.resolve(voices.some(function (v) { return v.lang && v.lang.toLowerCase().indexOf(short) === 0; }));
    }
    return Promise.resolve(false);
  }

  // Resolves true when the text was fully spoken, false when it was interrupted.
  function speak(text, langCode, rate, onWord, useVoice) {
    stop();
    var token = ++speakToken;
    wordCallback = onWord || null;
    var tag = window.Lang.tts(langCode);

    if (!useVoice) return timedCaption(text, rate, onWord, token);

    if (tts) {
      return tts.speak({ text: text, lang: tag, rate: rate, pitch: 1.1, volume: 1.0 })
        .then(function () { return token === speakToken; })
        .catch(function () {
          if (token !== speakToken) return false;
          return timedCaption(text, rate, onWord, token);
        });
    }

    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      return new Promise(function (resolve) {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = tag;
        u.rate = rate;
        u.pitch = 1.1;
        var started = false;
        u.onstart = function () { started = true; };
        u.onboundary = function (e) {
          if (token !== speakToken || !onWord) return;
          var end = text.indexOf(' ', e.charIndex);
          onWord(e.charIndex, end < 0 ? text.length : end);
        };
        u.onend = function () { resolve(token === speakToken); };
        u.onerror = function () {
          if (token !== speakToken) return resolve(false);
          started = true; // handled here, so the timer below must not act
          timedCaption(text, rate, onWord, token).then(resolve);
        };
        window.speechSynthesis.speak(u);
        // Some browsers never start speaking; fall back to timed captions.
        setTimeout(function () {
          if (!started && token === speakToken) {
            started = true;
            u.onend = u.onerror = null;
            window.speechSynthesis.cancel();
            timedCaption(text, rate, onWord, token).then(resolve);
          }
        }, 2500);
      });
    }

    return timedCaption(text, rate, onWord, token);
  }

  function stop() {
    speakToken++;
    wordCallback = null;
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    if (tts) { try { tts.stop().catch(function () {}); } catch (e) { /* nothing playing */ } }
    else if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* nothing playing */ } }
  }

  function installVoices() {
    if (tts && tts.openInstall) return tts.openInstall().catch(function () {});
    return Promise.resolve();
  }

  // ---------- Translation ----------
  var cache = {};
  var readyModels = {};

  function translate(text, from, to) {
    if (from === to) return Promise.resolve(text);
    if (!mlkit) return Promise.reject(new Error('no-translator'));
    var key = from + '>' + to + '>' + text;
    if (cache[key]) return Promise.resolve(cache[key]);
    return mlkit.translate({ text: text, sourceLanguage: from, targetLanguage: to }).then(function (r) {
      var out = (r && r.text) || text;
      cache[key] = out;
      return out;
    });
  }

  // Downloads the language packs (about 30 MB each, one time) before the story starts.
  function prepareLanguages(codes) {
    if (!mlkit) return Promise.reject(new Error('no-translator'));
    var chain = Promise.resolve();
    codes.forEach(function (code) {
      if (code === 'en' || readyModels[code]) return;
      chain = chain.then(function () {
        return mlkit.downloadModel({ language: code }).then(function () { readyModels[code] = 1; });
      });
    });
    return chain;
  }

  // ---------- Screen ----------
  function keepAwake(on) {
    if (!awake) return;
    try {
      (on ? awake.keepAwake() : awake.allowSleep()).catch(function () {});
    } catch (e) { /* optional */ }
  }

  window.Native = {
    isNative: isNative,
    canTranslate: !!mlkit,
    speak: speak,
    stop: stop,
    hasVoice: hasVoice,
    installVoices: installVoices,
    translate: translate,
    prepareLanguages: prepareLanguages,
    keepAwake: keepAwake
  };
})();
