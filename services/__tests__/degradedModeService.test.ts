/// <reference types="jest" />

const updatesState = {
  isEmbeddedLaunch: true,
  updateId: 'abcdefghijklmnop'
};

jest.mock('nativewind', () => ({
  colorScheme: {
    set: jest.fn(),
    get: jest.fn(() => 'light')
  }
}));

jest.mock('expo-updates', () => ({
  get isEmbeddedLaunch() {
    return updatesState.isEmbeddedLaunch;
  },
  get updateId() {
    return updatesState.updateId;
  }
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '2.2.6'
}));

jest.mock('expo-constants', () => ({
  expoConfig: { version: '2.2.6' }
}));

jest.spyOn(console, 'log').mockImplementation(() => {});

import { APP_SCHEMA_VERSION } from '@/db/constants';
import { useLocalStore } from '@/store/localStore';
import {
  clearDegradedMode,
  incrementRetryCount,
  isDegradedMode,
  resetRetryCount,
  shouldRetryMigration
} from '../degradedModeService';

function resetStore() {
  useLocalStore.setState({
    degradedMode: false,
    lastFailedVersion: null,
    migrationRetryCount: 0,
    lastUpdateId: null,
    lastAppVersion: null,
    lastSchemaVersion: null
  });
}

describe('degradedModeService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    updatesState.isEmbeddedLaunch = true;
    updatesState.updateId = 'abcdefghijklmnop';
    resetStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not retry on first launch', async () => {
    useLocalStore.setState({ degradedMode: true });
    await expect(shouldRetryMigration()).resolves.toBe(true);

    useLocalStore.setState({
      degradedMode: false,
      lastUpdateId: null,
      lastAppVersion: null
    });
    await expect(shouldRetryMigration()).resolves.toBe(false);
  });

  it('retries when degraded and the OTA id changes', async () => {
    useLocalStore.setState({
      degradedMode: true,
      lastUpdateId: 'oldoldol',
      lastAppVersion: '2.2.6'
    });
    updatesState.isEmbeddedLaunch = false;
    updatesState.updateId = 'newnewnewxyz';
    await expect(shouldRetryMigration()).resolves.toBe(true);
  });

  it('does not retry when degraded and versions are unchanged', async () => {
    useLocalStore.setState({
      degradedMode: true,
      lastUpdateId: 'embedded',
      lastAppVersion: '2.2.6'
    });
    await expect(shouldRetryMigration()).resolves.toBe(false);
  });

  it('enters degraded mode at the max retry count', async () => {
    await expect(incrementRetryCount()).resolves.toBe(true);
    expect(useLocalStore.getState().degradedMode).toBe(true);
    expect(useLocalStore.getState().migrationRetryCount).toBe(1);
    expect(useLocalStore.getState().lastUpdateId).toBe('embedded');
    expect(useLocalStore.getState().lastAppVersion).toBe('2.2.6');
    expect(useLocalStore.getState().lastSchemaVersion).toBe(APP_SCHEMA_VERSION);
    await expect(isDegradedMode()).resolves.toBe(true);
  });

  it('clearDegradedMode resets counters and stores the current version', async () => {
    useLocalStore.setState({
      degradedMode: true,
      migrationRetryCount: 3,
      lastFailedVersion: 'oops'
    });
    await clearDegradedMode();
    const state = useLocalStore.getState();
    expect(state.degradedMode).toBe(false);
    expect(state.migrationRetryCount).toBe(0);
    expect(state.lastFailedVersion).toBeNull();
    expect(state.lastUpdateId).toBe('embedded');
    expect(state.lastAppVersion).toBe('2.2.6');
    expect(state.lastSchemaVersion).toBe(APP_SCHEMA_VERSION);
  });

  it('resetRetryCount only clears the retry counter', () => {
    useLocalStore.setState({ migrationRetryCount: 4, degradedMode: true });
    resetRetryCount();
    expect(useLocalStore.getState().migrationRetryCount).toBe(0);
    expect(useLocalStore.getState().degradedMode).toBe(true);
  });
});
