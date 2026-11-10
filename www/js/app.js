/* Screens and the story player. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var Lang = window.Lang, Story = window.Story, Native = window.Native, Stage = window.Stage, Ocr = window.Ocr;

  var RTL = { ar: 1, ur: 1, fa: 1, he: 1 };

  var st = {
    scenes: [], prepared: [], idx: 0, token: 0,
    playing: false, ended: false,
    src: 'en', tgt: 'en', voice: true, picsReady: false,
    rate: 1, title: '', first: true
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
    auto.textContent = 'Same as the original (auto)';
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

  function fillHeroes() {
    var box = $('heroPicker');
    var saved = store('pdfkids.hero');
    if (!Stage.CHARACTERS[saved]) saved = 'owl';
    function choose(id) {
      Stage.setCharacter(id);
      $('loadHero').innerHTML = Stage.characterSvg(id);
      store('pdfkids.hero', id);
      var all = box.children;
      for (var k = 0; k < all.length; k++) {
        var on = all[k].getAttribute('data-id') === id;
        all[k].classList.toggle('is-on', on);
        all[k].setAttribute('aria-checked', on ? 'true' : 'false');
      }
    }
    Object.keys(Stage.CHARACTERS).forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero-pick';
      b.setAttribute('role', 'radio');
      b.setAttribute('data-id', id);
      b.innerHTML = Stage.characterSvg(id) + '<span></span>';
      b.lastChild.textContent = Stage.CHARACTERS[id].name;
      b.addEventListener('click', function () { choose(id); });
      box.appendChild(b);
    });
    choose(saved);
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

  // ---------- camera ----------
  function fillPageLanguages() {
    var sel = $('pageLang');
    Lang.LIST.forEach(function (l) {
      if (!Ocr.supports(l.code)) return;
      var o = document.createElement('option');
      o.value = l.code;
      o.textContent = Lang.label(l.code);
      sel.appendChild(o);
    });
    var saved = store('pdfkids.pageLang');
    if (saved && Lang.get(saved)) sel.value = saved;
  }

  function scanPage() {
    var lang = $('pageLang').value;
    store('pdfkids.pageLang', lang);
    $('camSheet').hidden = true;
    homeMsg('');
    Ocr.takePhoto($('photoInput')).then(function (url) {
      if (!url) return;
      show('loading');
      loadStep('Looking at your page…', 8);
      return Ocr.read(url, lang, function (stage, p) {
        if (stage === 'pack') loadStep('Getting the ' + Lang.name(lang) + ' reading pack (one time, needs internet)…', 10 + 20 * p);
        else if (stage === 'read') loadStep('Reading the words on the page…', 30 + 60 * p);
      }).then(function (text) {
        if (Story.countLetters(text) < 12) {
          return fail('No words could be read from that photo. Try brighter light, hold the phone flat and fill the screen with the page.');
        }
        return begin(text, 'My book page', '', lang);
      });
    }).catch(function () {
      fail('The page could not be read. For languages other than English the first scan needs internet. Please try again.');
    });
  }

  function fail(text) {
    show('home');
    homeMsg(text);
  }

  // ---------- getting the story ready ----------
  // knownLang is set when the language is already known (camera pages).
  function begin(text, title, note, knownLang) {
    var scenes = Story.buildScenes(text);
    if (!scenes.length) return fail('No sentences were found in this PDF.');

    var src = knownLang || Lang.detect(text);
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
        loadStep('Downloading the ' + Lang.name(tgt) + ' language pack (about 30 MB, one time only). Please wait…', 70);
        var wanted = tgt;
        var skip = $('skipBtn');
        $('loadBar').parentNode.classList.add('is-busy');
        skip.hidden = false;
        var skipped = new Promise(function (resolve) {
          skip.onclick = function () { resolve('skip'); };
          // Slow or stuck connection: stop waiting after 4 minutes.
          setTimeout(function () { resolve('slow'); }, 240000);
        });
        ready = Promise.race([
          Native.prepareLanguages([src, wanted]).then(function () { return 'ok'; }, function () { return 'fail'; }),
          skipped
        ]).then(function (how) {
          skip.hidden = true;
          skip.onclick = null;
          $('loadBar').parentNode.classList.remove('is-busy');
          if (how === 'ok') return;
          if (how === 'fail') notes.push('The language pack could not be downloaded. Check the internet and try again.');
          if (how === 'slow') notes.push('The language pack is taking too long. It keeps downloading, so try again in a few minutes.');
          notes.push('Playing in ' + Lang.name(src) + '.');
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
      st.title = title; st.first = true;
      st.idx = 0;
      st.ended = false;
      st.picsReady = src === 'en' || tgt === 'en';

      // Pictures are chosen from English keywords. For other languages the
      // English pack is fetched quietly; until then scenes use general pictures.
      var net = navigator.connection && navigator.connection.type;
      var onMobileData = net === 'cellular';
      if (!st.picsReady && Native.canTranslate && Lang.canTranslate(src) && (!onMobileData || tgt !== src)) {
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
      $('caption').innerHTML = '';
      $('endCard').hidden = true;
      $('storyMeta').textContent = Lang.name(tgt);
      $('progFill').style.width = '0';
      var token = ++st.token;
      return Stage.title(title).then(function () {
        if (token === st.token) play(0);
      });
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
        var scene = Story.pickPictures(en, i, cap);
        scene.caption = cap;
        return scene;
      });
    });
    return st.prepared[i];
  }

  function render(scene, i) {
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

  function talking(on) { Stage.talk(on); }

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
      prepare(i + 1); prepare(i + 2);
      var first = st.first;
      st.first = false;
      return Stage.show(scene, i, first).then(function () {
        if (token !== st.token) return;
        render(scene, i);
        if (!st.playing) return;
        return new Promise(function (r) { setTimeout(r, 450); }).then(function () {
          if (token !== st.token || !st.playing) return;
          speakScene(scene, i, token);
        });
      });
    });
  }

  function speakScene(scene, i, token) {
    talking(true);
    Native.speak(scene.caption, st.tgt, st.rate, highlight, st.voice).then(function (done) {
      if (token !== st.token) return;
      talking(false);
      clearHighlight();
      if (!done || !st.playing) return;
      setTimeout(function () {
        if (token === st.token && st.playing) play(i + 1);
      }, 900);
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
    Stage.celebrate();
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
    Stage.init();
    fillHeroes();
    fillLanguages();
    fillPageLanguages();

    $('pickBtn').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      onFile(f);
    });
    $('camBtn').addEventListener('click', function () { $('camSheet').hidden = false; });
    $('camCancel').addEventListener('click', function () { $('camSheet').hidden = true; });
    $('camSheet').addEventListener('click', function (e) { if (e.target === $('camSheet')) $('camSheet').hidden = true; });
    $('camGo').addEventListener('click', scanPage);
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
      Stage.stopFx();
      show('home');
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && st.playing) pause();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.PdfKids = { state: st, begin: begin, onFile: onFile, scanPage: scanPage };
})();
