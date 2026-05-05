import type {
  DashboardJsonPayload,
  DashboardMetrics,
  DashboardSubquestItem,
  JsonRecord,
  MemberStats,
  ProjectDashboardContext
} from './types.ts';

type FiaMetadata = {
  bookId: string;
  pericopeId?: string;
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asPositiveInteger(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function getContentType(
  value: unknown
): 'source' | 'translation' | 'transcription' | null {
  const normalized = asString(value)?.toLowerCase();
  if (
    normalized === 'source' ||
    normalized === 'translation' ||
    normalized === 'transcription'
  ) {
    return normalized;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => item !== null);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => asString(item))
          .filter((item): item is string => item !== null);
      }
    } catch {
      return [trimmed];
    }
  }

  return [];
}

function distinct(values: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (value && value.trim()) set.add(value);
  }
  return [...set];
}

function countWhere<T>(list: T[], predicate: (item: T) => boolean): number {
  let count = 0;
  for (const item of list) {
    if (predicate(item)) count += 1;
  }
  return count;
}

function hasText(value: unknown): boolean {
  return asString(value) !== null;
}

function hasAudio(row: JsonRecord): boolean {
  if (toStringArray(row.audio).length > 0) return true;
  return asString(row.audio_id) !== null;
}

function hasImage(row: JsonRecord): boolean {
  if (asString(row.image) !== null) return true;
  return toStringArray(row.images).length > 0;
}

function parseFiaMetadata(rawMetadata: unknown): FiaMetadata | null {
  const metadata = parseJsonRecord(rawMetadata);
  if (!metadata) return null;

  const fia = parseJsonRecord(metadata.fia);
  if (!fia) return null;

  const bookId = asString(fia.bookId)?.toLowerCase();
  if (!bookId) return null;

  const pericopeId = asString(fia.pericopeId)?.toLowerCase();
  return {
    bookId,
    pericopeId
  };
}

function parseVerseRange(
  rawMetadata: unknown
): { from: number; to: number } | null {
  const metadata = parseJsonRecord(rawMetadata);
  if (!metadata) return null;

  const verse = parseJsonRecord(metadata.verse);
  if (!verse) return null;

  const from = asNumber(verse.from);
  if (from === null || from <= 0) return null;

  const to = asNumber(verse.to);
  const start = Math.floor(from);
  const end = Math.floor(to ?? from);
  return {
    from: Math.min(start, end),
    to: Math.max(start, end)
  };
}

function getLatestByCreatedAt(rows: JsonRecord[]): JsonRecord | null {
  if (rows.length === 0) return null;

  return [...rows].sort((a, b) => {
    const aTime = new Date(asString(a.created_at) ?? 0).getTime();
    const bTime = new Date(asString(b.created_at) ?? 0).getTime();
    return bTime - aTime;
  })[0];
}

function buildFiaPericopeExpectedMap(rows: JsonRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const itemId = asString(row.item_id)?.toLowerCase();
    const expectedItems = asPositiveInteger(row.item_count);
    if (!itemId || expectedItems === null) continue;
    map.set(itemId, expectedItems);
  }
  return map;
}

function pericopeBelongsToBook(pericopeId: string, bookId: string): boolean {
  return pericopeId === bookId || pericopeId.startsWith(`${bookId}-`);
}

