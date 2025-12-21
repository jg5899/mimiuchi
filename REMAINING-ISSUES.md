# Remaining Issues - December 2024

## Minor Issues (Low Priority)

### 1. ScriptProcessorNode Deprecation
**File:** `src/modules/speech/Deepgram.ts:280`
**Issue:** `createScriptProcessorNode` is deprecated in favor of `AudioWorklet`. While it still works, browser vendors may remove support in the future.
**Fix:** Migrate to AudioWorklet API (larger refactor needed)
```typescript
// Modern approach:
await this.audioContext.audioWorklet.addModule('audio-processor.js')
const workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor')
```

### 2. Magic Numbers in Deepgram.ts
**File:** `src/modules/speech/Deepgram.ts`
**Lines:** 185, 256, 280
**Issue:** Hard-coded values like `300` (endpointing), `4096` (buffer size), and reconnection delays.
**Fix:** Extract to constants:
```typescript
private readonly ENDPOINTING_MS = 300
private readonly BUFFER_SIZE = 4096
private readonly MIN_BACKOFF_MS = 1000
private readonly MAX_BACKOFF_MS = 16000
```

### 3. Excessive Logging in translation_queue.ts
**File:** `src/helpers/translation_queue.ts`
**Issue:** Every translation result, broadcast, and queue operation logs to console. In high-volume scenarios, this creates log spam.
**Fix:** Add debug flag:
```typescript
private readonly DEBUG = false  // or from environment
if (this.DEBUG) console.log('[TranslationQueue] ...')
```

### 4. Loose Types in Home.vue
**File:** `src/pages/Home.vue:111-129`
**Issue:** The `isTextFinal` function uses `any` type for the `log` parameter.
**Fix:**
```typescript
import type { Log } from '@/stores/logs'
function isTextFinal(log: Log): boolean {
  // ... implementation
}
```

### 5. Unused Variables in Deepgram.ts
**File:** `src/modules/speech/Deepgram.ts:76-79`
**Issue:** Properties `recorded`, `talking`, `mediaRecorder` are declared but never used.
**Fix:** Remove unused properties or document why they exist.

### 6. Translation Queue Timeout
**File:** `src/helpers/translation_queue.ts:108-136`
**Issue:** If Electron crashes or worker thread hangs, `activeTasks` will never decrement, blocking the queue permanently.
**Fix:** Add timeout to recover from stuck translations:
```typescript
const timeoutId = setTimeout(() => {
  console.error(`[TranslationQueue] Translation timeout for ${tgtLang}`)
  this.activeTasks--
  this.processQueue()
}, 30000) // 30 second timeout
```

---

## Completed Fixes (for reference)
- Debounce timers cleared in logs.ts
- Fadeout array access race condition in speech.ts
- Restart interval cleared in Deepgram.ts stop()
- WebSocket cleanup in EnglishStream.vue
- beforeunload sync added to logs.ts
