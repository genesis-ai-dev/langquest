# Asset Merge & Unmerge

This document explains the merge and unmerge architecture.

## What Merge Means

Merging is an **audio-segment consolidation** operation:

- The first (selected) asset by list order is the **target**.
- Each additional selected asset is a **source**.
- Source `asset_content_link` rows (segments) are copied onto the target in order.
- Source assets are then deleted (destructive by design for this workflow).

The merge workflow is intended for newly recorded, local content before publish.

## What Unmerge Means

Unmerging **splits a multi-segment asset** back into individual assets:

- The first segment stays on the original asset.
- Each subsequent segment becomes a brand-new asset.
- New assets are named `{originalName} (2)`, `{originalName} (3)`, etc.
- New assets are inserted immediately after the original in list order.
- All segment metadata (trim points, audio references) is preserved.

Unmerge is only available for local assets with 2+ segments.

## Where Logic Lives

All merge and unmerge database mutations are in:

- `database_services/assetMergeService.ts`

Primary APIs:

- `mergeLocalAssets({ orderedAssetIds, userId })` — combine N assets into one
- `unmergeLocalAsset({ assetId, userId })` — split one asset into N

## Shared Asset Creation Helper

Both `saveRecording` (recording flow) and `unmergeLocalAsset` delegate to:

- `database_services/assetService.ts` → `createLocalAssetInTx(tx, params)`

This helper creates an asset row, quest link, and content link inside an existing
transaction. It optionally shifts existing assets to make room at the target
`order_index`.

## Transaction and Safety Guarantees

Both `mergeLocalAssets` and `unmergeLocalAsset` run all writes in a **single
database transaction**:

**Merge steps:**
1. Validate all selected assets are merge-eligible local assets.
2. Copy source segments to target in stable order.
3. Delete source assets and related local records.
4. Normalize target segment ordering.

**Unmerge steps:**
1. Validate asset is local, not synced, and has 2+ segments.
2. Delete extra content links from the original asset (keep first).
3. Create a new asset for each split-off segment via `createLocalAssetInTx`.
4. Shift existing assets to make room for the new ones.

Atomicity ensures no partial state on failure.

## Audio File Preservation

Both merge and unmerge preserve audio files. Only database records are
created/deleted; the underlying audio attachments are never removed.

## What Views Handle

Views (`BibleAssetsView`, `RecordingView`) call the service and keep UI concerns
local:

- selection reset (`cancelSelection`)
- query invalidation (`invalidateQueries`)
- view-specific cache/session refresh (RecordingView clears segment count and
  duration caches, adds new items to session list)

## Non-goals (Current System)

- Merge is intentionally destructive for source assets.
- Unmerge does not reconstruct original pre-merge assets; it creates new ones.
- No merge/unmerge history or provenance tracking.
