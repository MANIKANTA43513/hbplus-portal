import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'medium' | 'wide';

export const BREAKPOINTS = { medium: 600, wide: 960 } as const;

/** Phone / tablet / desktop layout bucket based on the current window width. */
export function useBreakpoint(): { width: number; size: Breakpoint; isWide: boolean } {
  const { width } = useWindowDimensions();
  const size: Breakpoint =
    width >= BREAKPOINTS.wide ? 'wide' : width >= BREAKPOINTS.medium ? 'medium' : 'compact';
  return { width, size, isWide: size === 'wide' };
}
