import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Secret sequence storage. We never persist the raw sequence: we store a salted
// SHA-256 hash in the OS secure enclave / keystore. Verification re-hashes the
// candidate with the stored salt and compares. Keys are generic so they do not
// hint at the feature's purpose.
const HASH_KEY = 'appearance.guard.h';
const SALT_KEY = 'appearance.guard.s';

async function hashWithSalt(value: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${value}`
  );
}

function randomSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Whether a secret sequence has been configured. */
export async function hasPin(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(HASH_KEY);
  return !!stored;
}

/** Stores a new secret sequence (salted-hashed). */
export async function setPin(value: string): Promise<void> {
  const salt = randomSalt();
  const hash = await hashWithSalt(value, salt);
  await SecureStore.setItemAsync(SALT_KEY, salt);
  await SecureStore.setItemAsync(HASH_KEY, hash);
}

/** Removes any configured secret sequence. */
export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(HASH_KEY);
  await SecureStore.deleteItemAsync(SALT_KEY);
}

/** Returns true when the candidate matches the stored secret sequence. */
export async function verifyPin(candidate: string): Promise<boolean> {
  const [salt, expected] = await Promise.all([
    SecureStore.getItemAsync(SALT_KEY),
    SecureStore.getItemAsync(HASH_KEY)
  ]);
  if (!salt || !expected) return false;
  const actual = await hashWithSalt(candidate, salt);
  return actual === expected;
}
