/**
 * Utility to clean up duplicate quest records
 *
 * This handles the case where multiple quest records exist with the same name
 * but different IDs (e.g., "Ruth 1" created multiple times).
 *
 * Usage: Import and call `cleanupDuplicateQuests(projectId)` to clean a project
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { eq, inArray } from 'drizzle-orm';

interface DuplicateGroup {
  name: string;
  records: Array<{
    id: string;
    name: string;
    project_id: string;
    created_at: string;
    source: 'local' | 'synced';
  }>;
}

/**
 * Find and remove duplicate quest records in a project
 * Keeps the newest record from the highest priority source (synced > local)
 */
export async function cleanupDuplicateQuests(projectId: string): Promise<{
  cleanedCount: number;
  groups: DuplicateGroup[];
}> {
  console.log(`🧹 Scanning for duplicate quests in project: ${projectId}`);

  const questLocal = resolveTable('quest', { localOverride: true });
  const questSynced = resolveTable('quest', { localOverride: false });

  // Get all quests from both tables
  const [localQuests, syncedQuests] = await Promise.all([
    system.db
      .select()
      .from(questLocal)
      .where(eq(questLocal.project_id, projectId)),
    system.db
      .select()
      .from(questSynced)
      .where(eq(questSynced.project_id, projectId))
  ]);

  // Combine and tag with source
  const allQuests = [
    ...localQuests.map((q) => ({ ...q, source: 'local' as const })),
    ...syncedQuests.map((q) => ({ ...q, source: 'synced' as const }))
  ];

  // Group by name
  const nameGroups = new Map<string, typeof allQuests>();
  allQuests.forEach((q) => {
    const existing = nameGroups.get(q.name);
    if (existing) {
      existing.push(q);
    } else {
      nameGroups.set(q.name, [q]);
    }
  });

  // Find groups with duplicates
  const duplicateGroups: DuplicateGroup[] = [];
  nameGroups.forEach((records, name) => {
    if (records.length > 1) {
      duplicateGroups.push({ name, records });
    }
  });

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate quests found');
    return { cleanedCount: 0, groups: [] };
  }

  console.log(`🔍 Found ${duplicateGroups.length} groups with duplicates:`);
  duplicateGroups.forEach((group) => {
    console.log(`  "${group.name}": ${group.records.length} copies`);
  });

  let totalDeleted = 0;

  // For each duplicate group, keep the best one and delete the rest
  for (const group of duplicateGroups) {
    // Sort by priority: synced > local, then by created_at (newest first)
    const sorted = [...group.records].sort((a, b) => {
      if (a.source === 'synced' && b.source === 'local') return -1;
      if (a.source === 'local' && b.source === 'synced') return 1;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    const keeper = sorted[0];
    const toDelete = sorted.slice(1);

    if (!keeper) {
      console.warn(`  No keeper found for group "${group.name}", skipping...`);
      continue;
    }

    console.log(
      `  Keeping: ${keeper.id} (${keeper.source}, ${keeper.created_at})`
    );

    // Delete from local table
    const localToDelete = toDelete
      .filter((q) => q.source === 'local')
      .map((q) => q.id);
    if (localToDelete.length > 0) {
      await system.db
        .delete(questLocal)
        .where(inArray(questLocal.id, localToDelete));
      console.log(`    Deleted ${localToDelete.length} from local`);
      totalDeleted += localToDelete.length;
    }

    // Note: We DON'T delete from synced table - that would affect cloud data
    // Synced duplicates should be resolved on the backend
    const syncedDuplicates = toDelete.filter((q) => q.source === 'synced');
    if (syncedDuplicates.length > 0) {
      console.warn(
        `    ⚠️  Found ${syncedDuplicates.length} synced duplicates - manual cleanup needed`
      );
    }
  }

  console.log(`✅ Cleaned up ${totalDeleted} duplicate quest records`);

  return {
    cleanedCount: totalDeleted,
    groups: duplicateGroups
  };
}

/**
 * Preview duplicate quests without deleting them
 */
export async function previewDuplicateQuests(
  projectId: string
): Promise<DuplicateGroup[]> {
  console.log(`🔍 Previewing duplicate quests in project: ${projectId}`);

  const questLocal = resolveTable('quest', { localOverride: true });
  const questSynced = resolveTable('quest', { localOverride: false });

  const [localQuests, syncedQuests] = await Promise.all([
    system.db
      .select()
      .from(questLocal)
      .where(eq(questLocal.project_id, projectId)),
    system.db
      .select()
      .from(questSynced)
      .where(eq(questSynced.project_id, projectId))
  ]);

  const allQuests = [
    ...localQuests.map((q) => ({ ...q, source: 'local' as const })),
    ...syncedQuests.map((q) => ({ ...q, source: 'synced' as const }))
  ];

  const nameGroups = new Map<string, typeof allQuests>();
  allQuests.forEach((q) => {
    const existing = nameGroups.get(q.name);
    if (existing) {
      existing.push(q);
    } else {
      nameGroups.set(q.name, [q]);
    }
  });

  const duplicateGroups: DuplicateGroup[] = [];
  nameGroups.forEach((records, name) => {
    if (records.length > 1) {
      duplicateGroups.push({ name, records });
    }
  });

  console.log(`Found ${duplicateGroups.length} groups with duplicates`);
  return duplicateGroups;
}
