import type { ConfigPlugin } from '@expo/config-plugins';
import { withPodfileProperties } from '@expo/config-plugins';
import { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = 'fafd03a9-a42c-44c7-849c-b0f84fbffe93';
const iconDark = './assets/icons/icon_dark.png';
const iconLight = './assets/icons/icon_light.png';
// const iconMono = './assets/icons/icon_mono.png';

const siteHost = 'langquest.org';
const uniqueIdentifier = 'com.etengenesis.langquest';

const appVariant =
  process.env.EXPO_PUBLIC_APP_VARIANT ||
  (process.env.NODE_ENV === 'development' ? 'development' : 'production');

function getAppName(variant: string) {
  switch (variant) {
    case 'development':
      return 'LangQuest (Dev)';
    case 'preview':
      return 'LangQuest (Preview)';
    default:
      return 'LangQuest';
  }
}

function getBundleIdentifier(variant: string) {
  switch (variant) {
    case 'development':
      return `${uniqueIdentifier}.dev`;
    case 'preview':
      return `${uniqueIdentifier}.preview`;
    default:
      return uniqueIdentifier;
  }
}

function getScheme(variant: string) {
  switch (variant) {
    case 'development':
      return 'langquest-dev';
    case 'preview':
      return 'langquest-preview';
    default:
      return 'langquest';
  }
}

export default ({ config }: ConfigContext): ExpoConfig =>
  withUseThirdPartySQLitePod({
    ...config,
    owner: 'eten-genesis',
    name: getAppName(appVariant),
    slug: 'langquest',
    version: '2.0.13',
    orientation: 'portrait',
    icon: iconLight,
    scheme: getScheme(appVariant),
    userInterfaceStyle: 'automatic',
    ios: {
      icon: {
        light: iconLight,
        dark: iconDark
        // tinted: iconMono
      },
      supportsTablet: true,
      requireFullScreen: true,
      bundleIdentifier: getBundleIdentifier(appVariant),
      config: {
        usesNonExemptEncryption: false
      },
      infoPlist: {
        NSMicrophoneUsageDescription:
          'LangQuest needs access to your microphone to record voice translations.'
      }
    },
    android: {
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/icons/adaptive-icon.png',
        monochromeImage: './assets/icons/adaptive-icon-mono.png',
        backgroundColor: '#ffffff'
      },
      package: getBundleIdentifier(appVariant),
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: siteHost,
              pathPrefix: '/app'
            },
            {
              scheme: getScheme(appVariant),
              host: siteHost
            }
          ],
          category: ['BROWSABLE', 'DEFAULT']
        }
      ]
    },
    web: {
      bundler: 'metro',
      favicon: iconLight
    },
    plugins: [
      'expo-font',
      'expo-router',
      // TODO: migrate existing localization to expo-localization
      'expo-localization',
      [
        'expo-splash-screen',
        {
          image: iconLight,
          backgroundColor: '#f5f5ff',
          dark: {
            image: iconDark,
            backgroundColor: '#131320'
          },
          imageWidth: 150
        }
      ],
      'expo-dev-client',
      ['testflight-dev-deploy', { enabled: appVariant === 'development' }]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
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

const withUseThirdPartySQLitePod: ConfigPlugin = (expoConfig) => {
  return withPodfileProperties(expoConfig, (config) => {
    config.modResults = {
      ...config.modResults,
      'expo.updates.useThirdPartySQLitePod': 'true'
    };
    return config;
  });
};
