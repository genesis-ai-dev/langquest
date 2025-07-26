import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

const SETTINGS_PREFIX = 'settings-';
const SETTINGS_SHOW_HIDDEN_CONTENT = SETTINGS_PREFIX + 'show-hidden-content';

const getSettingsKey = async (item: string) => {
  try {
    return await AsyncStorage.getItem(item);
  } catch (error) {
    console.error('Error getting settings key:', error);
    return null;
  }
};

const setSettingsKey = async (item: string, value: string) => {
  try {
    await AsyncStorage.setItem(item, value);
  } catch (error) {
    console.error('Error setting settings key:', error);
  }
};

export const getOptionShowHiddenContent = async () => {
  const value = await getSettingsKey(SETTINGS_SHOW_HIDDEN_CONTENT);
  return value === 'true';
};

export const setOptionShowHiddenContent = async (value: boolean) => {
  await setSettingsKey(SETTINGS_SHOW_HIDDEN_CONTENT, value ? 'true' : 'false');


};
