import type { ConfigPlugin } from '@expo/config-plugins';
import { withPodfileProperties } from '@expo/config-plugins';
import { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = 'fafd03a9-a42c-44c7-849c-b0f84fbffe93';
const iconPath = './assets/images/langquest_icon_v1.png';

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
      version: '1.3.2',
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
        bundleIdentifier: uniqueIdentifier,
        config: {
          usesNonExemptEncryption: false
        }
      },
      android: {
        edgeToEdgeEnabled: true,
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
        favicon: iconPath
      },
      plugins: [
        'expo-font',
        'expo-router',
        // TODO: migrate existing localization to expo-localization
        'expo-localization',
        [
          'expo-splash-screen',
          {
            image: './assets/images/icon.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff'
          }
        ],
        ['testflight-dev-deploy', { enabled: profile === 'development' }]
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
