import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { AUTH_STORAGE_KEY } from '@/constants/auth';
import {
  hasCallbackError,
  parseOAuthCallback,
  type OAuthCallbackParams,
} from '@/lib/oauth-callback';
import { secureStorage } from '@/lib/secure-storage';

// Expo only inlines EXPO_PUBLIC_* variables when they are referenced literally like this.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

function isUsableConfig(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (url.includes('YOUR-') || key.includes('YOUR-')) return false; // untouched .env.example
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** False when the public Supabase settings are missing; the UI then shows a configuration error. */
export const isSupabaseConfigured = isUsableConfig(supabaseUrl, supabaseKey);

function getWebStorage(): SupportedStorage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined; // storage blocked (e.g. strict privacy mode)
  }
}

/** Web: browser localStorage. Native: Keychain/Keystore through expo-secure-store. */
const authStorage: SupportedStorage | undefined =
  Platform.OS === 'web' ? getWebStorage() : secureStorage;

export const supabase = createClient(
  // Placeholders keep module loading safe when unconfigured; every flow checks
  // isSupabaseConfigured first, so these are never contacted.
  isSupabaseConfigured ? supabaseUrl! : 'https://unconfigured.invalid',
  isSupabaseConfigured ? supabaseKey! : 'unconfigured',
  {
    auth: {
      storage: authStorage,
      storageKey: AUTH_STORAGE_KEY,
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // The web redirect lands back on this origin; native completes the exchange manually.
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

/**
 * Remove any persisted session and PKCE verifier from this device.
 * Used when the server cannot be reached to revoke the session, so logout still takes effect locally.
 */
export async function clearStoredSession(): Promise<void> {
  if (!authStorage) return;
  await authStorage.removeItem(AUTH_STORAGE_KEY);
  await authStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
}

// On web, capture an OAuth error from the redirect URL before the SDK or router rewrites it.
let initialCallbackError: OAuthCallbackParams | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const params = parseOAuthCallback(window.location.href);
  if (hasCallbackError(params)) initialCallbackError = params;
}

/** Returns (once) the OAuth error carried by the page URL after a failed web redirect. */
export function takeInitialCallbackError(): OAuthCallbackParams | null {
  const value = initialCallbackError;
  initialCallbackError = null;
  return value;
}

// React Native has no page-visibility events: pause token refresh while the app is backgrounded.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
