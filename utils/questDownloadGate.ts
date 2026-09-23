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

export type QuestDownloadAction = 'download' | 'offload' | 'none';

/**
 * What the download control for a quest does, the same for every project
 * template and membership. Drafts only exist on this device, and a
 * downloaded draft cannot be offloaded (offloading would delete it).
 */
export function resolveQuestDownloadAction(options: {
  isSignedIn: boolean;
  isLocal: boolean;
  isDownloaded: boolean;
  isPublished: boolean;
}): QuestDownloadAction {
  if (!options.isSignedIn || options.isLocal) return 'none';
  if (!options.isDownloaded) return 'download';
  return options.isPublished ? 'offload' : 'none';
}
