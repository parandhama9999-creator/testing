/* Language list, voice tags and offline language detection. */
(function () {
  'use strict';

  // code, English name, native name, voice tag, can be translated on-device
  var RAW = [
    ['en', 'English', 'English', 'en-US', 1], ['hi', 'Hindi', 'हिन्दी', 'hi-IN', 1],
    ['te', 'Telugu', 'తెలుగు', 'te-IN', 1], ['ta', 'Tamil', 'தமிழ்', 'ta-IN', 1],
    ['kn', 'Kannada', 'ಕನ್ನಡ', 'kn-IN', 1], ['mr', 'Marathi', 'मराठी', 'mr-IN', 1],
    ['bn', 'Bengali', 'বাংলা', 'bn-IN', 1], ['gu', 'Gujarati', 'ગુજરાતી', 'gu-IN', 1],
    ['ur', 'Urdu', 'اردو', 'ur-PK', 1], ['ml', 'Malayalam', 'മലയാളം', 'ml-IN', 0],
    ['pa', 'Punjabi', 'ਪੰਜਾਬੀ', 'pa-IN', 0], ['or', 'Odia', 'ଓଡ଼ିଆ', 'or-IN', 0],
    ['es', 'Spanish', 'Español', 'es-ES', 1], ['fr', 'French', 'Français', 'fr-FR', 1],
    ['de', 'German', 'Deutsch', 'de-DE', 1], ['pt', 'Portuguese', 'Português', 'pt-BR', 1],
    ['it', 'Italian', 'Italiano', 'it-IT', 1], ['nl', 'Dutch', 'Nederlands', 'nl-NL', 1],
    ['ru', 'Russian', 'Русский', 'ru-RU', 1], ['uk', 'Ukrainian', 'Українська', 'uk-UA', 1],
    ['ar', 'Arabic', 'العربية', 'ar-SA', 1], ['fa', 'Persian', 'فارسی', 'fa-IR', 1],
    ['he', 'Hebrew', 'עברית', 'he-IL', 1], ['tr', 'Turkish', 'Türkçe', 'tr-TR', 1],
    ['zh', 'Chinese', '中文', 'zh-CN', 1], ['ja', 'Japanese', '日本語', 'ja-JP', 1],
    ['ko', 'Korean', '한국어', 'ko-KR', 1], ['th', 'Thai', 'ไทย', 'th-TH', 1],
    ['vi', 'Vietnamese', 'Tiếng Việt', 'vi-VN', 1], ['id', 'Indonesian', 'Bahasa Indonesia', 'id-ID', 1],
    ['ms', 'Malay', 'Bahasa Melayu', 'ms-MY', 1], ['tl', 'Tagalog', 'Tagalog', 'fil-PH', 1],
    ['sw', 'Swahili', 'Kiswahili', 'sw-KE', 1], ['af', 'Afrikaans', 'Afrikaans', 'af-ZA', 1],
    ['pl', 'Polish', 'Polski', 'pl-PL', 1], ['cs', 'Czech', 'Čeština', 'cs-CZ', 1],
    ['sk', 'Slovak', 'Slovenčina', 'sk-SK', 1], ['hu', 'Hungarian', 'Magyar', 'hu-HU', 1],
    ['ro', 'Romanian', 'Română', 'ro-RO', 1], ['bg', 'Bulgarian', 'Български', 'bg-BG', 1],
    ['el', 'Greek', 'Ελληνικά', 'el-GR', 1], ['sv', 'Swedish', 'Svenska', 'sv-SE', 1],
    ['da', 'Danish', 'Dansk', 'da-DK', 1], ['no', 'Norwegian', 'Norsk', 'nb-NO', 1],
    ['fi', 'Finnish', 'Suomi', 'fi-FI', 1], ['et', 'Estonian', 'Eesti', 'et-EE', 1],
    ['lv', 'Latvian', 'Latviešu', 'lv-LV', 1], ['lt', 'Lithuanian', 'Lietuvių', 'lt-LT', 1],
    ['hr', 'Croatian', 'Hrvatski', 'hr-HR', 1], ['sl', 'Slovenian', 'Slovenščina', 'sl-SI', 1],
    ['mk', 'Macedonian', 'Македонски', 'mk-MK', 1], ['sq', 'Albanian', 'Shqip', 'sq-AL', 1],
    ['be', 'Belarusian', 'Беларуская', 'be-BY', 1], ['ka', 'Georgian', 'ქართული', 'ka-GE', 1],
    ['ca', 'Catalan', 'Català', 'ca-ES', 1], ['gl', 'Galician', 'Galego', 'gl-ES', 1],
    ['cy', 'Welsh', 'Cymraeg', 'cy-GB', 1], ['ga', 'Irish', 'Gaeilge', 'ga-IE', 1],
    ['is', 'Icelandic', 'Íslenska', 'is-IS', 1], ['mt', 'Maltese', 'Malti', 'mt-MT', 1],
    ['ht', 'Haitian Creole', 'Kreyòl', 'ht-HT', 1], ['eo', 'Esperanto', 'Esperanto', 'eo', 1]
  ];

  var LIST = RAW.map(function (r) {
    return { code: r[0], name: r[1], native: r[2], tts: r[3], translate: !!r[4] };
  });
  var BY = {};
  LIST.forEach(function (l) { BY[l.code] = l; });

  // Unicode script blocks that point to one language (or a small family).
  var SCRIPTS = [
    ['te', 0x0C00, 0x0C7F], ['ta', 0x0B80, 0x0BFF], ['kn', 0x0C80, 0x0CFF],
    ['ml', 0x0D00, 0x0D7F], ['bn', 0x0980, 0x09FF], ['gu', 0x0A80, 0x0AFF],
    ['pa', 0x0A00, 0x0A7F], ['or', 0x0B00, 0x0B7F], ['deva', 0x0900, 0x097F],
    ['arab', 0x0600, 0x06FF], ['he', 0x0590, 0x05FF], ['th', 0x0E00, 0x0E7F],
    ['el', 0x0370, 0x03FF], ['cyrl', 0x0400, 0x04FF], ['ka', 0x10A0, 0x10FF],
    ['ko', 0xAC00, 0xD7AF], ['kana', 0x3040, 0x30FF], ['han', 0x4E00, 0x9FFF],
    ['latn', 0x0041, 0x024F]
  ];

  // Very common small words for languages written in Latin letters.
  var STOP = {
    en: 'the and is of to in that it was for with are this have from they what when were',
    es: 'el la de que y en los las un una es por con para se del como más pero su',
    fr: 'le la les de des et un une est que dans pour qui sur pas avec au ce il elle',
    de: 'der die das und ist nicht ein eine mit von zu den auf für sich auch dem es sie',
    pt: 'o a de que e do da em um uma para com não os as se na por mais dos como',
    it: 'il la di che e un una per non in con sono le del della si dei come più gli',
    nl: 'de het een en van is dat op te in met voor niet zijn er aan ook als maar',
    id: 'yang dan di ini itu dengan untuk dari pada tidak adalah ke akan juga oleh saya',
    ms: 'yang dan di ini itu dengan untuk dari pada tidak ialah ke akan juga oleh boleh',
    tr: 've bir bu da de için ile çok ne gibi daha ama var olan kadar en değil ben',
    vi: 'và của là có trong không được một những cho người này với các đã để khi',
    pl: 'i w nie na to się z że do jest jak ale po co tak za od przez czy był',
    sv: 'och att det i en är som på för med inte av den till har jag de ett om',
    da: 'og at det i en er som på for med ikke af den til har jeg de et om der',
    no: 'og at det i en er som på for med ikke av den til har jeg de et om var',
    fi: 'ja on ei se että oli hän mutta kun niin kuin tämä ovat myös joka sen',
    tl: 'ang ng sa na at mga ay si ko ito para hindi niya siya kung may isang',
    sw: 'na ya wa kwa ni la katika za kuwa hii si yake kama au lakini pia watu',
    ro: 'și de în a la cu este o un pe care nu că mai din se pentru sau fost',
    cs: 'a je se na v to že s z do pro jako ale by tak po byl jsou není',
    hu: 'a az és hogy nem is egy van meg de ez csak volt már még el mint vagy',
    af: 'die en van is in het nie dat vir met op te sy hy was hulle om as ook'
  };
  var STOPSETS = {};
  Object.keys(STOP).forEach(function (k) {
    STOPSETS[k] = {};
    STOP[k].split(' ').forEach(function (w) { STOPSETS[k][w] = 1; });
  });

  function count(text, re) { var m = text.match(re); return m ? m.length : 0; }

  function detect(text) {
    var sample = (text || '').slice(0, 6000);
    var tally = {};
    for (var i = 0; i < sample.length; i++) {
      var c = sample.charCodeAt(i);
      if (c < 0x41) continue;
      for (var s = 0; s < SCRIPTS.length; s++) {
        if (c >= SCRIPTS[s][1] && c <= SCRIPTS[s][2]) {
          tally[SCRIPTS[s][0]] = (tally[SCRIPTS[s][0]] || 0) + 1;
          break;
        }
      }
    }
    // Japanese mixes kana with Chinese characters, so kana decides.
    if (tally.kana && tally.kana > 5) return 'ja';
    var best = null, bestN = 0;
    Object.keys(tally).forEach(function (k) { if (tally[k] > bestN) { best = k; bestN = tally[k]; } });
    if (!best) return 'en';
    if (best === 'han') return 'zh';
    if (best === 'deva') {
      var mr = count(sample, /(^|\s)(आहे|आणि|नाही|होते|आहेत|मध्ये)(?=\s|[.,।]|$)/g);
      var hi = count(sample, /(^|\s)(है|और|नहीं|हैं|था|में)(?=\s|[.,।]|$)/g);
      return mr > hi ? 'mr' : 'hi';
    }
    if (best === 'arab') {
      if (count(sample, /[ٹڈڑںےھ]/g) > 3) return 'ur';
      if (count(sample, /[پچژگ]/g) > 3) return 'fa';
      return 'ar';
    }
    if (best === 'cyrl') {
      if (count(sample, /[іїєґ]/gi) > 2 && !count(sample, /[ў]/gi)) return 'uk';
      if (count(sample, /[ў]/gi) > 1) return 'be';
      if (count(sample, /[ѓќѕџ]/gi) > 1) return 'mk';
      if (!count(sample, /[ыэ]/gi) && count(sample, /[ъ]/gi) > 3) return 'bg';
      return 'ru';
    }
    if (best !== 'latn') return best;
    var words = sample.toLowerCase().split(/[^a-zà-ɏ]+/);
    var top = 'en', topScore = 0;
    Object.keys(STOPSETS).forEach(function (k) {
      var n = 0;
      for (var w = 0; w < words.length; w++) if (STOPSETS[k][words[w]]) n++;
      if (n > topScore) { topScore = n; top = k; }
    });
    return top;
  }

  window.Lang = {
    LIST: LIST,
    get: function (code) { return BY[code] || null; },
    name: function (code) { var l = BY[code]; return l ? l.name : code; },
    label: function (code) {
      var l = BY[code];
      if (!l) return code;
      return l.native === l.name ? l.name : l.native + ' (' + l.name + ')';
    },
    tts: function (code) { var l = BY[code]; return l ? l.tts : code; },
    canTranslate: function (code) { var l = BY[code]; return !!(l && l.translate); },
    detect: detect
  };
})();
