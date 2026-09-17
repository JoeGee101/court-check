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

export class AdminFacilityMissingGeofenceError extends Error {
  constructor() {
    super('A check-in geofence is required before activation.');
    this.name = 'AdminFacilityMissingGeofenceError';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
