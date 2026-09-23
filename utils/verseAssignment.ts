import type {
  AssetMetadata,
  AssetUpdatePayload
} from '@/database_services/assetService';

/**
 * Verse assignment for the Bible assets list.
 *
 * The list is a flat sequence of separators (verse labels) and assets. An
 * asset's verse is whatever labeled separator sits above it; assets under the
 * unassigned separator have no verse. Labels are not stored on their own: a
 * labeled separator exists only because at least one asset carries its range,
 * or because the user just created it and it is still held in UI state.
 *
 * order_index encodes placement as `(verse * 1000 + sequence) * 1000`, with
 * sequence starting at 1 inside each verse group. Unassigned assets use
 * UNASSIGNED_VERSE_BASE so they sort after every real verse.
 */

export interface VerseRange {
  from: number;
  to: number;
}

export interface VerseListAsset {
  id: string;
  order_index?: number | null;
  metadata?: unknown;
}

export interface VerseListAssetItem<A extends VerseListAsset = VerseListAsset> {
  type: 'asset';
  content: A;
  key: string;
}

export interface VerseListSeparator {
  type: 'separator';
  from?: number;
  to?: number;
  key: string;
}

export type VerseListItem<A extends VerseListAsset = VerseListAsset> =
  | VerseListAssetItem<A>
  | VerseListSeparator;

/** A label created in the UI that no asset carries yet. */
export interface ManualSeparator {
  from: number;
  to: number;
  key: string;
  /** Asset the label was added above. */
  assetId?: string;
}

export const UNASSIGNED_VERSE_BASE = 999;
export const UNASSIGNED_SEPARATOR_KEY = 'sep-unassigned';

export function orderIndexFor(verseBase: number, sequence: number): number {
  return (verseBase * 1000 + sequence) * 1000;
}

/** order_index that sorts before every asset in the verse. */
export function verseStartOrderIndex(verseBase: number): number {
  return orderIndexFor(verseBase, 0);
}

/**
 * Highest sequence already used in a verse group, so new assets can be
 * appended after it. Assets in `excludeIds` are ignored because they are the
 * ones being moved.
 */
export function lastSequenceInVerse(
  assets: readonly VerseListAsset[],
  verseBase: number,
  excludeIds: ReadonlySet<string> = new Set()
): number {
  const min = verseStartOrderIndex(verseBase);
  const max = verseStartOrderIndex(verseBase + 1) - 1;
  let last = 0;
  for (const asset of assets) {
    if (excludeIds.has(asset.id)) continue;
    const orderIndex = asset.order_index ?? 0;
    if (orderIndex < min || orderIndex > max) continue;
    last = Math.max(last, Math.floor(orderIndex / 1000) - verseBase * 1000);
  }
  return last;
}

export function parseAssetMetadata(raw: unknown): AssetMetadata | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as AssetMetadata)
        : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as AssetMetadata) : null;
}

export function getVerseRange(asset: VerseListAsset): VerseRange | undefined {
  // Stored metadata is not validated, so `to` may be missing.
  const verse = parseAssetMetadata(asset.metadata)?.verse as
    | Partial<VerseRange>
    | undefined;
  if (verse?.from == null) return undefined;
  return { from: verse.from, to: verse.to ?? verse.from };
}

function withVerse(rawMetadata: unknown, verse: VerseRange | null) {
  return {
    ...(parseAssetMetadata(rawMetadata) ?? {}),
    verse: verse ?? undefined
  };
}

function rangeKey(from: number | undefined, to: number | undefined) {
  return `${from ?? 'none'}-${to ?? 'none'}`;
}

function separatorRange(separator: VerseListSeparator): VerseRange | null {
  if (separator.from === undefined) return null;
  return { from: separator.from, to: separator.to ?? separator.from };
}

function byOrderIndex(a: VerseListAsset, b: VerseListAsset) {
  return (a.order_index ?? 0) - (b.order_index ?? 0);
}

/**
 * Builds the rendered list: labeled groups in verse order, then the
 * unassigned group, with manual separators placed where the user added them.
 */
