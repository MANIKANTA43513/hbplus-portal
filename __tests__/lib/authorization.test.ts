import { ACCESS_RESTRICTED_MESSAGE } from '@/constants/auth';
import { authError } from '@/lib/auth-errors';
import { authorizeUser } from '@/lib/authorization';

import { makeUser } from '../helpers/users';

describe('authorizeUser', () => {
  it('admits a verified Google user on the exact domain and maps profile data', () => {
    const result = authorizeUser(makeUser({ email: 'Jane.Doe@HBPLUS.FIT' }));
    expect(result).toEqual({
      ok: true,
      user: {
        id: 'user-1',
        email: 'jane.doe@hbplus.fit',
        name: 'Jane Doe',
        avatarUrl: 'https://lh3.googleusercontent.com/a/jane',
        provider: 'google',
        emailVerified: true,
        lastSignInAt: '2026-10-01T09:00:00Z',
      },
    });
  });

  it('falls back to the email local part when no name is provided', () => {
    const result = authorizeUser(makeUser({ user_metadata: { email_verified: true } }));
    expect(result.ok && result.user.name).toBe('jane.doe');
    expect(result.ok && result.user.avatarUrl).toBeNull();
  });

  it.each([
    ['gmail', 'someone@gmail.com'],
    ['another company', 'employee@anothercompany.com'],
    ['look-alike domain', 'user@not-hbplus.fit'],
    ['suffix attack', 'user@hbplus.fit.attacker.com'],
    ['subdomain', 'user@sub.hbplus.fit'],
  ])('rejects a %s address as unauthorized_domain', (_label, email) => {
    expect(authorizeUser(makeUser({ email }))).toEqual({ ok: false, reason: 'unauthorized_domain' });
  });

  it('shows the exact required message for unauthorized domains', () => {
    expect(authError('unauthorized_domain').message).toBe(
      'Access restricted. Please login using your official domain email.',
    );
    expect(authError('unauthorized_domain').message).toBe(ACCESS_RESTRICTED_MESSAGE);
  });

  it.each([[undefined], [''], ['   '], ['not-an-email']])('rejects missing/invalid email %p', (email) => {
    expect(authorizeUser(makeUser({ email }))).toEqual({ ok: false, reason: 'missing_email' });
  });

  it('rejects an unverified company email', () => {
    const result = authorizeUser(makeUser({ email_confirmed_at: undefined }));
    expect(result).toEqual({ ok: false, reason: 'unverified_email' });
  });

  it('rejects when the provider flags the email as explicitly unverified', () => {
    const result = authorizeUser(makeUser({ user_metadata: { email_verified: false } }));
    expect(result).toEqual({ ok: false, reason: 'unverified_email' });
  });

  it('does not let user-editable metadata grant verification', () => {
    const result = authorizeUser(
      makeUser({ email_confirmed_at: undefined, user_metadata: { email_verified: true } }),
    );
    expect(result).toEqual({ ok: false, reason: 'unverified_email' });
  });

  it('rejects non-Google providers such as email/password', () => {
    const result = authorizeUser(makeUser({ app_metadata: { provider: 'email', providers: ['email'] } }));
    expect(result).toEqual({ ok: false, reason: 'unsupported_provider' });
  });

  it('treats a missing user as an invalid session', () => {
    expect(authorizeUser(null)).toEqual({ ok: false, reason: 'session_expired' });
    expect(authorizeUser(undefined)).toEqual({ ok: false, reason: 'session_expired' });
  });

  it('reports the domain problem first for non-company, unverified accounts', () => {
    const result = authorizeUser(makeUser({ email: 'x@gmail.com', email_confirmed_at: undefined }));
    expect(result).toEqual({ ok: false, reason: 'unauthorized_domain' });
  });
});
