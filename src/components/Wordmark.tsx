import { Text, type TextStyle } from 'react-native';

import { colors } from '@/constants/theme';

interface WordmarkProps {
  size: number;
  color?: string;
  style?: TextStyle;
}

/** The "hb+" brand mark, set as heavy lowercase type. */
export function Wordmark({ size, color = colors.pine, style }: WordmarkProps) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ color, fontSize: size, lineHeight: size * 1.05, fontWeight: '900', letterSpacing: -size * 0.04 }, style]}
    >
      hb+
    </Text>
  );
}
