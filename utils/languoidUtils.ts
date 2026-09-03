/**
 * Utility functions for creating and managing languoids
 * Handles offline creation of new languoids when users create projects/assets with new languages
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq } from 'drizzle-orm';
import uuid from 'react-native-uuid';

/**
 * NO-OP: This function is kept for API compatibility but does nothing.
 *
 * Previously, this function called an RPC to add the user to a languoid's
 * download_profiles. This is now handled automatically by a database trigger
 * (propagate_pll_to_languoid_download_profiles_trigger) that fires when
 * project_language_link rows are inserted.
 *
 * The trigger-based approach is simpler and handles all cases uniformly:
 * - Old app users (no app-side call needed)
 * - New app users (trigger fires when insert syncs)
 * - Offline users (trigger fires when they come online)
 *
 * @param _languoid_id - Unused
 * @param _profile_id - Unused
 * @deprecated This function is a no-op. The database trigger handles everything.
 */
export async function ensureLanguoidDownloadProfile(
  _languoid_id: string,
  _profile_id: string
): Promise<void> {
  // No-op: Database trigger handles this automatically when project_language_link
  // is inserted. See migration: 20260205150100_add_project_language_link_languoid_trigger.sql
}

export interface CreateLanguoidParams {
  name: string;
  level?: 'family' | 'language' | 'dialect';
  iso639_3?: string;
  creator_id: string;
  ui_ready?: boolean;
}

export interface CreateLanguoidResult {
  languoid_id: string;
  created: boolean; // true if newly created, false if found existing
}

/**
 * Creates a new languoid in synced storage
 * When offline, PowerSync queues for upload when user comes online
 *
 * @param params - Languoid creation parameters
 * @returns The created languoid ID
 */
export async function createLanguoidOffline(
  params: CreateLanguoidParams
): Promise<CreateLanguoidResult> {
  const {
    name,
    level = 'language',
    iso639_3,
    creator_id,
    ui_ready = false
  } = params;

  // Check if a languoid with this name already exists in synced table
  const languoidSynced = resolveTable('languoid', { localOverride: false });
  const existing = await system.db
    .select()
    .from(languoidSynced)
    .where(eq(languoidSynced.name, name))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    // Languoid already exists
    return {
      languoid_id: existing[0].id,
      created: false
    };
  }

  // Generate a new ID for the languoid
  const languoidId = uuid.v4() as string;

  // Create the languoid in synced storage
  await system.db.transaction(async (tx) => {
    // Insert languoid
    await tx.insert(languoidSynced).values({
      id: languoidId,
      name: name.trim(),
      level,
      ui_ready,
      active: true,
      creator_id,
      download_profiles: [creator_id]
    });

    // If iso639_3 code is provided, create languoid_source record
    if (iso639_3 && iso639_3.trim() !== '') {
      const languoidSourceSynced = resolveTable('languoid_source', {
        localOverride: false
      });

      const sourceId = uuid.v4() as string;
      await tx.insert(languoidSourceSynced).values({
        id: sourceId,
        name: 'iso639-3',
        languoid_id: languoidId,
        unique_identifier: iso639_3.trim().toLowerCase(),
        active: true,
        creator_id,
        download_profiles: [creator_id]
      });
    }
  });

  return {
    languoid_id: languoidId,
    created: true
  };
}

/**
 * Finds or creates a languoid by name
 * Checks synced table, creates in synced table if not found
 *
 * @param name - The languoid name to find or create
 * @param creator_id - The user creating the languoid
 * @returns The languoid ID
 */
export async function findOrCreateLanguoidByName(
  name: string,
  creator_id: string
): Promise<string> {
  if (!name || name.trim() === '') {
    throw new Error('Languoid name cannot be empty');
  }

  const trimmedName = name.trim();

  // Check synced table (all languoids are now created in synced)
  const languoidSynced = resolveTable('languoid', { localOverride: false });
  const [existing] = await system.db
    .select()
    .from(languoidSynced)
    .where(eq(languoidSynced.name, trimmedName))
    .limit(1);

  if (existing) {
    // Ensure the user's profile is in download_profiles for this existing languoid
    await ensureLanguoidDownloadProfile(existing.id, creator_id);
    return existing.id;
  }

  // Not found - create new languoid in synced table
  const result = await createLanguoidOffline({
    name: trimmedName,
    level: 'language',
    creator_id
  });

  return result.languoid_id;
}
