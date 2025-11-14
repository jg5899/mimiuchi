# Testing Guide for mimiuchi

This guide provides comprehensive testing procedures for verifying the functionality of mimiuchi, particularly the Phase 3 enhancements (HTTP server, contextual translation, QR codes, and port configuration).

## Prerequisites

- Desktop app built or running via `npm run dev`
- A microphone connected and permitted
- Another device (phone/tablet/computer) on the same network for multi-device testing

---

## Core Functionality Tests

### 1. Basic Speech-to-Text

**Purpose**: Verify STT engines work correctly

**Test Cases**:

1. **Web Speech API**:
   - Go to Settings → Speech-to-Text
   - Select "Web Speech API"
   - Click the MIC button
   - Speak clearly
   - ✅ Verify: Text appears in real-time
   - ✅ Verify: Interim text (gray) updates as you speak
   - ✅ Verify: Final text (white) appears when you pause

2. **Deepgram** (if API key available):
   - Select "Deepgram"
   - Enter API key in Settings
   - Test same as above
   - ✅ Verify: Connection successful
   - ✅ Verify: Real-time transcription works

3. **Whisper** (if API key available):
   - Select "Whisper"
   - Enter OpenAI API key
   - Test same as above
   - ✅ Verify: Chunks sent every 3 seconds
   - ✅ Verify: Transcription appears

---

## Phase 3 Feature Tests

### 2. HTTP Display Server

**Purpose**: Verify built-in HTTP server and broadcasting

**Test Cases**:

1. **Start Server**:
   - Go to Settings → Connections
   - Find "HTTP Display Server" card
   - ✅ Verify: Toggle switch is visible (Electron only)
   - ✅ Verify: Port field shows (default: 8080) when server stopped
   - Toggle server ON
   - ✅ Verify: Success message "HTTP server started on port 8080"
   - ✅ Verify: Status shows "Server running on port 8080"
   - ✅ Verify: "Open in browser" button appears

2. **Port Configuration**:
   - Stop the server (toggle OFF)
   - Change port to 9000
   - Toggle server ON
   - ✅ Verify: Server starts on port 9000
   - ✅ Verify: Status shows "Server running on port 9000"

3. **Port Conflict Handling**:
   - Start server on port 8080
   - Open terminal: `python3 -m http.server 8080`
   - Try to start mimiuchi server on 8080
   - ✅ Verify: Error message "Port 8080 is already in use. Please choose a different port."
   - ✅ Verify: Server remains stopped
   - ✅ Verify: Can change port and start successfully

4. **Display Client**:
   - Start HTTP server
   - Click "Open in browser" button
   - ✅ Verify: Browser opens to `http://localhost:8080`
   - ✅ Verify: "Mimiuchi Display" header visible
   - ✅ Verify: Status shows "Connecting..." then "Connected"
   - ✅ Verify: Empty state shows "Waiting for transcriptions..."

5. **Broadcasting**:
   - Keep display client open
   - In mimiuchi, enable Broadcasting (📡 button)
   - Click MIC button and speak
   - ✅ Verify: Transcriptions appear in display client in real-time
   - ✅ Verify: Interim text shows (grayed out)
   - ✅ Verify: Final text appears solid
   - Speak multiple sentences
   - ✅ Verify: All sentences appear in chronological order

6. **Multi-Device Broadcasting**:
   - Get IP address from Settings → Connections → Network Connection Info
   - On mobile device, open browser to `http://[IP]:8080`
   - ✅ Verify: Display client loads
   - ✅ Verify: Shows "Connected"
   - Speak into microphone
   - ✅ Verify: Transcriptions appear on mobile device simultaneously
   - Open another tab on computer
   - ✅ Verify: Both tabs receive transcriptions

7. **Reconnection**:
   - With display client open, stop the HTTP server
   - ✅ Verify: Status changes to "Disconnected"
   - ✅ Verify: Transcriptions stop appearing
   - Start server again
   - ✅ Verify: Auto-reconnects within 3 seconds
   - ✅ Verify: Status shows "Connected"
   - ✅ Verify: New transcriptions appear

8. **Theme Toggle**:
   - In display client, click "Toggle Theme"
   - ✅ Verify: Switches between dark and light mode
   - Refresh page
   - ✅ Verify: Theme preference persists

