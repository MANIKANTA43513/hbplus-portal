import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Scrollable, width-limited content area for dashboard pages. */
export function PageContainer({ children }: { children: ReactNode }) {
  const { size } = useBreakpoint();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, size === 'compact' && styles.contentCompact]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bone },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  contentCompact: { padding: spacing.lg },
});