export function buildVerseList<A extends VerseListAsset>(
  assets: readonly A[],
  manualSeparators: readonly ManualSeparator[]
): VerseListItem<A>[] {
  const labeled: { asset: A; verse: VerseRange }[] = [];
  const unlabeled: A[] = [];
  for (const asset of assets) {
    const verse = getVerseRange(asset);
    if (verse) labeled.push({ asset, verse });
    else unlabeled.push(asset);
  }

  // Sorting by `to` as well keeps groups that share a start verse contiguous.
  labeled.sort(
    (a, b) =>
      a.verse.from - b.verse.from ||
      a.verse.to - b.verse.to ||
      byOrderIndex(a.asset, b.asset)
  );
  unlabeled.sort(byOrderIndex);

  const result: VerseListItem<A>[] = [];
  let current: VerseRange | undefined;
  for (const { asset, verse } of labeled) {
    if (verse.from !== current?.from || verse.to !== current.to) {
      result.push({
        type: 'separator',
        from: verse.from,
        to: verse.to,
        key: `sep-${verse.from}-${verse.to}`
      });
      current = verse;
    }
    result.push({ type: 'asset', content: asset, key: asset.id });
  }

  const toItem = (sep: ManualSeparator): VerseListSeparator => ({
    type: 'separator',
    from: sep.from,
    to: sep.to,
    key: sep.key
  });
  for (const sep of manualSeparators) {
    if (!sep.assetId) continue;
    const assetIndex = result.findIndex(
      (entry) => entry.type === 'asset' && entry.content.id === sep.assetId
    );
    // Labels added above an unassigned asset go at the end of the labeled part.
    result.splice(
      assetIndex === -1 ? result.length : assetIndex,
      0,
      toItem(sep)
    );
  }
  const positionedByVerse = manualSeparators
    .filter((sep) => !sep.assetId)
    .sort((a, b) => a.from - b.from);
  for (const sep of positionedByVerse) {
    const insertIndex = result.findIndex(
      (entry) =>
        entry.type === 'separator' &&
        entry.from !== undefined &&
        sep.from < entry.from
    );
    result.splice(
      insertIndex === -1 ? result.length : insertIndex,
      0,
      toItem(sep)
    );
  }

  if (unlabeled.length > 0) {
    result.push({ type: 'separator', key: UNASSIGNED_SEPARATOR_KEY });
    for (const asset of unlabeled) {
      result.push({ type: 'asset', content: asset, key: asset.id });
    }
  }

  // A manual label and the label derived from asset metadata can describe the
  // same range while the metadata write is in flight; show only the manual one.
  const manualKeys = new Set(manualSeparators.map((sep) => sep.key));
  const manualRanges = new Set(
    manualSeparators.map((sep) => rangeKey(sep.from, sep.to))
  );
  const seenRanges = new Set<string>();
  return result.filter((item) => {
    if (item.type !== 'separator') return true;
    const range = rangeKey(item.from, item.to);
    if (seenRanges.has(range)) return false;
    if (!manualKeys.has(item.key) && manualRanges.has(range)) return false;
    seenRanges.add(range);
    return true;
  });
}

export function lastUnassignedOrderIndex(
  assets: readonly VerseListAsset[]
): number | undefined {
  let last: number | undefined;
  for (const asset of assets) {
    if (getVerseRange(asset)) continue;
    const orderIndex = asset.order_index ?? 0;
    if (last === undefined || orderIndex > last) last = orderIndex;
  }
  return last;
}

function labeledSeparators(list: readonly VerseListItem[]) {
  return list.filter(
    (item): item is VerseListSeparator & VerseRange =>
      item.type === 'separator' &&
      item.from !== undefined &&
      item.to !== undefined
  );
}

/** Distinct label ranges in verse order. */
export function labelRanges(list: readonly VerseListItem[]): VerseRange[] {
  const seen = new Set<string>();
  const ranges: VerseRange[] = [];
  for (const sep of labeledSeparators(list)) {
    const key = rangeKey(sep.from, sep.to);
    if (seen.has(key)) continue;
    seen.add(key);
    ranges.push({ from: sep.from, to: sep.to });
  }
  return ranges.sort((a, b) => a.from - b.from);
}

/** Verses 1..verseCount that no label covers. */
export function unlabeledVerses(
  list: readonly VerseListItem[],
  verseCount: number
): number[] {
  const occupied = new Set<number>();
  for (const sep of labeledSeparators(list)) {
    for (let verse = sep.from; verse <= sep.to; verse++) occupied.add(verse);
  }
  const available: number[] = [];
  for (let verse = 1; verse <= (verseCount || 1); verse++) {
    if (!occupied.has(verse)) available.push(verse);
  }
  return available;
}

/** Largest `to` for a new label starting at `from` that does not overlap the next label. */
export function maxToForNewLabel(
  list: readonly VerseListItem[],
  from: number,
  verseCount: number
): number {
  if (!unlabeledVerses(list, verseCount).includes(from)) return from;
  const nextStart = labeledSeparators(list)
    .map((sep) => sep.from)
    .filter((start) => start > from)
    .sort((a, b) => a - b)[0];
  return nextStart !== undefined ? nextStart - 1 : verseCount || 1;
}

/**
 * Verses free for a label at `index`: after the nearest label above it and
 * before the nearest label below it. For a separator index this includes the
 * separator's own range.
 */