export function buildFiaDashboard(
  context: ProjectDashboardContext
): DashboardMetrics {
  const quests = context.quests;
  const assets = context.assets;
  const questAssetLinks = context.questAssetLinks;
  const assetContentLinks = context.assetContentLinks;
  const profileProjectLinks = context.profileProjectLinks;
  const projectLanguageLinks = context.projectLanguageLinks;
  const fiaPericopeExpectedMap = buildFiaPericopeExpectedMap(
    context.templateStructureRows
  );

  const activeQuests = quests.filter((q) => asBoolean(q.active, true));
  const inactiveQuests = quests.filter((q) => !asBoolean(q.active, true));
  const activeQuestIds = new Set(
    activeQuests
      .map((q) => asString(q.id))
      .filter((id): id is string => id !== null)
  );

  const activeAssets = assets.filter((a) => asBoolean(a.active, true));
  const sourceAssets = assets.filter(
    (a) => getContentType(a.content_type) === 'source'
  );
  const activeSourceAssets = sourceAssets.filter((a) =>
    asBoolean(a.active, true)
  );
  const inactiveSourceAssets = sourceAssets.filter(
    (a) => !asBoolean(a.active, true)
  );
  const activeSourceAssetIds = new Set(
    activeSourceAssets
      .map((a) => asString(a.id))
      .filter((id): id is string => id !== null)
  );

  const activeSourceAssetById = new Map<string, JsonRecord>();
  for (const asset of activeSourceAssets) {
    const id = asString(asset.id);
    if (id) activeSourceAssetById.set(id, asset);
  }

  const sourceHasTranslation = new Map<string, boolean>();
  const sourceHasTranscription = new Map<string, boolean>();
  const sourceTranslationCount = new Map<string, number>();
  const sourceTranscriptionCount = new Map<string, number>();
  for (const asset of activeAssets) {
    const contentType = getContentType(asset.content_type);
    if (contentType !== 'translation' && contentType !== 'transcription') {
      continue;
    }

    const sourceAssetId = asString(asset.source_asset_id);
    if (!sourceAssetId || !activeSourceAssetIds.has(sourceAssetId)) continue;

    if (contentType === 'translation') {
      sourceHasTranslation.set(sourceAssetId, true);
      sourceTranslationCount.set(
        sourceAssetId,
        (sourceTranslationCount.get(sourceAssetId) ?? 0) + 1
      );
    }
    if (contentType === 'transcription') {
      sourceHasTranscription.set(sourceAssetId, true);
      sourceTranscriptionCount.set(
        sourceAssetId,
        (sourceTranscriptionCount.get(sourceAssetId) ?? 0) + 1
      );
    }
  }

  const activeQuestAssetLinks = questAssetLinks.filter(
    (qal) =>
      asBoolean(qal.active, true) &&
      activeQuestIds.has(asString(qal.quest_id) ?? '') &&
      activeSourceAssetIds.has(asString(qal.asset_id) ?? '')
  );

  const questToAssetIds = new Map<string, Set<string>>();
  for (const link of activeQuestAssetLinks) {
    const questId = asString(link.quest_id);
    const assetId = asString(link.asset_id);
    if (!questId || !assetId) continue;

    if (!questToAssetIds.has(questId)) {
      questToAssetIds.set(questId, new Set<string>());
    }
    questToAssetIds.get(questId)?.add(assetId);
  }

  const activeAssetContentLinks = assetContentLinks.filter(
    (acl) =>
      asBoolean(acl.active, true) &&
      activeSourceAssetIds.has(asString(acl.asset_id) ?? '')
  );

  const aclByAssetId = new Map<string, JsonRecord[]>();
  for (const acl of activeAssetContentLinks) {
    const assetId = asString(acl.asset_id);
    if (!assetId) continue;
    if (!aclByAssetId.has(assetId)) aclByAssetId.set(assetId, []);
    aclByAssetId.get(assetId)?.push(acl);
  }

  const assetHasText = new Map<string, boolean>();
  const assetHasAudio = new Map<string, boolean>();
  for (const [assetId, aclRows] of aclByAssetId.entries()) {
    assetHasText.set(
      assetId,
      aclRows.some((row) => hasText(row.text))
    );
    assetHasAudio.set(
      assetId,
      aclRows.some((row) => hasAudio(row))
    );
  }

  const members: Record<string, MemberStats> = {};
  const addMemberQuest = (profileId: string | null) => {
    if (!profileId) return;
    if (!members[profileId]) {
      members[profileId] = { questsCreated: 0, assetsCreated: 0 };
    }
    members[profileId].questsCreated += 1;
  };
  const addMemberAsset = (profileId: string | null) => {
    if (!profileId) return;
    if (!members[profileId]) {
      members[profileId] = { questsCreated: 0, assetsCreated: 0 };
    }
    members[profileId].assetsCreated += 1;
  };

  for (const quest of activeQuests) addMemberQuest(asString(quest.creator_id));
  for (const asset of activeSourceAssets)
    addMemberAsset(asString(asset.creator_id));

  const activeRootQuests = activeQuests.filter(
    (quest) => asString(quest.parent_id) === null
  );
  const activeSubquests = activeQuests.filter(
    (quest) => asString(quest.parent_id) !== null
  );

  const rootGroupsByBook = new Map<string, JsonRecord[]>();
  for (const root of activeRootQuests) {
    const metadata = parseFiaMetadata(root.metadata);
    if (!metadata?.bookId) continue;
    if (!rootGroupsByBook.has(metadata.bookId)) {
      rootGroupsByBook.set(metadata.bookId, []);
    }
    rootGroupsByBook.get(metadata.bookId)?.push(root);
  }

  const questsJson: DashboardJsonPayload['quests'] = {};

  for (const [bookId, rootVersions] of rootGroupsByBook.entries()) {
    const latestRoot = getLatestByCreatedAt(rootVersions);
    const rootIds = new Set(
      rootVersions
        .map((root) => asString(root.id))
        .filter((id): id is string => id !== null)
    );
    if (rootIds.size === 0) continue;

    const groupedSubquestRows = new Map<
      string,
      { pericopeId: string; rows: JsonRecord[] }
    >();

    for (const subquest of activeSubquests) {
      const parentId = asString(subquest.parent_id);
      if (!parentId || !rootIds.has(parentId)) continue;

      const metadata = parseFiaMetadata(subquest.metadata);
      if (!metadata?.bookId || !metadata.pericopeId) continue;
      if (metadata.bookId !== bookId) continue;

      const groupKey = `${metadata.bookId}:${metadata.pericopeId}`;
      const existing = groupedSubquestRows.get(groupKey);
      if (!existing) {
        groupedSubquestRows.set(groupKey, {
          pericopeId: metadata.pericopeId,
          rows: [subquest]
        });
      } else {
        existing.rows.push(subquest);
      }
    }

    const subquestGroups = [...groupedSubquestRows.values()].sort((a, b) =>
      a.pericopeId.localeCompare(b.pericopeId)
    );

    const subquests: DashboardSubquestItem[] = subquestGroups.map((group) => {
      const subquestIds = group.rows
        .map((row) => asString(row.id))
        .filter((id): id is string => id !== null);
      const subquestAssetIds = new Set<string>();
      for (const subquestId of subquestIds) {
        const linkedAssetIds = questToAssetIds.get(subquestId);
        if (!linkedAssetIds) continue;
        for (const assetId of linkedAssetIds) {
          subquestAssetIds.add(assetId);
        }
      }

      const subquestAssets = [...subquestAssetIds]
        .map((assetId) => activeSourceAssetById.get(assetId))
        .filter((asset): asset is JsonRecord => asset !== undefined);

      const expectedItems = fiaPericopeExpectedMap.get(group.pericopeId) ?? 0;
      const completedFlags =
        expectedItems > 0 ? new Array<boolean>(expectedItems).fill(false) : [];
      const uniqueRanges = new Set<string>();

      if (expectedItems > 0) {
        for (const asset of subquestAssets) {
          const verseRange = parseVerseRange(asset.metadata);
          if (!verseRange) continue;

          const clampedStart = Math.max(
            1,
            Math.min(expectedItems, verseRange.from)
          );
          const clampedEnd = Math.max(
            1,
            Math.min(expectedItems, verseRange.to)
          );
          const start = Math.min(clampedStart, clampedEnd);
          const end = Math.max(clampedStart, clampedEnd);

          const rangeKey = `${start}:${end}`;
          if (uniqueRanges.has(rangeKey)) continue;
          uniqueRanges.add(rangeKey);

          for (let item = start; item <= end; item += 1) {
            completedFlags[item - 1] = true;
          }
        }
      }

      const completedItems = completedFlags.reduce(
        (sum, isCompleted) => sum + (isCompleted ? 1 : 0),
        0
      );

      const latestSubquest = getLatestByCreatedAt(group.rows);
      const creatorIds = distinct(
        group.rows.map((row) => asString(row.creator_id))
      );
      const languoids = distinct(
        subquestAssets.map(
          (asset) =>
            asString(asset.languoid_id) ?? asString(asset.source_language_id)
        )
      );

      return {
        name: asString(latestSubquest?.name ?? null),
        creatorsId: creatorIds,
        languoids,
        itemsExpected: expectedItems,
        itemsCompleted: completedItems,
        totalVersions: group.rows.length,
        totalAssets: subquestAssets.length,
        totalTranscriptions: [...subquestAssetIds].reduce(
          (sum, assetId) => sum + (sourceTranscriptionCount.get(assetId) ?? 0),
          0
        ),
        totalTranslations: [...subquestAssetIds].reduce(
          (sum, assetId) => sum + (sourceTranslationCount.get(assetId) ?? 0),
          0
        ),
        totalAssetsWithTranscription: countWhere(
          [...subquestAssetIds],
          (assetId) => sourceHasTranscription.get(assetId) === true
        ),
        totalAssetsWithTranslation: countWhere(
          [...subquestAssetIds],
          (assetId) => sourceHasTranslation.get(assetId) === true
        ),
        totalImages: countWhere(subquestAssets, (asset) => hasImage(asset)),
        totalText: countWhere(
          [...subquestAssetIds],
          (assetId) => assetHasText.get(assetId) === true
        ),
        totalAudio: countWhere(
          [...subquestAssetIds],
          (assetId) => assetHasAudio.get(assetId) === true
        )
      };
    });

    const allQuestIdsForBook = new Set<string>([
      ...rootIds,
      ...subquestGroups.flatMap((group) =>
        group.rows
          .map((row) => asString(row.id))
          .filter((id): id is string => id !== null)
      )
    ]);

    const hierarchyAssetIds = new Set<string>();
    for (const questId of allQuestIdsForBook) {
      const linkedAssetIds = questToAssetIds.get(questId);
      if (!linkedAssetIds) continue;
      for (const assetId of linkedAssetIds) hierarchyAssetIds.add(assetId);
    }

    const hierarchyAssets = [...hierarchyAssetIds]
      .map((assetId) => activeSourceAssetById.get(assetId))
      .filter((asset): asset is JsonRecord => asset !== undefined);

    const totalSubquestsCompleted = countWhere(
      subquests,
      (subquest) =>
        subquest.itemsExpected > 0 &&
        subquest.itemsCompleted === subquest.itemsExpected
    );
    console.log(
      'fia total subquests expected:',
      context.templateStructureRows.length
    );
    const totalSubquestsExpected = countWhere(
      context.templateStructureRows,
      (row) =>
        (row.parent_id === null || row.parent_id === undefined) &&
        asPositiveInteger(row.item_count) !== null
    );
    const questCompleted =
      totalSubquestsExpected > 0 &&
      totalSubquestsCompleted === totalSubquestsExpected;

    const questKey = asString(latestRoot?.id) ?? bookId;
    const questName = asString(latestRoot?.name ?? null) ?? bookId;
    const creators = distinct([
      ...rootVersions.map((root) => asString(root.creator_id)),
      ...subquests.flatMap((subquest) => subquest.creatorsId),
      ...hierarchyAssets.map((asset) => asString(asset.creator_id))
    ]);
    const questLanguoids = distinct(
      hierarchyAssets.map(
        (asset) =>
          asString(asset.languoid_id) ?? asString(asset.source_language_id)
      )
    );

    questsJson[questKey] = {
      name: questName,
      questCompleted: questCompleted,
      totalSubquestsCreated: subquests.length,
      totalSubquestsExpected: totalSubquestsExpected,
      totalSubquestsCompleted: totalSubquestsCompleted,
      totalAssets: hierarchyAssets.length,
      languoids: questLanguoids,
      creatorsId: creators,
      subquests
    };
  }

  const questEntries = Object.values(questsJson);
  const totalTargetLanguages = countWhere(
    projectLanguageLinks,
    (pll) =>
      asBoolean(pll.active, true) && asString(pll.language_type) === 'target'
  );

  const totalMembers = countWhere(
    profileProjectLinks,
    (ppl) =>
      asBoolean(ppl.active, true) && asString(ppl.membership) === 'member'
  );
  const totalOwners = countWhere(
    profileProjectLinks,
    (ppl) => asBoolean(ppl.active, true) && asString(ppl.membership) === 'owner'
  );

  return {
    total_quests: questEntries.length,
    total_subquests: questEntries.reduce(
      (sum, quest) => sum + quest.totalSubquestsCreated,
      0
    ),
    expected_quests: context.templateStructureRows.filter(
      (row) =>
        row.parent_id === null ||
        (row.parent_id === undefined &&
          asPositiveInteger(row.item_count) !== null)
    ).length,
    total_assets: activeSourceAssets.length,
    total_quests_versions: quests.length,
    completed_quests: countWhere(questEntries, (quest) => quest.questCompleted),
    completed_subquests: questEntries.reduce(
      (sum, quest) => sum + quest.totalSubquestsCompleted,
      0
    ),
    inactive_quests: inactiveQuests.length,
    inactive_assets: inactiveSourceAssets.length,
    assets_with_text: countWhere(
      activeSourceAssets,
      (asset) => assetHasText.get(asString(asset.id) ?? '') === true
    ),
    assets_with_audio: countWhere(
      activeSourceAssets,
      (asset) => assetHasAudio.get(asString(asset.id) ?? '') === true
    ),
    assets_with_image: countWhere(activeSourceAssets, (asset) =>
      hasImage(asset)
    ),
    assets_with_transcription: countWhere(
      activeSourceAssets,
      (asset) => sourceHasTranscription.get(asString(asset.id) ?? '') === true
    ),
    assets_with_translation: countWhere(
      activeSourceAssets,
      (asset) => sourceHasTranslation.get(asString(asset.id) ?? '') === true
    ),
    total_source_languages: distinct(
      activeSourceAssets.map(
        (asset) =>
          asString(asset.languoid_id) ?? asString(asset.source_language_id)
      )
    ).length,
    total_target_languages: totalTargetLanguages,
    total_members: totalMembers,
    total_owners: totalOwners,
    dashboard_json: {
      members,
      quests: questsJson
    }
  };
}
