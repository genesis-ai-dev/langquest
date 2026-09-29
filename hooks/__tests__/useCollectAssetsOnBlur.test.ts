/// <reference types="jest" />

import { renderHook } from '@testing-library/react-native';

jest.mock('@/database_services/assetGarbageCollectorService', () => ({
  run: jest.fn()
}));

jest.mock('@react-navigation/native', () => {
  const effects: (() => void | (() => void))[] = [];
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
    __effects: effects
  };
});

import { run } from '@/database_services/assetGarbageCollectorService';
import * as Navigation from '@react-navigation/native';
import { useCollectAssetsOnBlur } from '../useCollectAssetsOnBlur';

const runCollector = run as jest.MockedFunction<typeof run>;
const focusEffects = (
  Navigation as unknown as { __effects: (() => void | (() => void))[] }
).__effects;

describe('useCollectAssetsOnBlur', () => {
  beforeEach(() => {
    runCollector.mockClear();
    focusEffects.length = 0;
  });

  it('collects on blur and not when the screen gains focus', async () => {
    await renderHook(() => useCollectAssetsOnBlur());

    expect(runCollector).not.toHaveBeenCalled();
    expect(focusEffects).toHaveLength(1);

    const cleanup = focusEffects[0]?.();
    expect(runCollector).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');

    cleanup?.();
    expect(runCollector).toHaveBeenCalledTimes(1);
  });
});
