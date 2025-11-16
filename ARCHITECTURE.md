# Mimiuchi Architecture & User Guide

## Port Configuration

### Development Ports
- **Port 3344**: Vite dev server (Electron mode) - configured in `package.json` debug section
- **Port 5173**: Default Vite port when running `npm run dev` (web-only mode)

### Production Ports
- **Port 8080**: HTTP server for network display (default, configurable in Settings > Connections)

## How the App Works

### Architecture Overview

**mimiuchi** has TWO distinct display systems:

#### 1. Electron App (Local Only)
- Runs as a desktop application
- Access routes like `#/spanish`, `#/ukrainian`, etc. within the app
- **Purpose**: View language-specific translation streams in separate windows
- **Network Access**: NOT accessible over network

#### 2. HTTP Display Server (Network Accessible)
- Serves `public/display.html` via HTTP on port 8080
- Access via: `http://[your-IP]:8080`
- **Purpose**: Allow other devices on the network to view transcriptions
- **Current Limitation**: Shows ALL content (original + primary translation), NOT language-specific

---

## User Workflows

### Workflow 1: Local Transcription Only
**Who**: Single user on one computer
**How**:
1. Open mimiuchi desktop app
2. Configure STT settings (Settings > STT)
3. Start speaking - see transcriptions on Home page (`#/`)

### Workflow 2: Multi-Language Streams (Electron Windows)
**Who**: Church/event with multiple language groups in same room
**How**:
1. Enable languages in Settings > Multi-Language
2. Open new Electron windows for each language:
   - Right-click app, select "New Window"
   - Navigate to `#/spanish`, `#/ukrainian`, etc.
3. Position windows on different monitors/screens
4. Start speaking - each window shows only its language translation

**Current Issue**: This only works within Electron windows, not over network

### Workflow 3: Network Display (Browsers/Mobile)
**Who**: Remote viewers or viewers with their own devices
**How**:
1. Enable HTTP server in Settings > Connections
2. Set port (default 8080)
3. On other devices, open browser to `http://[host-IP]:8080`
4. View transcriptions in real-time

**Current Issue**:
- ❌ No way to view language-specific streams over HTTP
- ❌ `display.html` shows ALL content, not filtered by language
- ✅ Shows both original and one primary translation

---

## Current Architecture Gaps

### Problem 1: Language Streams Not Accessible Over Network
**Issue**: Language routes like `/spanish` are Vue Router hash routes (`#/spanish`) that only work inside Electron
**Impact**: Network users can't view language-specific translations

**Possible Solutions**:
1. **Query Parameter Approach**: Modify `display.html` to accept `?lang=spanish`
2. **Separate HTML Pages**: Create `display-spanish.html`, `display-ukrainian.html`, etc.
3. **Dynamic HTTP Routes**: Update HTTP server to serve language-specific endpoints like `/spanish`, `/ukrainian`

### Problem 2: Port Confusion
**Issue**: Multiple ports during development (3344, 5173, 8080) create confusion
**Impact**: Users don't know which URL to share

**Current State**:
- **Development**: Vite runs on port 3344 (Electron) or 5173 (web)
- **Production**: Only HTTP server on port 8080 matters
- **User-Facing**: Only port 8080 should be shown in Connection Info

---

## Recommended User Flow (As Currently Designed)

### Setup Phase
1. **Install**: Download and run mimiuchi desktop app
2. **Configure STT**: Choose Web Speech, Deepgram, or Whisper (Settings > STT)
3. **Configure Translation**: Enable OpenAI or Transformers.js (Settings > Translation)
4. **Enable Languages**: Select which languages to translate to (Settings > Multi-Language)
5. **Enable HTTP Server**: Turn on network broadcasting (Settings > Connections)

### Usage Phase

**For Main Speaker/Operator**:
- Use Home page (`#/`) to see original transcriptions + primary translation

**For Language Groups (Local)**:
- Open separate Electron windows
- Navigate each to its language: `#/spanish`, `#/ukrainian`, etc.
- Full-screen on monitors/projectors

**For Remote Viewers**:
- Share HTTP URL: `http://[your-IP]:8080`
- Viewers see original + primary translation (ALL languages currently shown together)

---

## Technical Details

### Translation Flow
```
Speech Input (Microphone)
    ↓
STT Engine (WebSpeech/Deepgram/Whisper)
    ↓
Word Replacement (custom rules)
    ↓
Multi-Language Translation (via translation_queue.ts)
    ↓ (parallel translation to all enabled languages)
Translation Worker (OpenAI or Transformers.js)
    ↓
Output to:
    - Home page (main window)
    - Language stream pages (#/spanish, etc.) - Electron only
    - HTTP display server (port 8080) - network accessible
    - WebSocket connections
    - Webhook endpoints
```

### Data Stores
- **logsStore**: Original transcriptions + single primary translation
- **multiTranslationStore**: Multi-language translations organized by language code
  - `multiLogs[index].translations[langCode]` = translation for that language

### Display Systems
- **Home.vue**: Shows `logsStore.logs` (original + primary translation)
- **LanguageStream.vue**: Shows `multiTranslationStore.getLogsForLanguage(targetLang)`
- **display.html**: Shows `logsStore.logs` via WebSocket (original + primary translation)

---

## What Needs to be Fixed

### High Priority
1. ✅ **Clarify Connection URLs**: Only show port 8080 in Connection Info
2. ❌ **Enable Language-Specific HTTP Access**: Allow `http://[IP]:8080?lang=spanish`
3. ❌ **Update display.html**: Filter by language query parameter

### Medium Priority
1. Performance optimization (code-splitting, lazy loading)
2. Better error messages when translations fail
3. Auto-reconnect improvements

### Documentation Needed
1. Clear README explaining the two display modes
2. User guide for setting up multi-language services
3. Network setup guide for remote viewers
