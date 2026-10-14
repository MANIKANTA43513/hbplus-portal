const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (key: string) => (mockStore.has(key) ? mockStore.get(key)! : null)),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

import * as SecureStore from 'expo-secure-store';

import { secureStorage } from '@/lib/secure-storage';

const session = JSON.stringify({
  access_token: 'a'.repeat(1500),
  refresh_token: 'r'.repeat(40),
  user: { email: 'jane@hbplus.fit' },
});

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe('secureStorage', () => {
  it('round-trips values larger than a single keystore entry', async () => {
    await secureStorage.setItem('auth', session);
    expect(mockStore.size).toBeGreaterThan(2); // chunked
    expect(await secureStorage.getItem('auth')).toBe(session);
  });

  it('stores nothing in plain localStorage-like form and uses device-bound accessibility', async () => {
    await secureStorage.setItem('auth', 'hello');
    const options = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][2];
    expect(options).toEqual({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' });
  });

  it('returns null when nothing is stored', async () => {
    expect(await secureStorage.getItem('missing')).toBeNull();
  });

  it('removes every chunk and the counter', async () => {
    await secureStorage.setItem('auth', session);
    await secureStorage.removeItem('auth');
    expect(mockStore.size).toBe(0);
    expect(await secureStorage.getItem('auth')).toBeNull();
  });

  it('drops stale chunks when a smaller value overwrites a larger one', async () => {
    await secureStorage.setItem('auth', session);
    await secureStorage.setItem('auth', 'small');
    expect(await secureStorage.getItem('auth')).toBe('small');
    expect([...mockStore.keys()].sort()).toEqual(['auth.0', 'auth.count']);
  });

  it('treats a missing chunk as no session instead of returning corrupt data', async () => {
    await secureStorage.setItem('auth', session);
    mockStore.delete('auth.1');
    expect(await secureStorage.getItem('auth')).toBeNull();
  });

  it('handles an empty string value', async () => {
    await secureStorage.setItem('auth', '');
    expect(await secureStorage.getItem('auth')).toBe('');
  });
});