export function openRangeAt(
  list: readonly VerseListItem[],
  index: number,
  verseCount: number
): VerseRange & { availableVerses: number[] } {
  const max = verseCount || 1;
  let prevTo: number | undefined;
  for (let i = index - 1; i >= 0; i--) {
    const item = list[i];
    if (item?.type === 'separator' && item.to !== undefined) {
      prevTo = item.to;
      break;
    }
  }
  let nextFrom: number | undefined;
  for (let i = index + 1; i < list.length; i++) {
    const item = list[i];
    if (item?.type === 'separator' && item.from !== undefined) {
      nextFrom = item.from;
      break;
    }
  }

  const from = Math.max(1, (prevTo ?? 0) + 1);
  const to = Math.min(nextFrom !== undefined ? nextFrom - 1 : max, max);
  const availableVerses: number[] = [];
  for (let verse = from; verse <= to; verse++) availableVerses.push(verse);
  return { from, to: Math.max(from, to), availableVerses };
}

/**
 * Assigns `range` to the assets starting at `startIndex` and continuing until
 * the next separator, renumbering them from the start of the verse.
 */
export function assignGroupFrom(
  list: readonly VerseListItem[],
  startIndex: number,
  range: VerseRange
): AssetUpdatePayload[] {
  const updates: AssetUpdatePayload[] = [];
  let sequence = 1;
  for (let i = startIndex; i < list.length; i++) {
    const item = list[i];
    if (!item || item.type === 'separator') break;
    updates.push({
      assetId: item.content.id,
      metadata: withVerse(item.content.metadata, range),
      order_index: orderIndexFor(range.from, sequence++)
    });
  }
  return updates;
}

export type ReorderRejection =
  /** An asset would sit above every separator. */
  | 'above-first-section'
  /** A label would leave verse order or land in the unassigned section. */
  | 'out-of-order'
  /** A label that had recordings would be left with none. */
  | 'empties-label';

export type ReorderPlan =
  | { ok: true; updates: AssetUpdatePayload[] }
  | { ok: false; reason: ReorderRejection };

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

function labelsWithAssets(list: readonly VerseListItem[]): Set<string> {
  const keys = new Set<string>();
  let current: VerseListSeparator | undefined;
  for (const item of list) {
    if (item.type === 'separator') current = item;
    else if (current?.from !== undefined) keys.add(current.key);
  }
  return keys;
}

function validateSeparatorMove(
  before: readonly VerseListItem[],
  after: readonly VerseListItem[],
  movedIndex: number
): ReorderRejection | null {
  const moved = after[movedIndex];
  if (moved?.type !== 'separator' || moved.from === undefined) return null;
  const range = separatorRange(moved)!;

  for (let i = movedIndex - 1; i >= 0; i--) {
    const item = after[i];
    if (item?.type !== 'separator') continue;
    if (item.from === undefined) return 'out-of-order';
    if ((item.to ?? item.from) >= range.from) return 'out-of-order';
    break;
  }
  for (let i = movedIndex + 1; i < after.length; i++) {
    const item = after[i];
    if (item?.type !== 'separator' || item.from === undefined) continue;
    if (item.from <= range.to) return 'out-of-order';
    break;
  }

  const hadAssets = labelsWithAssets(before);
  const hasAssets = labelsWithAssets(after);
  for (const key of hadAssets) {
    if (!hasAssets.has(key)) return 'empties-label';
  }
  return null;
}

/**
 * Works out what a drag from `fromIndex` to `toIndex` means for asset verse
 * labels and order, or why the drop should be refused. Only assets whose verse
 * or order_index actually changes are returned.
 */
export function planReorder(
  list: readonly VerseListItem[],
  fromIndex: number,
  toIndex: number
): ReorderPlan {
  const reordered = moveItem(list, fromIndex, toIndex);

  if (reordered[0]?.type === 'asset') {
    return { ok: false, reason: 'above-first-section' };
  }
  const rejection = validateSeparatorMove(list, reordered, toIndex);
  if (rejection) return { ok: false, reason: rejection };

  const updates: AssetUpdatePayload[] = [];
  let range: VerseRange | null = null;
  let sequence = 1;
  for (const item of reordered) {
    if (item.type === 'separator') {
      range = separatorRange(item);
      sequence = 1;
      continue;
    }

    const orderIndex = orderIndexFor(
      range?.from ?? UNASSIGNED_VERSE_BASE,
      sequence++
    );
    const current = getVerseRange(item.content);
    const verseChanged =
      current?.from !== range?.from || current?.to !== range?.to;
    const orderChanged = orderIndex !== item.content.order_index;
    if (!verseChanged && !orderChanged) continue;

    const update: AssetUpdatePayload = { assetId: item.content.id };
    if (verseChanged) update.metadata = withVerse(item.content.metadata, range);
    if (orderChanged) update.order_index = orderIndex;
    updates.push(update);
  }

  return { ok: true, updates };
}
