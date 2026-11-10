/* Reads the PDF, cuts the text into short scenes and picks pictures for each scene. */
(function () {
  'use strict';

  var MAX_PAGES = 40;
  var MAX_SCENES = 200;
  var MAX_SCENE_CHARS = 170;

  // ---------- PDF text ----------
  function readPdf(arrayBuffer, onProgress) {
    var lib = window.pdfjsLib;
    if (!lib) return Promise.reject(new Error('PDF reader did not load.'));
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    return lib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'vendor/cmaps/',
      cMapPacked: true
    }).promise.then(function (doc) {
      var total = Math.min(doc.numPages, MAX_PAGES);
      var parts = [];
      var chain = Promise.resolve();
      for (var p = 1; p <= total; p++) {
        (function (n) {
          chain = chain.then(function () {
            return doc.getPage(n).then(function (page) {
              return page.getTextContent();
            }).then(function (tc) {
              var out = '';
              tc.items.forEach(function (it) {
                out += it.str || '';
                if (it.hasEOL) out += '\n';
              });
              parts.push(out);
              if (onProgress) onProgress(n, total);
            });
          });
        })(p);
      }
      return chain.then(function () {
        return { text: parts.join('\n\n'), pages: doc.numPages, pagesRead: total };
      });
    });
  }

  // ---------- Text → scenes ----------
  var ENDERS = '.!?।॥。！？۔…';
  var NO_SPACE_ENDERS = '।॥。！？';
  var ABBREV = { mr: 1, mrs: 1, ms: 1, dr: 1, st: 1, vs: 1, eg: 1, ie: 1, no: 1, fig: 1, etc: 1 };

  function tidy(raw) {
    var lines = raw.replace(/\r/g, '').replace(/[ \t ]+/g, ' ').split('\n');
    var out = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) { out += '\n'; continue; }
      if (/^[\d\s.\-–|/]+$/.test(line)) continue;               // page numbers
      if (/-$/.test(line) && i + 1 < lines.length && /^[a-zà-ɏ]/.test(lines[i + 1].trim())) {
        out += line.slice(0, -1);                                  // word split across lines
        continue;
      }
      var last = line.charAt(line.length - 1);
      var next = (lines[i + 1] || '').trim();
      var looksLikeHeading = line.length < 45 && ENDERS.indexOf(last) < 0 && /^[A-Z0-9ऀ-෿]/.test(next);
      out += line + (ENDERS.indexOf(last) >= 0 || looksLikeHeading || !next ? '\n' : ' ');
    }
    return out;
  }

  function splitSentences(block) {
    var res = [], cur = '';
    for (var i = 0; i < block.length; i++) {
      var ch = block.charAt(i);
      cur += ch;
      if (ENDERS.indexOf(ch) < 0) continue;
      var nxt = block.charAt(i + 1);
      if (ENDERS.indexOf(nxt) >= 0 || /["'”’)\]]/.test(nxt)) continue; // keep "?!" and closing quotes together
      var boundary = !nxt || /\s/.test(nxt) || NO_SPACE_ENDERS.indexOf(ch) >= 0;
      if (!boundary) continue;
      if (ch === '.') {
        var m = cur.match(/([A-Za-z]+)\.$/);
        if (m && (m[1].length === 1 || ABBREV[m[1].toLowerCase()])) continue;
      }
      res.push(cur.trim());
      cur = '';
    }
    if (cur.trim()) res.push(cur.trim());
    return res;
  }

  function splitLong(s) {
    if (s.length <= MAX_SCENE_CHARS) return [s];
    var mid = s.length / 2, best = -1, bestDist = 1e9;
    for (var i = 20; i < s.length - 20; i++) {
      var ch = s.charAt(i);
      if (',;:،、，；—'.indexOf(ch) >= 0) {
        var d = Math.abs(i - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    }
    if (best < 0) {
      for (var j = Math.floor(mid); j < s.length - 10; j++) {
        if (s.charAt(j) === ' ') { best = j; break; }
      }
    }
    if (best < 0) return [s];
    return splitLong(s.slice(0, best + 1).trim()).concat(splitLong(s.slice(best + 1).trim()));
  }

  function buildScenes(rawText) {
    var blocks = tidy(rawText).split(/\n+/);
    var scenes = [];
    for (var b = 0; b < blocks.length && scenes.length < MAX_SCENES; b++) {
      var block = blocks[b].trim();
      if (!block) continue;
      var sentences = splitSentences(block);
      for (var s = 0; s < sentences.length; s++) {
        var pieces = splitLong(sentences[s]);
        for (var p = 0; p < pieces.length; p++) {
          var t = pieces[p].replace(/\s+/g, ' ').trim();
          if (countLetters(t) < 3) continue;
          scenes.push({ text: t });
          if (scenes.length >= MAX_SCENES) break;
        }
        if (scenes.length >= MAX_SCENES) break;
      }
    }
    return scenes;
  }

  function countLetters(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || c >= 0xC0) n++;
    }
    return n;
  }

  // ---------- Pictures ----------
  // word → [emoji, theme]. Themes: day, night, sea, forest, snow, sand, city, home.
  var PICS = {
    sun: ['☀️', 'day'], sunny: ['☀️', 'day'], sunlight: ['☀️', 'day'], light: ['💡'], day: ['🌤️', 'day'],
    moon: ['🌙', 'night'], night: ['🌙', 'night'], star: ['⭐', 'night'], sky: ['☁️', 'day'],
    cloud: ['☁️', 'day'], rain: ['🌧️', 'day'], rainbow: ['🌈', 'day'], storm: ['⛈️'], thunder: ['⚡'],
    lightning: ['⚡'], wind: ['🌬️'], snow: ['❄️', 'snow'], ice: ['🧊', 'snow'], cold: ['🥶', 'snow'],
    winter: ['⛄', 'snow'], hot: ['🔥'], heat: ['🔥'], fire: ['🔥'], summer: ['🌞', 'day'],
    water: ['💧', 'sea'], drop: ['💧'], river: ['🏞️', 'forest'], lake: ['🏞️', 'forest'], sea: ['🌊', 'sea'],
    ocean: ['🌊', 'sea'], wave: ['🌊', 'sea'], beach: ['🏖️', 'sand'], island: ['🏝️', 'sea'],
    fish: ['🐟', 'sea'], whale: ['🐋', 'sea'], shark: ['🦈', 'sea'], dolphin: ['🐬', 'sea'],
    octopus: ['🐙', 'sea'], crab: ['🦀', 'sand'], turtle: ['🐢', 'sea'], boat: ['⛵', 'sea'], ship: ['🚢', 'sea'],
    earth: ['🌍', 'space'], world: ['🌍'], planet: ['🪐', 'space'], space: ['🚀', 'space'],
    rocket: ['🚀', 'space'], astronaut: ['👩‍🚀', 'space'], galaxy: ['🌌', 'space'], gravity: ['🍎'],
    mountain: ['⛰️', 'forest'], hill: ['⛰️', 'forest'], volcano: ['🌋'], desert: ['🏜️', 'sand'],
    sand: ['🏖️', 'sand'], rock: ['🪨'], stone: ['🪨'], soil: ['🌱', 'forest'], ground: ['🌱'],
    tree: ['🌳', 'forest'], forest: ['🌲', 'forest'], jungle: ['🌴', 'forest'], leaf: ['🍃', 'forest'],
    leave: ['🍃', 'forest'], plant: ['🌱', 'forest'], seed: ['🌱', 'forest'], root: ['🌱', 'forest'],
    flower: ['🌸', 'forest'], rose: ['🌹'], grass: ['🌿', 'forest'], garden: ['🌻', 'forest'],
    farm: ['🚜', 'forest'], farmer: ['👨‍🌾', 'forest'], fruit: ['🍎'], apple: ['🍎'], banana: ['🍌'],
    mango: ['🥭'], orange: ['🍊'], grape: ['🍇'], vegetable: ['🥕'], carrot: ['🥕'], rice: ['🍚'],
    bread: ['🍞'], milk: ['🥛'], egg: ['🥚'], food: ['🍲'], eat: ['🍽️'], cake: ['🎂'], sweet: ['🍬'],
    animal: ['🐾', 'forest'], dog: ['🐶'], puppy: ['🐶'], cat: ['🐱'], kitten: ['🐱'], cow: ['🐄', 'forest'],
    horse: ['🐴'], sheep: ['🐑'], goat: ['🐐'], pig: ['🐷'], hen: ['🐔'], chicken: ['🐔'], duck: ['🦆'],
    bird: ['🐦', 'day'], parrot: ['🦜'], peacock: ['🦚'], eagle: ['🦅', 'day'], owl: ['🦉', 'night'],
    lion: ['🦁', 'forest'], tiger: ['🐯', 'forest'], elephant: ['🐘', 'forest'], monkey: ['🐒', 'forest'],
    bear: ['🐻', 'forest'], fox: ['🦊', 'forest'], wolf: ['🐺', 'forest'], deer: ['🦌', 'forest'],
    rabbit: ['🐰', 'forest'], mouse: ['🐭'], snake: ['🐍'], frog: ['🐸'], crocodile: ['🐊'],
    giraffe: ['🦒'], zebra: ['🦓'], camel: ['🐫', 'sand'], penguin: ['🐧', 'snow'], dinosaur: ['🦕'],
    insect: ['🐞'], bee: ['🐝'], honey: ['🍯'], butterfly: ['🦋', 'forest'], ant: ['🐜'], spider: ['🕷️'],
    boy: ['👦'], girl: ['👧'], child: ['🧒'], children: ['🧒'], kid: ['🧒'], baby: ['👶'],
    mother: ['👩'], mom: ['👩'], father: ['👨'], dad: ['👨'], grandmother: ['👵'], grandfather: ['👴'],
    family: ['👨‍👩‍👧', 'home'], friend: ['🤝'], people: ['🧑‍🤝‍🧑'], king: ['🤴'], queen: ['👸'],
    prince: ['🤴'], princess: ['👸'], teacher: ['👩‍🏫', 'home'], doctor: ['👩‍⚕️'], scientist: ['👩‍🔬'],
    student: ['🧑‍🎓', 'home'], school: ['🏫', 'city'], class: ['🏫'], book: ['📚', 'home'],
    read: ['📖', 'home'], write: ['✏️', 'home'], pencil: ['✏️'], story: ['📖'], learn: ['🧠'],
    brain: ['🧠'], think: ['💭'], idea: ['💡'], question: ['❓'], answer: ['✅'], number: ['🔢'],
    count: ['🔢'], math: ['➕'], add: ['➕'], science: ['🔬'], experiment: ['🧪'], magnet: ['🧲'],
    energy: ['⚡'], electricity: ['⚡'], battery: ['🔋'], computer: ['💻'], robot: ['🤖'], phone: ['📱'],
    house: ['🏠', 'home'], home: ['🏠', 'home'], door: ['🚪'], room: ['🛋️', 'home'], bed: ['🛏️', 'home'],
    sleep: ['😴', 'night'], dream: ['💭', 'night'], city: ['🏙️', 'city'], town: ['🏘️', 'city'],
    village: ['🏡', 'forest'], road: ['🛣️', 'city'], bridge: ['🌉', 'city'], shop: ['🏪', 'city'],
    market: ['🛒', 'city'], hospital: ['🏥', 'city'], temple: ['🛕'], castle: ['🏰'],
    car: ['🚗', 'city'], bus: ['🚌', 'city'], train: ['🚆', 'city'], bicycle: ['🚲'], bike: ['🚲'],
    plane: ['✈️', 'day'], airplane: ['✈️', 'day'], fly: ['🕊️', 'day'], wheel: ['🛞'],
    heart: ['❤️'], love: ['❤️'], happy: ['😊'], smile: ['😊'], laugh: ['😄'], sad: ['😢'], cry: ['😢'],
    angry: ['😠'], afraid: ['😨'], scared: ['😨'], brave: ['🦸'], strong: ['💪'], help: ['🤝'],
    play: ['⚽'], game: ['🎮'], ball: ['⚽'], run: ['🏃'], jump: ['🤸'], swim: ['🏊', 'sea'],
    dance: ['💃'], sing: ['🎤'], song: ['🎵'], music: ['🎶'], drum: ['🥁'], paint: ['🎨'],
    color: ['🎨'], colour: ['🎨'], picture: ['🖼️'], gift: ['🎁'], birthday: ['🎂'], party: ['🎉'],
    money: ['💰'], gold: ['🥇'], treasure: ['💎'], key: ['🔑'], clock: ['⏰'], time: ['⏰'],
    year: ['📅'], today: ['📅'], morning: ['🌅', 'day'], evening: ['🌇'], eye: ['👀'], see: ['👀'],
    look: ['👀'], hear: ['👂'], ear: ['👂'], hand: ['✋'], foot: ['🦶'], tooth: ['🦷'], teeth: ['🦷'],
    body: ['🧍'], bone: ['🦴'], blood: ['🩸'], air: ['🌬️', 'day'], breathe: ['🫁'], lung: ['🫁'],
    oxygen: ['🫧'], gas: ['🫧'], vapor: ['♨️'], vapour: ['♨️'], steam: ['♨️'], clean: ['🧼'],
    wash: ['🧼'], germ: ['🦠'], sick: ['🤒'], medicine: ['💊'],
    magic: ['🪄'], secret: ['🤫'], win: ['🏆'],
    india: ['🇮🇳'], flag: ['🚩'], map: ['🗺️'], travel: ['🧳'], journey: ['🧭'], grow: ['🌱', 'forest']
  };
  var FALLBACK = ['✨', '📖', '💡', '🌈', '⭐', '🎈', '🪁', '🧩'];

  // Action words decide how the pictures move.
  var MOTION = {
    fly: 'fly', flew: 'fly', flying: 'fly', bird: 'fly', plane: 'fly', airplane: 'fly', wind: 'fly', butterfly: 'fly', bee: 'fly', eagle: 'fly',
    fall: 'drop', fell: 'drop', rain: 'drop', down: 'drop',
    grow: 'grow', grew: 'grow', seed: 'grow', plant: 'grow', tree: 'grow', flower: 'grow',
    run: 'parade', ran: 'parade', walk: 'parade', walked: 'parade', went: 'parade', go: 'parade', march: 'parade', travel: 'parade', bus: 'parade', car: 'parade', train: 'parade',
    around: 'orbit', cycle: 'orbit', earth: 'orbit', planet: 'orbit', moon: 'orbit', turn: 'orbit', orbit: 'orbit',
    up: 'balloon', rise: 'balloon', rose: 'balloon', vapor: 'balloon', vapour: 'balloon', balloon: 'balloon', float: 'balloon',
    hide: 'peek', hid: 'peek', secret: 'peek', look: 'peek', peek: 'peek', find: 'peek', who: 'peek', where: 'peek',
    jump: 'bounce', jumped: 'bounce', play: 'bounce', ball: 'bounce', hop: 'bounce', frog: 'bounce', rabbit: 'bounce',
    dance: 'spin', magic: 'spin', spin: 'spin', wheel: 'spin',
    hang: 'swing', sleep: 'swing', monkey: 'swing', swing: 'swing', night: 'swing',
    big: 'zoom', biggest: 'zoom', huge: 'zoom', giant: 'zoom', important: 'zoom', sun: 'zoom', king: 'zoom', called: 'zoom'
  };
  var FX = {
    rain: 'rain', storm: 'rain', snow: 'snow', winter: 'snow', ice: 'snow',
    love: 'hearts', heart: 'hearts', mother: 'hearts', family: 'hearts', friend: 'hearts',
    party: 'confetti', birthday: 'confetti', win: 'confetti', won: 'confetti', celebrate: 'confetti', festival: 'confetti',
    magic: 'sparkle', shine: 'sparkle', bright: 'sparkle', gold: 'sparkle', treasure: 'sparkle', wonderful: 'sparkle', star: 'sparkle',
    leaf: 'leaves', autumn: 'leaves', wind: 'leaves', bubble: 'bubbles', swim: 'bubbles'
  };
  var MOOD = {
    happy: 'happy', love: 'happy', smile: 'happy', laugh: 'happy', friend: 'happy', fun: 'happy', joy: 'happy',
    sad: 'sad', cry: 'sad', cried: 'sad', alone: 'sad', lost: 'sad', hurt: 'sad',
    idea: 'idea', learn: 'idea', know: 'idea', because: 'idea', why: 'idea', think: 'idea', called: 'idea'
  };

  function stem(word, table) {
    if (table[word]) return table[word];
    if (word.length > 3 && word.slice(-3) === 'ies' && table[word.slice(0, -3) + 'y']) return table[word.slice(0, -3) + 'y'];
    if (word.length > 3 && word.slice(-2) === 'es' && table[word.slice(0, -2)]) return table[word.slice(0, -2)];
    if (word.length > 2 && word.slice(-1) === 's' && table[word.slice(0, -1)]) return table[word.slice(0, -1)];
    if (word.length > 4 && word.slice(-3) === 'ing' && table[word.slice(0, -3)]) return table[word.slice(0, -3)];
    if (word.length > 3 && word.slice(-2) === 'ed' && table[word.slice(0, -2)]) return table[word.slice(0, -2)];
    return null;
  }

  // englishText may be null when no English version of the scene is available.
  // caption is the text shown on screen (any language); its punctuation sets the mood.
  function pickPictures(englishText, index, caption) {
    var out = { emojis: [], theme: null, motion: null, fx: null, mood: null, plural: false };
    if (englishText) {
      var words = englishText.toLowerCase().split(/[^a-z]+/);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (!w) continue;
        if (out.emojis.length < 3) {
          var hit = stem(w, PICS);
          if (hit && out.emojis.indexOf(hit[0]) < 0) {
            out.emojis.push(hit[0]);
            if (!out.theme && hit[1]) out.theme = hit[1];
            if (out.emojis.length === 1) out.plural = !PICS[w] && /s$/.test(w);
          }
        }
        if (!out.motion) out.motion = stem(w, MOTION);
        if (!out.fx) out.fx = stem(w, FX);
        if (!out.mood) out.mood = stem(w, MOOD);
      }
      if (/\b(many|lots|all|some|two|three|four|five)\b/.test(englishText.toLowerCase())) out.plural = true;
    }
    var shown = caption || englishText || '';
    if (/[?？؟]/.test(shown)) out.mood = 'ask';
    else if (/[!！]/.test(shown) && !out.mood) out.mood = 'wow';
    if (!out.emojis.length) out.emojis.push(FALLBACK[index % FALLBACK.length]);
    return out;
  }

  var SAMPLE = [
    'This is the story of a tiny drop of water.',
    'The drop lived in a big blue sea with many fish.',
    'One morning the hot sun warmed the water.',
    'The little drop turned into vapor and went up, up into the sky!',
    'High in the cold air, many drops joined to make a fluffy cloud.',
    'The wind pushed the cloud over a green mountain.',
    'The cloud grew heavy, and the drops fell down as rain.',
    'The rain helped a small seed grow into a tall tree.',
    'Then the water ran into a river and went back to the sea.',
    'This journey is called the water cycle, and it never stops!'
  ].join(' ');

  window.Story = {
    readPdf: readPdf,
    buildScenes: buildScenes,
    pickPictures: pickPictures,
    countLetters: countLetters,
    SAMPLE: SAMPLE,
    MAX_PAGES: MAX_PAGES
  };
})();
