# Translated Text-to-Speech on Viewer Devices — Design

**Date:** 2026-06-14
**Branch:** `feature/viewer-tts` (off `feature/admin-dashboard`)
**Status:** Approved (brainstorming), pre-implementation

## 1. Goal

Let each attendee's own device **speak the translated caption aloud** in the language
they chose (e.g. a Romanian listener hears spoken Romanian), using the browser's built-in
`window.speechSynthesis`. Audio plays **on the viewer's device**, one language per device.

## 2. Why this approach

The translation pipeline already delivers per-language text to each subscribed viewer:
a phone opening `…:8080/?lang=ro` sends `{type:'subscribe', targetLang:'ron_Latn'}` and
then receives **only** Romanian messages of shape
`{type:'text', data:{transcript, translation, targetLang, languageName, isFinal, time}}`.
`public/display.html` already renders `log.translation || log.transcript`.

Because the correctly-filtered text is already at each device, viewer-device TTS needs
**no server, IPC, broadcast, message-format, or Pinia/persistence changes**. The whole
feature lives in `public/display.html`. Each device speaking its own language also avoids
the overlap problem of speaking multiple languages on one machine. It is also isolated
from the operator-side localStorage-wipe landmine (viewer browsers have separate storage).

Rejected alternatives:
- **Operator-Mac TTS** — one audio device can only voice one language; multiple languages
  would overlap. Useful only for a single-language room; not the church's multilingual case.
- **Server-side cloud TTS** — best/uniform voice quality, but needs a new binary audio
  transport (current broadcast forwards JSON only), per-utterance API cost, and the most
  complexity/latency. Deferred; can be layered later behind the same UI.

## 3. Scope

**In scope (all in `public/display.html`):**
- NLLB→BCP-47 locale map for voice selection.
- Async voice enumeration + auto-pick + manual override + per-device persistence.
- A 🔊 **Speak** toggle (off by default; the tap is the iOS audio-unlock gesture).
- A voice picker, a speaking-rate control, and a missing-voice notice.
- A speak engine with a **cap-the-backlog** queue and final-only, deduped utterances.
- iOS/mobile robustness (gesture unlock, resume keepalive, visibility resume).

**Out of scope (explicitly not touched):**
- The dead operator-side TTS (`speech.ts` → `Deepgram.speak()` no-op). Left alone.
  (Its misleading "Text-to-Speech" settings page is a separate future cleanup.)
- Server / IPC / broadcast routing / NLLB translation pipeline — unchanged.
- Cloud/neural TTS backend.

**New file:** `test/tts_mock_server.js` — a tiny standalone Node `ws` server for dev
verification without the mic/Deepgram/OpenAI stack (mirrors the existing
`test_profanity_filter.js` manual-test convention).

## 4. Components (inside `display.html`)

### 4.1 NLLB → BCP-47 map
A new constant mapping each configured stream's `targetLang` to a BCP-47 tag used to match
`speechSynthesis` voices:

| NLLB | BCP-47 | | NLLB | BCP-47 |
|---|---|---|---|---|
| `eng_Latn` | `en` | | `vie_Latn` | `vi` |
| `spa_Latn` | `es` | | `arb_Arab` | `ar` |
| `ukr_Cyrl` | `uk` | | `hin_Deva` | `hi` |
| `rus_Cyrl` | `ru` | | `pol_Latn` | `pl` |
| `por_Latn` | `pt` | | `ron_Latn` | `ro` |
| `fra_Latn` | `fr` | | `kor_Hang` | `ko` |
| `zho_Hans` | `zh-CN` | | `tgl_Latn` | `fil` |

The page's spoken language = `NLLB_TO_BCP47[targetLang]` when `?lang=` is set, else `en`
(English-stream viewers get English TTS for free). Voice matching compares the **primary
subtag** (text before `-`, lowercased), so `zh-CN` matches a `zh-TW` voice, `ro` matches
`ro-RO`, etc.

### 4.2 Voice selection
- Enumerate `speechSynthesis.getVoices()` on load **and** on `onvoiceschanged` (voices
  populate asynchronously; first call is often empty).
- Auto-pick for the page language: voices whose primary subtag equals the page's →
  prefer `localService` (offline, low-latency) → first match.
- Manual override via a `<select>`; selection saved to `localStorage.ttsVoiceURI` and
  re-applied on reload if still present.
- If no voice matches → **missing-voice state** (§4.5).

### 4.3 UI controls
Added to match the existing theme/font-button patterns:
- **🔊 Speak** toggle button in `.controls` (reuses `.theme-toggle` styling). Off by default.
  Icon reflects state (🔊 on / 🔇 off). Tapping it toggles `localStorage.ttsEnabled` and,
  on enable, performs the iOS unlock (§4.6).
- A fixed **TTS panel** directly under the header, shown only while enabled, containing:
  - Voice `<select>` (page-language voices first, then an "Other voices" group).
  - Speaking-rate `<select>` (0.8 / 0.9 / 1.0 / 1.1 / 1.2; default 1.0; saved to
    `localStorage.ttsRate`). Rationale: slowing down helps non-native listeners.
  - The missing-voice notice text.
