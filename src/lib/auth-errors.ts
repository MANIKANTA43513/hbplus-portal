import { ACCESS_RESTRICTED_MESSAGE } from '@/constants/auth';
import type { AuthErrorCode, AuthErrorInfo } from '@/types/auth';

const MESSAGES: Record<AuthErrorCode, string> = {
  cancelled: 'Sign-in was cancelled. Choose "Sign in with Google" to try again.',
  config:
    'Sign-in is not configured correctly. Ask the administrator to check the Supabase and Google OAuth settings.',
  missing_email:
    'Google did not provide an email address for this account, so access cannot be verified.',
  unverified_email:
    'This email address is not verified with Google. Verify it, then sign in again.',
  unauthorized_domain: ACCESS_RESTRICTED_MESSAGE,
  unsupported_provider: 'This sign-in method is not supported. Sign in with Google instead.',
  network: 'Network problem. Check your connection and try again.',
  session_expired: 'Your session has expired. Sign in again to continue.',
  provider: 'Sign-in failed. Try again in a moment.',
  logout:
    'You were signed out on this device, but the server could not be reached to end the session everywhere.',
};

export function authError(code: AuthErrorCode): AuthErrorInfo {
  return { code, message: MESSAGES[code] };
}

/** Error thrown inside the auth service. Carries only a safe code. */
export class AuthFlowError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

const NETWORK_PATTERN =
  /network request failed|failed to fetch|network error|fetch failed|timed out|offline/i;

/** True for transport-level failures (no connectivity, DNS, blocked fetch...). */
export function looksLikeNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  if (e.name === 'AuthRetryableFetchError') return true;
  return typeof e.message === 'string' && NETWORK_PATTERN.test(e.message);
}

/**
 * Convert any thrown value into a safe, user-facing error code.
 * The raw error is intentionally discarded so tokens or internals never reach the UI or logs.
 */
export function classifyError(error: unknown): AuthErrorCode {
  if (error instanceof AuthFlowError) return error.code;
  if (looksLikeNetworkError(error)) return 'network';
  return 'provider';
}

const REJECTION_CODES = new Set([
  'bad_jwt',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'refresh_token_not_found',
  'refresh_token_already_used',
]);

/**
 * True only when the Auth server has definitively said this session is no longer valid
 * (401/403, missing session, or a known invalid-token code). Anything else (rate limits,
 * unparseable proxy responses, unknown errors) is transient, so a valid session must not be destroyed.
 */
export function isDefinitiveRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; status?: number; code?: string };
  if (e.name === 'AuthSessionMissingError') return true;
  if (e.status === 401 || e.status === 403) return true;
  return typeof e.code === 'string' && REJECTION_CODES.has(e.code);
}
