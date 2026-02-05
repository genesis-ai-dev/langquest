/**
 * Utility functions for creating and managing languoids
 * Handles offline creation of new languoids when users create projects/assets with new languages
 */

import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { and, eq, sql } from 'drizzle-orm';
import uuid from 'react-native-uuid';

/**
 * Ensures a user's profile_id is in a languoid's download_profiles array.
 * Also updates related tables (languoid_source, languoid_alias, etc.)
 * This is needed when using an existing languoid for a project/asset.
 *
 * @param languoid_id - The languoid ID to update
 * @param profile_id - The user's profile ID to add
 */
export async function ensureLanguoidDownloadProfile(
  languoid_id: string,
  profile_id: string
): Promise<void> {
  // Use raw SQL to append profile_id to download_profiles if not already present
  // This works with PowerSync's SQLite and will sync the change
  const languoidSynced = resolveTable('languoid', { localOverride: false });

  // Check if profile is already in download_profiles
  const [existing] = await system.db
    .select()
    .from(languoidSynced)
    .where(eq(languoidSynced.id, languoid_id))
    .limit(1);

  if (!existing) {
    // Languoid doesn't exist locally, nothing to update
    // The languoid will sync down once download_profiles is updated server-side
    return;
  }

  const currentProfiles = (existing.download_profiles as string[] | null) || [];

  // Check if profile is already in the array
  if (currentProfiles.includes(profile_id)) {
    return; // Already has the profile
  }

  // Add the profile to download_profiles
  const updatedProfiles = [...currentProfiles, profile_id];

  await system.db
    .update(languoidSynced)
    .set({
      download_profiles: updatedProfiles,
      last_updated: sql`(datetime('now'))`
    })
    .where(eq(languoidSynced.id, languoid_id));

  // Also update related tables that have download_profiles
  // These tables reference the languoid and should sync together
  await updateRelatedLanguoidTables(languoid_id, profile_id);
}

/**
 * Updates download_profiles on languoid-related tables
 * @internal
 */
async function updateRelatedLanguoidTables(
  languoid_id: string,
  profile_id: string
): Promise<void> {
  // Update languoid_source records
  const languoidSourceSynced = resolveTable('languoid_source', {
    localOverride: false
  });
  const sources = await system.db
    .select()
    .from(languoidSourceSynced)
    .where(eq(languoidSourceSynced.languoid_id, languoid_id));

  for (const source of sources) {
    const currentProfiles = (source.download_profiles as string[] | null) || [];
    if (!currentProfiles.includes(profile_id)) {
      await system.db
        .update(languoidSourceSynced)
        .set({
          download_profiles: [...currentProfiles, profile_id],
          last_updated: sql`(datetime('now'))`
        })
        .where(eq(languoidSourceSynced.id, source.id));
    }
  }

  // Update languoid_alias records
  const languoidAliasSynced = resolveTable('languoid_alias', {
    localOverride: false
  });
  const aliases = await system.db
    .select()
    .from(languoidAliasSynced)
    .where(eq(languoidAliasSynced.subject_languoid_id, languoid_id));

  for (const alias of aliases) {
    const currentProfiles = (alias.download_profiles as string[] | null) || [];
    if (!currentProfiles.includes(profile_id)) {
      await system.db
        .update(languoidAliasSynced)
        .set({
          download_profiles: [...currentProfiles, profile_id],
          last_updated: sql`(datetime('now'))`
        })
        .where(eq(languoidAliasSynced.id, alias.id));
    }
  }

  // Update languoid_property records
  const languoidPropertySynced = resolveTable('languoid_property', {
    localOverride: false
  });
  const properties = await system.db
    .select()
    .from(languoidPropertySynced)
    .where(eq(languoidPropertySynced.languoid_id, languoid_id));

  for (const prop of properties) {
    const currentProfiles = (prop.download_profiles as string[] | null) || [];
    if (!currentProfiles.includes(profile_id)) {
      await system.db
        .update(languoidPropertySynced)
        .set({
          download_profiles: [...currentProfiles, profile_id],
          last_updated: sql`(datetime('now'))`
        })
        .where(eq(languoidPropertySynced.id, prop.id));
    }
  }
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

/**
 * Creates a project_language_link with languoid_id
 * Creates in synced table for immediate project publishing
 * Also ensures the languoid's download_profiles includes the creator
 *
 * PK is now (project_id, languoid_id, language_type) - languoid_id is required
 *
 * @param project_id - The project ID
 * @param languoid_id - The languoid ID (required - part of PK)
 * @param language_type - 'source' or 'target'
 * @param creator_id - The user creating the link
 * @param language_id - Optional language_id for backward compatibility
 */
export async function createProjectLanguageLinkWithLanguoid(
  project_id: string,
  languoid_id: string,
  language_type: 'source' | 'target',
  creator_id: string,
  language_id?: string // Optional for backward compatibility
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

  // Ensure the languoid's download_profiles includes this user
  // This is critical for offline sync - the languoid must sync to the user's device
  await ensureLanguoidDownloadProfile(languoid_id, creator_id);

  // Create new link - languoid_id is required (part of PK), language_id is optional
  await system.db.insert(projectLanguageLinkSynced).values({
    project_id,
    language_id: language_id || null, // Optional - for backward compatibility
    languoid_id,
    language_type,
    active: true,
    download_profiles: [creator_id]
  });
}

/**
 * Creates an asset_content_link with languoid_id
 * Handles both offline and online scenarios
 * Also ensures the languoid's download_profiles includes the creator
 *
 * @param asset_id - The asset ID
 * @param languoid_id - The languoid ID
 * @param creator_id - The user creating the link
 * @param language_id - Optional language_id for backward compatibility
 * @param text - Optional text content
 * @param audio - Optional audio file IDs
 */
export async function createAssetContentLinkWithLanguoid(
  asset_id: string,
  languoid_id: string,
  creator_id: string,
  language_id?: string, // Optional for backward compatibility
  text?: string,
  audio?: string[]
): Promise<string> {
  const assetContentLinkLocal = resolveTable('asset_content_link', {
    localOverride: true
  });

  // Ensure the languoid's download_profiles includes this user
  // This is critical for offline sync - the languoid must sync to the user's device
  await ensureLanguoidDownloadProfile(languoid_id, creator_id);

  const contentLinkId = uuid.v4();

  await system.db.insert(assetContentLinkLocal).values({
    id: contentLinkId,
    asset_id,
    source_language_id: language_id || null, // Keep for backward compatibility
    languoid_id,
    text,
    audio,
    active: true,
    download_profiles: [creator_id]
  });

  return contentLinkId;
}
