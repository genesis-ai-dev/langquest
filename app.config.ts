import { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = 'fafd03a9-a42c-44c7-849c-b0f84fbffe93';
const iconPath = './assets/images/langquest_icon_v1.png';

const siteHost = 'langquest.org';
const uniqueIdentifier = 'com.etengenesis.langquest';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'eten-genesis',
  name: 'LangQuest',
  slug: 'langquest',
  version: '1.1.0',
  orientation: 'portrait',
  icon: iconPath,
  scheme: 'langquest',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  ios: {
    supportsTablet: true,
    requireFullScreen: true,
    bundleIdentifier: uniqueIdentifier
  },
  android: {
    adaptiveIcon: {
      foregroundImage: iconPath,
      backgroundColor: '#ffffff'
    },
    package: uniqueIdentifier,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: siteHost,
            pathPrefix: '/reset-password'
          },
          {
            scheme: 'https',
            host: siteHost,
            pathPrefix: '/registration-confirmation'
          },
          {
            scheme: 'langquest',
            host: siteHost
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
    'expo-build-properties',
    'expo-font',
    'expo-router',
    // migrate existing localization to expo-localization
    'expo-localization',
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'PORTRAIT_UP'
      }
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff'
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
