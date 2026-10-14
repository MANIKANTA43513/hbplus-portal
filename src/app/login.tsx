import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, type BannerTone } from '@/components/Banner';
import { Button } from '@/components/Button';
import { GoogleLogo } from '@/components/GoogleLogo';
import { Wordmark } from '@/components/Wordmark';
import { ALLOWED_EMAIL_DOMAIN, APP_NAME } from '@/constants/auth';
import { colors, radius, spacing, type as typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { authError } from '@/lib/auth-errors';
import type { AuthErrorCode } from '@/types/auth';

const DESCRIPTION = 'The internal workspace for HB Plus staff.';

const TONE_BY_CODE: Partial<Record<AuthErrorCode, BannerTone>> = {
  cancelled: 'info',
  logout: 'warning',
};

export default function LoginScreen() {
  const { signIn, isSigningIn, error, isConfigured } = useAuth();
  const { size, isWide } = useBreakpoint();

  // A misconfigured deployment must be visible even before anyone clicks the button.
  const shownError = error ?? (isConfigured ? null : authError('config'));

  return (
    <View testID={`login-screen-${size}`} style={[styles.root, isWide && styles.rootWide]}>
      {isWide ? (
        <View testID="login-brand-panel" style={styles.brandPanel}>
          <Wordmark size={220} color={colors.pineDark} style={styles.brandMark} />
          <View style={styles.brandCopy}>
            <Text accessibilityRole="header" style={[typography.display, { color: colors.onPine }]}>
              {APP_NAME}
            </Text>
            <Text style={[typography.body, { color: colors.onPineMuted }]}>{DESCRIPTION}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[styles.formContent, size === 'compact' && styles.formContentCompact]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {!isWide ? (
            <View style={styles.compactHeader}>
              <Wordmark size={44} />
              <View style={styles.compactHeaderText}>
                <Text accessibilityRole="header" style={[typography.heading, { color: colors.ink }]}>
                  {APP_NAME}
                </Text>
                <Text style={[typography.small, { color: colors.inkMuted }]}>{DESCRIPTION}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.intro}>
            <Text accessibilityRole="header" style={[typography.title, { color: colors.ink }]}>
              Sign in
            </Text>
            <Text style={[typography.body, { color: colors.inkMuted }]}>
              Continue with your {ALLOWED_EMAIL_DOMAIN} Google account.
            </Text>
          </View>

          {shownError ? (
            <Banner
              testID="auth-error"
              tone={TONE_BY_CODE[shownError.code] ?? 'error'}
              message={shownError.message}
              hint={shownError.hint}
            />
          ) : null}

          <Button
            testID="google-signin-button"
            variant="outline"
            label="Sign in with Google"
            loadingLabel="Signing in…"
            loading={isSigningIn}
            disabled={!isConfigured}
            icon={<GoogleLogo />}
            accessibilityHint="Opens Google to choose your work account"
            onPress={signIn}
          />

          <Banner
            testID="domain-notice"
            tone="info"
            message={`Only official ${ALLOWED_EMAIL_DOMAIN} accounts can sign in. Personal Gmail and other company accounts are not accepted.`}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bone },
  rootWide: { flexDirection: 'row' },
  brandPanel: {
    flex: 1,
    backgroundColor: colors.pine,
    padding: spacing.xxxl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  brandMark: { marginLeft: -spacing.md },
  brandCopy: { gap: spacing.md, maxWidth: 480 },
  formScroll: { flex: 1 },
  formContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  formContentCompact: { padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  compactHeaderText: { flex: 1, gap: spacing.xs },
  intro: { gap: spacing.sm },
});
