import { decode } from './codec';

// Two presentation families. 'A' pairs with the keypad entry surface, 'B' with
// the note entry surface. Kept as single letters so the meaning is not obvious
// from the source.
export type ThemeFamily = 'A' | 'B';

export interface ThemeProfile {
  /** Stable, generic id that matches the asset folder name (e.g. "a01"). */
  id: string;
  /** Native alias suffix declared by the icon config plugin (e.g. "ThemeA01"). */
  aliasName: string;
  family: ThemeFamily;
  /** Home-screen display label. Decoded at runtime, never stored as plaintext. */
  label: string;
}

// Encoded manifest of every selectable theme. The decoded JSON is an array of
// { id, aliasName, family, label }. Encoded so the human-readable labels are
// not searchable in this public repo. See ./codec.ts.
const ENCODED_MANIFEST =
  'OisaGD4Rdk8AYAlTdhEtAQgxSz87XilPW3JsGT9eKSxRYRpdeFUtAAg8QVNgEQ1PTXJUEDhWIE9bcnsQNlA5AQAkVwN4TmAWQzlcU2ARLV1TchRTO18lDBIeWRw/EXZPNThdHD9yfF9DfBoXO14lARhyAlMbEWBPDTFaFDYRdk8iMVQSL18tGQ4iGgx2SG4EBXICUzsDf09NclkdM1I/IwA9XVNgERgFBD1dMGoAbkFDNlkcM181T1tyeVN2ESAMAzVUU2ARDwwNM00dO0cjH0MtFAp4WihPW3JZQW4RYE8APFEQKX0tAARyAlMOWykABBEIRXgfbgsAPVEdIxF2TyByFFM2Ui4IDXICUxlSIA4UPFkFNUFuEE0rGhg+EXZPAGANU3YRLQEIMUs/O14pT1tybBk/XiksUWUaXXhVLQAIPEFTYBENT01yVBA4ViBPW3J7EDZQOQEAJFcDeE5gFkM5XFNgES5dUHIUUztfJQwSHlkcPxF2TzU4XRw/cXxcQ3waFzteJQEYcgJTGBFgTw0xWhQ2EXZPLz9MFCkRMUEaclEVeAluD1FiGl14UiAEACN2EDdWbldDBFAUN1YOXVNyFFM8UiEEDSkaS3hxbkFDPFkTP19uV0MeVwU/QG4QTSsaGD4Rdk8DYAtTdhEtAQgxSz87XilPW3JsGT9eKS9RYxpdeFUtAAg8QVNgEQ5PTXJUEDhWIE9bcnYeLlY/Txx8Q1MzV25XQzIIRXgfbgwNOVkCFFIhCENqGiUyViEII2AMU3YRKgwMOVQIeAluL0N8Gh07USkBQ2oaPzVHKR5DLRQKeFooT1tyWkFvEWBPADxRECl9LQAEcgJTDlspAAQSCER4H24LAD1RHSMRdk8jchRTNlIuCA1yAlMUXDgIEnJFLA==';

let cached: ThemeProfile[] | null = null;

export function getThemeProfiles(): ThemeProfile[] {
  if (!cached) {
    cached = JSON.parse(decode(ENCODED_MANIFEST)) as ThemeProfile[];
  }
  return cached;
}

export function getThemeProfile(id: string): ThemeProfile | undefined {
  return getThemeProfiles().find((p) => p.id === id);
}

export function getThemeProfileByAlias(
  aliasName: string
): ThemeProfile | undefined {
  return getThemeProfiles().find((p) => p.aliasName === aliasName);
}

/** Decoded display label for a family (used as the entry-surface title). */
export function getFamilyLabel(family: ThemeFamily): string {
  return getThemeProfiles().find((p) => p.family === family)?.label ?? '';
}
