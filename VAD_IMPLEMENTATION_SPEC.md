# VAD Recording Implementation Spec

## Problem Statement

**Goal**: Capture speech in real-time with Voice Activity Detection (VAD) that:
- Captures the first words (speech onset) without clipping
- Automatically starts/stops based on voice activity
- Feels instant and responsive
- Handles multiple consecutive recordings seamlessly

**Core Challenge**: expo-av has 200-500ms cold start delay, causing first 2 words to be lost.

## Solution: Ring Buffer + Platform-Specific Implementation

### Architecture Overview (Native - iOS/Android)

```
┌─────────────────────────────────────────────────┐
│ MicrophoneEnergyModule (Native - Kotlin/Swift)  │
│                                                   │
│  ┌──────────────────┐                            │
│  │ Ring Buffer      │ Always recording last 500ms│
│  │ [████████████]   │ (16 chunks @ 16kHz)        │
│  └──────────────────┘                            │
│                                                   │
│  Energy > Threshold (e.g., 0.03)                 │
│    ↓                                              │
│  startSegment():                                  │
│    - Dump ring buffer to file (preroll)          │
│    - Continue recording to same file             │
│                                                   │
│  Silence > 1.5s                                   │
│    ↓                                              │
│  stopSegment():                                   │
│    - Close file                                   │
│    - Write WAV header (Android) or M4A (iOS)     │
│    - Emit onSegmentComplete(uri, duration)       │
└─────────────────────────────────────────────────┘
         ↓ Event
┌─────────────────────────────────────────────────┐
│ JavaScript/React (useVADRecording hook)          │
│                                                   │
│  onSegmentStart():                                │
│    - Create pending card in UI                    │
│    - Set insertion point                          │
│                                                   │
│  onSegmentComplete(uri):                          │
│    - Save WAV/M4A file to database               │
│    - Remove pending card                          │
│    - Add asset to list                            │
│    - Ready for next (instant!)                    │
└─────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Native Module (Kotlin - Android)

**File**: `modules/microphone-energy/android/.../MicrophoneEnergyModule.kt`

**Key Components**:

```kotlin
// Ring buffer (always recording)
private val ringBuffer = ArrayDeque<ShortArray>()
private val ringBufferMaxSize = 16 // ~500ms

// Process each audio chunk
private suspend fun processAudioData(audioData: ShortArray, bytesRead: Int, _sampleRate: Int) {
    // 1. Calculate RMS energy
    var energy = 0.0
    for (i in 0 until bytesRead) {
        val sample = audioData[i] / 32768.0
        energy += sample * sample
    }
    energy = sqrt(energy / bytesRead)

    // 2. Maintain ring buffer
    if (!isRecordingSegment) {
        ringBuffer.addLast(dataCopy)
        if (ringBuffer.size > ringBufferMaxSize) {
            ringBuffer.removeFirst()
        }
    }

    // 3. Collect data for active segment
    if (isRecordingSegment) {
        segmentBuffers.add(dataCopy)
    }

    // 4. Send energy to JavaScript
    sendEvent("onEnergyResult", mapOf("energy" to energy, ...))
}

// Start segment recording
fun startSegment(prerollMs: Int = 500) {
    // Copy last 500ms from ring buffer
    segmentBuffers.clear()
    segmentBuffers.addAll(ringBuffer.takeLast(buffersToWrite))
    
    isRecordingSegment = true
}

// Stop segment recording  
fun stopSegment() {
    // Write WAV file
    val out = FileOutputStream(segmentFile)
    writeWavHeader(out, dataSize, sampleRate, channels, bitsPerSample)
    
    for (buffer in segmentBuffers) {
        // Write PCM data as little-endian shorts
        out.write(convertToBytes(buffer))
    }
    
    out.close()
    
    // Emit event
    sendEvent("onSegmentComplete", mapOf(
        "uri" to "file://${file.absolutePath}",
        "duration" to duration
    ))
}
```

### 2. React Hook (useVADRecording)

**File**: `views/new/recording/hooks/useVADRecording.ts`

**State Machine**:

```typescript
State: IDLE (VAD locked, monitoring)
  ↓ (energy > predictiveThreshold)
State: RECORDING
  ↓ (silence > 1.5s)
