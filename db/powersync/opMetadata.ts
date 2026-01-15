import { APP_SCHEMA_VERSION } from '../constants';

export interface OpMetadata {
  schema_version: string;
  /**
   * Flag set by migration 1.0→2.0 to mark languoids created during migration.
   * Used by cleanupDuplicateLanguoids to identify migration-created languoids
   * that should be checked against Supabase for duplicates.
   */
  awaiting_cleanup?: boolean;
  // Future fields can be added here:
  // device_id?: string;
  // app_version?: string;
  // timestamp?: number;
}

export function getDefaultOpMetadata(): OpMetadata {
  return {
    schema_version: APP_SCHEMA_VERSION
  };
}
