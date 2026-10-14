import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/constants/theme';

interface DetailRowProps {
  label: string;
  value?: string;
  children?: ReactNode;
  testID?: string;
}

/** A labelled value, used for account and status details. */
export function DetailRow({ label, value, children, testID }: DetailRowProps) {
  return (
    <View testID={testID} style={styles.row}>
      <Text style={[typography.small, styles.label]}>{label}</Text>
      {children ?? <Text style={[typography.bodyStrong, styles.value]}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  label: { color: colors.inkMuted },
  value: { color: colors.ink, flexShrink: 1 },
});
