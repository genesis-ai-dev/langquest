/**
 * Shared lookup helpers for resolving languoid-related data.
 * These are imperative async functions (not hooks) designed to be called
 * inside queryFn or other async contexts. Each tries the local Drizzle DB
 * first, then falls back to a Supabase cloud query.
 */

import {
  languoid_property,
  languoid_source,
  project_language_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { and, eq } from 'drizzle-orm';

export async function lookupSourceLanguoidId(
  projectId: string
): Promise<string | null> {
  try {
    const { data, error } = await system.supabaseConnector.client
      .from('project_language_link')
      .select('languoid_id')
      .eq('project_id', projectId)
      .eq('language_type', 'source')
      .eq('active', true)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data.languoid_id;
  } catch {
    // Fall through to local
  }

  try {
    const row = await system.db.query.project_language_link.findFirst({
      where: and(
        eq(project_language_link.project_id, projectId),
        eq(project_language_link.language_type, 'source'),
        eq(project_language_link.active, true)
      ),
      columns: { languoid_id: true }
    });
    if (row?.languoid_id) return row.languoid_id;
  } catch {
    // No result
  }

  return null;
}

export async function lookupFiaLanguageCode(
  languoidId: string
): Promise<string | null> {
  try {
    const row = await system.db.query.languoid_property.findFirst({
      where: and(
        eq(languoid_property.languoid_id, languoidId),
        eq(languoid_property.key, 'fia_language_code'),
        eq(languoid_property.active, true)
      ),
      columns: { value: true }
    });
    if (row?.value) return row.value;
  } catch {
    // Fall through to cloud
  }

  const { data, error } = await system.supabaseConnector.client
    .from('languoid_property')
    .select('value')
    .eq('languoid_id', languoidId)
    .eq('key', 'fia_language_code')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
}

export async function lookupIso639_3(
  languoidId: string
): Promise<string | null> {
  try {
    const row = await system.db.query.languoid_source.findFirst({
      where: and(
        eq(languoid_source.languoid_id, languoidId),
        eq(languoid_source.name, 'iso639-3'),
        eq(languoid_source.active, true)
      ),
      columns: { unique_identifier: true }
    });
    if (row?.unique_identifier) return row.unique_identifier;
  } catch {
    // Fall through to cloud
  }

  const { data, error } = await system.supabaseConnector.client
    .from('languoid_source')
    .select('unique_identifier')
    .eq('languoid_id', languoidId)
    .eq('name', 'iso639-3')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.unique_identifier;
}
