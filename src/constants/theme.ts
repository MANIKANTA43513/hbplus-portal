import { Platform, type TextStyle } from 'react-native';

export const colors = {
  bone: '#F4F6F5',
  surface: '#FFFFFF',
  ink: '#10201B',
  inkMuted: '#46564F',
  line: '#D3DCD8',
  pine: '#0D5C4B',
  pineDark: '#08382D',
  pineTint: '#E2F0EB',
  onPine: '#FFFFFF',
  onPineMuted: '#BFDCD3',
  focus: '#1A73E8',
  danger: '#B3261E',
  dangerBg: '#FCECEA',
  warning: '#7A4E00',
  warningBg: '#FFF3D6',
  info: '#1F4E79',
  infoBg: '#E6F0FA',
  success: '#17653A',
  successBg: '#E2F4E9',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

const fontFamily = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

export const type = {
  display: { fontFamily, fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  title: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  small: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  smallStrong: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

/** Minimum comfortable touch target (Apple HIG 44pt / Material 48dp). */
export const TOUCH_TARGET = 48;
