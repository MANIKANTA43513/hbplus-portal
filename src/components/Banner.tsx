import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/constants/theme';

export type BannerTone = 'error' | 'warning' | 'info' | 'success';

const TONES: Record<BannerTone, { bg: string; fg: string }> = {
  error: { bg: colors.dangerBg, fg: colors.danger },
  warning: { bg: colors.warningBg, fg: colors.warning },
  info: { bg: colors.infoBg, fg: colors.info },
  success: { bg: colors.successBg, fg: colors.success },
};

interface BannerProps {
  tone: BannerTone;
  message: string;
  hint?: string;
  testID?: string;
}

/** Inline status message. Announced to screen readers when it appears. */
export function Banner({ tone, message, hint, testID }: BannerProps) {
  const { bg, fg } = TONES[tone];
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: bg, borderColor: fg }]}
    >
      <Text style={[typography.small, { color: fg }]}>{message}</Text>
      {hint ? <Text style={[typography.small, { color: fg, marginTop: spacing.xs }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
