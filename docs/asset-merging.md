# Asset Merging

This document explains the current merge architecture.

## What Merge Means

In this app, for now, merging is an **audio-segment consolidation** operation:

- The first (selected) asset by list order is the **target**.
- Each additional selected asset is a **source**.
- Source `asset_content_link` rows (segments) are copied onto the target in order.
- Source assets are then deleted (destructive by design for this workflow).

The merge workflow is intended for newly recorded, local content before publish.

## Where Merge Logic Lives

Merge database mutations are centralized in:

- `database_services/assetMergeService.ts`

Primary API:

- `mergeLocalAssets({ orderedAssetIds, userId })`

## Transaction and Safety Guarantees

`mergeLocalAssets` runs merge writes in a **single database transaction**:

1. Validate all selected assets are merge-eligible local assets.
2. Copy source segments to target in stable order.
3. Delete source assets and related local records.
4. Normalize target segment ordering.

Because these steps run atomically, merge avoids partial DB state when an error occurs mid-operation.

## Audio File Preservation

Merge always preserves audio files.

- Merge deletes source asset records, but does not delete underlying audio attachments.
- This is intentional: merged segments still reference the same audio identifiers.

## What Views Still Handle

Views call the merge service and keep UI concerns local:

- selection reset (`cancelSelection`)
- query invalidation (`invalidateQueries`)
- view-specific cache/session refresh

This keeps DB mutation logic centralized while preserving existing screen behavior.

## Non-goals (Current System)

- Merge is intentionally destructive for source assets in local workflow.
- History reconstruction is not part of this design.

