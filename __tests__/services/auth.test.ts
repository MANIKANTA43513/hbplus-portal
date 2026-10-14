import { Platform } from 'react-native';

const mockAuth = {
  getSession: jest.fn(),
  getUser: jest.fn(),
  signOut: jest.fn(),
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
};
const mockClearStoredSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  // Resolved lazily: imports are hoisted above the `const mockAuth` initialisation.
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
  clearStoredSession: (...args: unknown[]) => mockClearStoredSession(...args),
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'hbplusportal://auth/callback') }));

import * as WebBrowser from 'expo-web-browser';

import {
  callbackParamsToError,
  signInWithGoogle,
  signOutUser,
  verifyCurrentUser,
} from '@/services/auth';

import { makeUser } from '../helpers/users';

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const OAUTH_URL = 'https://project.supabase.co/auth/v1/authorize?provider=google';
const REDIRECT = 'hbplusportal://auth/callback';

/** Arrange a server that reports `user` for the current session. */
function serverReturns(user: ReturnType<typeof makeUser> | null) {
  mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
  mockAuth.getUser.mockResolvedValue({ data: { user }, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: OAUTH_URL }, error: null });
  mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  openAuthSession.mockResolvedValue({ type: 'success', url: `${REDIRECT}?code=auth-code` });
  mockClearStoredSession.mockResolvedValue(undefined);
});

describe('native sign-in flow', () => {
  it('admits a verified hbplus.fit user after a real OAuth round trip', async () => {
    serverReturns(makeUser());

    const outcome = await signInWithGoogle();

    expect(outcome.status).toBe('authorized');
    expect(outcome.status === 'authorized' && outcome.user.email).toBe('jane.doe@hbplus.fit');
    // Real provider calls happened, in order, using PKCE code exchange.
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { hd: 'hbplus.fit', prompt: 'select_account' },
      }),
    });
    expect(openAuthSession).toHaveBeenCalledWith(OAUTH_URL, REDIRECT);
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
    // Identity was re-validated against the Auth server, not trusted from the device.
    expect(mockAuth.getUser).toHaveBeenCalled();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it.each([
    ['a Gmail account', makeUser({ email: 'someone@gmail.com' })],
    ['another company', makeUser({ email: 'employee@anothercompany.com' })],
    ['a look-alike domain', makeUser({ email: 'user@not-hbplus.fit' })],
    ['a suffix attack', makeUser({ email: 'user@hbplus.fit.attacker.com' })],
  ])('rejects %s, shows the exact message and ends the session', async (_label, user) => {
    serverReturns(user);

    const outcome = await signInWithGoogle();

    expect(outcome).toEqual({
      status: 'signed_out',
      error: {
        code: 'unauthorized_domain',
        message: 'Access restricted. Please login using your official domain email.',
      },
    });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('rejects an unverified company email and ends the session', async () => {
    serverReturns(makeUser({ email_confirmed_at: undefined }));
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'unverified_email' } });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('rejects an account with no email', async () => {
    serverReturns(makeUser({ email: undefined }));
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'missing_email' } });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('treats a cancelled or dismissed browser as user cancellation', async () => {
    openAuthSession.mockResolvedValue({ type: 'cancel' });
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'cancelled' } });
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a database domain rejection from the redirect as unauthorized', async () => {
    openAuthSession.mockResolvedValue({
      type: 'success',
      url: `${REDIRECT}?error=server_error&error_description=Database+error+saving+new+user`,
    });
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'unauthorized_domain' } });
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports Google consent denial as cancellation', async () => {
    openAuthSession.mockResolvedValue({
      type: 'success',
      url: `${REDIRECT}?error=access_denied&error_description=The+user+denied+access`,
    });
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ error: { code: 'cancelled' } });
  });

  it('fails safely when the redirect carries no code', async () => {
    openAuthSession.mockResolvedValue({ type: 'success', url: REDIRECT });
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ error: { code: 'provider' } });
  });

  it('maps a network failure while starting OAuth to a network error', async () => {
    mockAuth.signInWithOAuth.mockRejectedValue(new TypeError('Network request failed'));
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ error: { code: 'network' } });
  });

  it('maps a failed code exchange to a provider error without leaking its message', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', message: 'invalid grant refresh_token=SECRET-TOKEN-123' },
    });
    const outcome = await signInWithGoogle();
    expect(outcome).toMatchObject({ error: { code: 'provider' } });
    expect(JSON.stringify(outcome)).not.toContain('SECRET-TOKEN-123');
  });
});

describe('web sign-in flow', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'web';
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://portal.example.app', href: 'https://portal.example.app/login' },
      configurable: true,
    });
  });
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('starts a full-page redirect to Google with the web callback URL', async () => {
    const outcome = await signInWithGoogle();

    expect(outcome).toEqual({ status: 'redirecting' });
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'https://portal.example.app/auth/callback',
        skipBrowserRedirect: false,
      }),
    });
    expect(openAuthSession).not.toHaveBeenCalled();
  });
});

