/* Screens and the story player. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var Lang = window.Lang, Story = window.Story, Native = window.Native;

  var PIP_SVG =
    '<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="60" cy="124" rx="34" ry="5" fill="rgba(0,0,0,.18)"/>' +
    '<g class="pip-body">' +
    '<path class="pip-wing-l" d="M30 70 Q6 74 12 98 Q24 96 34 86 Z" fill="#ff8f3f" stroke="#1b1464" stroke-width="4" stroke-linejoin="round"/>' +
    '<path class="pip-wing-r" d="M90 70 Q114 74 108 98 Q96 96 86 86 Z" fill="#ff8f3f" stroke="#1b1464" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M24 34 L34 10 L50 26 Z M96 34 L86 10 L70 26 Z" fill="#ff8f3f" stroke="#1b1464" stroke-width="4" stroke-linejoin="round"/>' +
    '<ellipse cx="60" cy="72" rx="42" ry="48" fill="#ffb347" stroke="#1b1464" stroke-width="4"/>' +
    '<ellipse cx="60" cy="90" rx="24" ry="24" fill="#fff3d6"/>' +
    '<circle cx="42" cy="56" r="16" fill="#fff" stroke="#1b1464" stroke-width="4"/>' +
    '<circle cx="78" cy="56" r="16" fill="#fff" stroke="#1b1464" stroke-width="4"/>' +
    '<circle class="pip-eye" cx="44" cy="58" r="7" fill="#1b1464"/>' +
    '<circle class="pip-eye" cx="76" cy="58" r="7" fill="#1b1464"/>' +
    '<circle cx="46.5" cy="55.5" r="2.2" fill="#fff"/><circle cx="78.5" cy="55.5" r="2.2" fill="#fff"/>' +
    '<path class="mouth-shut" d="M52 76 L60 84 L68 76 Z" fill="#ff6b6b" stroke="#1b1464" stroke-width="3.5" stroke-linejoin="round"/>' +
    '<path class="mouth-open" d="M50 74 L60 92 L70 74 Z" fill="#ff6b6b" stroke="#1b1464" stroke-width="3.5" stroke-linejoin="round"/>' +
    '<path d="M46 118 l-6 6 M50 118 l0 7 M70 118 l0 7 M74 118 l6 6" stroke="#1b1464" stroke-width="4" stroke-linecap="round"/>' +
    '</g></svg>';

  var RTL = { ar: 1, ur: 1, fa: 1, he: 1 };
  var DEFAULT_THEMES = ['day', 'forest', 'home', 'sand'];

  var st = {
    scenes: [], prepared: [], idx: 0, token: 0,
    playing: false, ended: false,
    src: 'en', tgt: 'en', voice: true, picsReady: false,
    rate: 1, theme: 'day', title: ''
  };

  // ---------- helpers ----------
  function show(id) {
    ['home', 'loading', 'player'].forEach(function (s) {
      $(s).classList.toggle('is-active', s === id);
    });
  }
  function loadStep(text, pct) {
    $('loadText').textContent = text;
    if (pct != null) $('loadBar').style.width = Math.max(5, Math.min(100, pct)) + '%';
  }
  function homeMsg(text) { $('homeMsg').textContent = text || ''; }

  var toastTimer = null;
  function toast(text, btnLabel, btnAction, ms) {
    $('toastText').textContent = text;
    var b = $('toastBtn');
    if (btnLabel) {
      b.textContent = btnLabel; b.hidden = false;
      b.onclick = function () { hideToast(); btnAction(); };
    } else { b.hidden = true; b.onclick = null; }
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 7000);
  }
  function hideToast() { $('toast').hidden = true; }

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { /* storage is only a convenience */ }
    return null;
  }

  // ---------- home ----------
  function fillLanguages() {
    var sel = $('langSelect');
    var auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = 'Same as the PDF (auto)';
    sel.appendChild(auto);
    Lang.LIST.forEach(function (l) {
      if (!l.translate) return;
      var o = document.createElement('option');
      o.value = l.code;
      o.textContent = Lang.label(l.code);
      sel.appendChild(o);
    });
    var saved = store('pdfkids.lang');
    if (saved && (saved === 'auto' || Lang.get(saved))) sel.value = saved;
    sel.addEventListener('change', function () { store('pdfkids.lang', sel.value); });
  }

  function onFile(file) {
    if (!file) return;
    homeMsg('');
    show('loading');
    loadStep('Opening your PDF…', 5);
    var reader = new FileReader();
    reader.onerror = function () { fail('Could not open that file. Please try another PDF.'); };
    reader.onload = function () {
      Story.readPdf(reader.result, function (n, total) {
        loadStep('Reading page ' + n + ' of ' + total + '…', 5 + 55 * n / total);
      }).then(function (res) {
        if (Story.countLetters(res.text) < 20) {
          return fail('This PDF has no text that can be read. It may be scanned pictures of pages, which are not supported yet.');
        }
        var title = (file.name || 'My story').replace(/\.pdf$/i, '');
        var note = res.pages > res.pagesRead ? 'Long PDF: the story uses the first ' + res.pagesRead + ' pages.' : '';
        return begin(res.text, title, note);
      }).catch(function () {
        fail('Could not read this PDF. If it has a password, remove it and try again.');
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function fail(text) {
    show('home');
    homeMsg(text);
  }

  // ---------- getting the story ready ----------
  function begin(text, title, note) {
    var scenes = Story.buildScenes(text);
    if (!scenes.length) return fail('No sentences were found in this PDF.');

    var src = Lang.detect(text);
    var choice = $('langSelect').value;
    var tgt = choice === 'auto' ? src : choice;
    var notes = note ? [note] : [];
    var ready = Promise.resolve();

    if (tgt !== src) {
      if (!Native.canTranslate) {
        notes.push('Translation works in the installed Android app. Playing in ' + Lang.name(src) + '.');
        tgt = src;
      } else if (!Lang.canTranslate(src)) {
        notes.push(Lang.name(src) + ' cannot be translated on this phone yet. Playing in ' + Lang.name(src) + '.');
        tgt = src;
      } else {
        loadStep('Getting the ' + Lang.name(tgt) + ' language pack. This happens once and needs internet…', 70);
        var wanted = tgt;
        ready = Native.prepareLanguages([src, wanted]).catch(function () {
          notes.push('The language pack could not be downloaded. Check the internet and try again. Playing in ' + Lang.name(src) + '.');
          tgt = src;
        });
      }
    }

    return ready.then(function () {
      loadStep('Finding a voice…', 90);
      return Native.hasVoice(tgt);
    }).then(function (voice) {
      st.scenes = scenes;
      st.prepared = [];
      st.src = src; st.tgt = tgt; st.voice = voice;
      st.title = title; st.theme = 'day';
      st.ended = false;
      st.picsReady = src === 'en' || tgt === 'en';

      // Pictures are chosen from English keywords. For other languages the
      // English pack is fetched quietly; until then scenes use general pictures.
      if (!st.picsReady && Native.canTranslate && Lang.canTranslate(src)) {
        Native.prepareLanguages([src]).then(function () {
          st.picsReady = true;
          for (var i = st.idx + 1; i < st.prepared.length; i++) st.prepared[i] = null;
        }).catch(function () { /* general pictures stay */ });
      }

      $('storyTitle').textContent = title;
      $('caption').dir = RTL[tgt] ? 'rtl' : 'ltr';
      $('caption').lang = tgt;
      show('player');
      Native.keepAwake(true);

      if (!voice) {
        notes.push('No ' + Lang.name(tgt) + ' voice is installed on this phone, so the story plays with words only.');
        toast(notes.join(' '), Native.isNative ? 'Get voice' : null, Native.installVoices, 12000);
      } else if (notes.length) {
        toast(notes.join(' '), null, null, 9000);
      }
      st.playing = true;
      updatePlayBtn();
      play(0);
    });
  }

  // ---------- scenes ----------
  function prepare(i) {
    if (i < 0 || i >= st.scenes.length) return Promise.resolve(null);
    if (st.prepared[i]) return st.prepared[i];
    var text = st.scenes[i].text;
    var src = st.src, tgt = st.tgt, picsReady = st.picsReady;

    var caption = tgt === src ? Promise.resolve(text)
      : Native.translate(text, src, tgt).catch(function () { return text; });

    st.prepared[i] = caption.then(function (cap) {
      var english;
      if (src === 'en') english = Promise.resolve(text);
      else if (tgt === 'en') english = Promise.resolve(cap);
      else if (picsReady) english = Native.translate(text, src, 'en').catch(function () { return null; });
      else english = Promise.resolve(null);
      return english.then(function (en) {
        var pics = Story.pickPictures(en, i);
        return { caption: cap, emojis: pics.emojis, theme: pics.theme };
      });
    });
    return st.prepared[i];
  }

  function render(scene, i) {
    var stage = $('stage');
    var theme = scene.theme || (i === 0 ? 'day' : st.theme) || DEFAULT_THEMES[i % DEFAULT_THEMES.length];
    st.theme = theme;
    stage.className = 'stage theme-' + theme;

    var props = $('props');
    props.className = 'props n' + scene.emojis.length;
    props.innerHTML = '';
    scene.emojis.forEach(function (e) {
      var s = document.createElement('span');
      s.className = 'prop';
      s.textContent = e;
      props.appendChild(s);
    });

    var cap = $('caption');
    cap.innerHTML = '';
    var re = /\S+|\s+/g, m;
    while ((m = re.exec(scene.caption))) {
      if (/^\s+$/.test(m[0])) { cap.appendChild(document.createTextNode(' ')); continue; }
      var w = document.createElement('span');
      w.className = 'w';
      w.textContent = m[0];
      w.setAttribute('data-s', m.index);
      w.setAttribute('data-e', m.index + m[0].length);
      cap.appendChild(w);
    }
    cap.parentNode.scrollTop = 0;

    $('storyMeta').textContent = Lang.name(st.tgt) + ' · ' + (i + 1) + ' of ' + st.scenes.length;
    $('progFill').style.width = (100 * (i + 1) / st.scenes.length) + '%';
  }

  var lastOn = null;
  function highlight(start) {
    var words = $('caption').children;
    for (var k = 0; k < words.length; k++) {
      var s = +words[k].getAttribute('data-s'), e = +words[k].getAttribute('data-e');
      if (start >= s && start < e) {
        if (lastOn && lastOn !== words[k]) lastOn.classList.remove('on');
        words[k].classList.add('on');
        lastOn = words[k];
        if (words[k].scrollIntoView) words[k].scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  }
  function clearHighlight() {
    if (lastOn) lastOn.classList.remove('on');
    lastOn = null;
  }

  function talking(on) { $('pip').classList.toggle('talking', !!on); }

  function play(i) {
    if (i < 0) i = 0;
    if (i >= st.scenes.length) return finish();
    var token = ++st.token;
    st.idx = i;
    st.ended = false;
    $('endCard').hidden = true;
    Native.stop();
    talking(false);
    clearHighlight();

    var busyTimer = setTimeout(function () { if (token === st.token) $('busy').hidden = false; }, 350);
    prepare(i).then(function (scene) {
      clearTimeout(busyTimer);
      if (token !== st.token || !scene) return;
      $('busy').hidden = true;
      render(scene, i);
      prepare(i + 1); prepare(i + 2);
      if (!st.playing) return;
      talking(true);
      Native.speak(scene.caption, st.tgt, st.rate, highlight, st.voice).then(function (done) {
        if (token !== st.token) return;
        talking(false);
        clearHighlight();
        if (!done || !st.playing) return;
        setTimeout(function () {
          if (token === st.token && st.playing) play(i + 1);
        }, 650);
      });
    });
  }

  function finish() {
    st.token++;
    st.playing = false;
    st.ended = true;
    Native.stop();
    talking(false);
    clearHighlight();
    updatePlayBtn();
    $('endCard').hidden = false;
    Native.keepAwake(false);
  }

  function pause() {
    st.playing = false;
    st.token++;
    Native.stop();
    talking(false);
    clearHighlight();
    updatePlayBtn();
    Native.keepAwake(false);
  }

  function resume() {
    st.playing = true;
    updatePlayBtn();
    Native.keepAwake(true);
    play(st.ended ? 0 : st.idx);
  }

  function updatePlayBtn() {
    var b = $('playBtn');
    b.textContent = st.playing ? '⏸' : '▶';
    b.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
  }

  // ---------- wiring ----------
  function init() {
    var pips = document.querySelectorAll('.pip-wrap');
    for (var i = 0; i < pips.length; i++) pips[i].innerHTML = PIP_SVG;
    fillLanguages();

    $('pickBtn').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      onFile(f);
    });
    $('sampleBtn').addEventListener('click', function () {
      homeMsg('');
      show('loading');
      loadStep('Getting the story ready…', 60);
      begin(Story.SAMPLE, 'The Little Drop of Water', '');
    });

    $('playBtn').addEventListener('click', function () { if (st.playing) pause(); else resume(); });
    $('prevBtn').addEventListener('click', function () { play(st.idx - 1); });
    $('nextBtn').addEventListener('click', function () {
      if (st.idx + 1 >= st.scenes.length) finish(); else play(st.idx + 1);
    });
    $('againBtn').addEventListener('click', function () { st.ended = true; resume(); });
    $('speedBtn').addEventListener('click', function () {
      st.rate = st.rate === 1 ? 0.75 : 1;
      $('speedBtn').textContent = st.rate === 1 ? '🐇' : '🐢';
      toast(st.rate === 1 ? 'Normal reading speed' : 'Slow reading speed', null, null, 1800);
      if (st.playing) play(st.idx);
    });
    $('backBtn').addEventListener('click', function () {
      pause();
      hideToast();
      show('home');
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && st.playing) pause();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.PdfKids = { state: st, begin: begin, onFile: onFile };
})();
