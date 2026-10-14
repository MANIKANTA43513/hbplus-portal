import { Redirect } from 'expo-router';

/**
 * OAuth return target (web: https://<origin>/auth/callback, native: hbplusportal://auth/callback).
 * The session itself is completed by the auth service; this route only forwards to "/",
 * which sends the person to the dashboard or back to login depending on the result.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
