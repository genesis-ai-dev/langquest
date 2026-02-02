import 'expo/config';

type BuildCacheProvider =
  | string
  | {
      plugin: string;
      options?: Record<string, unknown>;
    };

declare module 'expo/config' {
  interface ExpoConfig {
    experiments?: (ExpoConfig['experiments'] & {
      buildCacheProvider?: BuildCacheProvider;
    }) | null;
  }
}
