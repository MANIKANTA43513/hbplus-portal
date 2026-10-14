import { Dimensions } from 'react-native';

import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

type AuthListener = (event: string, session: unknown) => void;
const mockUnsubscribe = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: (_listener: AuthListener) => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      }),
      // Profile reads hit RLS on the server; here the table is simply unavailable.
      // (Only the shape needed by services/profile is provided.)
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'n/a' } }) }) }),
    }),
  },
  takeInitialCallbackError: () => null,
}));

const mockVerify = jest.fn();
const mockSignIn = jest.fn();
const mockSignOutUser = jest.fn();

jest.mock('@/services/auth', () => ({
  callbackParamsToError: jest.requireActual('@/services/auth').callbackParamsToError,
  verifyCurrentUser: () => mockVerify(),
  signInWithGoogle: () => mockSignIn(),
  signOutUser: () => mockSignOutUser(),
  endSession: jest.fn().mockResolvedValue(true),
}));

const jane = {
  id: 'user-1',
  email: 'jane.doe@hbplus.fit',
  name: 'Jane Doe',
  avatarUrl: null,
  provider: 'google',
  emailVerified: true,
  lastSignInAt: '2026-10-01T09:00:00Z',
};
const authorized = { status: 'authorized', user: jane };
const noSession = { status: 'signed_out', error: null };
const RESTRICTED = 'Access restricted. Please login using your official domain email.';

function setWindow(width: number) {
  Dimensions.set({ window: { width, height: 900, scale: 1, fontScale: 1 }, screen: { width, height: 900, scale: 1, fontScale: 1 } });
}

beforeEach(() => {
  jest.resetAllMocks();
  setWindow(1280);
});

const render = (url: string) => renderRouter('./src/app', { initialUrl: url });

describe('protected routes (real route files)', () => {
  it('redirects an unauthenticated direct visit to /dashboard to the login page', async () => {
    mockVerify.mockResolvedValue(noSession);
    render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('google-signin-button')).toBeTruthy());
    expect(screen).toHavePathname('/login');
    expect(screen.queryByTestId('welcome-message')).toBeNull();
  });

  it('redirects an unauthenticated visit to a nested protected URL', async () => {
    mockVerify.mockResolvedValue(noSession);
    render('/dashboard/account');
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByTestId('account-details')).toBeNull();
  });

  it('shows a loading state while restoring, then keeps the refreshed protected URL', async () => {
    let resolve!: (value: unknown) => void;
    mockVerify.mockReturnValue(new Promise((r) => (resolve = r)));
    render('/dashboard/account');

    expect(screen.getByTestId('loading-screen')).toBeTruthy();
    expect(screen.queryByTestId('google-signin-button')).toBeNull(); // no flash of the login page

    await act(async () => resolve(authorized));
    await waitFor(() => expect(screen.getByTestId('account-details')).toBeTruthy());
    expect(screen).toHavePathname('/dashboard/account');
  });

  it('shows the welcome message, name, email and status to an authorized user', async () => {
    mockVerify.mockResolvedValue(authorized);
    render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('welcome-message')).toBeTruthy());
    expect(screen.getByText('Welcome, Jane')).toBeTruthy();
    expect(screen.getByTestId('user-name')).toHaveTextContent('Jane Doe');
    expect(screen.getByTestId('user-email')).toHaveTextContent('jane.doe@hbplus.fit');
    expect(screen.getByTestId('auth-status')).toBeTruthy();
    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });

  it('keeps an authorized user off the login page', async () => {
    mockVerify.mockResolvedValue(authorized);
    render('/login');
    await waitFor(() => expect(screen.getByTestId('welcome-message')).toBeTruthy());
    expect(screen).toHavePathname('/dashboard');
  });

  it('routes the root URL by authentication state', async () => {
    mockVerify.mockResolvedValue(authorized);
    render('/');
    await waitFor(() => expect(screen).toHavePathname('/dashboard'));
  });

  it('forwards the OAuth callback route to the dashboard or login', async () => {
    mockVerify.mockResolvedValue(authorized);
    render('/auth/callback?code=abc');
    await waitFor(() => expect(screen).toHavePathname('/dashboard'));
  });

  it('navigates between the real dashboard pages', async () => {
    mockVerify.mockResolvedValue(authorized);
    render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('welcome-message')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByRole('link', { name: 'Account' }));
    });
    await waitFor(() => expect(screen).toHavePathname('/dashboard/account'));
    expect(screen.getByTestId('server-check')).toBeTruthy();
  });
});

