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

describe('localStore terms', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLocalStore.setState({ dateTermsAccepted: null });
    await Promise.resolve();
  });

  it('acceptTerms writes a date through persist', async () => {
    expect(useLocalStore.getState().dateTermsAccepted).toBeNull();
    useLocalStore.getState().acceptTerms();
    expect(useLocalStore.getState().dateTermsAccepted).toBeInstanceOf(Date);

    const persisted = await persistedState();
    expect(persisted.dateTermsAccepted).toBeTruthy();
  });

  it('rehydrates a prior terms acceptance', async () => {
    await AsyncStorage.setItem(
      'local-store',
      JSON.stringify({
        state: { dateTermsAccepted: '2026-09-17T13:00:00.000Z' },
        version: 1
      })
    );

    await useLocalStore.persist.rehydrate();
    expect(useLocalStore.getState().dateTermsAccepted).toBeTruthy();
  });
});
