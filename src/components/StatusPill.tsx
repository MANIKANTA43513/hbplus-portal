import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/constants/theme';

export function StatusPill({ label, tone = 'success', testID }: { label: string; tone?: 'success' | 'neutral'; testID?: string }) {
  const success = tone === 'success';
  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: success ? colors.successBg : colors.bone }]}
    >
      <Text style={[typography.smallStrong, { color: success ? colors.success : colors.inkMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
