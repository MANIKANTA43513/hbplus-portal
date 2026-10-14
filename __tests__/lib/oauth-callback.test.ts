import { hasCallbackError, parseOAuthCallback } from '@/lib/oauth-callback';

describe('parseOAuthCallback', () => {
  it('reads a code from the query string', () => {
    expect(parseOAuthCallback('hbplusportal://auth/callback?code=abc123')).toEqual({
      code: 'abc123',
      error: null,
      errorDescription: null,
    });
  });

  it('reads errors from the query string and decodes the description', () => {
    const params = parseOAuthCallback(
      'https://app.example/auth/callback?error=server_error&error_description=Database+error+saving+new+user',
    );
    expect(params.error).toBe('server_error');
    expect(params.errorDescription).toBe('Database error saving new user');
    expect(hasCallbackError(params)).toBe(true);
  });

  it('reads parameters from the fragment', () => {
    const params = parseOAuthCallback('app://cb#error=access_denied&error_description=denied');
    expect(params.error).toBe('access_denied');
  });

  it('prefers the query string when both carry a value', () => {
    expect(parseOAuthCallback('app://cb?code=q#code=h').code).toBe('q');
  });

  it('handles missing and empty input', () => {
    expect(parseOAuthCallback(undefined).code).toBeNull();
    expect(parseOAuthCallback('').error).toBeNull();
    expect(hasCallbackError(parseOAuthCallback('https://app.example/auth/callback'))).toBe(false);
  });
});
