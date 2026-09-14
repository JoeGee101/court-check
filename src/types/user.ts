export type UserRole = 'user' | 'admin';

export type ExperienceLevel =
  | 'newbie'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'pro';

export type CourtCheckProfile = {
  id: string;
  anonymous_username: string;
  experience_level: ExperienceLevel | null;
  email: string | null;
  adult_confirmed_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};
