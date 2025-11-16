# Testing Guide for Language-Specific Network Access

## Quick Start Testing (5 minutes)

### Test 1: Network Clients (Issue 1 - "Waiting for transcriptions...")

**Goal**: Verify that network clients can view language-specific translations

#### Step 1: Start the App
```bash
npm run dev
```

#### Step 2: Enable Broadcasting
1. Open the app (should auto-launch)
2. Go to **Settings** (gear icon)
3. Go to **Connections**
4. Toggle **Enable HTTP Server** ON
5. Note the port (default: 8080)

#### Step 3: Enable Languages
1. Go to **Settings** > **Multi-Language**
2. Enable at least **Spanish** (toggle it ON)
3. You can enable more if you want (Ukrainian, Russian, etc.)

#### Step 4: Configure Translation
1. Go to **Settings** > **Translation**
2. Make sure translation is **Enabled** (toggle ON)
3. Select translation engine:
   - **OpenAI** (requires API key) - recommended for testing
   - **Transformers.js** (no API key but slower)

#### Step 5: Open Browser to Language Stream
1. Open a browser (Chrome, Safari, Firefox)
2. Go to: `http://localhost:8080?lang=spanish`
3. You should see: **"Mimiuchi Display - Spanish"** at the top
4. The page should say "Waiting for transcriptions..."

#### Step 6: Start Speaking
1. Go back to the Electron app
2. Make sure you're on the **Home** page
3. Click the microphone button to start listening
4. **Speak in English**: "Hello, this is a test"
5. Wait a few seconds for translation

#### Step 7: Check Results

**In the Browser** (`http://localhost:8080?lang=spanish`):
- Should show the **Spanish translation** (e.g., "Hola, esto es una prueba")
- Each transcription appears in a card/box
- Timestamp below each entry

**If nothing appears**, open browser console (F12) and check for:
```
[Display] Configured for language: Spanish (spa_Latn)
[Display] Received message: {type: "text", data: {...}}
[Display] Processing text message
```

**In the Electron app** (View > Toggle Developer Tools):
```
[Broadcast] Broadcasting to enabled streams: 1
[Broadcast] Sending to Spanish (spa_Latn): Hola, esto...
```

---

### Test 2: Local Stream Display (Issue 2 - Chunking)

**Goal**: Verify that local Electron streams show clean, readable translations

#### Step 1: Open Language Stream in Electron
1. In the Electron app, look at the URL bar (top of window)
2. Change from `#/` to `#/spanish`
3. Press Enter
4. You should see a page titled **"Spanish"**

#### Step 2: Start Speaking
1. Open another window or go back to Home (`#/`)
2. Start the microphone
3. Speak: "This is another test of the translation system"

#### Step 3: Check the Spanish Stream Window
1. Go back to the `#/spanish` window
2. You should see:
   - **Clean card-style boxes** (not tiny chunks)
   - Each translation in its own box with padding
   - Colored left border on each box
   - Timestamp below each translation
   - Larger, readable text

**What you should NOT see**:
- ❌ Same text repeated multiple times in tiny boxes
- ❌ Cluttered, hard-to-read chunks
- ❌ Text running together

---

## Detailed Testing (15 minutes)

### Test 3: Multiple Languages Simultaneously

#### Setup
1. Enable 3 languages: Spanish, Ukrainian, Russian
2. Open 3 browser tabs:
   - Tab 1: `http://localhost:8080?lang=spanish`
   - Tab 2: `http://localhost:8080?lang=ukrainian`
   - Tab 3: `http://localhost:8080?lang=russian`

#### Test
1. Speak: "Good morning everyone, welcome to the service"
2. Each tab should show its own language:
   - Spanish: "Buenos días a todos, bienvenidos al servicio"
   - Ukrainian: "Доброго ранку всім, ласкаво просимо на службу"
   - Russian: "Доброе утро всем, добро пожаловать на службу"

---

### Test 4: Backward Compatibility (No Language Parameter)

#### Test
1. Open browser to: `http://localhost:8080` (NO ?lang= parameter)
2. This should show the **original transcript** + **primary translation**
3. Speak something and verify it appears

This tests that clients without language filtering still work.

---

### Test 5: Invalid Language Parameter

