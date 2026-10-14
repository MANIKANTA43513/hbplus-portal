import type { User } from '@supabase/supabase-js';

import { REQUIRED_PROVIDER } from '@/constants/auth';
import { isAllowedEmailDomain, parseEmail } from '@/lib/domain';
import type { AppUser, AuthErrorCode } from '@/types/auth';

export type AuthorizationResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: AuthErrorCode };

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Decide whether a Supabase user may use the app.
 *
 * The `user` must come from the Auth server (supabase.auth.getUser()) or a session the SDK
 * just minted, never from UI input or state. Checks, in order:
 *   1. an email is present and well-formed
 *   2. the email domain is exactly the allowed domain
 *   3. the provider has confirmed the email (email_confirmed_at is set by Supabase Auth only
 *      when Google reports the address as verified; user_metadata is user-editable, so it is
 *      only used as an additional negative signal)
 *   4. the identity came from Google (no password or other sign-up methods)
 *
 * Domain is checked before verification so a non-company account always sees the
 * "official domain" message rather than a verification hint.
 */
export function authorizeUser(user: User | null | undefined): AuthorizationResult {
  if (!user) return { ok: false, reason: 'session_expired' };

  const parsed = parseEmail(user.email);
  if (!parsed) return { ok: false, reason: 'missing_email' };

  if (!isAllowedEmailDomain(parsed.email)) return { ok: false, reason: 'unauthorized_domain' };

  const confirmed = Boolean(user.email_confirmed_at);
  const explicitlyUnverified = user.user_metadata?.email_verified === false;
  if (!confirmed || explicitlyUnverified) return { ok: false, reason: 'unverified_email' };

  const provider = readString(user.app_metadata?.provider);
  if (provider !== REQUIRED_PROVIDER) return { ok: false, reason: 'unsupported_provider' };

  const metadata = user.user_metadata ?? {};
  const name = readString(metadata.full_name) ?? readString(metadata.name) ?? parsed.local;

  return {
    ok: true,
    user: {
      id: user.id,
      email: parsed.email,
      name,
      avatarUrl: readString(metadata.avatar_url) ?? readString(metadata.picture),
      provider,
      emailVerified: true,
      lastSignInAt: user.last_sign_in_at ?? null,
    },
  };
}
