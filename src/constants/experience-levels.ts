import type { ExperienceLevel } from '@/types/user';

export const EXPERIENCE_LEVEL_OPTIONS = [
  { number: 1, label: 'Newbie', value: 'newbie' },
  { number: 2, label: 'Beginner', value: 'beginner' },
  { number: 3, label: 'Intermediate', value: 'intermediate' },
  { number: 4, label: 'Advanced', value: 'advanced' },
  { number: 5, label: 'Pro', value: 'pro' },
] as const satisfies readonly {
  number: number;
  label: string;
  value: ExperienceLevel;
}[];

export const EXPERIENCE_LEVEL_NUMBERS = Object.fromEntries(
  EXPERIENCE_LEVEL_OPTIONS.map((option) => [option.value, option.number]),
) as Record<ExperienceLevel, number>;

export function formatExperienceLevel(level: ExperienceLevel) {
  const option = EXPERIENCE_LEVEL_OPTIONS.find((item) => item.value === level);
  return option ? `${option.number}-${option.label}` : '';
}