#### Test
1. Open browser to: `http://localhost:8080?lang=invalid`
2. Check browser console (F12)
3. Should see warning: "Unknown language: invalid"
4. Page should fall back to showing all content (like no parameter)

---

### Test 6: QR Code Access (Mobile Testing)

#### Setup
1. Make sure your phone is on the **same WiFi** as your computer
2. In Electron app, go to **Settings** > **Connections**
3. You should see language-specific URLs with QR icons

#### Test
1. Click the QR icon next to "Spanish" URL
2. Scan with your phone
3. Should open the Spanish stream on your phone
4. Speak on your computer
5. Translations should appear on your phone in real-time

---

## Troubleshooting Guide

### Issue: Browser Shows "Waiting..." Forever

**Diagnosis Steps**:

1. **Check Electron Console** (View > Toggle Developer Tools):
   ```
   Look for: [Broadcast] Broadcasting to enabled streams: X
   ```
   - If you see this with X > 0, broadcasting is working
   - If you don't see this, translations aren't being broadcast

2. **Check Browser Console** (F12 in browser):
   ```
   Look for: [Display] Received message
   ```
   - If you see this, messages are arriving
   - If you don't, WebSocket connection issue

3. **Verify Language is Enabled**:
   - Settings > Multi-Language
   - Make sure the language toggle is ON

4. **Verify Translation is Working**:
   - Look at Home page after speaking
   - You should see both original text AND translation
   - If no translation appears, check:
     - Settings > Translation > Enabled = ON
     - If using OpenAI, check API key is set

5. **Check Translation Type**:
   - Settings > Translation
   - Make sure you're NOT using single-language mode
   - Multi-language should be enabled

**Common Fixes**:
- Restart the app (npm run dev again)
- Make sure you spoke enough text (short words might not translate)
- Wait a few seconds for translation to complete
- Check that HTTP server is enabled

---

### Issue: Translations Still Chunked in Local Streams

**Diagnosis Steps**:

1. **Check if filtering is working**:
   - Look at debug info at bottom of stream page
   - "Display logs count" should be less than "MultiLogs count"
   - If they're equal, filtering isn't working

2. **Look at the logs**:
   - Press F12 in Electron window
   - Look for: `DisplayLogs computed`
   - Should show filtering happening

**Common Fixes**:
- Make sure you're viewing a FINAL result (wait for speech to finish)
- Refresh the stream page
- Check that isFinal flag is being set properly

---

### Issue: Multiple Clients Not Working

**Diagnosis Steps**:

1. **Check HTTP server logs** (Electron console):
   ```
   Look for: [HTTPServer] Broadcast complete for spa_Latn: sent to X clients
   ```
   - X should match number of browser windows open

2. **Check each client is subscribed**:
   - Each browser console should show:
   ```
   Subscribed to language: spa_Latn
   ```

---

## Expected Console Logs (Success Case)

### Electron Console (View > Toggle Developer Tools):
```
[Broadcast] Broadcasting to enabled streams: 1
[Broadcast] Sending to Spanish (spa_Latn): Hola, esto es una prueba
[HTTPServer] Sending message to client subscribed to spa_Latn
[HTTPServer] Broadcast complete for spa_Latn: sent to 1 clients
```

### Browser Console (F12):
```
[Display] Configured for language: Spanish (spa_Latn)
Connected to Mimiuchi
[Display] Received message: {type: "text", data: {…}}
[Display] Processing text message: {hasTranscript: true, hasTranslation: true, …}
[Display] Removed empty state, first message received
[Display] Added new final transcription at index 0
```

---

## Performance Testing (Optional)

### Test Long Running Session
1. Enable 5 languages
2. Speak continuously for 5 minutes
3. Check that:
   - Display only shows last 50 entries (not thousands)
   - Page doesn't slow down
   - Memory usage is reasonable

---

## What to Report Back

After testing, please report:

1. **Which tests passed** ✅
2. **Which tests failed** ❌
3. **Any error messages** from consoles
4. **Screenshots** if something looks wrong
5. **Which translation engine** you used (OpenAI or Transformers.js)

---

## Next Steps After Testing

If everything works:
- ✅ Ready to use in production!
- Consider removing console.log statements for cleaner logs
- Document the feature for end users

If issues found:
- Share the console logs (Electron + Browser)
- I can help debug further
