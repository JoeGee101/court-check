import { getSupabaseClient } from '@/lib/supabase/client';
import type { CourtCheckProfile, ExperienceLevel } from '@/types/user';

type UpdateMyProfileInput = {
  email: string | null;
  experienceLevel: ExperienceLevel;
};

export type PlayTimeSession = {
  facilityName: string;
  checkedInAt: string;
  durationSeconds: number;
  isActive: boolean;
};

export type MyPlayTimeSummary = {
  weeklySeconds: number;
  recentSessions: PlayTimeSession[];
};

export async function getMyPlayTimeSummary(): Promise<MyPlayTimeSummary> {
  const { data, error } = await getSupabaseClient().rpc('get_my_play_time_summary');

  if (error || !isMyPlayTimeSummary(data)) {
    throw new Error('Play time request failed.');
  }

  return data;
}

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

export async function deleteMyAccount(): Promise<void> {
  const { error } = await getSupabaseClient().functions.invoke('delete-account');

  if (error) {
    throw new Error('Account deletion failed.');
  }
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

function isMyPlayTimeSummary(value: unknown): value is MyPlayTimeSummary {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.weeklySeconds) &&
    value.weeklySeconds <= 7 * 24 * 60 * 60 &&
    Array.isArray(value.recentSessions) &&
    value.recentSessions.length <= 3 &&
    value.recentSessions.every(isPlayTimeSession)
  );
}

function isPlayTimeSession(value: unknown): value is PlayTimeSession {
  return (
    isRecord(value) &&
    typeof value.facilityName === 'string' &&
    value.facilityName.trim().length > 0 &&
    typeof value.checkedInAt === 'string' &&
    Number.isFinite(Date.parse(value.checkedInAt)) &&
    isNonNegativeInteger(value.durationSeconds) &&
    value.durationSeconds <= 90 * 60 &&
    typeof value.isActive === 'boolean'
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