describe('session restoration (verifyCurrentUser)', () => {
  it('restores a valid authorized session', async () => {
    serverReturns(makeUser());
    expect(await verifyCurrentUser()).toMatchObject({ status: 'authorized' });
  });

  it('returns signed out, without an error, when there is no stored session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await verifyCurrentUser()).toEqual({ status: 'signed_out', error: null });
    expect(mockAuth.getUser).not.toHaveBeenCalled();
  });

  it('does not trust local storage: a session the server rejects is ended', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'forged' } }, error: null });
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' },
    });

    const outcome = await verifyCurrentUser();

    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'session_expired' } });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it.each([
    ['rate limited (429)', { name: 'AuthApiError', status: 429, message: 'too many requests' }],
    ['unparseable proxy response', { name: 'AuthUnknownError', message: '<html>bad gateway</html>' }],
    ['unexpected 400', { name: 'AuthApiError', status: 400, message: 'bad request' }],
  ])('does not destroy a valid session on a transient error: %s', async (_label, err) => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: err });

    const outcome = await verifyCurrentUser();

    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'provider' } });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(mockClearStoredSession).not.toHaveBeenCalled();
  });

  it.each([
    ['403 forbidden', { name: 'AuthApiError', status: 403, message: 'x' }],
    ['session missing', { name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' }],
    ['bad_jwt code', { name: 'AuthApiError', status: 400, code: 'bad_jwt', message: 'x' }],
  ])('ends the session when the server definitively rejects it: %s', async (_label, err) => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: err });
    expect(await verifyCurrentUser()).toMatchObject({ error: { code: 'session_expired' } });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('ignores a locally edited email: authorization uses the server-returned user', async () => {
    // The device session claims an hbplus.fit address, but the Auth server knows the real one.
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: 'x', user: makeUser({ email: 'edited@hbplus.fit' }) } },
      error: null,
    });
    mockAuth.getUser.mockResolvedValue({ data: { user: makeUser({ email: 'real@gmail.com' }) }, error: null });

    expect(await verifyCurrentUser()).toMatchObject({
      status: 'signed_out',
      error: { code: 'unauthorized_domain' },
    });
  });

  it('removes a stored session that now belongs to an unauthorized user', async () => {
    serverReturns(makeUser({ email: 'moved@gmail.com' }));
    await verifyCurrentUser();
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not admit anyone when the server is unreachable, but keeps the session for a retry', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'fetch failed', status: 0 },
    });

    const outcome = await verifyCurrentUser();

    expect(outcome).toMatchObject({ status: 'signed_out', error: { code: 'network' } });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('reports an SDK initialisation failure safely', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('boom: token=abc') });
    const outcome = await verifyCurrentUser();
    expect(outcome).toMatchObject({ error: { code: 'provider' } });
    expect(JSON.stringify(outcome)).not.toContain('token=abc');
  });
});

describe('logout (signOutUser)', () => {
  it('revokes the session on the server', async () => {
    expect(await signOutUser()).toEqual({ serverRevoked: true });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockClearStoredSession).not.toHaveBeenCalled();
  });

  it('still clears the device session when the server returns an error', async () => {
    mockAuth.signOut.mockResolvedValue({ error: { name: 'AuthRetryableFetchError', message: 'offline' } });
    expect(await signOutUser()).toEqual({ serverRevoked: false });
    expect(mockClearStoredSession).toHaveBeenCalled();
  });

  it('still clears the device session when the SDK throws', async () => {
    mockAuth.signOut.mockRejectedValue(new Error('crash'));
    expect(await signOutUser()).toEqual({ serverRevoked: false });
    expect(mockClearStoredSession).toHaveBeenCalled();
  });
});

describe('callbackParamsToError', () => {
  it('maps the provider/database messages to safe errors', () => {
    const map = (error: string | null, errorDescription: string | null) =>
      callbackParamsToError({ code: null, error, errorDescription }).code;
    expect(map('server_error', 'Database error saving new user')).toBe('unauthorized_domain');
    expect(map('server_error', 'Access restricted. Please login using your official domain email.')).toBe(
      'unauthorized_domain',
    );
    expect(map('access_denied', 'denied')).toBe('cancelled');
    expect(map('server_error', 'something else')).toBe('provider');
    expect(map('server_error', null)).toBe('provider');
  });

  it('shows the exact message with no hint when Supabase passes through the trigger text', () => {
    const info = callbackParamsToError({
      code: null,
      error: 'server_error',
      errorDescription: 'Access restricted. Please login using your official domain email.',
    });
    expect(info.message).toBe('Access restricted. Please login using your official domain email.');
    expect(info.hint).toBeUndefined();
  });

  it('keeps the exact message but adds a hint when the cause is only a generic database error', () => {
    const info = callbackParamsToError({
      code: null,
      error: 'server_error',
      errorDescription: 'Database error saving new user',
    });
    expect(info.message).toBe('Access restricted. Please login using your official domain email.');
    expect(info.hint).toMatch(/contact your administrator/);
  });
});
