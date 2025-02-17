import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
// We'll use this fallback in case Crypto.getRandomBytesAsync fails.
import * as Random from 'expo-random';
import { Platform } from 'react-native';

// Helper function to generate secure random bytes with fallback.
async function generateRandomBytes(byteCount: number): Promise<Uint8Array> {
  try {
    return await Crypto.getRandomBytesAsync(byteCount);
  } catch (error) {
    console.error('expo-crypto failed, falling back to expo-random:', error);
    return await Random.getRandomBytesAsync(byteCount);
  }
}

const ENCRYPTION_KEY_STORAGE = 'ENCRYPTION_KEY_STORAGE';

export class KVStorage {
  private encryptionKey: string | null = null;

  private async getEncryptionKey(): Promise<string> {
    if (this.encryptionKey) return this.encryptionKey;

    let key = await getItemAsync(ENCRYPTION_KEY_STORAGE);
    if (!key) {
      // Generate a new 256-bit (32-byte) random encryption key using generateRandomBytes.
      const randomBytes = await generateRandomBytes(32);
      key = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await setItemAsync(ENCRYPTION_KEY_STORAGE, key);
    }

    this.encryptionKey = key;
    return key;
  }

  private async encryptValue(value: string): Promise<string> {
    const key = await this.getEncryptionKey();
    return CryptoJS.AES.encrypt(value, key).toString();
  }

  private async decryptValue(encrypted: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const referenceKey = await getItemAsync(key);
      if (!referenceKey) return null;
      const encryptedValue = await AsyncStorage.getItem(referenceKey);
      if (!encryptedValue) return null;
      return this.decryptValue(encryptedValue);
    } catch (error) {
      console.error('Error in getItem:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Generate a random reference key using generateRandomBytes
      const randomBytes = await generateRandomBytes(16);
      const referenceKey = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const encryptedValue = await this.encryptValue(value);
      await AsyncStorage.setItem(referenceKey, encryptedValue);
      await setItemAsync(key, referenceKey);
    } catch (error) {
      console.error('Error in setItem:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const referenceKey = await getItemAsync(key);
      if (referenceKey) {
        await AsyncStorage.removeItem(referenceKey);
      }
      await deleteItemAsync(key);
    } catch (error) {
      console.error('Error in removeItem:', error);
      throw error;
    }
  }
}
