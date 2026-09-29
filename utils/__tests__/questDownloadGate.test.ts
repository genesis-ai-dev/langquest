/// <reference types="jest" />

import {
  resolveQuestDownloadAction,
  shouldRequireQuestDownload
} from '../questDownloadGate';

const memberOnCloudQuest = {
  isSignedIn: true,
  isMember: true,
  isCloud: true,
  isDownloaded: false
};

describe('shouldRequireQuestDownload', () => {
  it('requires a download for members opening a cloud quest', () => {
    expect(shouldRequireQuestDownload(memberOnCloudQuest)).toBe(true);
  });

  it('routes signed-in non-members like guests', () => {
    expect(
      shouldRequireQuestDownload({ ...memberOnCloudQuest, isMember: false })
    ).toBe(false);
  });

  it('never requires a download for guests', () => {
    expect(
      shouldRequireQuestDownload({
        ...memberOnCloudQuest,
        isSignedIn: false,
        isMember: false
      })
    ).toBe(false);
  });

  it('opens quests the member already downloaded', () => {
    expect(
      shouldRequireQuestDownload({ ...memberOnCloudQuest, isDownloaded: true })
    ).toBe(false);
  });

  it('opens local quests without a download', () => {
    expect(
      shouldRequireQuestDownload({ ...memberOnCloudQuest, isCloud: false })
    ).toBe(false);
  });
});

const cloudQuest = {
  isSignedIn: true,
  isLocal: false,
  isDownloaded: false
};

describe('resolveQuestDownloadAction', () => {
  it('offers a download for a quest that is not on the device', () => {
    expect(resolveQuestDownloadAction(cloudQuest)).toBe('download');
  });

  it('offers nothing for a quest already on the device', () => {
    expect(
      resolveQuestDownloadAction({ ...cloudQuest, isDownloaded: true })
    ).toBe('none');
  });

  it('offers nothing for local-only quests', () => {
    expect(resolveQuestDownloadAction({ ...cloudQuest, isLocal: true })).toBe(
      'none'
    );
  });

  it('offers nothing to guests', () => {
    expect(
      resolveQuestDownloadAction({ ...cloudQuest, isSignedIn: false })
    ).toBe('none');
  });
});
