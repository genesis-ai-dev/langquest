/// <reference types="jest" />

jest.mock('@/db/powersync/system', () => ({
  system: {
    db: {},
    powersync: { getAll: jest.fn() }
  }
}));

jest.mock('@/services/attachments/LocalFileIndex', () => ({
  localFileIndex: {
    has: jest.fn(),
    init: jest.fn()
  }
}));

import type { QuestScope } from '../questPendingChanges';
import {
    countPendingAudioFiles,
    crudEntryTouchesQuest,
    parseCrudEntry
} from '../questPendingChanges';

const scope: QuestScope = {
  questId: 'quest-1',
  assetIds: new Set(['asset-a', 'asset-b']),
  assetContentLinkIds: new Set(['acl-1']),
  voteIds: new Set(['vote-1'])
};

describe('parseCrudEntry', () => {
  it('reads type and id from a PowerSync crud blob', () => {
    expect(
      parseCrudEntry(JSON.stringify({ type: 'quest', id: 'quest-1' }))
    ).toEqual({ type: 'quest', id: 'quest-1' });
  });

  it('returns null for junk', () => {
    expect(parseCrudEntry(null)).toBeNull();
    expect(parseCrudEntry(42)).toBeNull();
    expect(parseCrudEntry('{')).toBeNull();
    expect(parseCrudEntry('[]')).toBeNull();
  });
});

describe('crudEntryTouchesQuest', () => {
  it('matches the quest and quest-keyed links by prefix', () => {
    expect(crudEntryTouchesQuest({ type: 'quest', id: 'quest-1' }, scope)).toBe(
      true
    );
    expect(
      crudEntryTouchesQuest(
        { type: 'quest_asset_link', id: 'quest-1_asset-a' },
        scope
      )
    ).toBe(true);
    expect(
      crudEntryTouchesQuest(
        { type: 'quest_tag_link', id: 'quest-1_tag-9' },
        scope
      )
    ).toBe(true);
    expect(
      crudEntryTouchesQuest({ type: 'quest', id: 'quest-other' }, scope)
    ).toBe(false);
    expect(
      crudEntryTouchesQuest(
        { type: 'quest_asset_link', id: 'quest-other_asset-a' },
        scope
      )
    ).toBe(false);
  });

  it('matches assets, content links, votes, and asset-tag links', () => {
    expect(crudEntryTouchesQuest({ type: 'asset', id: 'asset-a' }, scope)).toBe(
      true
    );
    expect(
      crudEntryTouchesQuest({ type: 'asset_content_link', id: 'acl-1' }, scope)
    ).toBe(true);
    expect(crudEntryTouchesQuest({ type: 'vote', id: 'vote-1' }, scope)).toBe(
      true
    );
    expect(
      crudEntryTouchesQuest(
        { type: 'asset_tag_link', id: 'asset-b_tag-3' },
        scope
      )
    ).toBe(true);
    expect(
      crudEntryTouchesQuest({ type: 'asset', id: 'asset-other' }, scope)
    ).toBe(false);
    expect(
      crudEntryTouchesQuest(
        { type: 'asset_tag_link', id: 'asset-other_tag-3' },
        scope
      )
    ).toBe(false);
  });

  it('ignores other tables and incomplete entries', () => {
    expect(
      crudEntryTouchesQuest({ type: 'project', id: 'project-1' }, scope)
    ).toBe(false);
    expect(crudEntryTouchesQuest({ type: 'quest' }, scope)).toBe(false);
    expect(crudEntryTouchesQuest({ id: 'quest-1' }, scope)).toBe(false);
  });
});

describe('countPendingAudioFiles', () => {
  const onDisk = (name: string) => name === 'a.m4a' || name === 'legacy.m4a';

  it('counts unique uploadable files that exist locally', () => {
    expect(
      countPendingAudioFiles(
        [
          { audio: ['a.m4a', 'local/legacy.m4a'] },
          { audio: ['a.m4a', 'missing.m4a', 'file:///tmp/x.m4a'] },
          { audio: null }
        ],
        onDisk
      )
    ).toBe(2);
  });

  it('returns 0 when nothing is on disk', () => {
    expect(countPendingAudioFiles([{ audio: ['a.m4a'] }], () => false)).toBe(0);
  });
});
