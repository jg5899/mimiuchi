# Church Service Features - Implementation Guide

This document describes the new features added to mimiuchi for church service use.

## Features Implemented

### 1. Speaker Profile System ✅

**Purpose**: Switch between different speakers with custom settings for each.

**How to Use**:
1. Navigate to **Settings > Speaker Profiles**
2. Select a profile to edit (General, Speaker A, or Speaker B)
3. Configure for each profile:
   - Profile name
   - Language preference
   - Confidence threshold
   - Sensitivity level
   - Custom vocabulary (word replacements)

**Quick Switching**:
- On the home page, use the profile switcher buttons in the footer
- Click "General", "Speaker A", or "Speaker B" to instantly switch
- Speech recognition automatically adjusts to the selected profile's settings

**Custom Vocabulary**:
- Add common names, technical terms, or specialized vocabulary per speaker
- Example: "jesus" → "Jesus", "john" → "John the Baptist"
- Vocabulary is applied automatically during transcription

### 2. Multiple Translation Output Streams ✅

**Purpose**: Display 3-4 languages simultaneously for multilingual congregations.

**Available Languages**:
- English (`/english`)
- Spanish (`/spanish`)
- Korean (`/korean`)
- Mandarin Chinese (`/mandarin`)

**How to Use**:

**Setup**:
1. Navigate to **Settings > Multi-Language Streams**
2. Toggle on the languages you want to enable
3. Copy the stream URLs provided for each language
4. Open each URL in a separate browser window/tab or display

**Running Multiple Streams**:
```
Main Display: http://localhost:3344/ (main transcription)
Spanish:      http://localhost:3344/spanish
Korean:       http://localhost:3344/korean
Mandarin:     http://localhost:3344/mandarin
```

**Quick Open**:
- Use the "Open All Enabled Streams" button to launch all active language streams at once
- Each stream updates in real-time as transcriptions are translated

**Translation**:
- Requires Electron version for full translation support
- Web version will display original transcription
- Enable translation in **Settings > Translation**
- Translations are queued automatically for all enabled languages

### 3. Enhanced Transcription Options ✅

**Features Added**:
- Custom vocabulary per speaker profile (see Speaker Profiles)
- Sensitivity and confidence adjustments per profile
- Integration with existing word replacement system
- Profile-based language selection

**Recommendation**:
- Set up different profiles for different speakers/situations:
  - **General**: Default settings for announcements
  - **Speaker A**: Pastor/primary speaker with their specific vocabulary
  - **Speaker B**: Guest speaker or translator

## File Structure

### New Files Created:
```
src/
├── stores/
│   ├── speaker_profiles.ts          # Speaker profile management
│   └── multi_translation.ts         # Multi-language stream management
├── pages/
│   ├── LanguageStream.vue           # Individual language stream display
│   └── settings/
│       ├── SpeakerProfiles.vue      # Speaker profile settings page
│       └── MultiLanguage.vue        # Multi-language stream settings
└── helpers/
    └── translation_queue.ts         # Translation queue service
```

### Modified Files:
```
src/
├── components/
│   └── Footer.vue                   # Added profile switcher UI
├── stores/
│   └── speech.ts                    # Integrated profiles & multi-translation
├── plugins/
│   └── router.ts                    # Added language stream routes
├── pages/
│   └── Settings.vue                 # Added navigation items
electron/
├── main/
│   ├── index.ts                     # Added multi-translation IPC handlers
│   └── worker/
│       └── translation.ts           # Updated translation worker
```

## Usage Workflow

### Basic Church Service Setup:

1. **Before Service**:
   - Set up speaker profiles with common terms/names
   - Test microphone with sensitivity settings
   - Open language stream windows on separate displays

2. **During Service**:
   - Select appropriate speaker profile in footer
   - Start transcription with microphone button
   - All language streams update automatically
   - Switch profiles as speakers change

3. **Multi-Display Setup**:
   ```
   Display 1: Main mimiuchi window (control)
   Display 2: /english stream (English translation)
   Display 3: /spanish stream (Spanish translation)
   Display 4: /korean stream (Korean translation)
   ```

## Technical Notes

### Web vs Electron:

**Web Version**:
- Full speaker profile support ✅
- Full speech recognition ✅
- Language streams display original transcript
- Translation requires Electron

**Electron Version**:
- Full speaker profile support ✅
- Full speech recognition ✅
- Full translation support ✅
- Multi-language simultaneous translation ✅

### Translation Queue:

The system queues translations for multiple target languages:
1. Transcription is captured
2. Custom vocabulary is applied
3. Translation requests are queued for each enabled language
4. Translations are processed sequentially
5. Each language stream displays its translation

### Performance:

- Translation queue processes ~2 translations per second
- For 4 languages, expect ~2-second delay between transcription and all translations
- Web Speech API is real-time regardless of translation status

## Troubleshooting

### Speaker Profile Not Switching:
- Check that you're on the home page (profile switcher only appears there)
- Verify the profile settings have been saved in Settings

### Language Streams Not Updating:
- Ensure translation is enabled in Settings > Translation
- Check that you're using the Electron version for translation
- Verify language streams are enabled in Settings > Multi-Language Streams

### Translations Slow:
- First translation loads the model (takes 1-2 minutes)
- Subsequent translations are faster
- Multiple languages translate sequentially, so more languages = more delay

### Custom Vocabulary Not Working:
- Check that the profile with vocabulary is active
- Verify the original word pattern matches (case-insensitive)
- Test with word replacement in Settings > Word Replace

## Future Enhancements (Optional)

If you need additional features later:
- More language options
- Parallel translation (instead of sequential)
- Profile import/export
- Transcription history/logs
- Custom styling per language stream
- Whisper API integration for better accuracy

## Support

For issues or questions:
1. Check the original mimiuchi documentation
2. Review console for error messages
3. Test in both web and Electron versions
4. Verify microphone permissions

---

**Implementation Date**: 2025-01-XX
**mimiuchi Version**: 0.5.0 (fork)
**Target Completion**: By Sunday for church services