State: IDLE (ready for next)
```

**Key Logic**:

```typescript
// Start segment when speech detected
React.useEffect(() => {
    if (!isRecording && currentEnergy > predictiveThreshold) {
        console.log('🎤 Speech detected - starting native segment');
        
        setIsRecording(true);
        recordingStartTime.current = Date.now();
        lastSpeechTime.current = Date.now();
        
        MicrophoneEnergyModule.startSegment({ prerollMs: 500 });
        onSegmentStart(); // Create pending card
    }
}, [isRecording, currentEnergy, predictiveThreshold]);

// Monitor silence (only runs when isRecording=true)
React.useEffect(() => {
    if (!isRecording) return;
    
    const interval = setInterval(() => {
        const silence = Date.now() - lastSpeechTime.current;
        
        if (silence >= 1500 + 300) { // 1.5s + 300ms tail
            console.log('💤 Silence detected - stopping segment');
            MicrophoneEnergyModule.stopSegment();
        }
    }, 100);
    
    return () => clearInterval(interval);
}, [isRecording, silenceDuration]);

// Listen for completion
React.useEffect(() => {
    const sub = MicrophoneEnergyModule.addListener('onSegmentComplete',
        (payload) => {
            console.log('📼 Segment complete:', payload.uri);
            setIsRecording(false);
            onSegmentComplete(payload.uri);
        }
    );
    return () => sub.remove();
}, []);
```

### 3. Parent Component (RecordingView)

**File**: `views/new/recording/index.tsx`

**Callbacks**:

```typescript
const handleVADSegmentStart = () => {
    // Create pending card
    const tempId = createPendingCard(insertionIndex);
    vadPendingCardRef.current = tempId;
    currentRecordingTempIdRef.current = tempId;
    currentRecordingOrderRef.current = calculateOrderIndex();
};

const handleVADSegmentComplete = (uri: string) => {
    // Save to database (same as manual recording)
    handleRecordingComplete(uri, 0, []);
    // Pending card removed by handleRecordingComplete
};

