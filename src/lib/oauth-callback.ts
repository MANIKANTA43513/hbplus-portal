export interface OAuthCallbackParams {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
}

/**
 * Read OAuth callback parameters from a redirect URL.
 * Parses both the query string and the fragment, because providers and Supabase use either.
 * Pure string handling, so it behaves identically on web and native.
 */
export function parseOAuthCallback(url: string | null | undefined): OAuthCallbackParams {
  const empty: OAuthCallbackParams = { code: null, error: null, errorDescription: null };
  if (!url) return empty;

  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  const merged = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((value, key) => {
    if (!merged.has(key)) merged.set(key, value);
  });

  return {
    code: merged.get('code'),
    error: merged.get('error') ?? merged.get('error_code'),
    errorDescription: merged.get('error_description'),
  };
}

/** True when the callback carries any error signal from the provider or Supabase. */
export function hasCallbackError(params: OAuthCallbackParams): boolean {
  return params.error !== null || params.errorDescription !== null;
}
