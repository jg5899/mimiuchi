# Translated TTS on Viewer Devices — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each viewer's device speak its chosen-language caption aloud via the browser's `speechSynthesis`, with all code confined to `public/display.html` plus a dev mock server.

**Architecture:** The per-language WebSocket stream already delivers `{type:'text', data:{translation, targetLang, languageName, isFinal, time}}` to each subscribed `display.html` client. We add an opt-in TTS layer in that file: map `targetLang` (NLLB) → BCP-47, pick a matching `speechSynthesis` voice, and speak each finalized line through a cap-the-backlog queue with dedupe. No server/IPC/broadcast/format changes.

**Tech Stack:** Vanilla ES2017 inline JS (no Vue/build), `window.speechSynthesis`, `localStorage`. Dev harness: Node + `ws`. Headless verify: Playwright with stubbed `speechSynthesis`.

**Testing reality:** No unit-test runner exists in the repo. Verification = (a) `node --check` on the extracted inline script for syntax, (b) a Node mock WS server that streams synthetic Romanian finals, (c) a Playwright headless smoke that stubs `speechSynthesis`, clicks Speak, and asserts the translated text was spoken. All edits land on branch `feature/viewer-tts`.

---

### Task 1: Dev mock WebSocket server (the test harness)

**Files:**
- Create: `test/tts_mock_server.js`

- [ ] **Step 1: Create the mock server**

