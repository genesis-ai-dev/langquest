/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import { VAD_THRESHOLD_DEFAULT, useLocalStore } from '../localStore';

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

const bible = {
  bibleId: 'eng',
  name: 'English',
  vname: null,
  hasText: true,
  hasAudio: false
};

describe('localStore persisted slices', () => {
  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await AsyncStorage.clear();
    useLocalStore.setState({
      recentProjects: [],
      recentQuests: [],
      recentAssets: [],
      fiaAttachmentQueue: [],
      bibleTranslationByProject: {},
      bibleRecentTranslations: {},
      dismissedInviteBanners: {},
      dismissedInvitedRows: {},
      dismissedStoreUpdateTimestamp: null,
      dismissedStoreUpdateVersion: null,
      vadThreshold: VAD_THRESHOLD_DEFAULT,
      enablePlayAll: false
    });
    await Promise.resolve();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('addRecentProject dedupes, caps at 5, and persists', async () => {
    for (let i = 1; i <= 6; i++) {
      useLocalStore.getState().addRecentProject({
        id: `p${i}`,
        name: `Project ${i}`,
        visitedAt: new Date()
      });
    }
    useLocalStore.getState().addRecentProject({
      id: 'p3',
      name: 'Project 3 again',
      visitedAt: new Date()
    });

    const ids = useLocalStore.getState().recentProjects.map((p) => p.id);
    expect(ids).toEqual(['p3', 'p6', 'p5', 'p4', 'p2']);

    const persisted = await persistedState();
    expect(
      (persisted.recentProjects as { id: string }[]).map((p) => p.id)
    ).toEqual(ids);
  });

  it('enqueueFiaAttachment dedupes per pericope and language', () => {
    const store = useLocalStore.getState();
    store.enqueueFiaAttachment({
      pericopeId: 'peri-1',
      projectId: 'proj-1',
      fiaLanguageCode: 'tpi'
    });
    store.enqueueFiaAttachment({
      pericopeId: 'peri-1',
      projectId: 'proj-1',
      fiaLanguageCode: 'tpi'
    });
    store.enqueueFiaAttachment({
      pericopeId: 'peri-1',
      projectId: 'proj-1',
      fiaLanguageCode: 'eng'
    });

    expect(useLocalStore.getState().fiaAttachmentQueue).toHaveLength(2);
    expect(useLocalStore.getState().fiaAttachmentQueue[0]?.status).toBe(
      'pending'
    );
  });

  it('updates, removes, and clears completed FIA attachments', () => {
    const store = useLocalStore.getState();
    store.enqueueFiaAttachment({
      pericopeId: 'peri-1',
      projectId: 'proj-1',
      fiaLanguageCode: 'tpi'
    });
    store.enqueueFiaAttachment({
      pericopeId: 'peri-2',
      projectId: 'proj-1',
      fiaLanguageCode: 'tpi'
    });

    store.updateFiaAttachment(
      { pericopeId: 'peri-1', fiaLanguageCode: 'tpi' },
      { status: 'completed' }
    );
    store.clearCompletedFiaAttachments();
    expect(useLocalStore.getState().fiaAttachmentQueue).toHaveLength(1);
    expect(useLocalStore.getState().fiaAttachmentQueue[0]?.pericopeId).toBe(
      'peri-2'
    );

    store.removeFiaAttachment({
      pericopeId: 'peri-2',
      fiaLanguageCode: 'tpi'
    });
    expect(useLocalStore.getState().fiaAttachmentQueue).toEqual([]);
  });

  it('dismissInvitedRow is idempotent and undismiss removes empty project keys', () => {
    const store = useLocalStore.getState();
    store.dismissInvitedRow('proj-1', 'invite-1');
    store.dismissInvitedRow('proj-1', 'invite-1');
    expect(useLocalStore.getState().dismissedInvitedRows['proj-1']).toEqual([
      'invite-1'
    ]);

    store.undismissInvitedRow('proj-1', 'invite-1');
    expect(
      useLocalStore.getState().dismissedInvitedRows['proj-1']
    ).toBeUndefined();
  });

  it('dismissInviteBanner records a timestamp and reset clears it', () => {
    useLocalStore.getState().dismissInviteBanner('proj-1');
    expect(useLocalStore.getState().dismissedInviteBanners['proj-1']).toEqual(
      expect.any(Number)
    );
    useLocalStore.getState().resetInviteBannerDismissal('proj-1');
    expect(
      useLocalStore.getState().dismissedInviteBanners['proj-1']
    ).toBeUndefined();
  });

  it('dismissStoreUpdate persists version and timestamp and reset clears them', async () => {
    useLocalStore.getState().dismissStoreUpdate('2.3.0');
    expect(useLocalStore.getState().dismissedStoreUpdateVersion).toBe('2.3.0');
    expect(useLocalStore.getState().dismissedStoreUpdateTimestamp).toEqual(
      expect.any(Number)
    );

    const persisted = await persistedState();
    expect(persisted.dismissedStoreUpdateVersion).toBe('2.3.0');
    expect(persisted.dismissedStoreUpdateTimestamp).toEqual(expect.any(Number));

    useLocalStore.getState().resetStoreUpdateDismissal();
    expect(useLocalStore.getState().dismissedStoreUpdateVersion).toBeNull();
    expect(useLocalStore.getState().dismissedStoreUpdateTimestamp).toBeNull();
  });

  it('setBibleTranslation updates the recent list and caps at 10', () => {
    for (let i = 1; i <= 11; i++) {
      useLocalStore.getState().setBibleTranslation('proj-1', {
        ...bible,
        bibleId: `b${i}`
      });
    }
    const recent = useLocalStore.getState().bibleRecentTranslations['proj-1'];
    expect(recent).toHaveLength(10);
    expect(recent?.[0]).toBe('b11');
    expect(recent).not.toContain('b1');
    expect(
      useLocalStore.getState().bibleTranslationByProject['proj-1']?.bibleId
    ).toBe('b11');
  });

  it('clamps VAD threshold and persists it', async () => {
    useLocalStore.getState().setVadThreshold(99);
    expect(useLocalStore.getState().vadThreshold).toBe(1);
    useLocalStore.getState().setVadThreshold(-1);
    expect(useLocalStore.getState().vadThreshold).toBe(0.001);

    const persisted = await persistedState();
    expect(persisted.vadThreshold).toBe(0.001);
  });

  it('clamps an invalid VAD threshold on rehydrate', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await AsyncStorage.setItem(
      'local-store',
      JSON.stringify({
        state: { vadThreshold: 50 },
        version: 1
      })
    );

    await useLocalStore.persist.rehydrate();
    expect(useLocalStore.getState().vadThreshold).toBe(VAD_THRESHOLD_DEFAULT);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('migrates old languoid flags and drops invalid FIA queue rows', async () => {
    await AsyncStorage.setItem(
      'local-store',
      JSON.stringify({
        state: {
          enableLanguoidLinkSuggestions: true,
          fiaAttachmentQueue: [
            {
              pericopeId: 'peri-1',
              fiaLanguageCode: 'tpi',
              projectId: 'proj-1',
              status: 'pending',
              enqueuedAt: 1
            },
            { pericopeId: 'legacy-only' }
          ]
        },
        version: 0
      })
    );

    await useLocalStore.persist.rehydrate();
    expect(useLocalStore.getState().enableProjectLanguageSuggestions).toBe(
      true
    );
    expect(useLocalStore.getState().fiaAttachmentQueue).toEqual([
      expect.objectContaining({
        pericopeId: 'peri-1',
        fiaLanguageCode: 'tpi'
      })
    ]);
  });
});