- The panel's height is measured in JS and the `.container` top padding is bumped while it's
  open so captions never hide behind it.

`localStorage` keys (mirroring existing `theme` / `displayFontSize`):
`ttsEnabled`, `ttsVoiceURI`, `ttsRate`.

### 4.4 Speak engine + queue — cap-the-backlog (default)
- Speak **only `log.isFinal === true`** lines; the spoken string is `log.translation ||
  log.transcript` (exactly what is rendered).
- **Dedupe**: each line keyed by `` `${log.time}|${spokenText}` ``. A `Set` of spoken keys
  ensures a line is spoken **exactly once**, regardless of DOM re-renders (the rolling-window
  trim rebuilds the DOM; speaking is therefore hooked in `updateTranscription`, not in
  `renderTranscriptions`). The key Set is pruned to its most-recent ~500 entries.
- **Queue policy** behind a single `TTS_MODE` switch so we can A/B live (per Josh's note):
  - `'cap'` **(default)**: keep at most `TTS_MAX_BACKLOG = 2` items waiting; on overflow drop
    the oldest. Worst-case lag ≈ current utterance + 2 ≈ ~3 sentences. Self-correcting.
  - `'latest'`: on each new final, `speechSynthesis.cancel()` and speak only the newest.
    Tightest sync; may cut off mid-sentence.
  - `'full'`: unbounded queue; never skips; can drift far behind.
- One utterance in flight; `onend`/`onerror` drains the next. `onerror` must always advance
  the queue (never deadlock).

### 4.5 Missing-voice handling (chosen: notice + silent)
If no installed voice matches the page language, show a banner
*"No <Language> voice on this device — showing captions only"*, **do not speak**, keep text
captions rendering, and leave the voice `<select>` available for manual override (a user can
pick another installed/cloud voice). Never read target-language text with a wrong-language
voice.

### 4.6 iOS / mobile robustness
- First **Speak** tap (a user gesture) speaks a silent primer utterance
  (`text:' '`, `volume:0`) and calls `speechSynthesis.resume()` to unlock audio for the
  session. (iOS blocks synthesis until a gesture; this is also why TTS is opt-in.)
- A ~10 s `resume()` keepalive while speaking (works around the Chromium long-pause bug).
- `visibilitychange` → `resume()` when the page returns to foreground (mobile suspends
  synthesis when backgrounded).

## 5. Data flow

```
Mic → Deepgram(final) → OpenAI(ron_Latn) → translation_queue broadcast
   → httpserver (per-targetLang filter) → WS → phone ?lang=ro
        display.html: handleMessage → updateTranscription
           render caption (unchanged)
           + if ttsEnabled && isFinal && key unseen → enqueueSpeak(translation)
              → cap-backlog queue → SpeechSynthesisUtterance(voice=ro, rate) → device audio
```

No change upstream of `display.html`.

## 6. Error handling

| Condition | Behavior |
|---|---|
| No matching voice | Notice + silent; captions continue; manual override available |
| `utterance.onerror` | Log; advance queue; never deadlock |
| `speechSynthesis` absent (old browser) | Hide TTS controls; no-op; captions unaffected |
| Reconnect (3 s) replays last lines | Dedupe Set prevents re-speaking |
| Backgrounded / Chromium pause | `resume()` keepalive + visibility resume |

## 7. Preconditions (existing behavior, not built here)

- The target language stream must be **enabled** (Romanian/Spanish/Ukrainian/Russian are by
  default in `multi_translation.ts`).
- **Broadcasting** must be on (manual toggle on this branch).

## 8. Testing / verification

- **`test/tts_mock_server.js`** (new): a ~30-line Node `ws` server that emits synthetic
  `{type:'text', data:{translation, targetLang:'ron_Latn', languageName:'Romanian',
  isFinal:true, time}}` messages on an interval. Open `display.html?lang=ro&port=<mock>`
  against it → tap Speak → confirm Romanian audio — **no mic/translation needed**.
- **Static check**: `node --check` the inline script extracted from `display.html`, and a
  headless smoke (Playwright) to confirm no JS errors and that the speak path is invoked
  (assert `SpeechSynthesisUtterance` constructed) using a stubbed `speechSynthesis`.
- **Real verify**: edit `public/display.html` → toggle the display server off/on (it caches
  the file in its constructor) → open a phone at `:8080/?lang=ro` → tap Speak → speak into
  the mic → hear spoken Romanian.
- **Packaged**: `npm run build` (`vite build` copies `public/`→`dist/`, packed in
  `app.asar`) then relaunch.
- No automated unit-test harness exists in the repo; verification is manual/runtime, with the
  mock server as the fast loop.

## 9. Files

- **Edit:** `public/display.html` — all feature code (controls, map, voice logic, queue,
  robustness).
- **New:** `test/tts_mock_server.js` — dev verification only.
- **New:** this design doc.

## 10. Open follow-ups (not this work)

- Remove or fix the misleading dead operator-side "Text-to-Speech" settings page.
- Optional future: server-side cloud TTS backend for uniform voice quality, behind the same
  viewer toggle.
