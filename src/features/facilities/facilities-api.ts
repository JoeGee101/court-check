import { getSupabaseClient } from '@/lib/supabase/client';
import type { ExperienceLevel } from '@/types/user';

export type FacilityActivityState =
  | 'courts_closed'
  | 'tournament_at_courts'
  | 'active'
  | 'quiet';

export type FacilitySummary = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  hours_text: string;
  court_count: number;
  has_lights: boolean;
  has_restrooms: boolean;
  has_water: boolean;
  verified_by: string | null;
  active_check_in_count: number;
  activity_state: FacilityActivityState;
};

export type FacilityDetailPlayer = {
  anonymousUsername: string;
  experienceLevel: ExperienceLevel;
};

export type FacilityDetailStatus = {
  type: 'courts_closed' | 'tournament_at_courts';
  authorUsername: string;
  createdAt: string;
  expiresAt: string;
};

export type FacilityDetail = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  hoursText: string;
  courtCount: number;
  hasLights: boolean;
  hasRestrooms: boolean;
  hasWater: boolean;
  isActive: boolean;
  verifiedBy: string | null;
  activeCheckInCount: number;
  players: FacilityDetailPlayer[];
  statuses: FacilityDetailStatus[];
};

export class FacilityNotFoundError extends Error {
  constructor() {
    super('Facility unavailable.');
    this.name = 'FacilityNotFoundError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPERIENCE_LEVELS = new Set<ExperienceLevel>([
  'newbie',
  'beginner',
  'intermediate',
  'advanced',
  'pro',
]);
const FACILITY_STATUS_TYPES = new Set<FacilityDetailStatus['type']>([
  'courts_closed',
  'tournament_at_courts',
]);

export function isValidFacilityId(value: string | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export async function listFacilities(search: string): Promise<FacilitySummary[]> {
  const client = getSupabaseClient();
  const normalizedSearch = search.trim();
  const { data, error } = await client.rpc('list_facilities', {
    p_search: normalizedSearch || null,
    p_min_latitude: null,
    p_min_longitude: null,
    p_max_latitude: null,
    p_max_longitude: null,
  });

  if (error || !Array.isArray(data)) {
    throw new Error('Facility list request failed.');
  }

  return data as FacilitySummary[];
}

export async function getFacilityDetail(facilityId: string): Promise<FacilityDetail> {
  if (!isValidFacilityId(facilityId)) {
    throw new FacilityNotFoundError();
  }

  const normalizedFacilityId = facilityId.toLowerCase();
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_facility_detail', {
    p_facility_id: normalizedFacilityId,
  });

  if (error?.code === 'P0002') {
    throw new FacilityNotFoundError();
  }

  if (error || !isFacilityDetail(data, normalizedFacilityId)) {
    throw new Error('Facility detail request failed.');
  }

  return data;
}

function isFacilityDetail(value: unknown, facilityId: string): value is FacilityDetail {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.toLowerCase() === facilityId &&
    typeof value.name === 'string' &&
    typeof value.address === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.hoursText === 'string' &&
    typeof value.courtCount === 'number' &&
    typeof value.hasLights === 'boolean' &&
    typeof value.hasRestrooms === 'boolean' &&
    typeof value.hasWater === 'boolean' &&
    typeof value.isActive === 'boolean' &&
    (typeof value.verifiedBy === 'string' || value.verifiedBy === null) &&
    typeof value.activeCheckInCount === 'number' &&
    Array.isArray(value.players) &&
    value.players.every(isFacilityDetailPlayer) &&
    Array.isArray(value.statuses) &&
    value.statuses.every(isFacilityDetailStatus)
  );
}

function isFacilityDetailPlayer(value: unknown): value is FacilityDetailPlayer {
  return (
    isRecord(value) &&
    typeof value.anonymousUsername === 'string' &&
    typeof value.experienceLevel === 'string' &&
    EXPERIENCE_LEVELS.has(value.experienceLevel as ExperienceLevel)
  );
}

function isFacilityDetailStatus(value: unknown): value is FacilityDetailStatus {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    FACILITY_STATUS_TYPES.has(value.type as FacilityDetailStatus['type']) &&
    typeof value.authorUsername === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
