# Rabbit Mode Translation System

**Rapid voice recording system for translation workflows with robust local storage.**

## Core Files & Responsibilities

### 🎙️ **Voice Detection & Recording**
- **`useRabbitModeVAD.ts`** - Voice Activity Detection hook
  - Auto-detects speech start/end using audio level analysis
  - Handles recording permissions and audio configuration
  - Adaptive threshold calibration for different environments
  - Returns recording URIs when speech segments end

### 🖥️ **User Interface**
- **`RapidTranslationAssetsView.tsx`** - Main assets view with rabbit mode
  - Toggles rabbit mode sessions on/off
  - Displays asset list with current recording target
  - Integrates VAD component for live recording feedback
  - Shows segments accordion under current asset

- **`RabbitModeSegmentDisplay.tsx`** - Audio segments UI
  - Displays recorded segments with playback controls
  - Handles segment reordering and deletion
  - Shows waveforms and duration for each segment

### 💾 **Local Storage & Sessions**
- **`rabbitModeFileManager.ts`** - File system management
  - Saves audio segments to semi-permanent device storage
  - Organizes files by session ID in isolated directories
  - Handles cleanup of orphaned files and directories
  - Verifies file integrity and calculates storage usage

- **Local Store** (`useLocalStore`) - Session state management
  - Stores active recording sessions with metadata
  - Tracks current asset being recorded for each session
  - Persists segments with audio URIs and waveform data
  - Maintains session state across app restarts

### 🚀 **Publishing & Recovery**
- **`rabbitModePublisher.ts`** - Converts drafts to translations
  - Moves audio files to permanent attachment queue
  - Creates translation records in database
  - Provides progress callbacks during publishing
  - Cleans up local files after successful publish

- **`rabbitModeRecovery.ts`** - App startup recovery system
  - Detects stale sessions (>7 days old) on app start
  - Prompts user to recover or delete old drafts
  - Cleans up orphaned files without active sessions
  - Verifies file integrity for active sessions

## Data Flow

1. **Session Creation** → Local store creates session with asset IDs
2. **Voice Detection** → VAD detects speech, starts/stops recording automatically  
3. **File Storage** → Audio saved to device storage with permanent URIs
4. **Segment Tracking** → Segments stored in local store with metadata
5. **Publishing** → Draft session converted to database translations
6. **Cleanup** → Local files removed after successful publish

## Robustness Features

- **Persistent Storage**: Sessions survive app kills/restarts
- **File Verification**: Regular integrity checks prevent corruption
- **Recovery System**: Handles stale sessions and orphaned files
- **Atomic Operations**: Publishing is transactional with rollback
- **User Control**: Hard to accidentally lose recordings

## Key Session States

- **Draft** → Active recording session, stored locally
- **Committed** → Successfully published to database
- **Stale** → >7 days old, candidate for cleanup
- **Orphaned** → Files exist but no session metadata 