// Lightweight, opt-in latency instrumentation for the caption pipeline.
//
// INERT by default. Enable at runtime (no rebuild) with:
//   localStorage.setItem('lat_debug', '1')   // then speak; disable with removeItem('lat_debug')
//
// Emits `[LAT] <stage> {json}` to the console AND appends to window.__latBuf (a capped ring
// buffer) so a whole session can be read in one CDP call:  copy(window.__latBuf.join('\n'))
// then feed it to scripts/analyze_latency.cjs. When off, every entry point early-returns —
// no Date.now, no writes, no buffer growth.

function latOn(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('lat_debug') === '1'
  } catch (e) {
    return false
  }
}

function emit(stage: string, obj: Record<string, any>): void {
  const line = '[LAT] ' + stage + ' ' + JSON.stringify(obj)
  // eslint-disable-next-line no-console
  console.log(line)
  try {
    const g: any = typeof window !== 'undefined' ? window : globalThis
    if (!g.__latBuf) g.__latBuf = []
    g.__latBuf.push(line)
    if (g.__latBuf.length > 5000) g.__latBuf.shift()
  } catch (e) {}
}

export function latLog(stage: string, data: Record<string, any> = {}): void {
  if (!latOn()) return
  emit(stage, { t: Date.now(), ...data })
}

const _marks = new Map<string, number>()

// Record a start time for a key (e.g. a translation task id).
export function latMark(key: string): void {
  if (!latOn()) return
  _marks.set(key, Date.now())
}

// Log elapsed time since the matching latMark(key), then forget the key.
export function latMeasure(stage: string, key: string, extra: Record<string, any> = {}): void {
  if (!latOn()) return
  const start = _marks.get(key)
  if (start === undefined) return
  _marks.delete(key)
  emit(stage, { t: Date.now(), ms: Date.now() - start, ...extra })
}

// Delete a mark without logging — call on terminal failure paths (timeout/error/invalid) so
// _marks never retains stale starts and translation latency isn't survivorship-biased.
// Ungated delete is safe (no-op when key absent, and _marks is empty when instrumentation is off).
export function latDiscard(key: string): void {
  _marks.delete(key)
}

// Finalization-hold timer: first interim of a phrase -> its final. All state is gated by
// latOn(), so nothing is touched (no Date.now, no writes) in production.
let _phraseStart = 0
export function latPhraseInterim(): void {
  if (!latOn()) return
  if (!_phraseStart) _phraseStart = Date.now()
}
export function latPhraseFinal(text: string): void {
  if (!latOn()) { _phraseStart = 0; return }
  const t = (text || '').trim()
  if (_phraseStart && t) {
    latLog('stt_hold', { ms: Date.now() - _phraseStart, text: t.slice(0, 30) })
  } else if (t) {
    // final with no preceding interim — Deepgram finalized instantly; counted separately so
    // it doesn't bias the stt_hold distribution high by omission.
    latLog('stt_no_interim', { ms: 0, text: t.slice(0, 30) })
  }
  _phraseStart = 0 // ALWAYS reset, including empty/silence finals, so the next phrase times fresh
}
