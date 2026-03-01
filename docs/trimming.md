# Audio Trimming

Non-destructive trim points let users shorten an asset's audio without deleting anything. The original files stay intact; only start/end markers are stored.

## How it works for the user

1. Select an asset and open the trim modal.
2. Drag the left handle to set where playback starts; drag the right handle to set where it ends.
3. Press OK to save. Cancel discards changes.
4. Reopening the modal shows the full audio again with handles at the saved positions — the user can always extend them back out.

Everywhere else in the app (playback, waveform thumbnails, export) the trimmed-away portions are invisible.

## Trimming + merging interactions

### Trimming a single asset

Straightforward. One audio file, two handles, full waveform shown.

### Merging already-trimmed assets

When assets A and B are merged, each keeps its own trim points. Playback chains the segments and respects each segment's `startMs`/`endMs`. The merged waveform in lists shows only the effective (trimmed) portions concatenated together.

### Trimming a merged asset

A merged asset has multiple segments (one per original content link). In the trim modal:

- **Interior segment trims are locked and hidden.** The user can't edit them and doesn't see the trimmed-away portions — those segments appear as solid blocks.
- **Only the first segment's start and last segment's end are adjustable.** These are the "exterior" edges of the merged clip.
- Clip divider lines show where segments meet.

This prevents the user from accidentally modifying interior boundaries while still allowing them to tighten the head and tail of the combined clip.

## Where trim is stored

Each `asset_content_link` row has a nullable `metadata TEXT` column containing JSON:

```json
{ "trim": { "startMs": 500, "endMs": 3200 } }
```

- `startMs` and `endMs` are milliseconds relative to the segment's full file duration.
- When `trim` is absent or null, the full file plays.
- The column can hold other metadata alongside trim (the save logic merges, not overwrites).

Only local (unsynced) content links can be updated. Synced rows are immutable.

## Code overview

### `services/assetAudio.ts`

The single file that owns resolution, playback, waveform, trim persistence, and export.


| Function                             | Role                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `resolveAssetAudio(assetId)`         | Queries content links, resolves URIs, loads durations, reads trim from `metadata`. Returns an `AssetAudio` object. |
| `getAssetWaveform(assetId, options)` | Builds a combined waveform from all segments. Options control which trims are applied (see below).                 |
| `saveTrim(assetAudio)`               | Writes each segment's `trim` back to the `metadata` column on local content links.                                 |
| `useAssetAudio()`                    | React hook exposing `play`, `stop`, `resolve`, `getWaveform`, `saveTrim`, and playback state.                      |


#### Waveform modes

When `getAssetWaveform` generates a waveform.


| Option                      | Behaviour                                                                            | Used by                             |
| --------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| *(default)*                 | All trims applied. Trimmed portions hidden.                                          | Asset lists, thumbnails.            |
| `ignoreTrim: true`          | No trims applied. Full file shown.                                                   | Trim modal (single-segment assets). |
| `ignoreExteriorTrims: true` | Interior trims applied; first segment's start and last segment's end left untrimmed. | Trim modal (merged assets).         |


### `views/new/recording/components/TrimSegmentModal.tsx`

The modal UI. Key concepts:

- **Visible ranges** — each segment's shown region (`fileStartMs` to `fileEndMs`), derived from the waveform mode. Single-segment: full file. Merged: exterior edges exposed, interior trims baked in.
- **Handle initialization** — on open, handles are positioned at existing trim fractions within the visible space, not reset to 0/1.
- `**buildTrimmedAssetAudio()*`* — maps handle fractions through visible ranges back to file-relative `startMs`/`endMs` per segment. Used for both live preview playback and the final confirm.
- **OK button** — builds the trimmed `AssetAudio` and passes it to `onConfirm`.

### `views/new/recording/hooks/useTrimModal.ts`

Shared hook consumed by `BibleAssetsView` and recording views. Handles:

- Resolving the `AssetAudio` and loading the waveform (choosing the right mode based on segment count).
- `handleConfirmTrim` — receives the trimmed `AssetAudio` from the modal, calls `saveTrim()`, and closes the modal.

### `asset_content_link.metadata` column

Added by migration `20260220120000_add_metadata_to_acl.sql`. Nullable text, JSON-encoded. Parsed by `parseTrimMetadata()` in `assetAudio.ts`.