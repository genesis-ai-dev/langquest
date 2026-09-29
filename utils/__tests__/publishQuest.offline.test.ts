/// <reference types="jest" />

const mockGetNetworkStatus = jest.fn(() => false);

jest.mock('@/hooks/useNetworkStatus', () => ({
  getNetworkStatus: () => mockGetNetworkStatus()
}));

jest.mock('@/db/powersync/system', () => ({
  system: {
    db: {
      select: jest.fn(() => {
        throw new Error('publishQuest should not query while offline');
      })
    }
  }
}));

import { publishQuest } from '../publishQuest';

describe('publishQuest offline guard', () => {
  it('returns an error without touching the database', async () => {
    mockGetNetworkStatus.mockReturnValue(false);

    await expect(publishQuest('quest-1', 'project-1')).resolves.toEqual({
      success: false,
      status: 'error',
      message: 'Cannot publish while offline',
      errors: ['Cannot publish while offline'],
      warnings: []
    });
  });
});
