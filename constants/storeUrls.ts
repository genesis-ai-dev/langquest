import { Linking, Platform } from 'react-native';

export const APP_STORE_URL = 'https://apps.apple.com/app/6752446665';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.etengenesis.langquest';

export async function openAppStore(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL(APP_STORE_URL);
    return;
  }

  if (Platform.OS === 'android') {
    await Linking.openURL(PLAY_STORE_URL);
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
