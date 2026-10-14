import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type as typography } from '@/constants/theme';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.ink }]}>
        Page not found
      </Text>
      <Text style={[typography.body, { color: colors.inkMuted }]}>This page does not exist.</Text>
      <Link href="/" style={[typography.bodyStrong, { color: colors.pine }]}>
        Go to the start page
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.bone },
});
