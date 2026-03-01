# AssetAudio

The `AssetAudio` system centralizes how the app loads, plays, previews, trims, and exports an asset's audio. It hides the complexity of merged audio (multiple audio files behind one asset) and trim points behind a small, consistent API.

## Why this exists

An asset's audio can be one file or several files in sequence ("merged audio"), and it may have trim points. `AssetAudio` gives you one interface and a handful of functions so you never have to think about those details. Play, visualize, trim, or export; it handles the rest.

## The `AssetAudio` interface

```typescript
interface AssetAudioSegment {
  uri: string;              // local file URI
  durationMs: number;       // full, untrimmed duration in ms
  trim?: {
    startMs: number;
    endMs: number;
  };
}

interface AssetAudio {
  assetId: string;
  segments: AssetAudioSegment[];
  totalDurationMs: number;  // sum of effective (trimmed) durations
}
```

Every function in the API can work from this object. 

When trimming audio the app uses this as an in-memory working copy, updating `trim` as the user drags handles. On confirmation the trim points will be written to the database.

## File layout

### `services/assetAudio.ts`

Contains all the logic in one file:

- **`AssetAudio` interface** - the type described above.
- **`useAssetAudio()` hook** - the main entry point for components. Calls `useAudio()` internally and exposes:
  - **`resolve(assetId)`** - queries the database for URIs, loads segment durations, reads trim metadata, and returns an `AssetAudio` object.
  - **`play(assetId | AssetAudio)`** - accepts an asset ID string or a pre-resolved `AssetAudio` object. Resolves automatically when given a string. Respects trim points. Handles single or merged audio.
  - **`stop()`** - stops playback.
  - **`getWaveform(assetId, options?)`** - extracts waveform amplitudes from each segment, combines them proportionally, and slices to the trim region by default. Pass `{ ignoreTrim: true }` for the full waveform.
  - **`saveTrim(assetAudio)`** - writes the object's trim points back to `asset.metadata` in the database.
  - **`export(assetId)`** - concatenates segments, applies trim, and returns a path to a single `.m4a` file.
  - **`isPlaying`** - `boolean`, true while audio is playing.
  - **`currentAudioId`** - the asset ID currently playing, or `null` when idle. Useful for highlighting the active asset in a list.
  - **`positionShared`** - Reanimated `SharedValue<number>` tracking the current playback position in milliseconds. Updates at 60fps on the UI thread for smooth progress bars.
  - **`durationShared`** - Reanimated `SharedValue<number>` with the total playback duration in milliseconds (after trim).
- The standalone functions `resolveAssetAudio`, `getAssetWaveform`, `exportAssetAudio`, and `saveTrim` are also exported directly for use outside React components.

### `contexts/AudioContext.tsx`

The low-level audio engine. Manages `expo-av` sound objects, position tracking via Reanimated shared values, and sequential segment playback. `useAssetAudio` wraps this internally; most components never import `AudioContext` directly.

### `database_services/assetService.ts`

Owns the `AssetMetadata` interface (which includes the `trim` field). `saveTrim` in `assetAudio.ts` delegates here to persist changes.

### `utils/audioWaveform.ts`

Contains `extractWaveformFromFile`, which reads PCM data from a single audio file and returns amplitude bars. `getAssetWaveform` calls this per-segment and stitches the results together.

## How to use it

### Play an asset's audio

```typescript
const audio = useAssetAudio();

// One call. Resolves URIs, applies trim, handles single or merged audio.
await audio.play(assetId);

// Stop playback
await audio.stop();
```

### Get a waveform

```typescript
const audio = useAssetAudio();

// Trimmed waveform (default); what the rest of the app sees
const waveform = await audio.getWaveform(assetId, { barCount: 64 });

// Full waveform, ignoring trim; used in the trim UI
const fullWaveform = await audio.getWaveform(assetId, { ignoreTrim: true, barCount: 128 });
```

### Export to a single file

