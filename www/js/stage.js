/* The animated stage: illustrated backgrounds, storyteller characters,
   scene choreography, weather effects, transitions, tap tricks and sounds. */
(function () {
  'use strict';

  var INK = '#1b1464';
  var S = 'stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

  // ---------- Storytellers ----------
  var SHADOW = '<ellipse cx="60" cy="124" rx="34" ry="5" fill="rgba(0,0,0,.2)"/>';
  var CHARACTERS = {
    owl: {
      name: 'Pip',
      svg: SHADOW + '<g class="c-body">' +
        '<path class="c-arm-l" d="M30 70 Q6 74 12 98 Q24 96 34 86 Z" fill="#ff8f3f" ' + S + '/>' +
        '<path class="c-arm-r" d="M90 70 Q114 74 108 98 Q96 96 86 86 Z" fill="#ff8f3f" ' + S + '/>' +
        '<path d="M24 34 L34 10 L50 26 Z M96 34 L86 10 L70 26 Z" fill="#ff8f3f" ' + S + '/>' +
        '<ellipse cx="60" cy="72" rx="42" ry="48" fill="#ffb347" ' + S + '/>' +
        '<ellipse cx="60" cy="90" rx="24" ry="24" fill="#fff3d6"/>' +
        '<circle cx="42" cy="56" r="16" fill="#fff" ' + S + '/><circle cx="78" cy="56" r="16" fill="#fff" ' + S + '/>' +
        '<circle class="c-eye" cx="44" cy="58" r="7" fill="' + INK + '"/><circle class="c-eye" cx="76" cy="58" r="7" fill="' + INK + '"/>' +
        '<circle cx="46.5" cy="55.5" r="2.2" fill="#fff"/><circle cx="78.5" cy="55.5" r="2.2" fill="#fff"/>' +
        '<path class="mouth-shut" d="M52 76 L60 84 L68 76 Z" fill="#ff6b6b" ' + S + '/>' +
        '<path class="mouth-open" d="M50 74 L60 92 L70 74 Z" fill="#ff6b6b" ' + S + '/>' +
        '<path d="M46 118 l-6 6 M50 118 l0 7 M70 118 l0 7 M74 118 l6 6" fill="none" ' + S + '/></g>'
    },
    robot: {
      name: 'Bolt',
      svg: SHADOW + '<g class="c-body">' +
        '<path d="M60 22 V9" fill="none" ' + S + '/><circle class="c-bulb" cx="60" cy="8" r="6" fill="#ff6b6b" ' + S + '/>' +
        '<rect class="c-arm-l" x="8" y="72" width="16" height="34" rx="8" fill="#2ec4b6" ' + S + '/>' +
        '<rect class="c-arm-r" x="96" y="72" width="16" height="34" rx="8" fill="#2ec4b6" ' + S + '/>' +
        '<rect x="28" y="64" width="64" height="54" rx="14" fill="#2ec4b6" ' + S + '/>' +
        '<rect x="44" y="82" width="32" height="22" rx="6" fill="#d9fff9" stroke="' + INK + '" stroke-width="3"/>' +
        '<circle cx="53" cy="93" r="4" fill="#ff6b6b"/><circle cx="67" cy="93" r="4" fill="#ffc93c"/>' +
        '<rect x="20" y="20" width="80" height="52" rx="18" fill="#5fe0d3" ' + S + '/>' +
        '<circle cx="44" cy="44" r="12" fill="#fff" ' + S + '/><circle cx="76" cy="44" r="12" fill="#fff" ' + S + '/>' +
        '<circle class="c-eye" cx="44" cy="45" r="5.5" fill="' + INK + '"/><circle class="c-eye" cx="76" cy="45" r="5.5" fill="' + INK + '"/>' +
        '<path class="mouth-shut" d="M51 63 H69" fill="none" ' + S + '/>' +
        '<rect class="mouth-open" x="50" y="58" width="20" height="10" rx="4" fill="#ff6b6b" stroke="' + INK + '" stroke-width="3"/></g>'
    },
    cat: {
      name: 'Mimi',
      svg: SHADOW + '<g class="c-body">' +
        '<path d="M92 108 Q120 104 108 76" fill="none" stroke="' + INK + '" stroke-width="15" stroke-linecap="round"/>' +
        '<path d="M92 108 Q120 104 108 76" fill="none" stroke="#b79cff" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M24 42 L28 8 L54 26 Z M96 42 L92 8 L66 26 Z" fill="#b79cff" ' + S + '/>' +
        '<ellipse class="c-arm-l" cx="24" cy="90" rx="9" ry="15" fill="#b79cff" ' + S + '/>' +
        '<ellipse class="c-arm-r" cx="96" cy="90" rx="9" ry="15" fill="#b79cff" ' + S + '/>' +
        '<ellipse cx="60" cy="92" rx="34" ry="29" fill="#b79cff" ' + S + '/>' +
        '<ellipse cx="60" cy="99" rx="18" ry="17" fill="#f3ecff"/>' +
        '<ellipse cx="60" cy="48" rx="38" ry="32" fill="#b79cff" ' + S + '/>' +
        '<ellipse class="c-eye" cx="45" cy="46" rx="6" ry="8" fill="' + INK + '"/><ellipse class="c-eye" cx="75" cy="46" rx="6" ry="8" fill="' + INK + '"/>' +
        '<circle cx="47" cy="43" r="2.2" fill="#fff"/><circle cx="77" cy="43" r="2.2" fill="#fff"/>' +
        '<path d="M56 56 h8 l-4 5 z" fill="#ff6b6b"/>' +
        '<path d="M14 50 h14 M14 58 h14 M92 50 h14 M92 58 h14" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>' +
        '<path class="mouth-shut" d="M52 64 Q56 69 60 64 Q64 69 68 64" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<ellipse class="mouth-open" cx="60" cy="68" rx="6" ry="6" fill="#ff6b6b" stroke="' + INK + '" stroke-width="3"/></g>'
    },
    panda: {
      name: 'Bao',
      svg: SHADOW + '<g class="c-body">' +
        '<circle cx="28" cy="22" r="13" fill="' + INK + '"/><circle cx="92" cy="22" r="13" fill="' + INK + '"/>' +
        '<ellipse class="c-arm-l" cx="22" cy="88" rx="10" ry="16" fill="' + INK + '"/>' +
        '<ellipse class="c-arm-r" cx="98" cy="88" rx="10" ry="16" fill="' + INK + '"/>' +
        '<ellipse cx="44" cy="118" rx="12" ry="7" fill="' + INK + '"/><ellipse cx="76" cy="118" rx="12" ry="7" fill="' + INK + '"/>' +
        '<ellipse cx="60" cy="92" rx="34" ry="29" fill="#fff" ' + S + '/>' +
        '<ellipse cx="60" cy="50" rx="40" ry="34" fill="#fff" ' + S + '/>' +
        '<ellipse cx="43" cy="48" rx="11" ry="13" fill="' + INK + '" transform="rotate(-18 43 48)"/>' +
        '<ellipse cx="77" cy="48" rx="11" ry="13" fill="' + INK + '" transform="rotate(18 77 48)"/>' +
        '<circle class="c-eye" cx="44" cy="47" r="4.5" fill="#fff"/><circle class="c-eye" cx="76" cy="47" r="4.5" fill="#fff"/>' +
        '<circle cx="30" cy="62" r="5" fill="#ffb3c1"/><circle cx="90" cy="62" r="5" fill="#ffb3c1"/>' +
        '<ellipse cx="60" cy="60" rx="5" ry="3.5" fill="' + INK + '"/>' +
        '<path class="mouth-shut" d="M54 67 Q60 73 66 67" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<ellipse class="mouth-open" cx="60" cy="70" rx="6" ry="5" fill="#ff6b6b" stroke="' + INK + '" stroke-width="3"/></g>'
    }
  };
  function characterSvg(id) {
    var c = CHARACTERS[id] || CHARACTERS.owl;
    return '<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">' + c.svg + '</svg>';
  }

  // ---------- Illustrated backgrounds ----------
  function grad(id, a, b) {
    return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a +
      '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="400" height="400" fill="url(#' + id + ')"/>';
  }
  function cloud(x, y, s, cls) {
    return '<g class="bg-cloud ' + cls + '"><g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="#fff" opacity=".95">' +
      '<ellipse cx="0" cy="0" rx="36" ry="15"/><circle cx="-14" cy="-10" r="15"/><circle cx="10" cy="-15" r="19"/></g></g>';
  }
  function sun(x, y, color) {
    var rays = '';
    for (var i = 0; i < 12; i++) rays += '<rect x="-4" y="-62" width="8" height="20" rx="4" transform="rotate(' + (i * 30) + ')"/>';
    return '<g transform="translate(' + x + ' ' + y + ')"><g class="bg-spin" fill="' + color + '" opacity=".85">' + rays +
      '</g><circle r="34" fill="' + color + '"/><circle r="34" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/></g>';
  }
  function dots(n, seed, maxY, color, cls) {
    var out = '', r = seed;
    for (var i = 0; i < n; i++) {
      r = (r * 9301 + 49297) % 233280; var x = r / 233280 * 400;
      r = (r * 9301 + 49297) % 233280; var y = r / 233280 * maxY;
      out += '<circle class="' + (i % 3 === 0 ? cls : '') + '" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (1 + (i % 3) * 0.7) +
        '" fill="' + color + '" style="animation-delay:' + (-(i % 7) * 0.5) + 's"/>';
    }
    return out;
  }
  function pine(x, y, s, fill, snow) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><rect x="-5" y="0" width="10" height="16" fill="#8a5a3c"/>' +
      '<path d="M0 -70 L26 -34 H12 L32 0 H-32 L-12 -34 H-26 Z" fill="' + fill + '"/>' +
      (snow ? '<path d="M0 -70 L12 -52 Q4 -48 0 -54 Q-4 -48 -12 -52 Z" fill="#fff"/>' : '') + '</g>';
  }
  function roundTree(x, y, s, fill) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><rect x="-6" y="-8" width="12" height="30" rx="3" fill="#8a5a3c"/>' +
      '<circle cx="0" cy="-30" r="30" fill="' + fill + '"/><circle cx="-18" cy="-14" r="18" fill="' + fill + '"/><circle cx="18" cy="-14" r="18" fill="' + fill + '"/></g>';
  }

  var SCENERY = {
    day: function () {
      return grad('g-day', '#4fc0ff', '#dcf7ff') + sun(322, 78, '#ffd23f') +
        cloud(70, 70, 1, 'c1') + cloud(230, 120, .7, 'c2') +
        '<path d="M0 300 Q100 236 210 286 T400 262 V400 H0Z" fill="#a4e86f"/>' +
        '<path d="M0 334 Q130 282 250 326 T400 314 V400 H0Z" fill="#6fd14b"/>' +
        '<g fill="#fff"><circle cx="60" cy="356" r="4"/><circle cx="300" cy="350" r="4"/><circle cx="180" cy="372" r="4"/></g>' +
        '<g fill="#ff8fab"><circle cx="110" cy="368" r="4"/><circle cx="350" cy="374" r="4"/><circle cx="240" cy="356" r="4"/></g>';
    },
    night: function () {
      return grad('g-night', '#0b0a3a', '#3f2f9e') + dots(46, 7, 250, '#fff', 'bg-twinkle') +
        '<circle cx="318" cy="78" r="34" fill="#fff4c2"/><circle cx="304" cy="68" r="30" fill="#161252" opacity=".0"/>' +
        '<circle cx="306" cy="70" r="7" fill="#f0dc94"/><circle cx="328" cy="92" r="5" fill="#f0dc94"/>' +
        '<path class="bg-shoot" d="M0 0 l46 14" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M0 304 Q100 246 210 292 T400 270 V400 H0Z" fill="#2c2580"/>' +
        '<path d="M0 338 Q130 290 250 330 T400 318 V400 H0Z" fill="#1f1a63"/>';
    },
    space: function () {
      return grad('g-space', '#06051f', '#2a1c70') + dots(60, 3, 400, '#fff', 'bg-twinkle') +
        '<g class="bg-bob"><circle cx="86" cy="96" r="30" fill="#ff9f68"/><ellipse cx="86" cy="96" rx="50" ry="11" fill="none" stroke="#ffe0b8" stroke-width="5" transform="rotate(-18 86 96)"/></g>' +
        '<g class="bg-bob b2"><circle cx="326" cy="250" r="20" fill="#7be0d6"/><circle cx="319" cy="244" r="5" fill="#57c2b8"/></g>' +
        '<circle cx="300" cy="70" r="11" fill="#c9b6ff"/>' +
        '<path d="M-20 400 Q200 310 420 400 Z" fill="#4b3bb0"/><circle cx="120" cy="384" r="10" fill="#3c2f95"/><circle cx="270" cy="376" r="7" fill="#3c2f95"/>';
    },
    sea: function () {
      return grad('g-sea', '#62dbff', '#0a4f9c') +
        '<g class="bg-rays" fill="#fff" opacity=".13"><path d="M60 0 L130 0 L60 400 L-40 400Z"/><path d="M190 0 L250 0 L250 400 L150 400Z"/><path d="M310 0 L370 0 L460 400 L360 400Z"/></g>' +
        '<path class="bg-wave" d="M-80 26 Q-60 10 -40 26 T0 26 T40 26 T80 26 T120 26 T160 26 T200 26 T240 26 T280 26 T320 26 T360 26 T400 26 T440 26 T480 26 V-10 H-80Z" fill="#d8f6ff" opacity=".8"/>' +
        '<path d="M0 352 Q90 322 200 348 T400 338 V400 H0Z" fill="#f4d9a0"/>' +
        '<g class="bg-sway" fill="none" stroke="#1fb38a" stroke-width="9" stroke-linecap="round"><path d="M50 356 Q36 320 52 286"/><path d="M72 360 Q86 330 70 304"/></g>' +
        '<g class="bg-sway s2" fill="none" stroke="#19a37c" stroke-width="9" stroke-linecap="round"><path d="M340 350 Q326 312 344 270"/><path d="M362 354 Q376 326 360 298"/></g>' +
        '<g fill="#ff7f9c"><circle cx="150" cy="352" r="12"/><circle cx="166" cy="344" r="9"/><circle cx="138" cy="344" r="8"/></g>' +
        '<path d="M250 356 l8 -16 8 16 -8 -5z M268 362 l6 -12 6 12 -6 -4z" fill="#ffb347"/>';
    },
    forest: function () {
      return grad('g-forest', '#bff2c8', '#f2ffe2') + sun(70, 66, '#ffe27a') +
        pine(40, 300, 1.5, '#7cc98d') + pine(130, 296, 1.2, '#8ed39c') + pine(290, 300, 1.6, '#7cc98d') + pine(370, 294, 1.2, '#8ed39c') +
        '<path d="M0 300 Q110 270 220 296 T400 286 V400 H0Z" fill="#59b86b"/>' +
        roundTree(30, 322, 1.25, '#2f9a50') + roundTree(372, 326, 1.35, '#2f9a50') +
        '<path d="M0 340 Q130 306 260 334 T400 326 V400 H0Z" fill="#3fa35c"/>' +
        '<g><rect x="196" y="352" width="8" height="12" fill="#fff3d6"/><path d="M186 354 Q200 332 214 354Z" fill="#ff6b6b"/><circle cx="196" cy="347" r="2.5" fill="#fff"/><circle cx="205" cy="349" r="2" fill="#fff"/></g>';
    },
    snow: function () {
      return grad('g-snow', '#9fcbff', '#f1f8ff') +
        '<path d="M-20 320 L90 150 L200 320Z" fill="#8fa9d6"/><path d="M90 150 L122 200 Q104 196 96 208 Q86 194 62 194Z" fill="#fff"/>' +
        '<path d="M150 320 L290 120 L430 320Z" fill="#7d99cc"/><path d="M290 120 L330 178 Q308 172 298 188 Q284 170 252 174Z" fill="#fff"/>' +
        '<path d="M0 306 Q110 276 220 300 T400 290 V400 H0Z" fill="#fff"/>' +
        pine(46, 326, 1.1, '#3f8f6b', true) + pine(350, 330, 1.25, '#3f8f6b', true) +
        '<path d="M0 346 Q130 318 260 340 T400 332 V400 H0Z" fill="#e9f3ff"/>';
    },
    sand: function () {
      return grad('g-sand', '#ffc45e', '#fff0cc') + sun(320, 86, '#fff1a8') +
        '<path d="M150 300 L230 190 L310 300Z" fill="#e8b25c"/><path d="M230 190 L310 300 H250Z" fill="#d69c48"/>' +
        '<path d="M0 300 Q90 262 200 292 T400 276 V400 H0Z" fill="#f0c074"/>' +
        '<path d="M0 338 Q140 296 260 332 T400 318 V400 H0Z" fill="#e3ad5c"/>' +
        '<g fill="#3fa35c" stroke="#2b7f45" stroke-width="3"><rect x="52" y="286" width="16" height="60" rx="8"/><path d="M52 318 h-12 a8 8 0 0 1 -8 -8 v-12" fill="none" stroke="#3fa35c" stroke-width="12" stroke-linecap="round"/><path d="M68 326 h12 a8 8 0 0 0 8 -8 v-16" fill="none" stroke="#3fa35c" stroke-width="12" stroke-linecap="round"/></g>';
    },
    city: function () {
      var b = '', xs = [[10, 150, 54], [70, 110, 46], [122, 170, 60], [188, 130, 50], [244, 190, 58], [308, 120, 44], [356, 160, 50]];
      xs.forEach(function (q, k) {
        var top = 320 - q[1];
        b += '<rect x="' + q[0] + '" y="' + top + '" width="' + q[2] + '" height="' + q[1] + '" rx="4" fill="' + (k % 2 ? '#6c63c7' : '#574bb8') + '"/>';
        for (var y = top + 12; y < 300; y += 22) for (var x = q[0] + 9; x < q[0] + q[2] - 10; x += 16) {
          b += '<rect class="' + ((x + y) % 5 === 0 ? 'bg-twinkle' : '') + '" x="' + x + '" y="' + y + '" width="8" height="10" rx="2" fill="#ffe27a"/>';
        }
      });
      return grad('g-city', '#ff9478', '#ffe6b8') + sun(200, 250, '#fff1a8') + cloud(90, 70, .9, 'c1') + cloud(300, 104, .6, 'c2') + b +
        '<rect x="0" y="318" width="400" height="82" fill="#565a78"/><path d="M0 358 H400" stroke="#fff" stroke-width="5" stroke-dasharray="26 22"/>';
    },
    home: function () {
      return '<rect width="400" height="400" fill="#ffe7a8"/>' + dots(34, 11, 300, '#ffd27a', '') +
        '<g><rect x="232" y="58" width="130" height="120" rx="10" fill="#8fdcff" stroke="#fff" stroke-width="10"/>' +
        '<path d="M297 58 V178 M232 118 H362" stroke="#fff" stroke-width="8"/>' +
        '<circle cx="332" cy="88" r="14" fill="#ffd23f"/><path d="M226 50 Q250 110 226 186Z M368 50 Q344 110 368 186Z" fill="#ff8fab"/></g>' +
        '<g><rect x="40" y="70" width="84" height="64" rx="6" fill="#fff" stroke="#c98b5e" stroke-width="8"/>' +
        '<path d="M50 126 L76 96 L92 112 L104 100 L116 126Z" fill="#7ed957"/><circle cx="104" cy="88" r="7" fill="#ffd23f"/></g>' +
        '<rect x="0" y="300" width="400" height="100" fill="#c98b5e"/><path d="M0 334 H400 M0 368 H400" stroke="#b47a50" stroke-width="3"/>' +
        '<ellipse cx="210" cy="356" rx="150" ry="26" fill="#ff8fab"/><ellipse cx="210" cy="356" rx="118" ry="17" fill="#ffd0dc"/>' +
        '<g><rect x="356" y="214" width="6" height="88" fill="#8a5a3c"/><path d="M336 214 L346 176 H372 L382 214Z" fill="#ffd23f"/></g>';
    }
  };
  var THEME_FX = { night: 'stars', space: 'stars', sea: 'bubbles', snow: 'snow', forest: 'leaves' };
  var THEME_CYCLE = ['day', 'forest', 'city', 'home', 'sand', 'night', 'sea', 'snow', 'space'];

  // ---------- Choreography ----------
  var MOVES = ['pop', 'parade', 'drop', 'orbit', 'fly', 'peek', 'balloon', 'grow', 'spin', 'swing', 'bounce', 'zoom'];
  var SLOTS = { 1: [[50, 46]], 2: [[30, 52], [70, 38]], 3: [[22, 58], [50, 30], [78, 58]] };
  var GROUND = { 1: [[50, 84]], 2: [[32, 84], [68, 84]], 3: [[22, 84], [50, 84], [78, 84]] };
  var PEEK = [[84, 36, '60vw', '0px', '9vw', '0px', -16], [16, 62, '-60vw', '0px', '-9vw', '0px', 16], [58, 88, '0px', '60vh', '0px', '34px', 0]];
  var SWING = { 1: [[50, .55]], 2: [[30, .62], [70, .42]], 3: [[22, .5], [50, .7], [78, .42]] };
  var TRICKS = ['t-spin', 't-jump', 't-flip', 't-wiggle'];
  var WIPES = ['iris', 'left', 'pop', 'up', 'blinds'];
  var WIPE_COLORS = ['#ffc93c', '#ff6b6b', '#2ec4b6', '#7b5cff', '#ff8fab'];
  var WIPE_ICONS = ['⭐', '🌈', '🎈', '✨', '🪁'];
  var EMOTES = { ask: '❓', wow: '❗', happy: '❤️', sad: '💧', idea: '💡' };

  var el = {};
  var cur = { theme: null, move: null, character: 'owl', moveTurn: 0, wipeTurn: 0, themeTurn: 0 };

  function buildProps(scene) {
    var box = el.props;
    box.innerHTML = '';
    var list = scene.emojis.map(function (e) { return { e: e, k: 1 }; });
    if (list.length === 1 && scene.plural) {
      list = [{ e: list[0].e, k: 1 }, { e: list[0].e, k: .68 }, { e: list[0].e, k: .5 }];
    }
    var move = scene.motion;
    if (!move || MOVES.indexOf(move) < 0 || move === cur.move) {
      do { move = MOVES[cur.moveTurn++ % MOVES.length]; } while (move === cur.move);
    }
    cur.move = move;
    var n = list.length;
    box.className = 'props ch-' + move + ' n' + n;
    var h = box.clientHeight || 260;

    if (move === 'orbit' && n === 1) list.push({ e: '⭐', k: .34 }, { e: '✨', k: .3 });

    list.forEach(function (it, i) {
      var p = document.createElement('div');
      p.className = 'prop p' + i;
      var pos = (SLOTS[n] || SLOTS[3])[i] || [50, 46];
      if (move === 'parade' || move === 'grow' || move === 'bounce') pos = GROUND[n][i];
      if (move === 'orbit') pos = [50, 48];
      if (move === 'zoom' && i > 0) pos = i === 1 ? [18, 20] : [82, 20];
      if (move === 'peek') {
        var q = PEEK[i % 3];
        pos = [q[0], q[1]];
        p.style.setProperty('--px', q[2]); p.style.setProperty('--py', q[3]);
        p.style.setProperty('--hx', q[4]); p.style.setProperty('--hy', q[5]);
        p.style.setProperty('--rot', q[6] + 'deg');
      }
      if (move === 'swing') {
        var sw = SWING[n][i];
        pos = [sw[0], 0];
        p.style.setProperty('--len', Math.round(h * sw[1]) + 'px');
      }
      var k = it.k;
      if (move === 'orbit' && i > 0 && it.k === 1) k = .5;
      if (move === 'zoom') k = i === 0 ? (n === 1 ? 1.1 : 1.35) : .5;
      p.style.setProperty('--x', pos[0] + '%');
      p.style.setProperty('--y', pos[1] + '%');
      p.style.setProperty('--i', i);
      p.style.setProperty('--k', k);
      p.innerHTML = '<div class="idle"><div class="center"><span class="emo"></span></div></div>';
      p.querySelector('.emo').textContent = it.e;
      box.appendChild(p);
    });
  }

  function setTheme(theme) {
    if (theme === cur.theme) return;
    cur.theme = theme;
    el.bg.innerHTML = '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">' +
      (SCENERY[theme] || SCENERY.day)() + '</svg>';
    el.stage.className = 'stage theme-' + theme;
  }

  function swap(scene, i) {
    var theme = scene.theme;
    if (!theme) {
      if (!cur.theme || (i > 0 && i % 4 === 0)) theme = THEME_CYCLE[cur.themeTurn++ % THEME_CYCLE.length];
      else theme = cur.theme;
    }
    setTheme(theme);
    setFx(scene.fx || THEME_FX[theme] || null);
    buildProps(scene);

    var right = Math.floor(i / 3) % 2 === 1;
    var moved = el.hero.classList.contains('at-right') !== right;
    el.hero.classList.toggle('at-right', right);
    if (moved) restart(el.hero, 'hop');
    setMood(scene.mood);
  }

  function restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  var moodTimer = null;
  function setMood(mood) {
    clearTimeout(moodTimer);
    el.hero.className = el.hero.className.replace(/\bmood-\w+/g, '').trim();
    el.emote.classList.remove('show');
    if (!mood || !EMOTES[mood]) return;
    el.hero.classList.add('mood-' + mood);
    el.emote.textContent = EMOTES[mood];
    restart(el.emote, 'show');
    moodTimer = setTimeout(function () {
      el.emote.classList.remove('show');
      el.hero.classList.remove('mood-' + mood);
    }, 2600);
  }

  // ---------- Transitions ----------
  var wipeTimers = [];
  function wipe(first) {
    wipeTimers.forEach(clearTimeout);
    wipeTimers = [];
    var w = el.wipe;
    var kind = WIPES[cur.wipeTurn % WIPES.length];
    w.style.setProperty('--wc', WIPE_COLORS[cur.wipeTurn % WIPE_COLORS.length]);
    el.wipeIcon.textContent = WIPE_ICONS[cur.wipeTurn % WIPE_ICONS.length];
    cur.wipeTurn++;
    return new Promise(function (resolve) {
      function reveal() {
        resolve();
        wipeTimers.push(setTimeout(function () {
          w.className = 'wipe on w-' + kind + ' reveal';
          wipeTimers.push(setTimeout(function () { w.className = 'wipe'; }, 460));
        }, 40));
      }
      if (first) {
        w.className = 'wipe on w-' + kind + ' covered';
        reveal();
      } else {
        w.className = 'wipe on w-' + kind + ' cover';
        sound('whoosh');
        wipeTimers.push(setTimeout(reveal, 380));
      }
    });
  }

  // ---------- Weather and sparkle effects (canvas) ----------
  var cv, ctx, W = 0, H = 0, parts = [], fxType = null, raf = 0, lastT = 0;
  var CAP = { rain: 70, snow: 46, bubbles: 20, leaves: 9, stars: 0, hearts: 12, confetti: 80, sparkle: 12 };
  var CONFETTI = ['#ffc93c', '#ff6b6b', '#2ec4b6', '#7b5cff', '#ff8fab', '#ffffff'];
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    var d = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  function spawn(type, spread) {
    var p = { t: type, age: 0, life: 1e9, x: rnd(0, W), y: 0, vx: 0, vy: 0, s: 4, r: 0, vr: 0, ph: rnd(0, 6.28) };
    if (type === 'rain') { p.y = spread ? rnd(0, H) : -20; p.vy = rnd(520, 760); p.vx = -70; p.s = rnd(10, 18); }
    else if (type === 'snow') { p.y = spread ? rnd(0, H) : -8; p.vy = rnd(28, 70); p.s = rnd(2, 5); }
    else if (type === 'bubbles') { p.y = spread ? rnd(0, H) : H + 12; p.vy = -rnd(24, 62); p.s = rnd(4, 12); }
    else if (type === 'leaves') { p.y = spread ? rnd(0, H * .7) : -24; p.x = rnd(-40, W * .8); p.vy = rnd(28, 52); p.vx = rnd(14, 40); p.vr = rnd(-2, 2); p.s = rnd(18, 26); p.c = Math.random() < .5 ? '🍃' : '🍂'; }
    else if (type === 'hearts') { p.y = spread ? rnd(H * .3, H) : H + 16; p.vy = -rnd(40, 84); p.s = rnd(18, 30); p.life = 4.2; p.c = Math.random() < .5 ? '❤️' : '💖'; }
    else if (type === 'confetti') { p.y = spread ? rnd(-H, H * .6) : -12; p.vy = rnd(120, 260); p.vx = rnd(-45, 45); p.vr = rnd(-8, 8); p.s = rnd(6, 11); p.c = CONFETTI[(Math.random() * CONFETTI.length) | 0]; }
    else if (type === 'sparkle') { p.y = rnd(0, H * .75); p.s = rnd(16, 30); p.life = rnd(1, 1.7); p.c = '✨'; }
    parts.push(p);
  }

  function setFx(type) {
    if (type === fxType) return;
    fxType = type;
    parts = parts.filter(function (p) { return p.t === 'burst'; });
    if (type && CAP[type]) {
      if (!W) resize();
      var n = Math.round(CAP[type] * (type === 'sparkle' ? .4 : .7));
      for (var i = 0; i < n; i++) spawn(type, true);
    }
    kick();
  }

  function burst(x, y) {
    if (!W) resize();
    for (var i = 0; i < 16; i++) {
      var a = rnd(0, 6.28), v = rnd(90, 260);
      parts.push({ t: 'burst', age: 0, life: rnd(.5, .9), x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, s: rnd(4, 8), r: 0, vr: 0, ph: 0, c: CONFETTI[i % CONFETTI.length] });
    }
    kick();
  }

  function kick() {
    if (raf || document.hidden) return;
    lastT = 0;
    raf = requestAnimationFrame(frame);
  }

  function frame(t) {
    raf = 0;
    var dt = lastT ? Math.min(.05, (t - lastT) / 1000) : .016;
    lastT = t;
    ctx.clearRect(0, 0, W, H);

    if (fxType && CAP[fxType]) {
      var have = 0;
      for (var k = 0; k < parts.length; k++) if (parts[k].t === fxType) have++;
      for (var a = 0; a < 2 && have < CAP[fxType]; a++, have++) spawn(fxType, false);
    }

    var keep = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.age += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.t === 'snow' || p.t === 'bubbles' || p.t === 'hearts') p.x += Math.sin(p.age * 2 + p.ph) * 18 * dt;
      if (p.t === 'burst') p.vy += 520 * dt;
      if (p.age > p.life || p.y > H + 40 || p.y < -60 || p.x < -60 || p.x > W + 60) continue;
      keep.push(p);
      var fade = p.life < 100 ? Math.max(0, 1 - p.age / p.life) : 1;

      if (p.t === 'rain') {
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.s * .14, p.y + p.s); ctx.stroke();
      } else if (p.t === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.fill();
      } else if (p.t === 'bubbles') {
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.arc(p.x - p.s * .35, p.y - p.s * .35, p.s * .2, 0, 6.28); ctx.fill();
      } else if (p.t === 'confetti' || p.t === 'burst') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = p.t === 'burst' ? fade : 1;
        ctx.fillStyle = p.c;
        if (p.t === 'burst') { ctx.beginPath(); ctx.arc(0, 0, p.s * .6, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (1 + Math.sin(p.age * 9 + p.ph) * .6));
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = p.t === 'sparkle' ? Math.sin(Math.PI * Math.min(1, p.age / p.life)) : Math.min(1, fade * 1.6);
        ctx.font = p.s + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.c, 0, 0);
        ctx.restore();
      }
    }
    parts = keep;
    if ((parts.length || (fxType && CAP[fxType])) && !document.hidden) raf = requestAnimationFrame(frame);
  }

  // ---------- Sounds ----------
  var ac = null, soundOn = true;
  function tone(f1, f2, dur, type, vol, delay) {
    if (!soundOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime + (delay || 0);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + dur + .02);
    } catch (e) { /* sound effects are optional */ }
  }
  function sound(name) {
    if (name === 'pop') tone(520, 940, .1, 'sine', .09);
    else if (name === 'whoosh') tone(320, 90, .24, 'triangle', .035);
    else if (name === 'boing') tone(220, 520, .16, 'square', .03);
    else if (name === 'tada') [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, .22, 'triangle', .07, i * .13); });
  }

  // ---------- Title and ending ----------
  function title(text) {
    var card = el.title;
    var h = card.querySelector('.title-text');
    h.innerHTML = '';
    String(text || '').slice(0, 70).split(/\s+/).forEach(function (w, i) {
      if (!w) return;
      var s = document.createElement('span');
      s.textContent = w;
      s.style.animationDelay = (.25 + i * .14) + 's';
      h.appendChild(s);
      h.appendChild(document.createTextNode(' '));
    });
    el.props.innerHTML = '';
    setTheme('day');
    setFx('sparkle');
    el.hero.classList.remove('at-right');
    card.hidden = false;
    restart(card, 'play');
    restart(el.hero, 'hop');
    sound('tada');
    return new Promise(function (resolve) {
      setTimeout(function () {
        card.hidden = true;
        resolve();
      }, 2600);
    });
  }

  function celebrate() {
    setFx('confetti');
    setMood('happy');
    restart(el.hero, 'hop');
    sound('tada');
  }

  // ---------- Setup ----------
  function setCharacter(id) {
    if (!CHARACTERS[id]) id = 'owl';
    cur.character = id;
    if (el.heroArt) el.heroArt.innerHTML = characterSvg(id);
  }

  function init() {
    el.stage = document.getElementById('stage');
    el.bg = document.getElementById('bg');
    el.props = document.getElementById('props');
    el.hero = document.getElementById('hero');
    el.heroArt = el.hero.querySelector('.hero-art');
    el.emote = el.hero.querySelector('.emote');
    el.wipe = document.getElementById('wipe');
    el.wipeIcon = el.wipe.querySelector('span');
    el.title = document.getElementById('titleCard');
    cv = document.getElementById('fx');
    ctx = cv.getContext('2d');
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    el.props.addEventListener('click', function (e) {
      var emo = e.target.closest ? e.target.closest('.emo') : null;
      if (!emo) return;
      var trick = TRICKS[(Math.random() * TRICKS.length) | 0];
      TRICKS.forEach(function (t) { emo.classList.remove(t); });
      void emo.offsetWidth;
      emo.classList.add(trick);
      var r = cv.getBoundingClientRect();
      burst(e.clientX - r.left, e.clientY - r.top);
      sound('pop');
    });
    el.hero.addEventListener('click', function (e) {
      restart(el.hero, 'hop');
      el.emote.textContent = ['😄', '👋', '🎵', '⭐'][(Math.random() * 4) | 0];
      restart(el.emote, 'show');
      var r = cv.getBoundingClientRect();
      burst(e.clientX - r.left, e.clientY - r.top - 20);
      sound('boing');
    });
    setCharacter(cur.character);
  }

  window.Stage = {
    CHARACTERS: CHARACTERS,
    characterSvg: characterSvg,
    init: init,
    setCharacter: setCharacter,
    // Covers the stage, swaps in the new scene, then uncovers it.
    // Resolves at the moment the new scene is in place.
    show: function (scene, i, first) {
      return wipe(first).then(function () { resize(); swap(scene, i); });
    },
    talk: function (on) { el.hero.classList.toggle('talking', !!on); },
    title: title,
    celebrate: celebrate,
    stopFx: function () { setFx(null); },
    setSound: function (on) { soundOn = !!on; },
    state: cur
  };
})();
