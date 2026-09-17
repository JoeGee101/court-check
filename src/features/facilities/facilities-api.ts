import { getSupabaseClient } from '@/lib/supabase/client';
import type { ExperienceLevel } from '@/types/user';

export type FacilityActivityState =
  | 'courts_closed'
  | 'maintenance'
  | 'courts_wet_unsafe'
  | 'tournament_at_courts'
  | 'courts_full'
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
  activity_reporter_count: number;
};

export type FacilityDetailPlayer = {
  anonymousUsername: string;
  experienceLevel: ExperienceLevel;
};

export type FacilityStatusType =
  | 'courts_closed'
  | 'maintenance'
  | 'courts_wet_unsafe'
  | 'tournament_at_courts'
  | 'courts_full';

export type FacilityDetailStatus = {
  type: FacilityStatusType;
  reporterCount: number;
  latestReportedAt: string;
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
  'maintenance',
  'courts_wet_unsafe',
  'tournament_at_courts',
  'courts_full',
]);
const FACILITY_ACTIVITY_STATES = new Set<FacilityActivityState>([
  'courts_closed',
  'maintenance',
  'courts_wet_unsafe',
  'tournament_at_courts',
  'courts_full',
  'active',
  'quiet',
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

  if (error || !Array.isArray(data) || !data.every(isFacilitySummary)) {
    throw new Error('Facility list request failed.');
  }

  return data;
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

function isFacilitySummary(value: unknown): value is FacilitySummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isValidFacilityId(value.id) &&
    typeof value.name === 'string' &&
    typeof value.address === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.hours_text === 'string' &&
    Number.isInteger(value.court_count) &&
    typeof value.has_lights === 'boolean' &&
    typeof value.has_restrooms === 'boolean' &&
    typeof value.has_water === 'boolean' &&
    (typeof value.verified_by === 'string' || value.verified_by === null) &&
    Number.isInteger(value.active_check_in_count) &&
    typeof value.active_check_in_count === 'number' &&
    value.active_check_in_count >= 0 &&
    typeof value.activity_state === 'string' &&
    FACILITY_ACTIVITY_STATES.has(value.activity_state as FacilityActivityState) &&
    Number.isInteger(value.activity_reporter_count) &&
    typeof value.activity_reporter_count === 'number' &&
    value.activity_reporter_count >= 0
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
    Number.isInteger(value.reporterCount) &&
    typeof value.reporterCount === 'number' &&
    value.reporterCount > 0 &&
    typeof value.latestReportedAt === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
