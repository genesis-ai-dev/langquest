/**
 * Quest-scoped "anything still on its way to the server?" check used by the
 * offload verification drawer.
 *
 * Two things can still be in flight for a quest:
 *   - PowerSync CRUD ops in `ps_crud` that write one of the quest's rows
 *   - audio files on this device whose asset_content_link row has not been
 *     confirmed by the server (`audio_uploaded_at` is null)
 *
 * Both are counted per quest. Device-wide counts (all of ps_crud, the
 * AudioUploader's pending total) block a published quest's offload whenever
 * an unrelated draft is mid-edit, now that drafts sync as soon as they are
 * written.
 */
import { asset_content_link, quest_asset_link, vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { localFileIndex } from '@/services/attachments/LocalFileIndex';
import {
  isRemoteAudioObject,
  localAudioFileName
} from '@/utils/attachmentPaths';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

/** Row ids that belong to one quest, keyed the way PowerSync keys them. */
export interface QuestScope {
  questId: string;
  assetIds: Set<string>;
  assetContentLinkIds: Set<string>;
  voteIds: Set<string>;
}

/** The parts of a `ps_crud.data` JSON blob this module cares about. */
export interface CrudEntryData {
  type?: string;
  id?: string;
}

export interface QuestPendingChanges {
  /** ps_crud ops that write rows of this quest. */
  records: number;
  /** Audio files on this device the server has not confirmed for this quest. */
  audioFiles: number;
}

const COMPOSITE_SEPARATOR = '_';

export function parseCrudEntry(raw: unknown): CrudEntryData | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    const { type, id } = parsed as { type?: unknown; id?: unknown };
    return {
      type: typeof type === 'string' ? type : undefined,
      id: typeof id === 'string' ? id : undefined
    };
  } catch {
    return null;
  }
}

/**
 * True when a ps_crud entry writes a row that belongs to `scope`.
 *
 * Link tables use PowerSync's synthetic `key1_key2` ids (see sync-rules.yml),
 * so quest-keyed links match on prefix and asset-keyed links on the first
 * segment. Deletes are matched the same way even though the row is already
 * gone locally.
 */
export function crudEntryTouchesQuest(
  entry: CrudEntryData,
  scope: QuestScope
): boolean {
  const { type, id } = entry;
  if (!type || !id) return false;

  switch (type) {
    case 'quest':
      return id === scope.questId;
    case 'quest_asset_link':
    case 'quest_tag_link':
      return id.startsWith(scope.questId + COMPOSITE_SEPARATOR);
    case 'asset':
      return scope.assetIds.has(id);
    case 'asset_content_link':
      return scope.assetContentLinkIds.has(id);
    case 'vote':
      return scope.voteIds.has(id);
    case 'asset_tag_link': {
      const assetId = id.split(COMPOSITE_SEPARATOR)[0];
      return !!assetId && scope.assetIds.has(assetId);
    }
    default:
      return false;
  }
}

/**
 * Count audio values that are still waiting on this device: uploadable object
 * names whose file exists locally. Values with no local file are not
 * "pending" (nothing can upload them); the cloud verification step reports
 * those as unconfirmed instead.
 */
export function countPendingAudioFiles(
  rows: { audio: string[] | null }[],
  hasLocalFile: (filename: string) => boolean = (name) =>
    localFileIndex.has(name)
): number {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const value of row.audio ?? []) {
      if (!value || !isRemoteAudioObject(value)) continue;
      if (seen.has(value)) continue;
      if (!hasLocalFile(localAudioFileName(value))) continue;
      seen.add(value);
    }
  }
  return seen.size;
}

export async function loadQuestScope(questId: string): Promise<QuestScope> {
  const links = await system.db
    .select({ asset_id: quest_asset_link.asset_id })
    .from(quest_asset_link)
    .where(eq(quest_asset_link.quest_id, questId));
  const assetIds = new Set(links.map((link) => link.asset_id));

  if (assetIds.size === 0) {
    return {
      questId,
      assetIds,
      assetContentLinkIds: new Set(),
      voteIds: new Set()
    };
  }

  const assetIdList = [...assetIds];
  const [contentLinks, votes] = await Promise.all([
    system.db
      .select({ id: asset_content_link.id })
      .from(asset_content_link)
      .where(inArray(asset_content_link.asset_id, assetIdList)),
    system.db
      .select({ id: vote.id })
      .from(vote)
      .where(inArray(vote.asset_id, assetIdList))
  ]);

  return {
    questId,
    assetIds,
    assetContentLinkIds: new Set(contentLinks.map((row) => row.id)),
    voteIds: new Set(votes.map((row) => row.id))
  };
}

export async function countQuestPendingChanges(
  questId: string
): Promise<QuestPendingChanges> {
  const scope = await loadQuestScope(questId);

  const crudRows = await system.powersync.getAll<{ data: string }>(
    'SELECT data FROM ps_crud'
  );
  let records = 0;
  for (const row of crudRows) {
    const entry = parseCrudEntry(row.data);
    if (entry && crudEntryTouchesQuest(entry, scope)) records++;
  }

  let audioFiles = 0;
  if (scope.assetIds.size > 0) {
    await localFileIndex.init();
    const unconfirmed = await system.db
      .select({ audio: asset_content_link.audio })
      .from(asset_content_link)
      .where(
        and(
          inArray(asset_content_link.asset_id, [...scope.assetIds]),
          isNotNull(asset_content_link.audio),
          isNull(asset_content_link.audio_uploaded_at)
        )
      );
    audioFiles = countPendingAudioFiles(unconfirmed);
  }

  return { records, audioFiles };
}
