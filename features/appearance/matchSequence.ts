// Pure, UI-free helpers that extract the candidate strings to test against the
// secret sequence. Kept separate from the components (and free of platform or
// async imports) so the matching logic is unit-testable. Actual verification is
// async (hashing) and lives in the caller.

/** Digits only, capped to a sane length. Used by the keypad surface. */
export function normalizeKeypadInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 12);
}

/**
 * Trailing windows of the typed digit buffer, longest first, bounded by
 * [minLen, maxLen]. Comparing the trailing digits means earlier arithmetic does
 * not block a correct sequence. Returns [] when the buffer is too short.
 */
export function keypadCandidates(
  buffer: string,
  minLen: number,
  maxLen: number
): string[] {
  const digits = normalizeKeypadInput(buffer);
  const out: string[] = [];
  const upper = Math.min(maxLen, digits.length);
  for (let len = upper; len >= minLen; len--) {
    out.push(digits.slice(-len));
  }
  return out;
}

/**
 * Non-empty trimmed lines of note text. The note surface unlocks when any single
 * line exactly equals the secret, letting the user type ordinary notes and
 * reveal access with a dedicated line.
 */
export function noteCandidates(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
