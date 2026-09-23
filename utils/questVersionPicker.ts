/**
 * Members and owners always get the version picker (including Create new
 * version) once at least one version exists. Guests and non-members skip
 * the picker when there is only one version and go straight to assets.
 */
export function shouldOpenQuestVersionPicker(
  isMember: boolean,
  versionCount: number
): boolean {
  if (versionCount <= 0) return false;
  return isMember || versionCount > 1;
}
