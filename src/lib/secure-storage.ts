import * as SecureStore from 'expo-secure-store';

/**
 * Supabase storage adapter backed by the platform keystore (iOS Keychain / Android Keystore).
 *
 * A Supabase session (access token + refresh token + user) is larger than the ~2 KB value
 * limit SecureStore recommends, so the JSON is split across several keys and reassembled on read.
 * Items are bound to this device and are only readable while the device is unlocked.
 */
const CHUNK_SIZE = 1000;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key), OPTIONS);
  const count = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readCount(key);
    if (count === 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i), OPTIONS);
      // A missing chunk means the entry is corrupt; treat it as no session rather than guessing.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readCount(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('');

    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunks[i], OPTIONS);
    }
    await SecureStore.setItemAsync(countKey(key), String(chunks.length), OPTIONS);

    for (let i = chunks.length; i < previousCount; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i), OPTIONS);
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i), OPTIONS);
    }
    await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
  },
};
