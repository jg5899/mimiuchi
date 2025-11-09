# Refactoring Plan: Church Translation Focus

## Goal
Transform mimiuchi from a VR/gaming translation tool into a **focused church translation application**.

## What We're Removing

### 1. OSC (Open Sound Control) - VRChat Integration
**Files to Remove:**
- `electron/main/modules/osc.ts` - OSC broadcasting logic
- `src/stores/osc.ts` - OSC state management
- `src/pages/settings/OSC.vue` - OSC settings page
- `src/pages/tooltips/OSCUnavailable.vue` - OSC tooltip
- `src/components/settings/osctriggers/` - All OSC trigger components
- References in `electron/main/index.ts` - IPC handlers for OSC
- References in `electron/main/modules/wsserver.ts` - OSC emit calls

**Package Dependencies to Remove:**
- `node-osc` - Native OSC library

**Why:** Churches don't need VRChat avatar control. This is gaming-specific functionality.

### 2. OBS WebSocket Integration
**Files to Clean Up:**
- `src/stores/connections.ts` - Remove OBS WebSocket client
- `src/components/settings/connections/` - Simplify connection dialogs
- References in localization files

**Package Dependencies to Remove:**
- `obs-websocket-js` - OBS WebSocket client library

**Why:** While some churches use OBS, they can use OBS Browser Source directly pointing to the web interface. No need for WebSocket integration.

### 3. Electron-Specific Features (Simplify)
**Keep Electron for:**
- Optional desktop app (for users who prefer it)
- But make web/Docker the PRIMARY deployment

**Remove from Electron:**
- OSC IPC handlers
- OBS WebSocket management
- Custom window frames (use standard browser chrome)
- Auto-launch features

## What We're Keeping

### Core Features (Web-First)
✅ Multi-language translation streams
✅ Real-time speech-to-text (Deepgram, Whisper, Web Speech API)
✅ OpenAI GPT-4o-mini translation with church context
✅ Language stream pages (/spanish, /ukrainian, etc.)
✅ Word replacement (church-specific vocabulary)
✅ Speaker profiles
✅ Export transcripts (TXT, JSON, CSV)
✅ Diagnostic agents (health, cost, quality, security)
✅ Text display customization
✅ Multi-device access

## New Architecture

### Before (Complex)
```
Electron Desktop App (Primary)
  ├── OSC Broadcasting
  ├── OBS WebSocket
  ├── Translation (IPC to worker)
  ├── Custom window management
  └── Web version as secondary

Two code paths for everything:
- if (is_electron()) { ... } else { ... }
```

### After (Simple)
```
Web App (Primary - Docker/Browser)
  ├── Translation (WebSocket to server)
  ├── Multi-language streams
  ├── Speech-to-text
  ├── All core features
  └── Works everywhere

Optional: Electron wrapper (just for desktop users who prefer it)
  └── Same code, just wrapped in Electron for offline use
```

## Implementation Steps

### Phase 1: Remove OSC/OBS
1. Delete OSC-related files
2. Delete OBS WebSocket code
3. Remove from Settings menu
4. Remove from router
5. Clean up package.json dependencies
6. Remove IPC handlers from electron/main/index.ts

### Phase 2: Simplify Architecture
1. Make WebSocket the primary communication method (remove IPC duplication)
2. Use localStorage everywhere (remove electron-store duplication)
3. Remove `is_electron()` checks where possible
4. Unify translation queue (no separate code paths)

### Phase 3: Update Documentation
1. Update README.md - Focus on church use case
2. Update DOCKER.md - Make this the primary deployment guide
3. Remove VRChat/gaming references
4. Add church-specific examples

### Phase 4: Testing
1. Test Docker deployment
2. Test browser version
3. Test Electron wrapper (if keeping)
4. Test all language streams
5. Test diagnostic agents

## File Changes Summary

