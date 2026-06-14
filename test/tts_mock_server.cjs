// Minimal mock of Mimiuchi's display server for TTS dev testing — NO mic/Deepgram/OpenAI.
// Usage:  node test/tts_mock_server.cjs [port]    (default 8090)
// Open:   http://localhost:<port>/?lang=ro       (serves the real public/display.html)
// It serves display.html for any GET (like the real catch-all server), accepts the
// {type:'subscribe',targetLang} message, and streams synthetic Romanian final messages.
const http = require('http')
const fs = require('fs')
const path = require('path')

let WebSocketServer
try { const ws = require('ws'); WebSocketServer = ws.WebSocketServer || ws.Server }
catch (e) { console.error('Needs the `ws` package (already a mimiuchi dep). Run from repo root.'); process.exit(1) }

const PORT = parseInt(process.argv[2] || '8090', 10)
const DISPLAY = fs.readFileSync(path.join(__dirname, '..', 'public', 'display.html'))
const LINES = [
  'Bună dimineața și bine ați venit la biserică.',
  'Astăzi vom vorbi despre dragoste și har.',
  'Să ne rugăm împreună în numele lui Isus.',
  'Domnul este păstorul meu, nu voi duce lipsă de nimic.',
  'Mulțumim pentru închinarea de astăzi.',
]

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
  res.end(DISPLAY)
})
const wss = new WebSocketServer({ server })
wss.on('connection', (socket) => {
  console.log('[mock] client connected')
  let i = 0
  socket.on('message', (m) => console.log('[mock] recv:', m.toString()))
  const timer = setInterval(() => {
    const line = LINES[i % LINES.length]
    i += 1
    const payload = {
      transcript: 'English source line ' + i,
      translation: line,
      targetLang: 'ron_Latn',
      languageName: 'Romanian',
      isFinal: true,
      time: new Date().toISOString(),
    }
    socket.send(JSON.stringify({ type: 'text', data: payload }))
    console.log('[mock] sent:', line)
  }, 4000)
  socket.on('close', () => { clearInterval(timer); console.log('[mock] client disconnected') })
})
server.listen(PORT, () => console.log(`[mock] http+ws on http://localhost:${PORT}  (open /?lang=ro)`))
