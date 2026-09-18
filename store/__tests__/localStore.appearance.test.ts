/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalStore } from '../localStore';

jest.mock('nativewind', () => ({
  colorScheme: {
    set: jest.fn(),
    get: jest.fn(() => 'light')
  }
}));

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

describe('localStore appearance', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLocalStore.setState({
      appearanceThemeId: null,
      entryGuardEnabled: false,
      entryGuardMode: 'A'
    });
    await Promise.resolve();
  });

  it('theme id and entry guard write through persist', async () => {
    const store = useLocalStore.getState();
    store.setAppearanceThemeId('a01');
    store.setEntryGuardEnabled(true);
    store.setEntryGuardMode('B');

    expect(useLocalStore.getState().appearanceThemeId).toBe('a01');
    expect(useLocalStore.getState().entryGuardEnabled).toBe(true);
    expect(useLocalStore.getState().entryGuardMode).toBe('B');

    const persisted = await persistedState();
    expect(persisted.appearanceThemeId).toBe('a01');
    expect(persisted.entryGuardEnabled).toBe(true);
    expect(persisted.entryGuardMode).toBe('B');
  });

  it('theme id and entry guard rehydrate from AsyncStorage', async () => {
    await AsyncStorage.setItem(
      'local-store',
      JSON.stringify({
        state: {
          appearanceThemeId: 'b05',
          entryGuardEnabled: true,
          entryGuardMode: 'B'
        },
        version: 1
      })
    );

    await useLocalStore.persist.rehydrate();
    const restored = useLocalStore.getState();
    expect(restored.appearanceThemeId).toBe('b05');
    expect(restored.entryGuardEnabled).toBe(true);
    expect(restored.entryGuardMode).toBe('B');
  });
});
