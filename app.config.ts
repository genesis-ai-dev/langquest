import { ConfigContext, ExpoConfig } from 'expo/config';

const projectId = 'fafd03a9-a42c-44c7-849c-b0f84fbffe93';
const iconPath = './assets/images/langquest_icon_v1.png';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getSlug = () => {
  if (IS_DEV) {
    return 'langquest-dev';
  }

  if (IS_PREVIEW) {
    return 'langquest-preview';
  }

  return 'langquest';
};

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return 'com.etengenesis.langquest.dev';
  }

  if (IS_PREVIEW) {
    return 'com.etengenesis.langquest.preview';
  }

  return 'com.etengenesis.langquest';
};

const getAppName = () => {
  if (IS_DEV) {
    return 'LangQuest (Dev)';
  }

  if (IS_PREVIEW) {
    return 'LangQuest (Preview)';
  }

  return 'LangQuest';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'eten-genesis',
  name: getAppName(),
  slug: getSlug(),
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
    bundleIdentifier: getUniqueIdentifier()
  },
  android: {
    adaptiveIcon: {
      foregroundImage: iconPath,
      backgroundColor: '#ffffff'
    },
    package: getUniqueIdentifier(),
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: process.env.EXPO_PUBLIC_SITE_URL,
            pathPrefix: '/reset-password'
          },
          {
            scheme: 'https',
            host: process.env.EXPO_PUBLIC_SITE_URL,
            pathPrefix: '/registration-confirmation'
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
    'expo-build-properties',
    'expo-font',
    'expo-router',
    // migrate existing localization to expo-localization
    'expo-localization',
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'DEFAULT'
      }
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#232323',
        image: iconPath,
        dark: {
          image: iconPath,
          backgroundColor: '#000000'
        },
        imageWidth: 200
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
