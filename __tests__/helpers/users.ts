import type { User } from '@supabase/supabase-js';

/** Build a Supabase user as the Auth server would return it for a Google sign-in. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    email: 'jane.doe@hbplus.fit',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    last_sign_in_at: '2026-10-01T09:00:00Z',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {
      full_name: 'Jane Doe',
      avatar_url: 'https://lh3.googleusercontent.com/a/jane',
      email_verified: true,
    },
    ...overrides,
  } as User;
}
