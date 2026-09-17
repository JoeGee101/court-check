import { getSupabaseClient } from '@/lib/supabase/client';
import type { CourtCheckProfile, ExperienceLevel } from '@/types/user';

type UpdateMyProfileInput = {
  email: string | null;
  experienceLevel: ExperienceLevel;
};

export async function updateMyProfile({
  email,
  experienceLevel,
}: UpdateMyProfileInput): Promise<CourtCheckProfile> {
  const { data, error } = await getSupabaseClient()
    .rpc('update_my_profile', {
      p_email: email,
      p_experience: experienceLevel,
    })
    .maybeSingle<CourtCheckProfile>();

  if (error || !isCourtCheckProfile(data)) {
    throw new Error('Profile update failed.');
  }

  return data;
}

function isCourtCheckProfile(value: CourtCheckProfile | null): value is CourtCheckProfile {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.anonymous_username === 'string' &&
      isExperienceLevel(value.experience_level) &&
      (typeof value.email === 'string' || value.email === null) &&
      typeof value.created_at === 'string' &&
      typeof value.updated_at === 'string',
  );
}

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return (
    value === 'newbie' ||
    value === 'beginner' ||
    value === 'intermediate' ||
    value === 'advanced' ||
    value === 'pro'
  );
}
