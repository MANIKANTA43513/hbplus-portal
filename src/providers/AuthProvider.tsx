import { createContext, useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authError } from '@/lib/auth-errors';
import { authorizeUser } from '@/lib/authorization';
import { isSupabaseConfigured, supabase, takeInitialCallbackError } from '@/lib/supabase';
import {
  callbackParamsToError,
  endSession,
  signInWithGoogle,
  signOutUser,
  verifyCurrentUser,
  type AuthOutcome,
} from '@/services/auth';
import type { AppUser, AuthErrorInfo, AuthStatus } from '@/types/auth';

interface AuthState {
  status: AuthStatus;
  user: AppUser | null;
  error: AuthErrorInfo | null;
  isSigningIn: boolean;
}

type Action =
  | { type: 'outcome'; outcome: AuthOutcome }
  | { type: 'signin_start' }
  | { type: 'signin_reset' }
  | { type: 'clear_error' }
  | { type: 'session_lost' }
  | { type: 'forced_signout'; error: AuthErrorInfo }
  | { type: 'external_authorized'; user: AppUser };

const initialState: AuthState = { status: 'loading', user: null, error: null, isSigningIn: false };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'outcome': {
      const { outcome } = action;
      if (outcome.status === 'authorized') {
        return { status: 'authenticated', user: outcome.user, error: null, isSigningIn: false };
      }
      if (outcome.status === 'signed_out') {
        return { status: 'unauthenticated', user: null, error: outcome.error, isSigningIn: false };
      }
      return state; // redirecting: keep the in-progress state while the browser navigates away
    }
    case 'signin_start':
      return { ...state, error: null, isSigningIn: true };
    case 'signin_reset':
      return { ...state, isSigningIn: false };
    case 'clear_error':
      return state.error ? { ...state, error: null } : state;
    case 'session_lost':
      // The SDK dropped the session (refresh token revoked/expired, or signed out in another tab).
      if (state.status !== 'authenticated') return state;
      return {
        status: 'unauthenticated',
        user: null,
        error: authError('session_expired'),
        isSigningIn: false,
      };
    case 'forced_signout':
      return { status: 'unauthenticated', user: null, error: action.error, isSigningIn: false };
    case 'external_authorized':
      // Another tab completed sign-in. Never override an in-progress or settled local flow.
      if (state.status !== 'unauthenticated' || state.isSigningIn) return state;
      return { status: 'authenticated', user: action.user, error: null, isSigningIn: false };
    default:
      return state;
  }
}

export interface AuthContextValue extends AuthState {
  isConfigured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mounted = useRef(true);
  const signingIn = useRef(false);
  const verifyInFlight = useRef<Promise<AuthOutcome> | null>(null);
  // Read once so React StrictMode's double effect run cannot lose the redirect error.
  const callbackError = useRef<AuthErrorInfo | null | undefined>(undefined);

  /** Share one server verification between concurrent callers (init + auth events). */
  const verify = useCallback((): Promise<AuthOutcome> => {
    if (!verifyInFlight.current) {
      verifyInFlight.current = verifyCurrentUser().finally(() => {
        verifyInFlight.current = null;
      });
    }
    return verifyInFlight.current;
  }, []);

  // Restore (or complete a web OAuth redirect) on startup.
  useEffect(() => {
    mounted.current = true;

    if (callbackError.current === undefined) {
      const params = takeInitialCallbackError();
      callbackError.current = params ? callbackParamsToError(params) : null;
    }

    void verify().then((outcome) => {
      if (!mounted.current) return;
      if (outcome.status === 'signed_out' && !outcome.error && callbackError.current) {
        dispatch({ type: 'outcome', outcome: { status: 'signed_out', error: callbackError.current } });
      } else {
        dispatch({ type: 'outcome', outcome });
      }
    });

    return () => {
      mounted.current = false;
    };
  }, [verify]);

  // React to SDK events. This listener can only *revoke* access or pick up another tab's sign-in;
  // admission always goes through verifyCurrentUser() so local state/storage is never trusted.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Do not call SDK methods synchronously inside this callback (it can deadlock the SDK lock).
      if (event === 'SIGNED_OUT') {
        setTimeout(() => mounted.current && dispatch({ type: 'session_lost' }), 0);
        return;
      }

      if (!session) return;
      const changed = event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED';
      if (!changed) return;

      const decision = authorizeUser(session.user);
      if (!decision.ok) {
        const reason = decision.reason;
        setTimeout(() => {
          void endSession().then(() => {
            if (mounted.current) dispatch({ type: 'forced_signout', error: authError(reason) });
          });
        }, 0);
      } else if (event === 'SIGNED_IN') {
        setTimeout(() => {
          void verify().then((outcome) => {
            if (mounted.current && outcome.status === 'authorized') {
              dispatch({ type: 'external_authorized', user: outcome.user });
            }
          });
        }, 0);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [verify]);

  // Returning to the page through the browser's back/forward cache would leave the
  // "Redirecting to Google" state stuck on, so reset it.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        signingIn.current = false;
        dispatch({ type: 'signin_reset' });
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const signIn = useCallback(async () => {
    if (signingIn.current) return; // block duplicate requests even if the button is double-tapped
    signingIn.current = true;
    dispatch({ type: 'signin_start' });

    const outcome = await signInWithGoogle();
    if (outcome.status === 'redirecting') return; // page is leaving for Google
    signingIn.current = false;
    if (mounted.current) dispatch({ type: 'outcome', outcome });
  }, []);

  const signOut = useCallback(async () => {
    const { serverRevoked } = await signOutUser();
    if (!mounted.current) return;
    dispatch({
      type: 'outcome',
      outcome: { status: 'signed_out', error: serverRevoked ? null : authError('logout') },
    });
  }, []);

  const clearError = useCallback(() => dispatch({ type: 'clear_error' }), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, isConfigured: isSupabaseConfigured, signIn, signOut, clearError }),
    [state, signIn, signOut, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
