import type { ConfigPlugin } from '@expo/config-plugins';
import { withPodfileProperties } from '@expo/config-plugins';
import { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = 'fafd03a9-a42c-44c7-849c-b0f84fbffe93';
const iconDark = './assets/icons/icon_dark.png';
const iconLight = './assets/icons/icon_light.png';
// const iconMono = './assets/icons/icon_mono.png';

const siteHost = 'langquest.org';
const uniqueIdentifier = 'com.etengenesis.langquest';

const profile = process.env.EAS_BUILD_PROFILE;

export default ({ config }: ConfigContext): ExpoConfig =>
  withUseThirdPartySQLitePod(
    {
      ...config,
      owner: 'eten-genesis',
      name: 'LangQuest',
      slug: 'langquest',
      version: '2.0.0',
      orientation: 'portrait',
      icon: iconLight,
      scheme: 'langquest',
      userInterfaceStyle: 'automatic',
      splash: {
        image: iconLight,
        backgroundColor: '#f5f5ff',
        dark: {
          image: iconDark,
          backgroundColor: '#131320'
        }
      },
      ios: {
        icon: {
          light: iconLight,
          dark: iconDark
          // tinted: iconMono
        },
        supportsTablet: true,
        requireFullScreen: true,
        bundleIdentifier: uniqueIdentifier,
        config: {
          usesNonExemptEncryption: false
        }
      },
      android: {
        edgeToEdgeEnabled: true,
        adaptiveIcon: {
          foregroundImage: './assets/icons/adaptive-icon.png',
          monochromeImage: './assets/icons/adaptive-icon-mono.png',
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
                pathPrefix: '/app'
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
        favicon: iconLight
      },
      plugins: [
        'expo-font',
        'expo-router',
        // TODO: migrate existing localization to expo-localization
        'expo-localization',
        ['testflight-dev-deploy', { enabled: profile === 'development' }]
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
    },
    undefined
  );

const withUseThirdPartySQLitePod: ConfigPlugin<unknown> = (expoConfig) => {
  return withPodfileProperties(expoConfig, (config) => {
    config.modResults = {
      ...config.modResults,
      'expo.updates.useThirdPartySQLitePod': 'true'
    };
    return config;
  });
};
