import { ExpoConfig, ConfigContext } from 'expo/config';

const projectId = 'fafd03a9-a42c-44c7-849c-b0f84fbffe93';
const iconPath = './assets/images/langquest_icon_v1.png';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'eten-genesis',
  name: 'LangQuest',
  slug: 'langquest',
  version: '1.0.0',
  orientation: 'portrait',
  icon: iconPath,
  scheme: 'langquest',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.etengenesis.langquest'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/langquest_icon_v1.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.etengenesis.langquest',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'langquest.org',
            pathPrefix: '/reset-password'
          },
          {
            scheme: 'langquest',
            host: '*'
          }
        ],
        category: ['BROWSABLE', 'DEFAULT']
      }
    ]
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: iconPath
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '13.4'
        }
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    powersyncUrl: process.env.EXPO_PUBLIC_POWERSYNC_URL,
    eas: {
      projectId
    }
  },
  updates: {
    url: `https://u.expo.dev/${projectId}`
  },
  runtimeVersion: {
    policy: 'appVersion'
  }
});