---

### 3. Connection Info & QR Codes

**Purpose**: Verify network info display and QR code generation

**Test Cases**:

1. **Network Info Display**:
   - Go to Settings → Connections
   - Enable Broadcasting
   - ✅ Verify: "Network Connection Info" card appears
   - ✅ Verify: Shows "WebSocket URLs" section
   - ✅ Verify: Shows "HTTP URLs" section (if HTTP server running)
   - ✅ Verify: Shows "Local IP Addresses" section
   - ✅ Verify: Each network interface listed with IP

2. **Copy to Clipboard**:
   - Click copy button (📋) next to any URL
   - ✅ Verify: Icon changes to checkmark (✓) for 2 seconds
   - Paste into notepad
   - ✅ Verify: URL copied correctly

3. **QR Code Generation**:
   - Click QR code button next to any URL
   - ✅ Verify: Dialog opens showing QR code
   - ✅ Verify: QR code is clear and scannable
   - ✅ Verify: URL text displayed below QR code
   - Scan QR code with phone camera
   - ✅ Verify: Phone recognizes URL and offers to open
   - Click "Close"
   - ✅ Verify: Dialog closes

4. **HTTP Server URLs**:
   - Start HTTP server on port 9000
   - ✅ Verify: HTTP URLs section appears
   - ✅ Verify: URLs show correct port (9000)
   - Example: `http://192.168.1.100:9000`
   - ✅ Verify: QR code works for HTTP URLs
   - Scan and open on mobile
   - ✅ Verify: Display client loads correctly

---

### 4. Contextual Translation

**Purpose**: Verify context-aware translation improves quality

**Test Cases**:

1. **Enable Contextual Translation**:
   - Go to Settings → Translations
   - Enable translations
   - Select "OpenAI" as translation service
   - Enter OpenAI API key
   - ✅ Verify: "Use Context for Translation" toggle appears
   - ✅ Verify: Context window size slider visible
   - Enable "Use Context"
   - Set window size to 3

2. **Test Without Context**:
   - Disable "Use Context"
   - Start speech-to-text
   - Say: "He went to the store."
   - Say: "He bought milk."
   - Say: "He came home."
   - ✅ Verify: Each sentence translated independently
   - Note: Pronoun "He" might be generic in translation

3. **Test With Context**:
   - Enable "Use Context" (window size: 3)
   - Start speech-to-text
   - Say: "John went to the store."
   - Say: "He bought milk."
   - Say: "He came home."
   - ✅ Verify: Second sentence has context from first
   - ✅ Verify: Third sentence has context from first two
   - ✅ Verify: Pronoun resolution improved with context

4. **Context Window Size**:
   - Set context window to 1
   - Speak 3 sentences
   - ✅ Verify: Only previous 1 sentence used as context
   - Set context window to 5
   - ✅ Verify: Previous 5 sentences used as context

---

## Speaker Profiles Tests

### 5. Custom Vocabulary

**Purpose**: Verify custom word replacement works

**Test Cases**:

1. **Add Custom Vocabulary**:
   - Go to Settings → Speaker Profiles
   - Create a new profile "Tech Talk"
   - Add vocabulary:
     - "Claude" → "Claude Code"
     - "API" → "Application Programming Interface"
   - Save profile
   - Set as active profile

2. **Test Vocabulary Replacement**:
   - Start speech-to-text
   - Say: "I'm using Claude for API development"
   - ✅ Verify: Transcription shows "I'm using Claude Code for Application Programming Interface development"
   - ✅ Verify: Translation uses replaced text
   - ✅ Verify: Display client shows replaced text

---

## Error Handling Tests

### 6. Error Scenarios

**Purpose**: Verify graceful error handling

**Test Cases**:

1. **Port Already in Use**:
   - Test covered in Section 2.3

2. **No Microphone Permission**:
   - Deny microphone permission in browser
   - Click MIC button
   - ✅ Verify: Error message "You must give permission to use the microphone"
   - ✅ Verify: MIC button doesn't start

3. **Invalid API Key**:
   - Enter invalid Deepgram API key
   - Try to start STT
   - ✅ Verify: Error message displayed
   - ✅ Verify: Falls back to Web Speech API (if available)

