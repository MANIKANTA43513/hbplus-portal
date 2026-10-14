import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/constants/theme';

export function LoadingScreen({ label = 'Restoring your session…' }: { label?: string }) {
  return (
    <View style={styles.container} testID="loading-screen" accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.pine} />
      <Text style={[typography.body, { color: colors.inkMuted }]} accessibilityLiveRegion="polite">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.bone,
  },
});
