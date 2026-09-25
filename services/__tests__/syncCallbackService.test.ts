/// <reference types="jest" />

type StatusChanged = (status: { lastSyncedAt?: Date | null }) => void;

jest.mock('@/db/powersync/system', () => ({
  system: {
    powersync: {
      currentStatus: { lastSyncedAt: new Date(1_000) as Date | null },
      registerListener: jest.fn()
    }
  }
}));

import { system } from '@/db/powersync/system';
import { syncCallbackService } from '../syncCallbackService';

describe('syncCallbackService', () => {
  let statusChanged: StatusChanged | undefined;
  const unregister = jest.fn();

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    unregister.mockReset();
    statusChanged = undefined;
    (system.powersync.registerListener as jest.Mock).mockImplementation(
      (listener: { statusChanged: StatusChanged }) => {
        statusChanged = listener.statusChanged;
        return unregister;
      }
    );
    syncCallbackService.cancelCallback('quest-aaaa');
    syncCallbackService.cancelCallback('quest-bbbb');
    syncCallbackService.cancelCallback('quest-cccc');
    (
      system.powersync.currentStatus as { lastSyncedAt: Date | null }
    ).lastSyncedAt = new Date(1_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fires a registered callback once when lastSyncedAt advances', async () => {
    const callback = jest.fn();
    syncCallbackService.registerCallback('quest-aaaa', callback);

    statusChanged?.({ lastSyncedAt: new Date(1_000) });
    expect(callback).not.toHaveBeenCalled();

    statusChanged?.({ lastSyncedAt: new Date(2_000) });
    await Promise.resolve();
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);

    statusChanged?.({ lastSyncedAt: new Date(3_000) });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not fire a cancelled callback', async () => {
    const callback = jest.fn();
    syncCallbackService.registerCallback('quest-aaaa', callback);
    syncCallbackService.cancelCallback('quest-aaaa');

    statusChanged?.({ lastSyncedAt: new Date(5_000) });
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalled();
  });

  it('lets one callback failure skip the others', async () => {
    const failing = jest.fn(() => {
      throw new Error('nope');
    });
    const succeeding = jest.fn();
    syncCallbackService.registerCallback('quest-aaaa', failing);
    syncCallbackService.registerCallback('quest-bbbb', succeeding);

    statusChanged?.({ lastSyncedAt: new Date(8_000) });
    await Promise.resolve();
    await Promise.resolve();
    expect(failing).toHaveBeenCalled();
    expect(succeeding).toHaveBeenCalled();
  });
});
