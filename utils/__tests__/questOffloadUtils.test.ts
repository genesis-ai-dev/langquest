/// <reference types="jest" />

const mockFindFirst = jest.fn(
  (): Promise<{ id: string; published_at: string | null } | undefined> =>
    Promise.resolve(undefined)
);
const mockBulkUndownloadQuest = jest.fn(
  (): Promise<{ tableName: string; recordsUpdated: number }[]> =>
    Promise.resolve([])
);

jest.mock('@/db/powersync/system', () => ({
  system: {
    db: {
      query: {
        quest: {
          findFirst: () => mockFindFirst()
        },
        quest_asset_link: { findMany: jest.fn() },
        asset_content_link: { findMany: jest.fn() },
        vote: { findMany: jest.fn() }
      }
    }
  }
}));

jest.mock('@/utils/bulkUndownload', () => ({
  bulkUndownloadQuest: () => mockBulkUndownloadQuest()
}));

import type { VerifiedIds } from '@/hooks/useQuestOffloadVerification';
import { offloadQuest } from '../questOffloadUtils';

const emptyIds: VerifiedIds = {
  questIds: [],
  projectIds: [],
  questAssetLinkIds: [],
  assetIds: [],
  assetContentLinkIds: [],
  voteIds: [],
  questTagLinkIds: [],
  assetTagLinkIds: [],
  tagIds: [],
  languageIds: [],
  languoidIds: [],
  languoidAliasIds: [],
  languoidSourceIds: [],
  languoidPropertyIds: [],
  languoidRegionIds: [],
  regionIds: [],
  regionAliasIds: [],
  regionSourceIds: [],
  regionPropertyIds: [],
  attachmentIds: []
};

describe('offloadQuest draft guard', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockBulkUndownloadQuest.mockReset();
  });

  it('throws and does not undownload when the quest is unpublished', async () => {
    mockFindFirst.mockResolvedValue({ id: 'quest-1', published_at: null });

    await expect(
      offloadQuest({ questId: 'quest-1', verifiedIds: emptyIds })
    ).rejects.toThrow(/unpublished/);

    expect(mockBulkUndownloadQuest).not.toHaveBeenCalled();
  });

  it('throws when the quest is missing locally', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect(
      offloadQuest({ questId: 'missing', verifiedIds: emptyIds })
    ).rejects.toThrow(/not found/);

    expect(mockBulkUndownloadQuest).not.toHaveBeenCalled();
  });
});
