/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalStore } from '../localStore';

jest.mock('nativewind', () => ({
  colorScheme: {
    set: jest.fn(),
    get: jest.fn(() => 'light')
  }
}));

const SETTINGS_DEFAULTS = {
  theme: 'system' as const,
  notificationsEnabled: true,
  downloadOnWifiOnly: true,
  showHiddenContent: false,
  enableFia: false,
  enableAiSuggestions: false,
  enableTranscription: false,
  enableMerge: false,
  enableAssetImport: false,
  enableAssetDetails: false,
  enableProjectLanguageSuggestions: false,
  autoBackup: false,
  offlineUndownloadWarningEnabled: true,
  debugMode: false
};

async function persistedState(): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const raw = await AsyncStorage.getItem('local-store');
    if (raw) {
      const persisted = JSON.parse(raw) as { state: Record<string, unknown> };
      return persisted.state;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('local-store was not written to AsyncStorage');
}

describe('localStore settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLocalStore.setState(SETTINGS_DEFAULTS);
    await Promise.resolve();
  });

  it('theme toggle writes through persist', async () => {
    useLocalStore.getState().setTheme('dark');
    expect(useLocalStore.getState().theme).toBe('dark');
    const state = await persistedState();
    expect(state.theme).toBe('dark');
  });

  it('settings toggles write through persist', async () => {
    const store = useLocalStore.getState();
    store.setNotificationsEnabled(false);
    store.setDownloadOnWifiOnly(false);
    store.setShowHiddenContent(true);
    store.setEnableFia(true);
    store.setEnableAiSuggestions(true);
    store.setEnableTranscription(true);
    store.setEnableMerge(true);
    store.setEnableAssetImport(true);
    store.setEnableAssetDetails(true);
    store.setEnableProjectLanguageSuggestions(true);
    store.setAutoBackup(true);
    store.setOfflineUndownloadWarningEnabled(false);
    store.setDebugMode(true);

    expect(useLocalStore.getState().notificationsEnabled).toBe(false);
    const persisted = await persistedState();
    expect(persisted.notificationsEnabled).toBe(false);
    expect(persisted.downloadOnWifiOnly).toBe(false);
    expect(persisted.showHiddenContent).toBe(true);
    expect(persisted.enableFia).toBe(true);
    expect(persisted.enableAiSuggestions).toBe(true);
    expect(persisted.enableTranscription).toBe(true);
    expect(persisted.enableMerge).toBe(true);
    expect(persisted.enableAssetImport).toBe(true);
    expect(persisted.enableAssetDetails).toBe(true);
    expect(persisted.enableProjectLanguageSuggestions).toBe(true);
    expect(persisted.autoBackup).toBe(true);
    expect(persisted.offlineUndownloadWarningEnabled).toBe(false);
    expect(persisted.debugMode).toBe(true);
  });

  it('settings toggles rehydrate from AsyncStorage', async () => {
    await AsyncStorage.setItem(
      'local-store',
      JSON.stringify({
        state: {
          notificationsEnabled: false,
          downloadOnWifiOnly: false,
          showHiddenContent: true,
          enableFia: true,
          enableAiSuggestions: true,
          enableTranscription: true,
          enableMerge: true,
          enableAssetImport: true,
          enableAssetDetails: true,
          enableProjectLanguageSuggestions: true,
          autoBackup: true,
          offlineUndownloadWarningEnabled: false,
          debugMode: true
        },
        version: 1
      })
    );

    await useLocalStore.persist.rehydrate();
    const restored = useLocalStore.getState();
    expect(restored.notificationsEnabled).toBe(false);
    expect(restored.downloadOnWifiOnly).toBe(false);
    expect(restored.showHiddenContent).toBe(true);
    expect(restored.enableFia).toBe(true);
    expect(restored.enableAiSuggestions).toBe(true);
    expect(restored.enableTranscription).toBe(true);
    expect(restored.enableMerge).toBe(true);
    expect(restored.enableAssetImport).toBe(true);
    expect(restored.enableAssetDetails).toBe(true);
    expect(restored.enableProjectLanguageSuggestions).toBe(true);
    expect(restored.autoBackup).toBe(true);
    expect(restored.offlineUndownloadWarningEnabled).toBe(false);
    expect(restored.debugMode).toBe(true);
  });
});