```js
// Minimal mock of Mimiuchi's display server for TTS dev testing — NO mic/Deepgram/OpenAI.
// Usage:  node test/tts_mock_server.js [port]    (default 8090)
// Open:   http://localhost:<port>/?lang=ro       (serves the real public/display.html)
// It serves display.html for any GET (like the real catch-all server), accepts the
// {type:'subscribe',targetLang} message, and streams synthetic Romanian final messages.
const http = require('http');
const fs = require('fs');
const path = require('path');

let WebSocketServer;
try { const ws = require('ws'); WebSocketServer = ws.WebSocketServer || ws.Server; }
catch (e) { console.error('Needs the `ws` package (already a mimiuchi dep). Run from repo root.'); process.exit(1); }

const PORT = parseInt(process.argv[2] || '8090', 10);
const DISPLAY = fs.readFileSync(path.join(__dirname, '..', 'public', 'display.html'));
const LINES = [
  'Bună dimineața și bine ați venit la biserică.',
  'Astăzi vom vorbi despre dragoste și har.',
  'Să ne rugăm împreună în numele lui Isus.',
  'Domnul este păstorul meu, nu voi duce lipsă de nimic.',
  'Mulțumim pentru închinarea de astăzi.',
];

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
  res.end(DISPLAY);
});
const wss = new WebSocketServer({ server });
wss.on('connection', (socket) => {
  console.log('[mock] client connected');
  let i = 0;
  socket.on('message', (m) => console.log('[mock] recv:', m.toString()));
  const timer = setInterval(() => {
    const line = LINES[i % LINES.length];
    i += 1;
    const payload = {
      transcript: 'English source line ' + i,
      translation: line,
      targetLang: 'ron_Latn',
      languageName: 'Romanian',
      isFinal: true,
      time: new Date().toISOString(),
    };
    socket.send(JSON.stringify({ type: 'text', data: payload }));
    console.log('[mock] sent:', line);
  }, 4000);
  socket.on('close', () => { clearInterval(timer); console.log('[mock] client disconnected'); });
});
server.listen(PORT, () => console.log(`[mock] http+ws on http://localhost:${PORT}  (open /?lang=ro)`));
```

- [ ] **Step 2: Verify it runs and serves**

Run: `node test/tts_mock_server.js 8090 & sleep 1 && curl -s localhost:8090/ | head -1 && kill %1`
Expected: prints `[mock] http+ws on …` then `<!DOCTYPE html>`.

- [ ] **Step 3: Commit**

```bash
git add test/tts_mock_server.js
git commit -m "test(tts): mock display WS server for TTS dev verification"
```

---

### Task 2: HTML controls + CSS (Speak button, TTS panel)

**Files:**
- Modify: `public/display.html` (style block ~line 106; `.controls` ~line 226–234; after `.header` ~line 235)

- [ ] **Step 1: Add CSS** — insert after the `.font-btn` light/dark rules (after current line 128):

```css
        .tts-panel {
            position: fixed;
            left: 0;
            right: 0;
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
            padding: 0.6rem 2rem;
            z-index: 99;
            font-size: 0.9rem;
            backdrop-filter: blur(10px);
        }
        .tts-panel[hidden] { display: none; }
        body.light .tts-panel { background-color: rgba(245, 245, 245, 0.95); border-bottom: 1px solid #e0e0e0; }
        body.dark .tts-panel { background-color: rgba(34, 34, 34, 0.95); border-bottom: 1px solid #333333; }
        .tts-field { display: flex; align-items: center; gap: 0.4rem; }
        .tts-panel select { padding: 0.3rem 0.5rem; border-radius: 6px; border: none; font-size: 0.9rem; }
        .tts-notice { opacity: 0.9; font-style: italic; }
        body.dark .tts-notice { color: #ffcc66; }
        body.light .tts-notice { color: #b26a00; }
```

- [ ] **Step 2: Add the Speak button** — in `.controls`, immediately before the `themeToggle` button (current line 233):

```html
            <button class="theme-toggle" id="ttsToggle" aria-label="Toggle spoken audio">🔇 Speak</button>
```

- [ ] **Step 3: Add the TTS panel** — immediately after the `.header` closing `</div>` (current line 235), before `<div class="container">`:

```html
    <div class="tts-panel" id="ttsPanel" hidden>
        <label class="tts-field">Voice
            <select id="ttsVoiceSelect"></select>
        </label>
        <label class="tts-field">Speed
            <select id="ttsRateSelect">
                <option value="0.8">0.8×</option>
                <option value="0.9">0.9×</option>
                <option value="1" selected>1.0×</option>
                <option value="1.1">1.1×</option>
                <option value="1.2">1.2×</option>
            </select>
        </label>
        <span class="tts-notice" id="ttsNotice" hidden></span>
    </div>
```

- [ ] **Step 4: Verify markup** — open in a browser (or the mock) and confirm the 🔇 Speak button appears; panel stays hidden. (No automated step; visual.)

---

### Task 3: NLLB→BCP-47 map + page spoken-language resolution

**Files:**
- Modify: `public/display.html` (after `languageNames` ~line 295; after `targetLang` ~line 301)

- [ ] **Step 1: Add the locale map** — after the `languageNames` object's closing `};` (current line 295):

```js
        // NLLB target-language code -> BCP-47 tag, for matching speechSynthesis voices
        const NLLB_TO_BCP47 = {
            'eng_Latn': 'en', 'spa_Latn': 'es', 'ukr_Cyrl': 'uk', 'rus_Cyrl': 'ru',
            'por_Latn': 'pt', 'fra_Latn': 'fr', 'kor_Hang': 'ko', 'zho_Hans': 'zh-CN',
            'tgl_Latn': 'fil', 'vie_Latn': 'vi', 'arb_Arab': 'ar', 'hin_Deva': 'hi',
            'pol_Latn': 'pl', 'ron_Latn': 'ro'
        };
```

- [ ] **Step 2: Resolve the page's spoken language** — immediately after `const targetLang = …;` (current line 301):

```js
        // Spoken-audio language for this page. English page (no ?lang=) speaks English.
        const ttsLang = targetLang ? (NLLB_TO_BCP47[targetLang] || 'en') : 'en';
        const ttsLangPrefix = ttsLang.split('-')[0].toLowerCase();
        const ttsLangName = targetLang ? (languageNames[targetLang] || langParam) : 'English';
```

---

### Task 4–6: TTS state, voice logic, speak engine, wiring

**Files:**
- Modify: `public/display.html` — insert the whole block immediately before `// Initialize connection` / `connect();` (current line 588).

- [ ] **Step 1: Insert the TTS module**

```js
        // ===================== Text-to-Speech (per-viewer) =====================
        const ttsSupported = 'speechSynthesis' in window;

        // Queue policy: 'cap' (default) | 'latest' | 'full'. Switch to A/B live.
        //   cap    = keep at most TTS_MAX_BACKLOG waiting; drop oldest (stays ~near live)
        //   latest = cancel() + speak only newest (tightest sync, may cut off)
        //   full   = unbounded queue (never skips, can drift far behind)
        const TTS_MODE = 'cap';
        const TTS_MAX_BACKLOG = 2;

        let ttsEnabled = localStorage.getItem('ttsEnabled') === 'true';
        let ttsRate = parseFloat(localStorage.getItem('ttsRate') || '1') || 1;
        let ttsVoiceURI = localStorage.getItem('ttsVoiceURI') || '';
        let selectedVoice = null;
        let voices = [];
        let ttsUnlocked = false;

        const ttsQueue = [];
        let ttsSpeaking = false;
        let resumeKeepalive = null;
        const spokenKeys = new Set();

        const ttsToggle = document.getElementById('ttsToggle');
        const ttsPanel = document.getElementById('ttsPanel');
        const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
        const ttsRateSelect = document.getElementById('ttsRateSelect');
        const ttsNotice = document.getElementById('ttsNotice');

        function bcp47Prefix(lang) { return (lang || '').toLowerCase().split('-')[0]; }
        function matchingVoices() { return voices.filter(v => bcp47Prefix(v.lang) === ttsLangPrefix); }

        function autoPickVoice() {
            const matches = matchingVoices();
            if (!matches.length) return null;
            matches.sort((a, b) => (b.localService === true) - (a.localService === true));
            return matches[0];
        }

        function loadVoices() {
            if (!ttsSupported) return;
            voices = window.speechSynthesis.getVoices() || [];
            selectedVoice = null;
            if (ttsVoiceURI) selectedVoice = voices.find(v => v.voiceURI === ttsVoiceURI) || null;
            if (!selectedVoice) selectedVoice = autoPickVoice();
            renderVoiceOptions();
            updateTtsNotice();
        }

        function renderVoiceOptions() {
            if (!ttsVoiceSelect) return;
            ttsVoiceSelect.innerHTML = '';
            const matches = matchingVoices();
            const others = voices.filter(v => bcp47Prefix(v.lang) !== ttsLangPrefix);
            const addGroup = (list, label) => {
                if (!list.length) return;
                const group = document.createElement('optgroup');
                group.label = label;
                list.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.voiceURI;
                    opt.textContent = v.name + ' (' + v.lang + ')';
                    if (selectedVoice && v.voiceURI === selectedVoice.voiceURI) opt.selected = true;
                    group.appendChild(opt);
                });
                ttsVoiceSelect.appendChild(group);
            };
            addGroup(matches, ttsLangName + ' voices');
            addGroup(others, 'Other voices');
        }

        function updateTtsNotice() {
            if (!ttsNotice) return;
            if (ttsEnabled && !selectedVoice) {
                ttsNotice.textContent = 'No ' + ttsLangName + ' voice on this device — showing captions only';
                ttsNotice.hidden = false;
            } else {
                ttsNotice.hidden = true;
            }
        }

        function layoutTtsPanel() {
            if (!ttsPanel) return;
            const header = document.querySelector('.header');
            const container = document.querySelector('.container');
            if (ttsPanel.hidden) {
                ttsPanel.style.top = '';
                if (container) container.style.paddingTop = '';
                return;
            }
            const h = header ? header.offsetHeight : 56;
            ttsPanel.style.top = h + 'px';
            if (container) container.style.paddingTop = (h + ttsPanel.offsetHeight + 16) + 'px';
        }

        // ---- speak engine ----
        function speakKey(log) { return (log.time || '') + '|' + (log.translation || log.transcript || ''); }

        function enqueueSpeak(text) {
            if (!text) return;
            if (TTS_MODE === 'latest') {
                try { window.speechSynthesis.cancel(); } catch (e) {}
                ttsQueue.length = 0;
                ttsSpeaking = false;
                ttsQueue.push(text);
            } else {
                ttsQueue.push(text);
                if (TTS_MODE === 'cap') { while (ttsQueue.length > TTS_MAX_BACKLOG) ttsQueue.shift(); }
            }
            drainSpeak();
        }

        function drainSpeak() {
            if (!ttsSupported || ttsSpeaking) return;
            const text = ttsQueue.shift();
            if (text === undefined) return;
            const u = new SpeechSynthesisUtterance(text);
            if (selectedVoice) u.voice = selectedVoice;
            u.lang = (selectedVoice && selectedVoice.lang) || ttsLang;
            u.rate = ttsRate;
            u.onend = () => { ttsSpeaking = false; stopKeepalive(); drainSpeak(); };
            u.onerror = () => { ttsSpeaking = false; stopKeepalive(); drainSpeak(); };
            ttsSpeaking = true;
            startKeepalive();
            try { window.speechSynthesis.speak(u); }
            catch (e) { ttsSpeaking = false; stopKeepalive(); }
        }

        function startKeepalive() {
            if (resumeKeepalive) return;
            resumeKeepalive = setInterval(() => {
                try { if (window.speechSynthesis.speaking) window.speechSynthesis.resume(); } catch (e) {}
            }, 10000);
        }
        function stopKeepalive() { if (resumeKeepalive) { clearInterval(resumeKeepalive); resumeKeepalive = null; } }

        // Called from updateTranscription for every line; speaks finals once.
        function maybeSpeak(log) {
            if (!ttsSupported || !ttsEnabled || !selectedVoice) return;
            if (log.isFinal !== true) return;
            const key = speakKey(log);
            if (spokenKeys.has(key)) return;
            spokenKeys.add(key);
            if (spokenKeys.size > 500) {
                const it = spokenKeys.values();
                for (let i = 0; i < 100; i++) { const n = it.next(); if (n.done) break; spokenKeys.delete(n.value); }
            }
            enqueueSpeak(log.translation || log.transcript);
        }

        // ---- enable / iOS unlock ----
        function primeUnlock() {
            if (ttsUnlocked || !ttsSupported) return;
            ttsUnlocked = true;
            try {
                const primer = new SpeechSynthesisUtterance(' ');
                primer.volume = 0;
                window.speechSynthesis.resume();
                window.speechSynthesis.speak(primer);
            } catch (e) {}
        }

        function setTtsEnabled(on) {
            ttsEnabled = on;
            localStorage.setItem('ttsEnabled', on ? 'true' : 'false');
            if (ttsToggle) ttsToggle.textContent = on ? '🔊 Speak' : '🔇 Speak';
            if (ttsPanel) ttsPanel.hidden = !on;
            if (on) {
                loadVoices();
                primeUnlock();
            } else {
                try { window.speechSynthesis.cancel(); } catch (e) {}
                ttsQueue.length = 0;
                ttsSpeaking = false;
                stopKeepalive();
            }
            updateTtsNotice();
            layoutTtsPanel();
        }

        if (!ttsSupported) {
            if (ttsToggle) ttsToggle.hidden = true;
        } else {
            ttsToggle.textContent = ttsEnabled ? '🔊 Speak' : '🔇 Speak';
            if (ttsPanel) ttsPanel.hidden = !ttsEnabled;

            ttsToggle.addEventListener('click', () => setTtsEnabled(!ttsEnabled));

            if (ttsRateSelect) {
                ttsRateSelect.value = String(ttsRate);
                ttsRateSelect.addEventListener('change', () => {
                    ttsRate = parseFloat(ttsRateSelect.value) || 1;
                    localStorage.setItem('ttsRate', String(ttsRate));
                });
            }
            if (ttsVoiceSelect) {
                ttsVoiceSelect.addEventListener('change', () => {
                    ttsVoiceURI = ttsVoiceSelect.value;
                    localStorage.setItem('ttsVoiceURI', ttsVoiceURI);
                    selectedVoice = voices.find(v => v.voiceURI === ttsVoiceURI) || null;
                    updateTtsNotice();
                });
            }

            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
            window.addEventListener('resize', layoutTtsPanel);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && ttsEnabled) { try { window.speechSynthesis.resume(); } catch (e) {} }
            });
            // If TTS was left enabled in a previous session, unlock on the first user gesture.
            ['click', 'touchend', 'keydown'].forEach(evt => document.addEventListener(evt, () => { if (ttsEnabled) primeUnlock(); }));
            if (ttsEnabled) layoutTtsPanel();
        }
        // =================== end Text-to-Speech ===================
```

---

### Task 7: Hook speaking into the caption path

**Files:**
- Modify: `public/display.html` — `updateTranscription` (after the "Skip if no content" guard, current line 441)

- [ ] **Step 1: Call maybeSpeak** — immediately after the `if (!log.transcript && !log.translation) { … return; }` block:

```js
            // Speak finalized lines (no-op unless TTS enabled + a matching voice exists)
            maybeSpeak(log);
```

(`maybeSpeak` is a hoisted function declaration; the `const` state it reads is initialized during the initial script run, before any WebSocket message arrives.)

---

### Task 8: Verification

- [ ] **Step 1: Syntax check the inline script**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('public/display.html','utf8');const m=h.match(/<script>([\s\S]*)<\/script>/);fs.writeFileSync('/tmp/display_script.js',m[1]);" && node --check /tmp/display_script.js && echo "SYNTAX OK"
```
Expected: `SYNTAX OK` (no parse errors).

- [ ] **Step 2: Headless behavior smoke (Playwright, stubbed speechSynthesis)**

Start the mock (`node test/tts_mock_server.js 8090 &`), then drive a headless browser: stub `window.speechSynthesis` via an init script that records every `speak(u)` call, navigate to `http://localhost:8090/?lang=ro`, click `#ttsToggle`, wait for a mock line, and assert at least one utterance whose text is one of the Romanian `LINES` was spoken, and that `u.lang` starts with `ro`. Tear down the mock.

Expected: ≥1 captured utterance with Romanian text and `lang` starting `ro`; no console errors.

- [ ] **Step 3: Commit the feature**

```bash
git add public/display.html
git commit -m "feat(tts): speak translated captions on viewer devices (opt-in)"
```

- [ ] **Step 4 (manual, by Josh on a device):** open `http://<host>:8080/?lang=ro` on a phone with a Romanian voice installed → tap 🔊 Speak → speak into the mic → hear spoken Romanian. Confirm catch-up feels right; if not, flip `TTS_MODE` to `'latest'` or `'full'` and rebuild.

---

## Self-Review

**Spec coverage:** NLLB→BCP-47 map (T3) ✓; voice enum/auto-pick/override/persist (T4–6) ✓; Speak toggle off-by-default + iOS unlock (T2/T6) ✓; voice picker + rate + notice (T2/T4/T6) ✓; cap-backlog queue with switch (T6) ✓; final-only + dedupe (T6/T7) ✓; iOS resume keepalive + visibility (T6) ✓; missing-voice notice+silent (T4/T6) ✓; mock server (T1) ✓; syntax + headless verify (T8) ✓; no server/IPC/format change (all tasks confined to display.html + test/) ✓.

**Placeholder scan:** none — every code step is complete.

**Type/name consistency:** `loadVoices`, `autoPickVoice`, `matchingVoices`, `bcp47Prefix`, `renderVoiceOptions`, `updateTtsNotice`, `layoutTtsPanel`, `speakKey`, `enqueueSpeak`, `drainSpeak`, `startKeepalive`/`stopKeepalive`, `maybeSpeak`, `primeUnlock`, `setTtsEnabled` — all defined in T6 and referenced consistently; element ids (`ttsToggle`, `ttsPanel`, `ttsVoiceSelect`, `ttsRateSelect`, `ttsNotice`) match T2 markup; localStorage keys (`ttsEnabled`, `ttsVoiceURI`, `ttsRate`) consistent throughout; `maybeSpeak` (T7 call) defined in T6.