const { currentEnergy, isRecording: isVADRecording } = useVADRecording({
    threshold: vadThreshold,
    silenceDuration: vadSilenceDuration,
    isVADActive: isVADLocked,
    onSegmentStart: handleVADSegmentStart,
    onSegmentComplete: handleVADSegmentComplete,
    isManualRecording: isRecording
});
```

## Configuration

### Thresholds

- **Predictive threshold**: `threshold * 0.5` (start at 50% of main)
  - Example: Main=0.03 → Predictive=0.015
  - Lower = earlier start, more false positives
  - Higher = later start, might miss onset

- **Main threshold**: User adjustable (default 0.03)
  - Validates user is actually speaking
  - Updates `lastSpeechTime` while above threshold

### Timing

- **Min segment duration**: 500ms (discard shorter recordings)
- **Silence duration**: 1500ms (user adjustable)
- **Audio tail delay**: 300ms (capture speech decay)
- **Ring buffer size**: 16 chunks (~500ms at 16kHz)

## Expected Logs (Success Flow)

```
1. 🔒 Slide-to-lock → VAD activated
2. 🎯 Energy monitoring started
3. 🎤 Speech detected (0.018 > 0.015) - starting native segment
4. 📼 Preroll: 16 chunks (~500ms)  
5. 🎬 Segment recording started
6. 🎬 VAD segment starting - creating pending card
7. 📝 VAD pending card created at order_index: 3
8. (User speaks...)
9. 💤 1800ms silence - stopping native segment
10. 🎬 Writing WAV file: 32000 samples
11. ✅ WAV file written
12. 📼 Native segment complete: file://.../segment.wav
13. 💾 Starting to save recording...
14. 🧹 Removing pending card
15. ✅ Asset saved to database at order_index: 3
16. ✅ Queries invalidated, asset should appear now
17. (Ready for next - instant!)
```

## Key Differences vs expo-av

| Aspect | expo-av (Manual) | Native Module (VAD) |
|--------|------------------|---------------------|
| Cold start | 200-500ms | 0ms (always recording) |
| Speech onset | ❌ Clipped | ✅ Captured (500ms preroll) |
| Format | M4A (expo handles) | WAV (we write header) |
| Coordination | Simple (one recorder) | Simple (one recorder) |
| Use case | Hold-to-record button | Auto voice detection |

## Common Issues

### Issue: Silence monitoring not running
**Symptom**: Segment starts but never stops
**Cause**: Effect uses ref instead of state for `isRecording`
**Fix**: Use `useState` for `isRecording` so effect re-runs

### Issue: Duplicate pending cards
**Symptom**: Two pending cards created per recording
**Cause**: `WalkieTalkieRecorder` calls `onRecordingStart` callback
**Fix**: Use `createPendingCard()` instead of `startRecording()` for VAD

### Issue: PCM format errors
**Symptom**: "UnrecognizedInputFormatException" when playing
**Cause**: Raw PCM files without headers
**Fix**: Write WAV header (44 bytes) before PCM data

## Testing Checklist

After rebuild:

- [ ] Lock VAD mode (slide gesture)
- [ ] Speak clearly - verify pending card appears
- [ ] Stop speaking - verify asset saves after 1.5s
- [ ] Check asset plays correctly (no format errors)
- [ ] Speak again - verify second recording works
- [ ] Unlock VAD - verify manual recording still works

## For Another Dev

**The core insight**: expo-av is too slow to capture speech onset. The solution is a **native ring buffer** that's always recording. When speech is detected, we dump the buffer (preroll) + continue recording, then write a proper WAV/M4A file when done.

**Key files**:
1. `modules/microphone-energy/ios/MicrophoneEnergyModule.swift` - Ring buffer + file writing (iOS)
2. `modules/microphone-energy/android/.../MicrophoneEnergyModule.kt` - Ring buffer + WAV writing (Android)
3. `views/new/recording/hooks/useVADRecording.ts` - Speech/silence detection logic
4. `views/new/recording/index.tsx` - UI coordination (pending cards, save)

**Critical**: The native module writes WAV (Android) or M4A (iOS) files, NOT raw PCM. This is essential for expo-av playback compatibility.

---

## 🌐 Web Implementation

### Architecture Overview (Web - Browser)

```
┌─────────────────────────────────────────────────┐
│ Web Audio API (AudioContext + AnalyserNode)     │
│                                                   │
│  ┌──────────────────┐                            │
│  │ Energy Monitor   │ Always analyzing audio    │
│  │ [Frequency Data] │ (AnalyserNode FFT)        │
│  └──────────────────┘                            │
│                                                   │
│  Smoothed Energy > onsetThreshold                │
│    ↓                                              │
│  VAD State: IDLE → ONSET → SPEAKING              │
│                                                   │
│  Start MediaRecorder:                             │
│    - Dump ring buffer (preroll)                  │
│    - Continue recording to chunks array          │
│                                                   │
│  Silence > silenceDuration                        │
│    ↓                                              │
│  VAD State: SPEAKING → SILENCE → IDLE            │
│                                                   │
│  Stop MediaRecorder:                              │
│    - Create Blob from chunks                     │
│    - Generate Object URL (blob://)               │
│    - Call onSegmentComplete(uri)                 │
└─────────────────────────────────────────────────┘
         ↓ Callback
┌─────────────────────────────────────────────────┐
│ React (useVADRecording.web.ts)                   │
│                                                   │
│  onSegmentStart():                                │
│    - Create pending card in UI                    │
│    - Assign order_index from counter             │
│                                                   │
│  onSegmentComplete(uri):                          │
│    - Save Blob to database                       │
│    - Remove pending card                          │
│    - Add asset to list                            │
│    - Ready for next (instant!)                    │
└─────────────────────────────────────────────────┘
```

### Platform Comparison

| Aspect | Native (iOS/Android) | Web (Browser) |
|--------|---------------------|---------------|
| **Energy Monitor** | Native ring buffer | AudioContext + AnalyserNode |
| **Recording** | Native audio APIs | MediaRecorder |
| **Preroll** | ShortArray buffer | Blob array |
| **Format** | WAV/M4A | WebM/MP4 (codec dependent) |
| **URI** | `file://` | `blob://` (Object URL) |
| **Latency** | 10-20ms | ~16ms (requestAnimationFrame) |
| **Cold Start** | 0ms (always on) | 0ms (always on) |

### Web-Specific Implementation

#### 1. Energy Monitoring (`useMicrophoneEnergy.web.ts`)

```typescript
// AudioContext for real-time analysis
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048; // Frequency resolution
analyser.smoothingTimeConstant = 0.8; // Built-in smoothing

// Connect microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);

// Monitor energy (frequency domain)
const dataArray = new Uint8Array(analyser.frequencyBinCount);
const monitorEnergy = () => {
  analyser.getByteFrequencyData(dataArray); // 0-255 per bin
  
  // Calculate RMS from frequency bins
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = dataArray[i] / 255.0;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  
  // Exponential moving average
  smoothedEnergy = smoothedEnergy * 0.7 + rms * 0.3;
  
  setEnergyResult({ energy: rms, smoothedEnergy });
  requestAnimationFrame(monitorEnergy);
};
```

**Why Frequency Domain?**
- More robust to noise than time-domain RMS
- Better isolates speech frequencies (300-3400 Hz)
- Built-in smoothing from AnalyserNode

#### 2. VAD State Machine (`useVADRecording.web.ts`)

```typescript
// Schmitt trigger for robust detection
const onsetThreshold = threshold * 0.25;   // 0.0075 (very sensitive)
const confirmThreshold = threshold * 0.5;  // 0.015 (prevents false positives)

switch (vadState) {
  case 'idle':
    if (smoothedEnergy > onsetThreshold) {
      vadState = 'onset'; // Potential speech
    }
    break;
    
  case 'onset':
    if (smoothedEnergy > confirmThreshold) {
      vadState = 'speaking';
      await startSegment(); // Start MediaRecorder
    } else if (smoothedEnergy < onsetThreshold) {
      vadState = 'idle'; // False alarm
    }
    break;
    
  case 'speaking':
    if (smoothedEnergy < confirmThreshold) {
      silenceStart = Date.now();
      vadState = 'silence';
    }
    break;
    
  case 'silence':
    if (smoothedEnergy > confirmThreshold) {
      vadState = 'speaking'; // Speech resumed
      silenceStart = 0;
    } else if (Date.now() - silenceStart >= silenceDuration) {
      vadState = 'idle';
      await stopSegment(); // Stop MediaRecorder
    }
    break;
}
```

#### 3. Ring Buffer (Preroll)

```typescript
class RingBuffer {
  private chunks: Blob[] = [];
  private maxChunks: number;

  constructor(durationMs = 500, chunkMs = 100) {
    this.maxChunks = Math.ceil(durationMs / chunkMs); // 5 chunks
  }

  add(chunk: Blob) {
    this.chunks.push(chunk);
    if (this.chunks.length > this.maxChunks) {
      this.chunks.shift(); // FIFO - discard oldest
    }
  }

  dump(): Blob[] {
    return [...this.chunks]; // Copy for segment
  }

  clear() {
    this.chunks = [];
  }
}

// MediaRecorder provides chunks at regular intervals
recorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    if (vadState === 'idle') {
      ringBuffer.add(event.data); // Preroll
    } else {
      segmentChunks.push(event.data); // Active segment
    }
  }
};

recorder.start(100); // 100ms chunks (matches ring buffer)
```

#### 4. Segment Recording

```typescript
async function startSegment() {
  // Get fresh stream
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  // Create recorder with browser-compatible codec
  const mimeType = MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : 'audio/mp4';
  const recorder = new MediaRecorder(stream, { mimeType });
  
  // Dump ring buffer to segment (preroll)
  segmentChunks = [...ringBuffer.dump()];
  ringBuffer.clear();
  
  // Start recording
  recorder.start(100); // 100ms time slices
  onSegmentStart(); // Notify parent (creates pending card)
}

async function stopSegment() {
  await new Promise<void>((resolve) => {
    recorder.onstop = () => {
      // Create Blob from chunks
      const blob = new Blob(segmentChunks, { type: recorder.mimeType });
      
      // Create Object URL (blob://)
      const uri = URL.createObjectURL(blob);
      
      // Notify parent (saves to DB)
      onSegmentComplete(uri);
      resolve();
    };
    
    recorder.stop();
  });
  
  // Cleanup
  stream.getTracks().forEach(track => track.stop());
}
```

### Configuration (Same as Native)

```typescript
const vadConfig = {
  threshold: 0.03,              // User adjustable
  silenceDuration: 300,         // User adjustable (ms)
  onsetMultiplier: 0.25,        // Fixed (25% of threshold)
  confirmMultiplier: 0.5,       // Fixed (50% of threshold)
  minSegmentDuration: 500       // Fixed (discard shorter)
};
```

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| AudioContext | ✅ | ✅ | ✅ | ✅ |
| MediaRecorder | ✅ | ✅ | ✅ | ✅ |
| audio/webm | ✅ | ✅ | ❌ | ✅ |
| audio/mp4 | ❌ | ❌ | ✅ | ❌ |

**Solution**: Codec detection
```typescript
const mimeType = MediaRecorder.isTypeSupported('audio/webm')
  ? 'audio/webm'
  : 'audio/mp4';
```

### Expected Logs (Web Success Flow)

```
1. 🔒 VAD mode activated
2. 🎤 Starting web energy detection...
3. ✅ Web audio context created, sample rate: 48000
4. ✅ Energy monitoring started
5. 🔊 Web VAD: Onset detected (0.018 > 0.0075)
6. ✅ Web VAD: Speech confirmed (0.025 > 0.015)
7. 🎬 Web VAD: Starting segment
8. ✅ Web VAD: Segment recording started
9. 🎬 Native VAD: Segment starting (pending card created)
10. 📝 Native VAD: Pending card created at order_index: 3
11. (User speaks...)
12. 🤫 Web VAD: Silence started
13. 🛑 Web VAD: Silence threshold reached (1500ms)
14. 🛑 Web VAD: Stopping segment
15. 📼 Web VAD: Segment complete (2340ms, 45678 bytes)
16. 💾 Starting to save recording...
17. 🧹 Removing pending card
18. ✅ Asset saved to database at order_index: 3
19. ✅ Queries invalidated, asset should appear now
20. (Ready for next - instant!)
```

### Web Gotchas & Solutions

#### 1. Object URL Memory Leaks
**Problem**: Blob URLs persist in memory until revoked
```typescript
// ❌ Bad: Memory leak
const uri = URL.createObjectURL(blob);
onSegmentComplete(uri);

// ✅ Good: Revoke after saving
const uri = URL.createObjectURL(blob);
await saveToDatabase(uri);
URL.revokeObjectURL(uri); // Free memory
```

#### 2. AudioContext Restrictions
**Problem**: Browsers require user gesture to start AudioContext
```typescript
// ✅ Solution: Start on VAD lock (user interaction)
const handleVADLock = async () => {
  await audioContext.resume(); // Ensure running
  startEnergyDetection();
};
```

#### 3. MediaRecorder Codec Varies
**Problem**: Safari doesn't support webm, Chrome doesn't support mp4
```typescript
// ✅ Solution: Feature detection
const mimeType = MediaRecorder.isTypeSupported('audio/webm')
  ? 'audio/webm'
  : MediaRecorder.isTypeSupported('audio/mp4')
  ? 'audio/mp4'
  : 'audio/webm'; // Fallback
```

#### 4. Microphone Permission
**Problem**: Browser prompts for mic access
```typescript
// ✅ Solution: Request on first VAD activation
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  console.error('Microphone permission denied');
  // Show UI to request permission
}
```

### Testing Web Implementation

```bash
# Start dev server
npm run web

# Open browser console
# Navigate to recording view
# Lock VAD mode
# Check logs for:
#   - AudioContext creation
#   - Energy monitoring started
#   - Onset/confirm detection
#   - Segment start/stop
#   - Object URL creation
```

**Test Cases:**
1. **Rapid speech**: Speak 5 phrases in 10 seconds → verify all captured
2. **Silence gaps**: Speak with 2s pauses → verify each is separate segment
3. **False onsets**: Background noise → verify no false recordings
4. **Long speech**: Speak for 30s continuously → verify captures full duration

### Key Files (Web)

1. `hooks/useMicrophoneEnergy.web.ts` - AudioContext energy monitoring
2. `views/new/recording/hooks/useVADRecording.web.ts` - VAD state machine + MediaRecorder
3. `views/new/recording/index.tsx` - Parent component (same callbacks for web & native)

### Determinism (Web = Native)

The web implementation reuses **100% of the deterministic infrastructure**:
- Sequential counter (`vadSequentialCounterRef`)
- DB write queue (`dbWriteQueueRef`)
- Same callbacks (`handleVADSegmentStart`, `handleVADSegmentComplete`)

**Result**: Web and native produce identical, deterministic segment ordering.

