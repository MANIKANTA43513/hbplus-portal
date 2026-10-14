import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react-native';

type AuthListener = (event: string, session: unknown) => void;
let mockListener: AuthListener | null = null;
const mockUnsubscribe = jest.fn();
const mockTakeInitialCallbackError = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mockListener = listener;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
  takeInitialCallbackError: () => mockTakeInitialCallbackError(),
}));

const mockVerify = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignOutUser = jest.fn();
const mockEndSession = jest.fn();

jest.mock('@/services/auth', () => ({
  // Keep the real error mapping; mock only the provider-facing calls.
  callbackParamsToError: jest.requireActual('@/services/auth').callbackParamsToError,
  verifyCurrentUser: () => mockVerify(),
  signInWithGoogle: () => mockSignInWithGoogle(),
  signOutUser: () => mockSignOutUser(),
  endSession: () => mockEndSession(),
}));

import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/AuthProvider';
import type { AppUser } from '@/types/auth';

import { makeUser } from '../helpers/users';

const jane: AppUser = {
  id: 'user-1',
  email: 'jane.doe@hbplus.fit',
  name: 'Jane Doe',
  avatarUrl: null,
  provider: 'google',
  emailVerified: true,
  lastSignInAt: null,
};
const authorized = { status: 'authorized', user: jane } as const;
const signedOut = (code?: string, message = 'msg') => ({
  status: 'signed_out',
  error: code ? { code, message } : null,
});

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

async function setup() {
  const hook = renderHook(() => useAuth(), { wrapper });
  return hook;
}

/** Fire an SDK auth event and let the provider's deferred (setTimeout 0) handler run. */
async function emit(event: string, session: unknown) {
  await act(async () => {
    mockListener?.(event, session);
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockListener = null;
  mockTakeInitialCallbackError.mockReturnValue(null);
  mockEndSession.mockResolvedValue(true);
});

describe('startup / session restoration', () => {
  it('starts in the loading state, then authenticates a restored valid session', async () => {
    let resolve!: (value: unknown) => void;
    mockVerify.mockReturnValue(new Promise((r) => (resolve = r)));

    const { result } = await setup();
    expect(result.current.status).toBe('loading');

    await act(async () => resolve(authorized));
    expect(result.current.status).toBe('authenticated');
    expect(result.current.user?.email).toBe('jane.doe@hbplus.fit');
  });

  it('becomes unauthenticated when there is no session', async () => {
    mockVerify.mockResolvedValue(signedOut());
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.error).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('surfaces an unauthorized-domain verdict as the exact required message', async () => {
    mockVerify.mockResolvedValue(
      signedOut('unauthorized_domain', 'Access restricted. Please login using your official domain email.'),
    );
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.error?.message).toBe(
      'Access restricted. Please login using your official domain email.',
    );
  });

  it('shows the error carried by a failed web OAuth redirect', async () => {
    mockTakeInitialCallbackError.mockReturnValue({
      code: null,
      error: 'server_error',
      errorDescription: 'Database error saving new user',
    });
    mockVerify.mockResolvedValue(signedOut());

    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.error?.code).toBe('unauthorized_domain');
  });

  it('shares one in-flight server verification with a concurrent SIGNED_IN event', async () => {
    let resolve!: (value: unknown) => void;
    mockVerify.mockReturnValue(new Promise((r) => (resolve = r)));

    const { result } = await setup();
    await emit('SIGNED_IN', { user: makeUser() }); // arrives while startup verification is pending
    expect(mockVerify).toHaveBeenCalledTimes(1);

    await act(async () => resolve(authorized));
    expect(result.current.status).toBe('authenticated');
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from auth events on unmount', async () => {
    mockVerify.mockResolvedValue(signedOut());
    const { unmount } = await setup();
    await unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('sign-in', () => {
  beforeEach(() => mockVerify.mockResolvedValue(signedOut()));

  it('authenticates after a successful sign-in and exposes a loading flag meanwhile', async () => {
    let resolve!: (value: unknown) => void;
    mockSignInWithGoogle.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.signIn();
    });
    expect(result.current.isSigningIn).toBe(true);

    await act(async () => {
      resolve(authorized);
      await pending;
    });
    expect(result.current.status).toBe('authenticated');
    expect(result.current.isSigningIn).toBe(false);
  });

  it('ignores a second sign-in request while one is in progress', async () => {
    let resolve!: (value: unknown) => void;
    mockSignInWithGoogle.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      void result.current.signIn();
      void result.current.signIn();
      void result.current.signIn();
    });
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);

    await act(async () => resolve(signedOut('cancelled', 'cancelled')));
    expect(result.current.isSigningIn).toBe(false);
  });

  it('can sign in again after a failure', async () => {
    mockSignInWithGoogle
      .mockResolvedValueOnce(signedOut('network', 'Network problem.'))
      .mockResolvedValueOnce(authorized);
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => result.current.signIn());
    expect(result.current.error?.code).toBe('network');
    expect(result.current.status).toBe('unauthenticated');

    await act(async () => result.current.signIn());
    expect(result.current.status).toBe('authenticated');
    expect(result.current.error).toBeNull();
  });

  it('keeps the loading state while the browser redirects to Google (web)', async () => {
    mockSignInWithGoogle.mockResolvedValue({ status: 'redirecting' });
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => result.current.signIn());
    expect(result.current.isSigningIn).toBe(true);
  });

  it('clearError removes the visible error', async () => {
    mockSignInWithGoogle.mockResolvedValue(signedOut('provider', 'failed'));
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await act(async () => result.current.signIn());
    expect(result.current.error).not.toBeNull();
    await act(async () => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});

describe('logout', () => {
  beforeEach(() => mockVerify.mockResolvedValue(authorized));

  it('clears the user and returns to unauthenticated', async () => {
    mockSignOutUser.mockResolvedValue({ serverRevoked: true });
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => result.current.signOut());
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('still signs out locally and warns when the server could not be reached', async () => {
    mockSignOutUser.mockResolvedValue({ serverRevoked: false });
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => result.current.signOut());
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(result.current.error?.code).toBe('logout');
  });
});

describe('SDK auth events', () => {
  beforeEach(() => mockVerify.mockResolvedValue(authorized));

  it('treats SIGNED_OUT (revoked/expired session, other tab) as an expired session', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await emit('SIGNED_OUT', null);
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.error?.code).toBe('session_expired');
  });

  it('force-signs-out when a session refresh yields an unauthorized identity', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await emit('USER_UPDATED', { user: makeUser({ email: 'changed@gmail.com' }) });
    expect(mockEndSession).toHaveBeenCalled();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.error?.code).toBe('unauthorized_domain');
  });

  it('never admits anyone from an event alone (INITIAL_SESSION from storage is ignored)', async () => {
    mockVerify.mockResolvedValue(signedOut());
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await emit('INITIAL_SESSION', { user: makeUser() });
    expect(result.current.status).toBe('unauthenticated');
  });

  it('keeps an authorized user signed in across token refreshes', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    await emit('TOKEN_REFRESHED', { user: makeUser() });
    expect(result.current.status).toBe('authenticated');
    expect(mockEndSession).not.toHaveBeenCalled();
  });

  it('picks up a sign-in completed in another tab, after server verification', async () => {
    mockVerify.mockResolvedValueOnce(signedOut());
    const { result } = await setup();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    mockVerify.mockResolvedValue(authorized);
    await emit('SIGNED_IN', { user: makeUser() });
    expect(result.current.status).toBe('authenticated');
  });
});

describe('useAuth', () => {
  it('throws when used outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside <AuthProvider>');
    spy.mockRestore();
  });
});
