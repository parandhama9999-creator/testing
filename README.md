# PDF Kids Narrator

Android app that turns a PDF into an animated, narrated story for children, in the PDF's own language or a language you pick. Everything runs on the phone with free services, so there are no API keys and no running costs.

This branch (`kids-pdf-narrator`) is separate from the other app in this repository.

## Download

Open the repository's **Releases** page and download `PDF-Kids-Narrator.apk` from the newest "PDF Kids Narrator" release. Every push to this branch builds a new one.

## How it works

1. **Read**: `pdf.js` pulls the text out of the PDF (first 40 pages).
2. **Detect**: the language is detected on the device from the script and common words.
3. **Scenes**: the text is cut into short sentences, one per scene (up to 200 scenes).
4. **Translate** (optional): Google ML Kit translates on the device. Each language pack is about 30 MB and is downloaded once.
5. **Narrate**: the phone's own text-to-speech voice reads each scene, with the spoken word highlighted.
6. **Animate**: a storyteller (Pip the owl, Bolt the robot, Mimi the cat or Bao the panda) talks and reacts while pictures matching the words move through an illustrated scene.

## Camera

**Scan a book page** takes a photo (or picks one from the gallery) and reads the words with the Tesseract text reader inside the app. You choose the language printed on the page. English works offline; every other language downloads a reading pack (2 to 15 MB) the first time.

## Animation

- **12 movements**, chosen from the words and never repeated twice in a row: fly in, drop and bounce, parade, orbit, balloon ride, grow, peek, spin, swing, roll, spotlight and pop.
- **9 illustrated worlds**: day, night, space, under the sea, forest, snow, desert, city and home.
- **Effects**: rain, snow, bubbles, falling leaves, hearts, sparkles and confetti.
- **Scene changes**: five different wipes, plus an animated title card and a star ending.
- **Touch**: tap a picture or the storyteller for a trick, sparkles and a sound.

## Limits of this first version

- Scanned PDFs (photos of pages) are not supported yet. Use **Scan a book page** for printed pages.
- The wording is not rewritten into simpler language. That needs an AI model, which is a paid service.
- It plays inside the app. It does not export a video file.
- Translation covers the 59 ML Kit languages. Malayalam, Punjabi and Odia are narrated in the original language only.
- Narration needs a voice for that language installed on the phone (Settings → Text-to-speech).

## Project layout

```
www/index.html     screens
www/css/app.css    look and animations
www/js/lang.js     language list and detection
www/js/story.js    PDF reading, scene splitting, picture picking
www/js/native.js   voice, translation, keep-screen-on
www/js/ocr.js      camera photo and reading the words on it
www/js/stage.js    backgrounds, characters, movements, effects, transitions
www/js/app.js      story player
scripts/copy_vendor.sh           copies pdf.js into www/vendor
.github/workflows/build_apk.yml  builds the APK and publishes a release
```

## Run in a desktop browser

```
npm install
npm run vendor
npm run serve     # then open http://localhost:8080
```

Translation only works in the installed Android app.
