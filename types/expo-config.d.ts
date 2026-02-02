import 'expo/config';

declare module 'expo/config' {
  interface ExpoConfig {
    buildCacheProvider?:
      | string
      | {
          plugin: string;
          options?: Record<string, unknown>;
        };
  }
}
