# HB+ Team Portal

A cross-platform (web, Android, iOS) React Native app with **Google sign-in restricted to `hbplus.fit` email accounts**. One shared codebase built with Expo, Expo Router, React Native for Web, TypeScript and Supabase Auth.

> **Verification status (read this first).** Verified locally: type checking, lint, 137 Jest tests, a production web build, Android/iOS bundle compilation and generated native config, and the SQL migration on PostgreSQL 16. **Not verified:** a real Google sign-in against a live Supabase project, a deployed Netlify site, and running on an Android/iOS emulator or device. Those need your credentials or hardware; exact steps are below. See [Known limitations](#25-known-limitations) for what the tests can and cannot prove.

---

## 1. Project overview

Staff open the app, press **Sign in with Google**, and are admitted only if Google/Supabase confirms a verified email on the exact domain `hbplus.fit`. Anyone else sees:

> Access restricted. Please login using your official domain email.

## 2. Features and requirements implemented

| Requirement | Where |
|---|---|
| React Native + React Native for Web, one codebase | Expo SDK 57, `src/` |
| Real Google OAuth 2.0 | Supabase Auth, Google provider, PKCE (`src/services/auth.ts`) |
| Exact-domain restriction `hbplus.fit` | `src/lib/domain.ts`, `src/lib/authorization.ts`, plus database trigger and RLS |
| Verified email required | `authorizeUser()` and `is_authorized_member()` |
| Login page (responsive, loading, errors, disabled button, domain notice) | `src/app/login.tsx` |
| Protected dashboard (name, email, photo, status, logout, empty state) | `src/app/(app)/` |
| Route protection (direct URL, refresh, logout) | `Stack.Protected` in `src/app/_layout.tsx` |
| Session restore, logout | `src/providers/AuthProvider.tsx`, `src/services/auth.ts` |
| Error handling (cancel, config, missing/unverified email, domain, network, expired session, provider, logout) | `src/lib/auth-errors.ts` |
| Tests | `__tests__/` (128 Jest tests) and `supabase/tests/` (SQL) |

## 3. Technology stack and why

- **Expo + Expo Router + React Native for Web + TypeScript.** One codebase and one navigation structure for all three platforms; file-based routes work as real URLs on web.
- **Supabase Auth with Google** (rather than Firebase or the native Google Sign-In SDK).
  - The same browser-based OAuth/PKCE flow works on web, Android and iOS, so there is a single authentication provider and one authorization path. The native Google SDK would need a development build and a different token path per platform.
  - Supabase gives a Postgres database where the domain rule can be enforced **server-side** (trigger + Row Level Security), which the brief requires.
- **`expo-secure-store`** keeps native sessions in the iOS Keychain / Android Keystore. **`expo-web-browser`** runs the native OAuth session.

## 4. Architecture and folder structure

```
src/
  app/                  Routes (Expo Router)
    _layout.tsx           AuthProvider + protected navigator
    index.tsx             Redirects to /dashboard or /login
    login.tsx             Login page
    auth/callback.tsx     OAuth return URL, forwards to "/"
    (app)/                Protected group (URL has no "(app)")
      _layout.tsx           Sidebar (desktop) / header (phone) shell
      dashboard/index.tsx   Overview
      dashboard/account.tsx Account + server-side access check
  components/           Button, Banner, Card, Avatar, GoogleLogo, ...
  constants/            auth.ts (domain, exact message), theme.ts
  hooks/                use-auth, use-breakpoint, use-profile
  lib/                  domain.ts, authorization.ts, auth-errors.ts,
                        oauth-callback.ts, supabase.ts, secure-storage.ts
  providers/            AuthProvider.tsx (state machine)
  services/             auth.ts (provider integration), profile.ts
  types/                auth.ts
supabase/
  migrations/           SQL: domain trigger, RLS, profiles table
  tests/                SQL tests (run on plain PostgreSQL)
__tests__/              Jest tests
```

**One admission gate.** Only `verifyCurrentUser()` can produce an "authorized" result. It waits for the SDK, re-validates the session **with the Auth server** (`getUser()`), then applies the domain / verified-email / provider rules to the server-returned user. Edited local storage or React state cannot grant access. SDK events can only *revoke* access.

## 5. Prerequisites

- Node.js 22 and npm (the versions it was built and tested with)
- A Google Cloud project and a Supabase project (both free tier is fine)
- Optional: Android Studio (emulator), Xcode on macOS (iOS simulator), a Netlify account, a GitHub account

## 6. Installation and local setup

```bash
npm install
cp .env.example .env     # then fill in the two values (section 7)
npm run web              # http://localhost:8081
```

## 7. Environment variables

`.env` (git-ignored; only `.env.example` is committed):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_KEY` | Publishable key (`sb_publishable_…`) or legacy `anon` key |

Both are **public** by design: they are bundled into the app, and safety comes from Row Level Security. **Never** put the service-role key or the Google client secret in this app. The Google client secret is entered only in the Supabase dashboard. If these variables are missing, the login page shows a configuration error instead of crashing.

## 8. Google Cloud Console setup

1. Create a project at <https://console.cloud.google.com>.
2. **Google Auth Platform → Branding / OAuth consent screen**
   - If `hbplus.fit` is a Google Workspace organisation, choose **Internal**. Google itself then only lets your organisation's users sign in (an extra layer on top of this app's checks).
   - Otherwise choose **External**.
3. **Data Access (scopes):** the default `openid`, `email`, `profile` are all that is needed.
4. **Clients → Create client → Web application** (see sections 10–11 for the URLs). Copy the **Client ID** and **Client secret**.

## 9. OAuth consent screen and authorized domains

Add your Supabase domain (`supabase.co`) and, if you set a home-page link, your deployed domain under **Authorized domains / Branding**. No sensitive or restricted scopes are used, so no Google verification review is required.

## 10. Web OAuth client: allowed JavaScript origins

Under the Web client's **Authorized JavaScript origins** add:

- `http://localhost:8081`
- `https://YOUR-SITE.netlify.app`

(With Supabase's server-side flow the browser never calls Google directly from your origin, so these are belt-and-braces, but they are harmless and the brief asks for them.)

## 11. Redirect / callback URLs

Three different places, do not mix them up:

1. **Google client → Authorized redirect URIs** (Google → Supabase). Exactly one:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
2. **Supabase → Authentication → Providers → Google:** enable it, paste the Client ID and Client secret.
3. **Supabase → Authentication → URL Configuration** (Supabase → your app):
   - *Site URL:* `https://YOUR-SITE.netlify.app`
   - *Redirect URLs:*
     - `http://localhost:8081/auth/callback`
     - `https://YOUR-SITE.netlify.app/auth/callback`
     - `hbplusportal://auth/callback` (Android/iOS builds, scheme from `app.json`)

Also in Supabase: **turn off the Email provider** (Google should be the only sign-in method) and leave anonymous sign-ins off. Keep **"Allow new users to sign up" enabled**: Google sign-in creates the account on first login, and the database trigger is what rejects non-company users.

**Apply the database migration** (this is the server-side domain enforcement): paste `supabase/migrations/20260101000000_enforce_hbplus_domain.sql` into the Supabase **SQL Editor** and run it (or use the Supabase CLI: `supabase link` then `supabase db push`).

## 12. Android configuration

- Package: `fit.hbplus.portal` (`app.json → expo.android.package`).
- URL scheme `hbplusportal` (`app.json → expo.scheme`) is turned into the Android intent filter by Expo.
- Google credential: the **same Web client**. Because Google is reached through the system browser via Supabase, no Android client and no SHA-1 fingerprint are needed.
- Add `hbplusportal://auth/callback` to the Supabase Redirect URLs (section 11).

## 13. iOS configuration

- Bundle identifier: `fit.hbplus.portal` (`app.json → expo.ios.bundleIdentifier`).
- URL scheme `hbplusportal` is registered by Expo from `app.json`.
- Google credential: the same Web client; no iOS client ID needed for this flow.
- Same Supabase redirect URL as Android.

## 14. Authentication flow, step by step

1. User presses **Sign in with Google** (button disabled and shows "Signing in…"; duplicate requests are ignored).
2. `signInWithOAuth` starts a PKCE flow. Web: full-page redirect. Native: `expo-web-browser` opens a system auth session.
3. Google authenticates the user and returns to Supabase, which returns a one-time code to `/auth/callback` (web) or `hbplusportal://auth/callback` (native).
4. The code is exchanged for a session (`exchangeCodeForSession` on native; automatic on web).
5. `verifyCurrentUser()` asks the **Auth server** for the user (`getUser()`).
6. `authorizeUser()` checks: email present, **exact domain**, **verified**, **Google provider**.
7. Authorized → dashboard. Otherwise the session is ended (`signOut({scope:'local'})`, with local cleanup as a fallback) and the error is shown.

## 15. How the `hbplus.fit` restriction works

Three layers:

1. **Database trigger** (`enforce_allowed_email_domain`): Supabase will not create (or change to) a user whose email domain is not exactly `hbplus.fit`. Non-company accounts never get a session.
2. **Row Level Security** (`is_authorized_member()`): data is returned only to a user whose `auth.users` record has a confirmed `hbplus.fit` email and the Google provider.
3. **Client check** (`isAllowedEmailDomain`): the email is trimmed and lower-cased, split on exactly one `@`, and the **whole domain is compared for equality**. No `includes`/`endsWith`.

| Email | Result |
|---|---|
| `user@hbplus.fit`, `USER@HBPLUS.FIT` | accepted |
| `user@gmail.com`, `user@not-hbplus.fit` | rejected |
| `user@hbplus.fit.attacker.com`, `user@sub.hbplus.fit` | rejected |
| missing / malformed / `a@evil.com@hbplus.fit` | rejected |

The `hd=hbplus.fit` parameter sent to Google only pre-selects the company account in Google's chooser. It is a UX hint, **not** a security control.

## 16. Why unverified or unauthorized emails are rejected

An email string alone proves nothing: an unverified address could belong to someone else. The app requires `email_confirmed_at`, which Supabase sets only when Google reports the address as verified, and RLS re-checks it from `auth.users` (not from `user_metadata`, which users can edit). Wrong-domain accounts are denied by the trigger and, as a backstop, by the client check, with the exact message above.

## 17. Session persistence, logout and protected routes

- **Persistence:** web uses browser `localStorage` (Supabase default); native uses Keychain/Keystore via `expo-secure-store` (chunked, device-bound, readable only when unlocked). Tokens refresh automatically; refresh is paused while the native app is backgrounded.
- **Restore on launch:** the loading screen shows while the session is validated with the server. The navigator mounts only afterwards, so refreshing `/dashboard` keeps you on `/dashboard`.
- **Logout:** revokes this device's session on the server and clears local storage. If the server is unreachable the device session is still cleared and a notice is shown.
- **Protected routes:** `Stack.Protected` removes the dashboard while signed out (direct URLs redirect to `/login`) and removes `/login` while signed in. This is user experience, not security; the data layer is protected by RLS.
- **Expired/revoked session:** an SDK sign-out event returns the user to login with "session has expired".

## 18. Security considerations and limitations

- **Secrets:** none in the repo. Only public Supabase settings are used client-side (the production bundle was checked: it contains the publishable key and URL only; supabase-js itself refuses to run in a browser with a `sb_secret_` key). `.env*` (except `.env.example`), keys, certificates, `google-services.json` and `GoogleService-Info.plist` are git-ignored; this was tested with decoy files.
- **No token or raw-error logging:** there is no `console` call in `src/`; errors are reduced to fixed, safe messages (tested).
- **Web sessions live in `localStorage`, which is readable by any script running on the page, so a cross-site-scripting (XSS) bug would let an attacker steal the session.** It is not safe from XSS. What reduces the risk: PKCE (the URL code alone is useless), short-lived access tokens with refresh-token rotation, no inline scripts in the built page, no user-generated HTML anywhere in the app, and no third-party scripts. `netlify.toml` also sends HSTS, `X-Frame-Options`, `nosniff` and a **Content-Security-Policy in Report-Only mode**. It is report-only because it could not be tested in a browser here: deploy, open the site, check the console for `Content-Security-Policy-Report-Only` violations, then rename the header to `Content-Security-Policy` to enforce it. If you need stronger protection than this, put the session in an HttpOnly cookie via a server-side proxy (not implemented).
- **Native deep link:** custom URL schemes can be claimed by other apps on Android. PKCE means an intercepted `code` cannot be exchanged without the verifier held in the app's secure storage. Claimed (HTTPS) app links would be stronger but are not configured.
- **Redirect handling:** the app only sends `redirectTo` values on your own origin/scheme, and Supabase rejects any redirect that is not in its allow-list (section 11). Keep that list minimal; never add wildcards like `*` for production.
- **Client route protection alone does not secure a backend;** the database policies do. The app does not currently have other tables or an API, so `profiles` is the only protected data.
- **Existing unauthorized users:** the migration does not delete users created *before* it was applied. They are still blocked: the app's own check rejects them and signs them out, and RLS returns them no rows (tested with a legacy Gmail account). Delete them anyway (SQL is provided, commented out, at the end of the migration).
- **If the migration is not applied,** a Gmail user can still complete OAuth and an `auth.users` row is created, but the app immediately ends their session and shows the denial. Apply the migration so the row is never created.
- **Service-role key:** never used or referenced by the app; the app only talks to Supabase with the publishable key under RLS.

## 19. Run on web

```bash
npm run web          # dev server on http://localhost:8081
npm run build:web    # production build into dist/
```

## 20. Run on Android

Recommended (supports the `hbplusportal://` deep link): a development build. Needs Android Studio and an emulator or device.

```bash
npx expo run:android
```

Expo Go is *possible* but its redirect URL is an `exp://…` address that must also be added to the Supabase Redirect URLs; this path has not been tried.

## 21. Run on iOS

Needs macOS with Xcode:

```bash
npx expo run:ios
```

## 22. Testing and building

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (ESLint)
npm test            # Jest
npm run check       # all three
npm run build:web   # Expo web export (uses --clear so environment variables are always re-inlined)
npm run doctor      # expo-doctor (needs internet access to exp.host)
```

**Results from the build environment:**

| Check | Result |
|---|---|
| `tsc --noEmit` | passed |
| `expo lint` | passed |
| Jest | 7 suites, **137 tests passed** |
| `expo export --platform web` | passed |
| `expo export --platform android` / `ios` | bundles compile (this does **not** mean they were run on a device) |
| `expo-doctor` | 19/21 passed; the other 2 could not run offline (no access to `exp.host`) |
| SQL migration + SQL tests on PostgreSQL 16 | passed (see below) |

What the Jest tests cover (the identity provider is mocked **only in tests**):

- Domain validation: all required cases plus homoglyph, newline-injection, trailing-dot, zero-width and double-`@` inputs.
- Authorization: Gmail/other/look-alike/suffix/subdomain rejected; unverified, missing email and non-Google provider rejected; user-editable metadata cannot grant verification.
- Auth flows: successful login, domain rejection (session ended), unverified, missing email, user cancellation, network error, failed code exchange without leaking the message, session restore, a session the server rejects, a locally edited email being ignored, server unreachable, logout success and failure.
- State: loading → authenticated, duplicate sign-in blocked, redirect state, SDK events (sign-out, forced sign-out, cross-tab sign-in, token refresh).
- Real route files: direct `/dashboard` and `/dashboard/account` without a session redirect to `/login`; refresh keeps the URL; dashboard unreachable after logout; login at 360/768/1280 px; sidebar vs header.
- Secure storage adapter (chunking, corruption, cleanup).

SQL tests (`supabase/tests/`) were run against a **plain PostgreSQL 16 with a stand-in `auth` schema**, not against real Supabase:

```bash
psql -d yourdb -f supabase/tests/00_stub_supabase_auth.sql      # stand-in auth schema (test DB only!)
psql -d yourdb -f supabase/migrations/20260101000000_enforce_hbplus_domain.sql
psql -d yourdb -f supabase/tests/10_signup_trigger.sql
psql -d yourdb -f supabase/tests/20_row_level_security.sql
```

## 23. Deployment (Netlify)

Netlify is compatible: the web build is a static single-page app (`app.json → web.output = "single"`) and `netlify.toml` already contains the build command (`npx expo export --platform web`), publish directory (`dist`), Node 22, a catch-all rewrite to `index.html` (so refreshing `/dashboard` works) and basic security headers.

1. Push to GitHub (section below).
2. Netlify → **Add new site → Import an existing project** → pick the repo. Build settings are read from `netlify.toml`.
3. **Site configuration → Environment variables:** add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`. They are baked in at build time, so redeploy after changing them.
4. Deploy, then copy the site URL.
5. Add the URL to: Google client **JavaScript origins**, Supabase **Site URL** and **Redirect URLs** (`https://YOUR-SITE.netlify.app/auth/callback`).
6. Verify on the live site: sign in with an `@hbplus.fit` account (works), with a Gmail account (shows the exact message), refresh `/dashboard`, open `/dashboard` in a private window (redirects to login), log out, check the browser console for errors.

### GitHub

Create an **empty** repository on github.com first (no README/licence), then:

```bash
git init -b main
git add .
git status          # confirm there is no .env, node_modules/ or dist/
git commit -m "HB+ Team Portal: Google sign-in restricted to hbplus.fit"
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

## 24. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `redirect_uri_mismatch` from Google | The Google client's redirect URI must be exactly `https://<ref>.supabase.co/auth/v1/callback`. |
| After Google, you land on the Supabase Site URL instead of the app | The `redirectTo` is not in Supabase **Redirect URLs** (section 11). Match scheme, host and path exactly. |
| Native browser opens but never returns to the app | `hbplusportal://auth/callback` missing from Redirect URLs, or the app was built before `scheme` was set. Rebuild the dev build. |
| Login page says "Sign-in is not configured correctly" | `.env` is missing/placeholder, or on Netlify the variables were not set before the build. |
| A company user gets the restriction message | Check Supabase → Logs → Postgres; the app cannot tell a trigger rejection from another sign-up database failure (see limitations). |
| `invalid_client` / `unauthorized_client` | Client ID/secret in Supabase do not match the Google client, or the consent screen is not published for External users. |
| "Access blocked: app not verified" | External consent screen in *Testing*: add the user as a test user or publish the app. |
| Refreshing `/dashboard` on Netlify gives 404 | The rewrite in `netlify.toml` is missing or the file was not deployed. |
| "profile record could not be read" on Account | The migration has not been applied. |
| Local web build says sign-in is "not configured" although `.env` is set | Metro cached an earlier build made without the variables. Run `npm run build:web` (it passes `--clear`) or `npx expo start --clear`. |
| Restriction message followed by "contact your administrator" | Supabase returned only the generic "Database error saving new user". That is the normal result for a rejected non-company account, but it can also be an unrelated database failure: check Supabase → Logs → Postgres. |

## 25. Known limitations

**What the automated tests do and do not prove**

| Layer | Proven by | Not proven |
|---|---|---|
| Domain, authorization, error mapping, storage adapter | Jest unit tests | n/a (pure logic) |
| Sign-in, restore, logout, cancel, network | Jest with a **mocked** Supabase client | That the real SDK/Supabase/Google behave as the mock assumes (e.g. exact error shapes, `email_confirmed_at` being set for Google users, `app_metadata.provider` being `google`) |
| Route protection, refresh, responsive layout | Jest with the **real route files** in a simulated React Native renderer | Real browser behaviour (Netlify rewrite, browser history, `pageshow`/bfcache), visual layout, touch targets on a device |
| SQL trigger and RLS | Plain **PostgreSQL 16** with a hand-written stand-in for the `auth` schema | The real Supabase `auth` schema, GoTrue's insert order (whether `raw_app_meta_data` and `email_confirmed_at` are populated when the `BEFORE INSERT` trigger fires), real JWT/PostgREST roles, and what error text GoTrue returns to the app |
| Native | Bundles compile; generated Android manifest/iOS plist inspected | Any run on an emulator/device, deep-link return, Keychain/Keystore storage |

**Other limitations**

- **No live end-to-end test** with real Google/Supabase credentials was possible (no credentials, no browser).
- **Ambiguous rejection message.** Supabase normally reports a trigger rejection to the app only as "Database error saving new user". The app shows the required message for it *with an added hint line* ("contact your administrator"), because an unrelated database failure would produce the same text. Network failures and provider errors never take this path.
- **Trigger checks the domain only.** It deliberately does not check verification or provider at insert time because GoTrue's insert ordering could not be verified here; getting that wrong would block every login. Verification and provider are enforced by RLS (from `auth.users`) and by the app. Users without an email (anonymous/phone) are rejected by the trigger.
- **Offline start:** a stored session is not trusted without server confirmation, so opening the app offline shows a network message (the session is kept and works once online). A rate-limit or other transient server error likewise does not sign anyone out.
- **Single domain, no subdomains,** by policy. Change `ALLOWED_EMAIL_DOMAIN` and the SQL domain together.
- **Light theme only.** The app icon and splash images are the Expo template placeholders; replace `assets/images/*` with HB+ artwork before publishing to stores.
- The Account page's "server-side access check" reads the `profiles` table and shows a hint if the migration was not applied.
