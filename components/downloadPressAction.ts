export type DownloadPressAction =
  | 'undownload-warning'
  | 'download-confirm'
  | 'direct';

export function resolveDownloadPressAction(options: {
  isConnected: boolean;
  isFlaggedForDownload: boolean;
  showUndownloadWarning: boolean;
  hasDownloadConfirmation: boolean;
}): DownloadPressAction {
  if (
    !options.isConnected &&
    options.isFlaggedForDownload &&
    options.showUndownloadWarning
  ) {
    return 'undownload-warning';
  }

  if (options.hasDownloadConfirmation && !options.isFlaggedForDownload) {
    return 'download-confirm';
  }

  return 'direct';
}
