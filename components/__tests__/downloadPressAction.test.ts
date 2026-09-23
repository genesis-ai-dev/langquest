/// <reference types="jest" />

import { resolveDownloadPressAction } from '../downloadPressAction';

describe('resolveDownloadPressAction', () => {
  it('asks for confirmation before a new project/quest download', () => {
    expect(
      resolveDownloadPressAction({
        hasDownloadConfirmation: true
      })
    ).toBe('download-confirm');
  });

  it('downloads immediately when there is no confirmation', () => {
    expect(
      resolveDownloadPressAction({
        hasDownloadConfirmation: false
      })
    ).toBe('direct');
  });
});
