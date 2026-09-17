import { Platform } from 'react-native';

export const colors = {
  teal: '#0E7C7C',
  tealDark: '#0A5E5E',
  tealDeep: '#0A4A4A',
  tealTint: '#E4F2F1',
  orange: '#E8622C',
  orangeTint: '#FDE8E0',
  ink: '#16263D',
  inkMuted: '#5B6B7C',
  cloud: '#F3F7F6',
  card: '#FFFFFF',
  line: '#E1E8E6',
  danger: '#A63232',
  success: '#24704D',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 26,
  xxxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 20,
  brand: 22,
  pill: 999,
} as const;

export const controlHeights = {
  compact: 44,
  default: 54,
  phone: 58,
} as const;

export const typeScale = {
  eyebrow: 11,
  caption: 12,
  bodySmall: 13.5,
  body: 15,
  button: 15,
  title: 26,
  display: 34,
} as const;

export const shadows = {
  button: Platform.select({
    ios: {
      shadowColor: colors.teal,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    default: { elevation: 3 },
  }),
  card: Platform.select({
    ios: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    default: { elevation: 2 },
  }),
} as const;

