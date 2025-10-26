import { APP_SCHEMA_VERSION } from '../constants';

export interface OpMetadata {
  schema_version: string;
  // Future fields can be added here:
  // device_id?: string;
  // app_version?: string;
  // timestamp?: number;
}

export function getDefaultOpMetadata(): OpMetadata {
  console.log('getDefaultOpMetadata', APP_SCHEMA_VERSION);
  return {
    schema_version: APP_SCHEMA_VERSION
  };
}