```typescript
const audio = useAssetAudio();

// Concatenates segments, applies trim, returns a path to one .m4a file
const filePath = await audio.export(assetId);
```

### Access playback state

```typescript
const audio = useAssetAudio();

audio.isPlaying;        // boolean
audio.currentAudioId;   // the assetId currently playing, or null
audio.positionShared;   // Reanimated SharedValue<number> (ms), 60fps updates
audio.durationShared;   // Reanimated SharedValue<number> (ms)
```

### Work with the raw `AssetAudio` object

For the trim UI or anywhere you need to inspect or modify the underlying data:

```typescript
const audio = useAssetAudio();

// Get the full resolved object
const resolved = await audio.resolve(assetId);
// resolved.segments[0] → { uri: "file:///...seg1.m4a", durationMs: 4200, trim: { startMs: 200, endMs: 4000 } }
// resolved.segments[1] → { uri: "file:///...seg2.m4a", durationMs: 3100 }
// resolved.totalDurationMs → 6900  (3800 trimmed + 3100 untrimmed)
```

### Trim modal workflow

The trim modal is the one place that digs into the `AssetAudio` object directly. It uses `resolve` to get the raw data, then mutates a local copy as the user drags the trim handles.

```typescript
const audio = useAssetAudio();
const [assetAudio, setAssetAudio] = useState<AssetAudio | null>(null);
const [waveform, setWaveform] = useState<number[]>([]);

// 1. Open the modal: resolve the object and load the full waveform
const open = async (assetId: string) => {
  const resolved = await audio.resolve(assetId);
  const fullWaveform = await audio.getWaveform(assetId, { ignoreTrim: true, barCount: 128 });
  setAssetAudio(resolved);
  setWaveform(fullWaveform);
};

// 2. User drags trim handles: adjusts start of first segment, end of last segment
const onTrimChange = (startFraction: number, endFraction: number) => {
  setAssetAudio(prev => {
    if (!prev) return null;
    const segments = prev.segments.map((seg, i) => {
      if (i === 0) {
        const startMs = Math.round(startFraction * seg.durationMs);
        return { ...seg, trim: { startMs, endMs: seg.trim?.endMs ?? seg.durationMs } };
      }
      if (i === segments.length - 1) {
        const endMs = Math.round(endFraction * seg.durationMs);
        return { ...seg, trim: { startMs: seg.trim?.startMs ?? 0, endMs } };
      }
      return seg;
    });
    const totalDurationMs = segments.reduce((sum, seg) =>
      sum + (seg.trim ? seg.trim.endMs - seg.trim.startMs : seg.durationMs), 0
    );
    return { ...prev, segments, totalDurationMs };
  });
};

// 3. Play preview (debounced): plays whatever trim is on the object
const debouncedPlay = useDebouncedCallback(() => {
  if (assetAudio) audio.play(assetAudio);
}, [assetAudio], 300);

// 4. Confirm: persist the object's trim to the database
const onConfirm = async () => {
  if (assetAudio) await audio.saveTrim(assetAudio);
};
```

The waveform display layers three things on top of each other:

1. **Full waveform** in a faded color (the `waveform` state, always `ignoreTrim: true`).
2. **Selection overlay** in a bright color, clipped to the trim region. Uses the same waveform data, masked by the selection bounds.
3. **Clip divider lines** at the boundaries between internal audio files. Positions come from each segment's `durationMs`, converted to fractions of the full untrimmed duration.

### Outside of React components

`resolveAssetAudio`, `getAssetWaveform`, `exportAssetAudio`, and `saveTrim` are plain async functions. They don't require React. Import them directly for use in background tasks, scripts, or utilities.

```typescript
import { resolveAssetAudio, exportAssetAudio } from '@/services/assetAudio';

const audio = await resolveAssetAudio(assetId);
const exportedPath = await exportAssetAudio(assetId);
```

Only `play` and the playback state properties require the `useAssetAudio` hook, because they depend on the React audio context for managing sound objects and position tracking.
