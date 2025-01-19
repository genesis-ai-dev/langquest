import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'langquest',
  slug: 'langquest',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/langquest_icon_v1.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/langquest_icon_v1.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.etengenesis.langquest'
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    powersyncUrl: process.env.EXPO_PUBLIC_POWERSYNC_URL,
    eas: {
      projectId: 'fafd03a9-a42c-44c7-849c-b0f84fbffe93'
    }
  }
});
