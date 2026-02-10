import type { WASQLiteOpenFactory } from '@powersync/web';

/**
 * Type for WebDBConnection returned by WASQLiteOpenFactory.openConnection()
 * Used for web platform database connections in devtools plugins.
 */
export type WebDBConnection = Awaited<
  Awaited<ReturnType<WASQLiteOpenFactory['openConnection']>>
>;
