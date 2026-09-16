import { getSupabaseClient } from '@/lib/supabase/client';
import type { CourtCheckProfile, ExperienceLevel } from '@/types/user';

type CompleteOnboardingInput = {
  email: string | null;
  experienceLevel: ExperienceLevel;
};

export async function completeOnboarding({
  email,
  experienceLevel,
}: CompleteOnboardingInput) {
  const { data, error } = await getSupabaseClient()
    .rpc('complete_onboarding', {
      p_email: email,
      p_adult_confirmed: true,
      p_experience: experienceLevel,
    })
    .maybeSingle<CourtCheckProfile>();

  if (error || !data) {
    throw new Error('We could not complete your account. Please try again.');
  }

  return data;
}
