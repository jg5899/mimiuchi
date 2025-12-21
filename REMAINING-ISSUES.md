# Remaining Issues - December 2024

## Minor Issues (Low Priority)

### 1. ScriptProcessorNode Deprecation
**File:** `src/modules/speech/Deepgram.ts:287`
**Issue:** `createScriptProcessorNode` is deprecated in favor of `AudioWorklet`. While it still works, browser vendors may remove support in the future.
**Fix:** Migrate to AudioWorklet API (larger refactor needed)
```typescript
// Modern approach:
await this.audioContext.audioWorklet.addModule('audio-processor.js')
const workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor')
```

### 2. ESLint Configuration
**File:** `eslint.config.js`
**Issue:** ESLint is not properly configured for TypeScript/Vue and produces parsing errors.
**Fix:** Upgrade Node.js to 20.10.0+ or reconfigure ESLint with proper TypeScript support.

---

## Known Behaviors

### Translation Display Mode
The Home page has three display modes for translations (Settings > Translation):
- **Original Only**: Shows only English transcripts
- **Translation Only**: Shows translations (or original if translation not yet available)
- **Both**: Shows both original and translation stacked vertically

If you see both English and translated text, check the display mode toggle at the top of the Home page.

---

## Completed Fixes (December 2024)
- ✅ Magic numbers extracted to `DEEPGRAM_CONFIG` constants in Deepgram.ts
- ✅ Unused variables (`recorded`, `talking`, `mediaRecorder`) removed from Deepgram.ts
- ✅ Debug logging flag added to translation_queue.ts (`QUEUE_CONFIG.DEBUG`)
- ✅ Translation queue timeout (30s) added to recover from stuck translations
- ✅ Loose types fixed in Home.vue (`isTextFinal` now uses `Log` type)
- ✅ Debounce timers cleared in logs.ts
- ✅ Fadeout array access race condition fixed in speech.ts
- ✅ Restart interval cleared in Deepgram.ts stop()
- ✅ WebSocket cleanup in EnglishStream.vue
- ✅ beforeunload sync added to logs.ts
