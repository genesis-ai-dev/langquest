/// <reference types="jest" />

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    })
  };
});

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_alg: string, value: string) => {
    return `sha256:${value}`;
  }),
  getRandomBytes: jest.fn(() => Uint8Array.from({ length: 16 }, () => 7))
}));

import { clearPin, hasPin, setPin, verifyPin } from '../guard';

describe('appearance guard pin', () => {
  beforeEach(async () => {
    await clearPin();
  });

  it('stores a salted hash and verifies the same candidate', async () => {
    expect(await hasPin()).toBe(false);
    await setPin('1234');
    expect(await hasPin()).toBe(true);
    expect(await verifyPin('1234')).toBe(true);
    expect(await verifyPin('9999')).toBe(false);
  });

  it('clearPin removes the stored sequence', async () => {
    await setPin('5678');
    await clearPin();
    expect(await hasPin()).toBe(false);
    expect(await verifyPin('5678')).toBe(false);
  });
});
