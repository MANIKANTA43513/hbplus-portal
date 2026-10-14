import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/Card';
import { DetailRow } from '@/components/DetailRow';
import { PageContainer } from '@/components/PageContainer';
import { StatusPill } from '@/components/StatusPill';
import { ALLOWED_EMAIL_DOMAIN } from '@/constants/auth';
import { colors, spacing, type as typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

function formatDate(iso: string | null): string {
  if (!iso) return 'Not available';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AccountScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return <AccountDetails userId={user.id} />;
}

function AccountDetails({ userId }: { userId: string }) {
  const { user } = useAuth();
  const profile = useProfile(userId);
  if (!user) return null;

  return (
    <PageContainer>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.ink }]}>
        Account
      </Text>

      <Card title="Sign-in details" testID="account-details">
        <DetailRow label="Name" value={user.name} />
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Sign-in method" value="Google" />
        <DetailRow label="Email verification">
          <StatusPill label="Verified by Google" />
        </DetailRow>
        <DetailRow label="Allowed domain" value={ALLOWED_EMAIL_DOMAIN} />
        <DetailRow label="Last sign-in" value={formatDate(user.lastSignInAt)} />
      </Card>

      <Card title="Server-side access check" testID="server-check">
        <Text style={[typography.body, { color: colors.inkMuted }]}>
          Company data is protected by database policies that apply the same domain and verified-email
          rules, independent of this app.
        </Text>
        {profile.status === 'loading' ? (
          <Text style={[typography.small, { color: colors.inkMuted }]}>Checking…</Text>
        ) : profile.status === 'ready' && profile.profile ? (
          <>
            <StatusPill label="Confirmed by the database" />
            <DetailRow label="Member since" value={formatDate(profile.profile.createdAt)} />
          </>
        ) : (
          <Text style={[typography.small, styles.muted]}>
            The profile record could not be read. If you are the administrator, make sure the database
            migration in supabase/migrations has been applied.
          </Text>
        )}
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.inkMuted, marginTop: spacing.xs },
});
