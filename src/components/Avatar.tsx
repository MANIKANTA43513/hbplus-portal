import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, type as typography } from '@/constants/theme';

interface AvatarProps {
  name: string;
  uri: string | null;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Profile photo with an initials fallback when there is no image or it fails to load. */
export function Avatar({ name, uri, size = 48 }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={`Profile photo of ${name}`}
        onError={() => setFailed(true)}
        style={[styles.image, dimension]}
      />
    );
  }
  return (
    <View style={[styles.fallback, dimension]} accessibilityLabel={`Initials for ${name}`}>
      <Text style={[typography.bodyStrong, { color: colors.pine, fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.pineTint },
  fallback: { backgroundColor: colors.pineTint, alignItems: 'center', justifyContent: 'center' },
});
