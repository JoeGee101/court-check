import { isValidFacilityId } from '@/features/facilities/facilities-api';
import { getSupabaseClient } from '@/lib/supabase/client';

export type AdminFacilitySummary = {
  id: string;
  name: string;
  address: string;
  court_count: number;
  is_active: boolean;
  verified_by: string | null;
  updated_at: string;
};

export type AdminFacilityGeofence = {
  latitude: number;
  longitude: number;
  radiusM: number;
};

export type AdminFacilityDetail = {
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
  geofence: AdminFacilityGeofence | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveAdminFacilityInput = {
  facilityId: string | null;
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
  geofenceLatitude: number;
  geofenceLongitude: number;
  geofenceRadiusM: number;
};

export class AdminFacilityMissingGeofenceError extends Error {
  constructor() {
    super('A check-in geofence is required before activation.');
    this.name = 'AdminFacilityMissingGeofenceError';
  }
}

export class AdminFacilityNotFoundError extends Error {
  constructor() {
    super('Facility not found.');
    this.name = 'AdminFacilityNotFoundError';
  }
}

export class AdminFacilityHasHistoryError extends Error {
  constructor() {
    super('The facility has player activity history.');
    this.name = 'AdminFacilityHasHistoryError';
  }
}

export async function listAdminFacilities(): Promise<AdminFacilitySummary[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('facilities')
    .select('id,name,address,court_count,is_active,verified_by,updated_at')
    .order('name', { ascending: true });

  if (error || !Array.isArray(data) || !data.every(isAdminFacilitySummary)) {
    throw new Error('Admin facility list request failed.');
  }

  return data;
}

export async function setAdminFacilityActive(
  facilityId: string,
  isActive: boolean,
): Promise<void> {
  if (!isValidFacilityId(facilityId)) {
    throw new Error('Invalid facility identifier.');
  }

  const client = getSupabaseClient();
  const { error } = await client.rpc('admin_set_facility_active', {
    p_facility_id: facilityId,
    p_is_active: isActive,
  });

  if (error?.code === '23514') {
    throw new AdminFacilityMissingGeofenceError();
  }

  if (error) {
    throw new Error('Admin facility state request failed.');
  }
}

export async function deleteAdminFacility(facilityId: string): Promise<void> {
  if (!isValidFacilityId(facilityId)) {
    throw new AdminFacilityNotFoundError();
  }

  const client = getSupabaseClient();
  const { error } = await client.rpc('admin_delete_facility', {
    p_facility_id: facilityId,
  });

  if (error?.code === '23503') {
    throw new AdminFacilityHasHistoryError();
  }

  if (error?.code === 'P0002') {
    throw new AdminFacilityNotFoundError();
  }

  if (error) {
    throw new Error('Admin facility deletion request failed.');
  }
}

export async function getAdminFacility(facilityId: string): Promise<AdminFacilityDetail> {
  if (!isValidFacilityId(facilityId)) {
    throw new AdminFacilityNotFoundError();
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('admin_get_facility', {
    p_facility_id: facilityId,
  });

  if (error?.code === 'P0002') {
    throw new AdminFacilityNotFoundError();
  }

  if (error || !isAdminFacilityDetail(data)) {
    throw new Error('Admin facility detail request failed.');
  }

  return data;
}

export async function saveAdminFacility(input: SaveAdminFacilityInput): Promise<string> {
  if (input.facilityId !== null && !isValidFacilityId(input.facilityId)) {
    throw new AdminFacilityNotFoundError();
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('admin_save_facility', {
    p_facility_id: input.facilityId,
    p_name: input.name,
    p_address: input.address,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_hours_text: input.hoursText,
    p_court_count: input.courtCount,
    p_has_lights: input.hasLights,
    p_has_restrooms: input.hasRestrooms,
    p_has_water: input.hasWater,
    p_is_active: input.isActive,
    p_verified_by: input.verifiedBy,
    p_geofence_latitude: input.geofenceLatitude,
    p_geofence_longitude: input.geofenceLongitude,
    p_geofence_radius_m: input.geofenceRadiusM,
  });

  if (error?.code === 'P0002') {
    throw new AdminFacilityNotFoundError();
  }

  if (error || typeof data !== 'string' || !isValidFacilityId(data)) {
    throw new Error('Admin facility save request failed.');
  }

  return data;
}

function isAdminFacilitySummary(value: unknown): value is AdminFacilitySummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isValidFacilityId(value.id) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&
    typeof value.court_count === 'number' &&
    Number.isInteger(value.court_count) &&
    value.court_count >= 0 &&
    typeof value.is_active === 'boolean' &&
    (typeof value.verified_by === 'string' || value.verified_by === null) &&
    typeof value.updated_at === 'string'
  );
}

function isAdminFacilityDetail(value: unknown): value is AdminFacilityDetail {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    isValidFacilityId(value.id) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&
    isLatitude(value.latitude) &&
    isLongitude(value.longitude) &&
    typeof value.hoursText === 'string' &&
    value.hoursText.trim().length > 0 &&
    typeof value.courtCount === 'number' &&
    Number.isInteger(value.courtCount) &&
    value.courtCount >= 0 &&
    typeof value.hasLights === 'boolean' &&
    typeof value.hasRestrooms === 'boolean' &&
    typeof value.hasWater === 'boolean' &&
    typeof value.isActive === 'boolean' &&
    (typeof value.verifiedBy === 'string' || value.verifiedBy === null) &&
    (value.geofence === null || isAdminFacilityGeofence(value.geofence)) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isAdminFacilityGeofence(value: unknown): value is AdminFacilityGeofence {
  return (
    isRecord(value) &&
    isLatitude(value.latitude) &&
    isLongitude(value.longitude) &&
    typeof value.radiusM === 'number' &&
    Number.isInteger(value.radiusM) &&
    value.radiusM >= 10 &&
    value.radiusM <= 1000
  );
}

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
