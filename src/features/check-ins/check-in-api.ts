import { isValidFacilityId } from '@/features/facilities/facilities-api';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { CheckInCoordinates } from '@/lib/location';

export type CheckInErrorCode =
  | 'outside-geofence'
  | 'already-checked-in'
  | 'facility-unavailable'
  | 'account-required'
  | 'session-required'
  | 'invalid-location'
  | 'unknown';

export class CheckInError extends Error {
  constructor(readonly code: CheckInErrorCode) {
    super('Check-in failed.');
    this.name = 'CheckInError';
  }
}

type CheckInResult = {
  id: string;
  facility_id: string;
  checked_in_at: string;
  expires_at: string;
};

export async function checkInAtFacility(
  facilityId: string,
  coordinates: CheckInCoordinates,
): Promise<void> {
  if (!isValidFacilityId(facilityId) || !areValidCoordinates(coordinates)) {
    throw new CheckInError('invalid-location');
  }

  const normalizedFacilityId = facilityId.toLowerCase();
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('check_in', {
    p_facility_id: normalizedFacilityId,
    p_latitude: coordinates.latitude,
    p_longitude: coordinates.longitude,
  });

  if (error) {
    throw mapDatabaseError(error.code, error.message);
  }

  if (!isCheckInResult(data, normalizedFacilityId)) {
    throw new CheckInError('unknown');
  }
}

function mapDatabaseError(code: string | undefined, message: string | undefined): CheckInError {
  if (code === 'P0002') {
    return new CheckInError('facility-unavailable');
  }

  if (code === '23505') {
    return new CheckInError('already-checked-in');
  }

  if (code === '22023') {
    return new CheckInError('invalid-location');
  }

  if (code === '42501') {
    if (message === 'Outside facility geofence') {
      return new CheckInError('outside-geofence');
    }

    if (message === 'Completed phone-verified account required') {
      return new CheckInError('account-required');
    }

    if (message === 'Authentication required') {
      return new CheckInError('session-required');
    }
  }

  return new CheckInError('unknown');
}

function areValidCoordinates(coordinates: CheckInCoordinates) {
  return (
    Number.isFinite(coordinates.latitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

function isCheckInResult(value: unknown, facilityId: string): value is [CheckInResult] {
  if (!Array.isArray(value) || value.length !== 1) {
    return false;
  }

  const row: unknown = value[0];

  return (
    isRecord(row) &&
    typeof row.id === 'string' &&
    typeof row.facility_id === 'string' &&
    row.facility_id.toLowerCase() === facilityId &&
    typeof row.checked_in_at === 'string' &&
    typeof row.expires_at === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