describe('login screen', () => {
  it('shows the exact access-denied message for an unauthorized restored session', async () => {
    mockVerify.mockResolvedValue({
      status: 'signed_out',
      error: { code: 'unauthorized_domain', message: RESTRICTED },
    });
    render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('auth-error')).toBeTruthy());
    expect(screen.getByText(RESTRICTED)).toBeTruthy();
    expect(screen).toHavePathname('/login');
  });

  it('shows the official-domain notice, app name and description', async () => {
    mockVerify.mockResolvedValue(noSession);
    render('/login');
    await waitFor(() => expect(screen.getByTestId('domain-notice')).toBeTruthy());
    expect(screen.getByTestId('domain-notice')).toHaveTextContent(/hbplus\.fit/);
    expect(screen.getAllByText('HB+ Team Portal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('The internal workspace for HB Plus staff.').length).toBeGreaterThan(0);
  });

  it('signs in: disables the button while loading, blocks duplicates, then opens the dashboard', async () => {
    mockVerify.mockResolvedValue(noSession);
    let resolve!: (value: unknown) => void;
    mockSignIn.mockReturnValue(new Promise((r) => (resolve = r)));
    render('/login');
    await waitFor(() => expect(screen.getByTestId('google-signin-button')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('google-signin-button'));
    });
    const button = screen.getByTestId('google-signin-button');
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(screen.getByText('Signing in…')).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    await act(async () => resolve(authorized));
    await waitFor(() => expect(screen.getByTestId('welcome-message')).toBeTruthy());
    expect(screen).toHavePathname('/dashboard');
  });

  it('rejects a non-company login with the exact message and stays on /login', async () => {
    mockVerify.mockResolvedValue(noSession);
    mockSignIn.mockResolvedValue({
      status: 'signed_out',
      error: { code: 'unauthorized_domain', message: RESTRICTED },
    });
    render('/login');
    await waitFor(() => expect(screen.getByTestId('google-signin-button')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('google-signin-button'));
    });
    await waitFor(() => expect(screen.getByText(RESTRICTED)).toBeTruthy());
    expect(screen).toHavePathname('/login');
    expect(screen.queryByTestId('welcome-message')).toBeNull();
    // Button is usable again for another attempt.
    expect(screen.getByTestId('google-signin-button').props.accessibilityState.disabled).toBe(false);
  });

  it('renders the hint alongside the exact message for an ambiguous rejection', async () => {
    mockVerify.mockResolvedValue({
      status: 'signed_out',
      error: { code: 'unauthorized_domain', message: RESTRICTED, hint: 'Contact your administrator.' },
    });
    render('/login');
    await waitFor(() => expect(screen.getByText(RESTRICTED)).toBeTruthy());
    expect(screen.getByText('Contact your administrator.')).toBeTruthy();
  });

  it.each([
    ['cancelled', 'Sign-in was cancelled.'],
    ['network', 'Network problem.'],
    ['unverified_email', 'not verified'],
    ['missing_email', 'did not provide an email'],
  ])('shows a clear message for %s', async (code, fragment) => {
    mockVerify.mockResolvedValue(noSession);
    const { authError } = jest.requireActual('@/lib/auth-errors');
    mockSignIn.mockResolvedValue({ status: 'signed_out', error: authError(code) });
    render('/login');
    await waitFor(() => expect(screen.getByTestId('google-signin-button')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('google-signin-button'));
    });
    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent(new RegExp(fragment)));
  });
});

describe('logout', () => {
  it('signs out, returns to login, and blocks the dashboard afterwards', async () => {
    mockVerify.mockResolvedValue(authorized);
    mockSignOutUser.mockResolvedValue({ serverRevoked: true });
    render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('logout-button')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('logout-button'));
    });
    await waitFor(() => expect(screen.getByTestId('google-signin-button')).toBeTruthy());
    expect(screen).toHavePathname('/login');

    await act(async () => {
      try {
        router.navigate('/dashboard');
      } catch {
        // navigating to a removed route may throw in dev; either way access must be denied
      }
    });
    expect(screen.queryByTestId('welcome-message')).toBeNull();
    expect(screen.getByTestId('google-signin-button')).toBeTruthy();
  });
});

describe('responsive layout', () => {
  beforeEach(() => mockVerify.mockResolvedValue(noSession));

  it.each([
    [360, 'compact', false],
    [768, 'medium', false],
    [1280, 'wide', true],
  ])('login page at %ipx uses the %s layout (brand panel: %s)', async (width, size, brand) => {
    setWindow(width);
    render('/login');
    await waitFor(() => expect(screen.getByTestId(`login-screen-${size}`)).toBeTruthy());
    expect(!!screen.queryByTestId('login-brand-panel')).toBe(brand);
    expect(screen.getByTestId('google-signin-button')).toBeTruthy();
  });

  it('dashboard uses a sidebar on desktop and a header on phones', async () => {
    mockVerify.mockResolvedValue(authorized);
    setWindow(1280);
    const first = render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('dashboard-shell-wide')).toBeTruthy());
    first.unmount();

    setWindow(390);
    render('/dashboard');
    await waitFor(() => expect(screen.getByTestId('dashboard-shell-compact')).toBeTruthy());
    expect(screen.getByTestId('logout-button')).toBeTruthy();
  });
});
