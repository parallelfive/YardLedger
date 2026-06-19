import { useWindowDimensions } from 'react-native';

// Width breakpoints (dp). Phones below `tablet`; counter tablets and small
// landscape between; desktop browsers above. `useWindowDimensions` updates live
// on web resize, so consumers re-render as the window changes.
export const breakpoints = {
  tablet: 600,
  desktop: 1024,
} as const;

// Max content width for centered, readable columns on wide screens. Forms and
// single-column reading flows cap here so they don't stretch the full browser
// width on desktop; full-bleed layouts opt out by ignoring `contentMaxWidth`.
export const contentMaxWidth = 640;

export interface Responsive {
  width: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Tablet or wider — the threshold for centered, capped content columns. */
  isWide: boolean;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isTablet = width >= breakpoints.tablet && width < breakpoints.desktop;
  const isDesktop = width >= breakpoints.desktop;
  return {
    width,
    isPhone: width < breakpoints.tablet,
    isTablet,
    isDesktop,
    isWide: width >= breakpoints.tablet,
  };
}