### Files to DELETE:
```
electron/main/modules/osc.ts
src/stores/osc.ts
src/pages/settings/OSC.vue
src/pages/tooltips/OSCUnavailable.vue
src/components/settings/osctriggers/
src/migration/migrate_to_v0.5.0.ts (OSC migration)
```

### Files to MODIFY:
```
electron/main/index.ts - Remove OSC IPC handlers
electron/main/modules/wsserver.ts - Remove OSC emit calls
src/plugins/router.ts - Remove OSC routes
src/pages/Settings.vue - Remove OSC menu items
src/components/Footer.vue - Remove OSC broadcast button
src/stores/speech.ts - Remove OSC emit calls
src/stores/connections.ts - Remove OBS WebSocket
package.json - Remove node-osc, obs-websocket-js
README.md - Update focus to church translation
```

### Files to SIMPLIFY:
```
src/helpers/translation_queue.ts - Single code path
src/stores/translation.ts - Remove IPC duplication
src/App.vue - Remove OSC initialization
```

## Benefits After Refactoring

### Code Quality
- **50% less code** - Remove duplicate paths
- **Easier to maintain** - One way to do things
- **Faster development** - No need to test two versions
- **Fewer bugs** - Less complexity = fewer edge cases

### User Experience
- **Simpler installation** - Just `docker-compose up` or open browser
- **Easier configuration** - No OSC settings to confuse users
- **Better documentation** - Focused on actual use case
- **Mobile-friendly** - Web-first means it works on phones/tablets

### Deployment
- **Docker is primary** - Easy updates, no installation
- **Cloud-ready** - Deploy to any cloud provider
- **Multi-device** - Access from anywhere on network
- **Cost-effective** - ~$1.50-2.00/month for church services

## Timeline Estimate

- **Phase 1** (Remove OSC/OBS): 2-3 hours
- **Phase 2** (Simplify architecture): 3-4 hours
- **Phase 3** (Update docs): 1 hour
- **Phase 4** (Testing): 1-2 hours

**Total: ~7-10 hours of work**

## Questions to Decide

1. **Keep Electron wrapper?**
   - Option A: Remove entirely, web/Docker only
   - Option B: Keep as simple wrapper (no custom features)
   - Recommendation: Keep simple wrapper for offline use

2. **OBS Integration?**
   - Option A: Remove WebSocket integration, users use Browser Source
   - Option B: Keep minimal integration
   - Recommendation: Remove, Browser Source is simpler

3. **Migration for existing users?**
   - Most users are probably using VRChat features
   - But church users don't need them
   - Recommendation: Major version bump (v1.0.0), breaking change

## New Focus: Church Translation

### Primary Use Cases
1. **Multi-language church services** - Translations for immigrant congregations
2. **Accessibility** - Hard-of-hearing members
3. **Remote viewers** - Online service attendees
4. **Multi-campus** - Share sermon across locations

### Target Users
- Church AV technicians (not gamers)
- Pastors/worship leaders
- IT volunteers
- Congregants with phones/tablets

### Marketing Pivot
From: "Speech-to-text for VRChat and OBS"
To: "Real-time translation for multi-language church services"

## Next Steps

1. **User confirmation** - Get approval for this direction
2. **Create feature branch** - `refactor/church-focus`
3. **Implement Phase 1** - Remove OSC/OBS
4. **Test thoroughly** - Ensure nothing breaks
5. **Update version** - Bump to v1.0.0 (breaking change)
6. **Update all documentation** - Church-focused messaging
7. **Create migration guide** - For users who need OSC (point them to old version)

## Backward Compatibility

**For users who need VRChat/OSC:**
- Create `legacy` branch with v0.5.0
- No new features, just security updates
- Clear documentation: "Use v0.5.x for VRChat, v1.0+ for churches"

## Success Metrics

After refactoring, we should have:
- ✅ 50%+ less code
- ✅ Single deployment method (Docker primary)
- ✅ Zero `is_electron()` checks in core features
- ✅ Sub-5 minute setup time
- ✅ Works on mobile devices
- ✅ Clear church-focused documentation
