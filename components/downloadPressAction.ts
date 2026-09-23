export type DownloadPressAction = 'download-confirm' | 'direct';

export function resolveDownloadPressAction(options: {
  hasDownloadConfirmation: boolean;
}): DownloadPressAction {
  if (options.hasDownloadConfirmation) {
    return 'download-confirm';
  }

  return 'direct';
}
