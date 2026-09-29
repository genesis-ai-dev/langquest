/**
 * Members and owners must download a cloud quest before opening it.
 * Guests and signed-in non-members open it straight to the cloud assets.
 */
export function shouldRequireQuestDownload(options: {
  isSignedIn: boolean;
  isMember: boolean;
  isCloud: boolean;
  isDownloaded: boolean;
}): boolean {
  return (
    options.isSignedIn &&
    options.isMember &&
    options.isCloud &&
    !options.isDownloaded
  );
}

export type QuestDownloadAction = 'download' | 'none';

/**
 * What the download control for a quest does, the same for every project
 * template and membership. A quest already on the device has nothing to do.
 */
export function resolveQuestDownloadAction(options: {
  isSignedIn: boolean;
  isLocal: boolean;
  isDownloaded: boolean;
}): QuestDownloadAction {
  if (!options.isSignedIn || options.isLocal || options.isDownloaded) {
    return 'none';
  }
  return 'download';
}
