import type {
  DashboardJsonPayload,
  DashboardMetrics,
  JsonRecord,
  MemberStats,
  ProjectDashboardContext
} from './types.ts';

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

function getContentType(value: unknown): 'source' | 'translation' | 'transcription' | null {
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

function hasText(value: unknown): boolean {
  const text = asString(value);
  return text !== null;
}

function hasAudio(row: JsonRecord): boolean {
  if (toStringArray(row.audio).length > 0) {
    return true;
  }

  return asString(row.audio_id) !== null;
}

function hasImage(row: JsonRecord): boolean {
  if (asString(row.image) !== null) {
    return true;
  }

  return toStringArray(row.images).length > 0;
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

export function buildGenericDashboardMetrics(
  context: ProjectDashboardContext
): DashboardMetrics {
  const quests = context.quests;
  const assets = context.assets;
  const questAssetLinks = context.questAssetLinks;
  const assetContentLinks = context.assetContentLinks;
  const profileProjectLinks = context.profileProjectLinks;
  const projectLanguageLinks = context.projectLanguageLinks;

  const activeQuests = quests.filter((q) => asBoolean(q.active, true));
  const inactiveQuests = quests.filter((q) => !asBoolean(q.active, true));
  const activeQuestIds = new Set(
    activeQuests
      .map((q) => asString(q.id))
      .filter((id): id is string => id !== null)
  );

  const activeAssets = assets.filter((a) => asBoolean(a.active, true));
  const sourceAssets = assets.filter((a) => getContentType(a.content_type) === 'source');
  const activeSourceAssets = sourceAssets.filter((a) => asBoolean(a.active, true));
  const inactiveSourceAssets = sourceAssets.filter((a) => !asBoolean(a.active, true));
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

    if (!aclByAssetId.has(assetId)) {
      aclByAssetId.set(assetId, []);
    }
    aclByAssetId.get(assetId)?.push(acl);
  }

  const assetHasText = new Map<string, boolean>();
  const assetHasAudio = new Map<string, boolean>();
  for (const [assetId, aclRows] of aclByAssetId.entries()) {
    const hasAnyText = aclRows.some((row) => hasText(row.text));
    const hasAnyAudio = aclRows.some((row) => hasAudio(row));
    assetHasText.set(assetId, hasAnyText);
    assetHasAudio.set(assetId, hasAnyAudio);
  }

  const questHasContent = new Map<string, boolean>();
  for (const quest of activeQuests) {
    const questId = asString(quest.id);
    if (!questId) continue;

    const linkedAssetIds = questToAssetIds.get(questId) ?? new Set<string>();
    let hasAnyContent = false;

    for (const assetId of linkedAssetIds) {
      const asset = activeSourceAssetById.get(assetId);
      if (!asset) continue;

      if (
        hasImage(asset) ||
        assetHasText.get(assetId) === true ||
        assetHasAudio.get(assetId) === true
      ) {
        hasAnyContent = true;
        break;
      }
    }

    questHasContent.set(questId, hasAnyContent);
  }

  const rootQuests = activeQuests.filter((q) => asString(q.parent_id) === null);
  const subquests = activeQuests.filter((q) => asString(q.parent_id) !== null);

  const childrenByParentId = new Map<string, JsonRecord[]>();
  for (const quest of subquests) {
    const parentId = asString(quest.parent_id);
    if (!parentId) continue;

    if (!childrenByParentId.has(parentId)) {
      childrenByParentId.set(parentId, []);
    }
    childrenByParentId.get(parentId)?.push(quest);
  }

  const getDescendantQuests = (rootQuestId: string): JsonRecord[] => {
    const descendants: JsonRecord[] = [];
    const stack = [...(childrenByParentId.get(rootQuestId) ?? [])];

    while (stack.length > 0) {
      const next = stack.pop();
      if (!next) continue;

      descendants.push(next);
      const nextId = asString(next.id);
      if (!nextId) continue;
      const children = childrenByParentId.get(nextId) ?? [];
      for (const child of children) {
        stack.push(child);
      }
    }

    return descendants;
  };

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

  for (const quest of activeQuests) {
    addMemberQuest(asString(quest.creator_id));
  }
  for (const asset of activeSourceAssets) {
    addMemberAsset(asString(asset.creator_id));
  }

  const questsJson: DashboardJsonPayload['quests'] = {};

  for (const rootQuest of rootQuests) {
    const rootQuestId = asString(rootQuest.id);
    if (!rootQuestId) continue;

    const descendants = getDescendantQuests(rootQuestId);
    const descendantsById = new Set(
      descendants
        .map((q) => asString(q.id))
        .filter((id): id is string => id !== null)
    );

    const hierarchyQuestIds = new Set<string>([rootQuestId, ...descendantsById]);
    const hierarchyAssetIds = new Set<string>();
    for (const questId of hierarchyQuestIds) {
      const ids = questToAssetIds.get(questId);
      if (!ids) continue;
      for (const assetId of ids) hierarchyAssetIds.add(assetId);
    }

    const hierarchyAssets = [...hierarchyAssetIds]
      .map((assetId) => activeSourceAssetById.get(assetId))
      .filter((asset): asset is JsonRecord => asset !== undefined);

    const hierarchyCreators = distinct([
      asString(rootQuest.creator_id),
      ...descendants.map((q) => asString(q.creator_id)),
      ...hierarchyAssets.map((asset) => asString(asset.creator_id))
    ]);

    const hierarchyLanguoids = distinct(
      hierarchyAssets.map(
        (asset) => asString(asset.languoid_id) ?? asString(asset.source_language_id)
      )
    );

    const descendantCompleted = countWhere(descendants, (quest) => {
      const questId = asString(quest.id);
      return questId ? questHasContent.get(questId) === true : false;
    });

    const subquestsJson = descendants.map((quest) => {
      const questId = asString(quest.id);
      const directAssetIds = questId
        ? [...(questToAssetIds.get(questId) ?? new Set<string>())]
        : [];
      const directAssets = directAssetIds
        .map((assetId) => activeSourceAssetById.get(assetId))
        .filter((asset): asset is JsonRecord => asset !== undefined);
      const directLanguoids = distinct(
        directAssets.map(
          (asset) =>
            asString(asset.languoid_id) ?? asString(asset.source_language_id)
        )
      );
      const directItemsCount = directAssets.length;

      return {
        name: asString(quest.name),
        creatorsId: distinct([asString(quest.creator_id)]),
        languoids: directLanguoids,
        itemsExpected: directItemsCount,
        itemsCompleted: directItemsCount,
        totalVersions: 1,
        totalAssets: directAssets.length,
        totalTranscriptions: directAssetIds.reduce(
          (sum, assetId) => sum + (sourceTranscriptionCount.get(assetId) ?? 0),
          0
        ),
        totalTranslations: directAssetIds.reduce(
          (sum, assetId) => sum + (sourceTranslationCount.get(assetId) ?? 0),
          0
        ),
        totalAssetsWithTranscription: countWhere(
          directAssetIds,
          (assetId) => sourceHasTranscription.get(assetId) === true
        ),
        totalAssetsWithTranslation: countWhere(
          directAssetIds,
          (assetId) => sourceHasTranslation.get(assetId) === true
        ),
        totalImages: countWhere(directAssets, (asset) => hasImage(asset)),
        totalText: countWhere(
          directAssetIds,
          (assetId) => assetHasText.get(assetId) === true
        ),
        totalAudio: countWhere(
          directAssetIds,
          (assetId) => assetHasAudio.get(assetId) === true
        )
      };
    });

    questsJson[rootQuestId] = {
      name: asString(rootQuest.name),
      questCompleted: false,
      totalSubquestsCreated: descendants.length,
      totalSubquestsExpected: descendants.length,
      totalSubquestsCompleted: descendantCompleted,
      totalAssets: hierarchyAssets.length,
      languoids: hierarchyLanguoids,
      creatorsId: hierarchyCreators,
      subquests: subquestsJson
    };
  }

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
    (ppl) =>
      asBoolean(ppl.active, true) && asString(ppl.membership) === 'owner'
  );

  const completedQuests = countWhere(rootQuests, (quest) => {
    const questId = asString(quest.id);
    return questId ? questHasContent.get(questId) === true : false;
  });
  const completedSubquests = countWhere(subquests, (quest) => {
    const questId = asString(quest.id);
    return questId ? questHasContent.get(questId) === true : false;
  });

  return {
    total_quests: rootQuests.length,
    total_subquests: subquests.length,
    expected_quests: 0,
    total_assets: activeSourceAssets.length,
    total_quests_versions: quests.length,
    completed_quests: completedQuests,
    completed_subquests: completedSubquests,
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
    assets_with_image: countWhere(activeSourceAssets, (asset) => hasImage(asset)),
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
        (asset) => asString(asset.languoid_id) ?? asString(asset.source_language_id)
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
