export type AuthErrorCode =
  | 'cancelled'
  | 'config'
  | 'missing_email'
  | 'unverified_email'
  | 'unauthorized_domain'
  | 'unsupported_provider'
  | 'network'
  | 'session_expired'
  | 'provider'
  | 'logout';

export interface AuthErrorInfo {
  code: AuthErrorCode;
  /** User-safe text. Never contains tokens or raw provider errors. */
  message: string;
  /** Optional second line shown under the message when the cause is ambiguous. */
  hint?: string;
}

/** The subset of identity data the UI is allowed to rely on. */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: string;
  emailVerified: boolean;
  lastSignInAt: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
