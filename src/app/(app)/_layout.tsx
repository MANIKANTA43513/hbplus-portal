import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Wordmark } from '@/components/Wordmark';
import { APP_NAME } from '@/constants/auth';
import { colors, radius, spacing, TOUCH_TARGET, type as typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/use-breakpoint';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Account', href: '/dashboard/account' },
] as const;

function NavLink({ label, href, active, onDark }: { label: string; href: string; active: boolean; onDark: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // <Link asChild> requires a flat style object, not an array.
        style={StyleSheet.flatten([
          styles.navLink,
          onDark ? styles.navLinkDark : styles.navLinkLight,
          active && (onDark ? styles.navActiveDark : styles.navActiveLight),
          focused && styles.focused,
        ])}
      >
        <Text
          style={[
            typography.bodyStrong,
            { color: onDark ? colors.onPine : active ? colors.pine : colors.inkMuted },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function AppLayout() {
  const { status, user, signOut } = useAuth();
  const { isWide } = useBreakpoint();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  // Defence in depth: the root layout already removes this group when signed out.
  if (status !== 'authenticated' || !user) return <Redirect href="/login" />;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));

  if (isWide) {
    return (
      <View testID="dashboard-shell-wide" style={styles.shellWide}>
        <View style={styles.sidebar} role="navigation">
          <View style={styles.brandRow}>
            <Wordmark size={40} color={colors.onPine} />
            <Text style={[typography.smallStrong, { color: colors.onPineMuted, flex: 1 }]}>{APP_NAME}</Text>
          </View>

          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} onDark />
            ))}
          </View>

          <View style={styles.sidebarFooter}>
            <View style={styles.userRow}>
              <Avatar name={user.name} uri={user.avatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[typography.smallStrong, { color: colors.onPine }]}>
                  {user.name}
                </Text>
                <Text numberOfLines={1} style={[typography.small, { color: colors.onPineMuted }]}>
                  {user.email}
                </Text>
              </View>
            </View>
            <Button
              testID="logout-button"
              variant="outline"
              label="Sign out"
              loadingLabel="Signing out…"
              loading={signingOut}
              onPress={handleSignOut}
            />
          </View>
        </View>
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View testID="dashboard-shell-compact" style={styles.shellCompact}>
      <View style={styles.topBar} accessibilityRole="header">
        <View style={styles.topBarRow}>
          <Wordmark size={32} />
          <Text numberOfLines={1} style={[typography.smallStrong, { color: colors.ink, flex: 1 }]}>
            {APP_NAME}
          </Text>
          <Avatar name={user.name} uri={user.avatarUrl} size={36} />
          <Button
            testID="logout-button"
            variant="ghost"
            label="Sign out"
            loadingLabel="Signing out…"
            loading={signingOut}
            onPress={handleSignOut}
          />
        </View>
        <View style={styles.topNav} role="navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} onDark={false} />
          ))}
        </View>
      </View>
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellWide: { flex: 1, flexDirection: 'row', backgroundColor: colors.bone },
  shellCompact: { flex: 1, backgroundColor: colors.bone },
  content: { flex: 1 },
  sidebar: {
    width: 264,
    backgroundColor: colors.pine,
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navList: { gap: spacing.xs, flex: 1 },
  sidebarFooter: { gap: spacing.lg },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  topBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topNav: { flexDirection: 'row', gap: spacing.sm },
  navLink: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  navLinkDark: {},
  navLinkLight: { borderBottomWidth: 3, borderBottomColor: 'transparent', borderRadius: 0 },
  navActiveDark: { backgroundColor: colors.pineDark },
  navActiveLight: { borderBottomColor: colors.pine },
  focused: { outlineWidth: 3, outlineColor: colors.focus, outlineOffset: 2, outlineStyle: 'solid' },
});