4. **Network Disconnection**:
   - Start HTTP server with display client connected
   - Disconnect computer from network
   - ✅ Verify: Display client shows "Disconnected"
   - Reconnect to network
   - ✅ Verify: Auto-reconnects

---

## Language Support Tests

### 7. Internationalization

**Purpose**: Verify all 11 languages work correctly

**Test Cases**:

1. **Language Switching**:
   - Go to Settings → General
   - Change UI language to each:
     - English ✅
     - Spanish ✅
     - Japanese ✅
     - Chinese ✅
     - Romanian ✅
     - Ukrainian ✅
     - Russian ✅
     - French ✅
     - German ✅
     - Portuguese ✅
     - Italian ✅
   - For each language:
     - ✅ Verify: Settings → Connections → HTTP server strings translated
     - ✅ Verify: Connection info strings translated
     - ✅ Verify: QR code dialog strings translated

---

## Integration Tests

### 8. End-to-End Workflow

**Purpose**: Verify complete workflow from STT to display

**Test Cases**:

1. **Complete Setup**:
   - Start mimiuchi
   - Configure Deepgram STT
   - Enable OpenAI translation (English → Japanese)
   - Enable contextual translation
   - Create speaker profile with custom vocabulary
   - Start HTTP server on port 8080
   - Enable broadcasting

2. **Multi-Device Streaming**:
   - Open display client on computer browser
   - Open display client on mobile phone (via QR code)
   - Open display client on tablet (via HTTP URL)

3. **Full Transcription Flow**:
   - Start STT
   - Speak several sentences with technical terms
   - ✅ Verify: Real-time transcription on main app
   - ✅ Verify: Custom vocabulary applied
   - ✅ Verify: Translation appears with context
   - ✅ Verify: All 3 display clients show identical transcriptions simultaneously
   - ✅ Verify: Original and translated text both visible
   - ✅ Verify: Interim and final text states correct

---

## Performance Tests

### 9. Stress Testing

**Purpose**: Verify stability under load

**Test Cases**:

1. **Rapid Speech**:
   - Speak continuously for 5 minutes
   - ✅ Verify: No crashes
   - ✅ Verify: All transcriptions captured
   - ✅ Verify: Memory usage stable

2. **Multiple Connections**:
   - Open 10 display client tabs
   - Start transcription
   - ✅ Verify: All tabs update simultaneously
   - ✅ Verify: No lag or dropped messages

3. **Long Running Session**:
   - Run for 30+ minutes
   - ✅ Verify: No memory leaks
   - ✅ Verify: WebSocket stays connected
   - ✅ Verify: Performance doesn't degrade

---

## Regression Tests

### 10. Verify No Breakage

**Purpose**: Ensure Phase 3 didn't break existing features

**Test Cases**:

1. **WebSocket Connections** (user-defined):
   - Add custom WebSocket connection
   - Enable broadcasting
   - ✅ Verify: Still receives transcriptions
   - ✅ Verify: Format correct

2. **Webhooks**:
   - Add custom webhook
   - Enable broadcasting
   - ✅ Verify: POST requests sent
   - ✅ Verify: Payload correct

3. **Text Appearance Settings**:
   - Change font, size, color
   - ✅ Verify: All settings apply
   - ✅ Verify: Display updates correctly

4. **Text Fading**:
   - Enable text fade after 5 seconds
   - ✅ Verify: Text fades correctly
   - ✅ Verify: No errors in console

---

## Known Limitations

- HTTP server only works in Electron desktop app (not web version)
- QR codes require camera permission on mobile devices
- Contextual translation only works with OpenAI API (not Transformers.js)
- Maximum recommended display clients: 50 simultaneous connections

---

## Bug Reporting

If you find issues during testing:

1. Note the exact steps to reproduce
2. Check browser console for errors (F12)
3. Check Electron console (if in dev mode)
4. Note your configuration (OS, STT engine, translation settings)
5. Report on GitHub Issues with all details

---

## Next Steps After Testing

1. Document any bugs found
2. Verify fixes for critical issues
3. Create automated integration tests
4. Performance profiling and optimization
5. User acceptance testing

---

*Last updated: 2025-11-14*
