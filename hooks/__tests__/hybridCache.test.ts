/// <reference types="jest" />

import { QueryClient } from '@tanstack/react-query';
import { invalidateCloud, invalidateOfflineChapterLists } from '../hybridCache';

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity }
    }
  });
}

async function seed(client: QueryClient, queryKey: unknown[], data: unknown) {
  await client.prefetchQuery({
    queryKey,
    queryFn: () => data
  });
}

describe('invalidateCloud', () => {
  it('invalidates finite and infinite cloud keys for the given types', async () => {
    const client = createClient();
    await seed(client, ['assets', 'cloud', 'p1'], []);
    await seed(client, ['assets', 'infinite', 'p1', 'cloud'], []);
    await seed(client, ['assets', 'offline', 'p1'], []);
    await seed(client, ['quests', 'cloud', 'p1'], []);

    await invalidateCloud(client, 'assets');

    expect(client.getQueryState(['assets', 'cloud', 'p1'])?.isInvalidated).toBe(
      true
    );
    expect(
      client.getQueryState(['assets', 'infinite', 'p1', 'cloud'])?.isInvalidated
    ).toBe(true);
    expect(
      client.getQueryState(['assets', 'offline', 'p1'])?.isInvalidated
    ).toBe(false);
    expect(client.getQueryState(['quests', 'cloud', 'p1'])?.isInvalidated).toBe(
      false
    );
  });

  it('ignores keys whose first segment is not a matching string type', async () => {
    const client = createClient();
    await seed(client, [12, 'cloud'], []);
    await invalidateCloud(client, 'assets');
    expect(client.getQueryState([12, 'cloud'])?.isInvalidated).toBe(false);
  });
});

describe('invalidateOfflineChapterLists', () => {
  it('invalidates bible chapter and fia pericope offline lists', async () => {
    const client = createClient();
    await seed(client, ['bible-chapters', 'offline'], []);
    await seed(client, ['fia-pericope-quests', 'offline'], []);
    await seed(client, ['assets', 'offline'], []);

    await invalidateOfflineChapterLists(client);

    expect(
      client.getQueryState(['bible-chapters', 'offline'])?.isInvalidated
    ).toBe(true);
    expect(
      client.getQueryState(['fia-pericope-quests', 'offline'])?.isInvalidated
    ).toBe(true);
    expect(client.getQueryState(['assets', 'offline'])?.isInvalidated).toBe(
      false
    );
  });
});
