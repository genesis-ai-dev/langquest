/// <reference types="jest" />

const existingRows: { id: string; name: string }[] = [];
const inserted: Record<string, unknown>[] = [];

jest.mock('@/db/powersync/system', () => ({
  system: {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => existingRows
          })
        })
      }),
      transaction: async (
        fn: (tx: {
          insert: (table: unknown) => {
            values: (row: Record<string, unknown>) => Promise<void>;
          };
        }) => Promise<void>
      ) => {
        await fn({
          insert: () => ({
            values: async (row: Record<string, unknown>) => {
              inserted.push(row);
            }
          })
        });
      }
    }
  }
}));

jest.mock('@/utils/dbUtils', () => ({
  resolveTable: (name: string) => name
}));

jest.mock('react-native-uuid', () => ({
  __esModule: true,
  default: { v4: () => 'languoid-uuid-1' }
}));

import { createLanguoidOffline } from '../languoidUtils';

describe('createLanguoidOffline', () => {
  beforeEach(() => {
    existingRows.length = 0;
    inserted.length = 0;
  });

  it('returns an existing languoid without inserting', async () => {
    existingRows.push({ id: 'existing-id', name: 'Tok Pisin' });

    await expect(
      createLanguoidOffline({
        name: 'Tok Pisin',
        creator_id: 'user-1'
      })
    ).resolves.toEqual({ languoid_id: 'existing-id', created: false });
    expect(inserted).toEqual([]);
  });

  it('inserts a new languoid and optional iso639-3 source', async () => {
    await expect(
      createLanguoidOffline({
        name: '  New Lang  ',
        creator_id: 'user-1',
        iso639_3: 'xyz'
      })
    ).resolves.toEqual({ languoid_id: 'languoid-uuid-1', created: true });

    expect(inserted).toEqual([
      {
        id: 'languoid-uuid-1',
        name: 'New Lang',
        level: 'language',
        ui_ready: false,
        active: true,
        creator_id: 'user-1',
        download_profiles: ['user-1']
      },
      {
        id: 'languoid-uuid-1',
        name: 'iso639-3',
        languoid_id: 'languoid-uuid-1',
        unique_identifier: 'xyz',
        active: true,
        creator_id: 'user-1',
        download_profiles: ['user-1']
      }
    ]);
  });
});
