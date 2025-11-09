# Docker Mode Features

This document explains what mimiuchi can do in Docker mode. As of v1.0.0, Docker mode provides the complete feature set for web-based multi-language translation.

> **Note**: For Docker installation and deployment instructions, see [DOCKER.md](DOCKER.md). This document focuses on features, capabilities, and church-specific deployment patterns.

## ✅ All Core Features Work

### Core Functionality
- ✅ **Web Interface** - Full Vue.js UI accessible from any browser
- ✅ **Multi-Language Streams** - Spanish, Ukrainian, Russian, Portuguese, French, Korean, Mandarin, Tagalog, Vietnamese, Arabic, Hindi, Polish
- ✅ **Real-time Translation** - OpenAI GPT-4o-mini with church-specific context
- ✅ **WebSocket Broadcasting** - Translations sent to all connected browser clients
- ✅ **Speech-to-Text** - Multiple options available (see below)
- ✅ **Text Display** - Customizable text window with auto-scrolling
- ✅ **Word Replacement** - Custom vocabulary and corrections
- ✅ **Speaker Profiles** - Different settings per speaker
- ✅ **Export** - Download transcripts/translations in TXT, JSON, CSV
- ✅ **Multi-Device Access** - Access from phones, tablets, laptops on same network
- ✅ **Network Deployment** - Can be hosted on local servers or cloud
- ✅ **Diagnostic Agents** - All health checks, cost monitoring, quality validation work

### Language Stream Pages
Each enabled language has its own page accessible at:
- `/spanish` - Spanish translations
- `/ukrainian` - Ukrainian translations
- `/russian` - Russian translations
- `/portuguese` - Portuguese translations
- (etc. for all enabled languages)

These pages:
- Show only translated text (no English)
- Auto-scroll for readability
- Optimized for mobile/tablet display
- Perfect for projection screens or displays

## ⚙️ Configuration Options

### Speech-to-Text Options

**Deepgram (Cloud API)**
- ✅ Fully supported
- Requires: Deepgram API key
- Cost: $0.0043/minute (~$0.26 per hour)
- Quality: Excellent
- Latency: Low (~200-500ms)
- Setup: Enter API key in Settings → STT

**OpenAI Whisper (Cloud API)**
- ✅ Fully supported
- Requires: OpenAI API key
- Cost: $0.006/minute (~$0.36 per hour)
- Quality: Excellent
- Latency: Medium (~500-1000ms)
- Setup: Enter API key in Settings → STT

**Web Speech API (Browser-based)**
- ⚠️ **Limited browser support**
- Only works in: Chrome, Edge (Chromium-based browsers)
- Does NOT work in: Firefox, Safari (for continuous recognition)
- Free: No API key required
- Quality: Good (uses browser's built-in STT)
- Latency: Low
- **User must enable microphone** in browser settings
- **HTTPS required** for production (microphone access restriction)

### Translation

**OpenAI Translation**
- ✅ Works perfectly
- Requires: OpenAI API key in Settings → Translation
- **Important**: API key must be set on EACH device/browser
  - Main operator device: Set API key
  - Language stream displays: Can receive translations without API key
  - The server needs the API key to perform translations

**How it works:**
1. Main operator device sends transcript via WebSocket
2. Server's translation worker processes it (needs API key)
3. Server broadcasts translations to all connected clients
4. Language stream pages receive and display translations

## 🔧 Setup Requirements

### For Docker Server Host
- Docker Engine 20.10+
- 2GB RAM minimum
- Ports 3000 and 7714 open
- Node.js 20+ (for building)

### For Client Devices
- Modern web browser (Chrome, Edge recommended)
- Network access to server
- For microphone: HTTPS connection (or localhost for testing)

### For Speech-to-Text
Choose ONE option:
1. **Deepgram** - Best quality, low latency, paid
2. **Whisper** - Great quality, medium latency, paid
3. **Web Speech API** - Good quality, free, browser-limited

### For Translation
- OpenAI API key required
- Set once on the operator's device
- ~$0.05-0.08 per service hour

## 💡 Recommended Deployment

### For Churches

**Recommended Setup:**
```
Server (Docker Container)
  ├── Port 3000: Main operator interface
  ├── Port 7714: WebSocket for translations
  │
Client Devices:
  ├── Operator Station: http://[server]:3000
  │   └── Runs STT, controls everything, enters API keys
  │
  ├── Spanish Display: http://[server]:3000/#/spanish
  │   └── Shows only Spanish translations
  │
  ├── Ukrainian Display: http://[server]:3000/#/ukrainian
  │   └── Shows only Ukrainian translations
  │
  └── Mobile Devices: http://[server]:3000/#/[language]
      └── Congregation members can follow along
```

**Cost Estimate (4 services/month):**
- Deepgram STT: $1.04/month
- OpenAI Translation: $0.20-0.32/month
- **Total: ~$1.50-2.00/month**

### For Cloud Deployment

**Hosting Options:**
- **DigitalOcean App Platform**: $5/month droplet + API costs
- **AWS ECS Fargate**: Pay per use
- **Google Cloud Run**: Pay per use, free tier available
- **Azure Container Instances**: Pay per use
- **Fly.io**: Free tier available, pay for scaling

**Domain + SSL:**
- Use Let's Encrypt for free SSL certificates
- Point domain to your server
- Access via: https://church.example.com

## 🔒 Security Considerations

### API Keys
- **Never commit API keys** to version control
- **Set per-device** in browser localStorage
- **Use environment variables** for server-side keys (future feature)

### Network Security
- **Enable firewall** rules for ports 3000, 7714
- **Use HTTPS** in production (required for microphone access)
- **Restrict access** via firewall or reverse proxy if needed

### Data Privacy
- Transcripts stored in **browser localStorage only**
- No data sent to mimiuchi servers
- API usage goes directly to:
  - Deepgram (if using Deepgram STT)
  - OpenAI (if using Whisper STT or translation)
  - Browser vendor (if using Web Speech API)

## 📊 Performance

### Server Requirements
- **Minimal**: 0.5 CPU, 512MB RAM (idle)
- **Recommended**: 2 CPU, 2GB RAM (active translation)
- **Network**: 1-5 Mbps (for WebSocket clients)

### Client Requirements
- **Any modern browser**
- **Stable network connection**
- **No special hardware** for language stream displays

## 🐛 Troubleshooting

### "Translation not working"
- Check: API key set in Settings → Translation
- Check: WebSocket connected (browser console should show "WebSocket connected")
- Check: Server logs: `docker-compose logs -f`

### "WebSocket connection failed"
- Check: Port 7714 is open on server
- Check: Firewall allows WebSocket connections
- Check: Using correct server IP/hostname

### "Microphone not working"
- Check: Browser supports Web Speech API (use Chrome/Edge)
- Check: HTTPS enabled (or using localhost for testing)
- Check: Microphone permissions granted in browser
- Try: Deepgram or Whisper API instead

### "Language stream page blank"
- Check: Language is enabled in Settings → Multi-Language
- Check: Translations are being generated (check main page first)
- Check: Browser console for errors

## 🚀 Future Enhancements

Planned features for Docker mode:
- [ ] Environment variable for server-side API keys
- [ ] WebRTC for lower-latency audio streaming
- [ ] Recording/replay of past services
- [ ] User authentication for multi-tenant deployment
- [ ] Prometheus metrics for monitoring
- [ ] Horizontal scaling support

## 📞 Support

For issues specific to Docker deployment:
- Check: [DOCKER.md](DOCKER.md) for setup instructions
- Check: Docker logs for errors
- Report: GitHub Issues with "docker" label
