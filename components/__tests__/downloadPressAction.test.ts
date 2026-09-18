/// <reference types="jest" />

import { resolveDownloadPressAction } from '../downloadPressAction';

describe('resolveDownloadPressAction', () => {
  it('shows the undownload warning when offline and already downloaded', () => {
    expect(
      resolveDownloadPressAction({
        isConnected: false,
        isFlaggedForDownload: true,
        showUndownloadWarning: true,
        hasDownloadConfirmation: true
      })
    ).toBe('undownload-warning');
  });

  it('skips the warning when the preference is off', () => {
    expect(
      resolveDownloadPressAction({
        isConnected: false,
        isFlaggedForDownload: true,
        showUndownloadWarning: false,
        hasDownloadConfirmation: false
      })
    ).toBe('direct');
  });

  it('asks for confirmation before a new project/quest download', () => {
    expect(
      resolveDownloadPressAction({
        isConnected: true,
        isFlaggedForDownload: false,
        showUndownloadWarning: false,
        hasDownloadConfirmation: true
      })
    ).toBe('download-confirm');
  });

  it('downloads or offloads immediately otherwise', () => {
    expect(
      resolveDownloadPressAction({
        isConnected: true,
        isFlaggedForDownload: true,
        showUndownloadWarning: false,
        hasDownloadConfirmation: true
      })
    ).toBe('direct');
  });
});
