import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { DetailRow } from '@/components/DetailRow';
import { PageContainer } from '@/components/PageContainer';
import { StatusPill } from '@/components/StatusPill';
import { ALLOWED_EMAIL_DOMAIN } from '@/constants/auth';
import { colors, spacing, type as typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/use-breakpoint';

export default function DashboardOverview() {
  const { user } = useAuth();
  const { isWide } = useBreakpoint();
  if (!user) return null;

  const firstName = user.name.split(/\s+/)[0];

  return (
    <PageContainer>
      <View style={styles.heading}>
        <Text testID="welcome-message" accessibilityRole="header" style={[typography.title, { color: colors.ink }]}>
          Welcome, {firstName}
        </Text>
        <Text style={[typography.body, { color: colors.inkMuted }]}>
          You are signed in to the HB+ Team Portal.
        </Text>
      </View>

      <View style={[styles.grid, isWide && styles.gridWide]}>
        <Card title="Your account" style={styles.cell} testID="account-card">
          <View style={styles.identity}>
            <Avatar name={user.name} uri={user.avatarUrl} size={64} />
            <View style={{ flex: 1 }}>
              <Text testID="user-name" style={[typography.heading, { color: colors.ink }]}>
                {user.name}
              </Text>
              <Text testID="user-email" style={[typography.body, { color: colors.inkMuted }]}>
                {user.email}
              </Text>
            </View>
          </View>
          <DetailRow label="Authentication status">
            <StatusPill testID="auth-status" label="Signed in with Google" />
          </DetailRow>
          <DetailRow label="Email">
            <StatusPill label="Verified" />
          </DetailRow>
          <DetailRow label="Company domain" value={ALLOWED_EMAIL_DOMAIN} />
        </Card>

        <Card title="Team activity" style={styles.cell} testID="empty-state">
          <Text style={[typography.bodyStrong, { color: colors.ink }]}>Nothing to show yet</Text>
          <Text style={[typography.body, { color: colors.inkMuted }]}>
            Team data will appear here once it is connected to this portal. Until then, you can review
            how your sign-in is protected.
          </Text>
          <Link href="/dashboard/account" style={[typography.bodyStrong, { color: colors.pine }]}>
            Review account security
          </Link>
        </Card>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  grid: { gap: spacing.xl },
  gridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
