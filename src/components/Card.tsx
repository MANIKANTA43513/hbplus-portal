import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, type as typography } from '@/constants/theme';

interface CardProps {
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ title, children, style, testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {title ? (
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.ink }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
