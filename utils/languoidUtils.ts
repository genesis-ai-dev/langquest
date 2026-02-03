/**
 * Utility functions for creating and managing languoids
 * Handles offline creation of new languoids when users create projects/assets with new languages
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq } from 'drizzle-orm';
import uuid from 'react-native-uuid';

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
  const languoidId = uuid.v4();

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

      const sourceId = uuid.v4();
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

/**
 * Creates a project_language_link with languoid_id
 * Creates in synced table for immediate project publishing
 *
 * PK is now (project_id, languoid_id, language_type) - languoid_id is required
 *
 * @param project_id - The project ID
 * @param languoid_id - The languoid ID (required - part of PK)
 * @param language_type - 'source' or 'target'
 * @param creator_id - The user creating the link
 */
export async function createProjectLanguageLinkWithLanguoid(
  project_id: string,
  languoid_id: string,
  language_type: 'source' | 'target',
  creator_id: string
): Promise<void> {
  const projectLanguageLinkSynced = resolveTable('project_language_link', {
    localOverride: false
  });

  // Check if link already exists using new PK (project_id, languoid_id, language_type)
  const existing = await system.db
    .select()
    .from(projectLanguageLinkSynced)
    .where(
      and(
        eq(projectLanguageLinkSynced.project_id, project_id),
        eq(projectLanguageLinkSynced.languoid_id, languoid_id),
        eq(projectLanguageLinkSynced.language_type, language_type)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    // Link already exists with this PK, nothing to do
    return;
  }

  // Create new link - languoid_id is required (part of PK), language_id is optional
  await system.db.insert(projectLanguageLinkSynced).values({
    project_id,
    languoid_id,
    language_type,
    active: true,
    download_profiles: [creator_id]
  });
}

/**
 * Creates an asset_content_link with languoid_id
 * Handles both offline and online scenarios
 *
 * @param asset_id - The asset ID
 * @param languoid_id - The languoid ID
 * @param creator_id - The user creating the link
 * @param text - Optional text content
 * @param audio - Optional audio file IDs
 */
export async function createAssetContentLinkWithLanguoid(
  asset_id: string,
  languoid_id: string,
  creator_id: string,
  text?: string,
  audio?: string[]
): Promise<string> {
  const assetContentLinkLocal = resolveTable('asset_content_link', {
    localOverride: true
  });

  const contentLinkId = uuid.v4();

  await system.db.insert(assetContentLinkLocal).values({
    id: contentLinkId,
    asset_id,
    languoid_id,
    text,
    audio,
    active: true,
    download_profiles: [creator_id]
  });

  return contentLinkId;
}
