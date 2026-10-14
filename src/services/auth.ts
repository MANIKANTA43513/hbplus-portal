import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { ALLOWED_EMAIL_DOMAIN } from '@/constants/auth';
import {
  authError,
  AuthFlowError,
  classifyError,
  isDefinitiveRejection,
  looksLikeNetworkError,
} from '@/lib/auth-errors';
import { authorizeUser } from '@/lib/authorization';
import {
  hasCallbackError,
  parseOAuthCallback,
  type OAuthCallbackParams,
} from '@/lib/oauth-callback';
import { clearStoredSession, isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser, AuthErrorInfo } from '@/types/auth';

/** Result of any step that decides whether someone may enter the app. */
export type AuthOutcome =
  | { status: 'authorized'; user: AppUser }
  | { status: 'signed_out'; error: AuthErrorInfo | null }
  /** Web only: the browser is navigating to Google; the page will reload on return. */
  | { status: 'redirecting' };

const EXPLICIT_RESTRICTION_PATTERN = /access restricted/i;
const GENERIC_DATABASE_ERROR_PATTERN = /database error saving new user/i;

const AMBIGUOUS_REJECTION_HINT =
  'If you signed in with your official hbplus.fit account and still see this, contact your administrator.';

/** Map an OAuth error carried by a redirect URL to a safe, user-facing error. */
export function callbackParamsToError(params: OAuthCallbackParams): AuthErrorInfo {
  const description = params.errorDescription ?? '';
  // If Supabase passes through the trigger's own text, the cause is unambiguous.
  if (EXPLICIT_RESTRICTION_PATTERN.test(description)) return authError('unauthorized_domain');
  // The domain trigger (see supabase/migrations) normally surfaces as this generic message, but
  // any other failure inside the sign-up transaction does too, so the cause cannot be proven.
  // Show the required message, plus a hint so an unrelated failure is not silently mislabelled.
  if (GENERIC_DATABASE_ERROR_PATTERN.test(description)) {
    return { ...authError('unauthorized_domain'), hint: AMBIGUOUS_REJECTION_HINT };
  }
  if (params.error === 'access_denied') return authError('cancelled');
  return authError('provider');
}

function getRedirectUrl(): string {
  if (Platform.OS === 'web') return `${window.location.origin}/auth/callback`;
  return Linking.createURL('auth/callback');
}

/**
 * End the current session. Revokes it on the server when reachable and always removes it
 * from this device. Returns whether the server confirmed the revocation.
 */
export async function endSession(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (!error) return true;
  } catch {
    // fall through to local cleanup
  }
  await clearStoredSession().catch(() => undefined);
  return false;
}

/**
 * The single admission gate. Only this function can produce an `authorized` outcome.
 *
 * 1. Wait for the SDK to finish initialisation (this also completes a web OAuth redirect).
 * 2. Re-validate the session with the Auth server, so edited local storage cannot grant access.
 * 3. Apply the domain, verified-email and provider rules to the server-returned user.
 * 4. Unauthorized or invalid sessions are ended and removed from the device.
 */
export async function verifyCurrentUser(): Promise<AuthOutcome> {
  if (!isSupabaseConfigured) return { status: 'signed_out', error: authError('config') };

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return { status: 'signed_out', error: null };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      if (looksLikeNetworkError(userError) || !isDefinitiveRejection(userError)) throw userError;
      // Server definitively rejected the token: expired, revoked, deleted or forged.
      await endSession();
      return { status: 'signed_out', error: authError('session_expired') };
    }

    const decision = authorizeUser(userData.user);
    if (!decision.ok) {
      await endSession();
      return { status: 'signed_out', error: authError(decision.reason) };
    }
    return { status: 'authorized', user: decision.user };
  } catch (error) {
    // Network failures keep any stored session so a later retry can still succeed,
    // but the user is not admitted without server confirmation.
    return { status: 'signed_out', error: authError(classifyError(error)) };
  }
}

/** Start Google sign-in using the flow appropriate for the current platform. */
export async function signInWithGoogle(): Promise<AuthOutcome> {
  if (!isSupabaseConfigured) return { status: 'signed_out', error: authError('config') };

  try {
    const redirectTo = getRedirectUrl();
    const isWeb = Platform.OS === 'web';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: !isWeb,
        // "hd" only pre-selects the company account in Google's chooser. It is a UX hint,
        // NOT a security control: the server and client checks below are what enforce the domain.
        queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) throw error;

    if (isWeb) return { status: 'redirecting' };
    if (!data.url) throw new AuthFlowError('config');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new AuthFlowError('cancelled');

    const params = parseOAuthCallback(result.url);
    if (hasCallbackError(params)) {
      return { status: 'signed_out', error: callbackParamsToError(params) };
    }
    if (!params.code) throw new AuthFlowError('provider');

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchangeError) throw exchangeError;

    return await verifyCurrentUser();
  } catch (error) {
    return { status: 'signed_out', error: authError(classifyError(error)) };
  }
}

/** Sign out of this device. Resolves with whether the server confirmed the revocation. */
export async function signOutUser(): Promise<{ serverRevoked: boolean }> {
  return { serverRevoked: await endSession() };
}
