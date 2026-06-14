// Summarize the caption pipeline's per-stage latency from captured [LAT] logs.
//
// 1) In the running app (renderer console or CDP): localStorage.setItem('lat_debug','1')
// 2) Capture the renderer console during a live ~60s mic session (CDP, or copy from devtools).
// 3) node scripts/analyze_latency.cjs <captured-log-file>     (or pipe stdin)
//
// Timed stages (ms):
//   stt_hold          first interim of a phrase -> Deepgram final = the finalization "hold"
//                     (the delay before anything is broadcast to viewers today)
//   stt_no_interim    finals Deepgram emitted with NO interim (instant; ms=0, listed so the
//                     stt_hold average isn't biased high by omitting the fast ones)
//   translate_done:*  final dispatched -> OpenAI translation returned, per target language
// Event-only stages (counts): translate_timeout, translate_invalid — the slow/failed cases
//   that translate_done deliberately excludes; watch these so translation isn't read as "fast".
//
// NOTE: translate_done covers the MULTI-LANGUAGE path only (the production church path). A
// single-translation-toggle deployment produces no translate_done samples.
const fs = require('fs')

const src = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : fs.readFileSync(0, 'utf8')

const re = /\[LAT\]\s+(\S+)\s+(\{.*\})/
const byStage = {}
const counts = {}

for (const line of src.split(/\r?\n/)) {
  const m = line.match(re)
  if (!m) continue
  let o
  try { o = JSON.parse(m[2]) } catch (e) { continue }
  const stage = o.lang ? `${m[1]}:${o.lang}` : m[1]
  counts[stage] = (counts[stage] || 0) + 1
  if (typeof o.ms === 'number') (byStage[stage] || (byStage[stage] = [])).push(o.ms)
}

function stats(a) {
  const s = [...a].sort((x, y) => x - y)
  const n = s.length
  // standard nearest-rank percentile (ceil(q*n)-1), not floor(q*n) which makes p90==max at small n
  const p = (q) => s[Math.max(0, Math.ceil(q * n) - 1)]
  const avg = Math.round(s.reduce((x, y) => x + y, 0) / n)
  return { n, min: s[0], p50: p(0.5), avg, p90: p(0.9), max: s[n - 1] }
}

const timed = Object.keys(byStage).sort()
if (!timed.length && !Object.keys(counts).length) {
  console.log('No [LAT] samples found. Enable lat_debug=1 and capture the renderer console during speech.')
  process.exit(0)
}

console.log('stage'.padEnd(26) + ['n', 'min', 'p50', 'avg', 'p90', 'max'].map((c) => c.padStart(7)).join('') + '   (ms)')
for (const st of timed) {
  const s = stats(byStage[st])
  console.log(
    st.padEnd(26) +
    [s.n, s.min, s.p50, s.avg, s.p90, s.max].map((v) => String(v).padStart(7)).join('') +
    (s.n < 20 ? '   (small n — percentiles approximate)' : ''),
  )
}

const eventOnly = Object.keys(counts).filter((s) => !byStage[s]).sort()
if (eventOnly.length) {
  console.log('\nevents (no timing):')
  for (const s of eventOnly) console.log('  ' + s.padEnd(24) + String(counts[s]).padStart(5))
}
