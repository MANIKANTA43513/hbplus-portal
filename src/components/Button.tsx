import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET, type as typography } from '@/constants/theme';

type Variant = 'primary' | 'outline' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  /** Shown instead of `label` while loading. */
  loadingLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  loadingLabel,
  disabled = false,
  icon,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const shownLabel = loading && loadingLabel ? loadingLabel : label;
  const textColor = variant === 'primary' ? colors.onPine : colors.ink;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        focused && styles.focused,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.onPine : colors.pine} /> : icon}
      <Text style={[typography.bodyStrong, { color: textColor }]}>{shownLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  primary: { backgroundColor: colors.pine },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: spacing.md },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.6 },
  focused: { outlineWidth: 3, outlineColor: colors.focus, outlineOffset: 2, outlineStyle: 'solid' },
});
