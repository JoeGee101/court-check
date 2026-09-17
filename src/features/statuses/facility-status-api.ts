import {
  isValidFacilityId,
  type FacilityStatusType,
} from '@/features/facilities/facilities-api';
import { getSupabaseClient } from '@/lib/supabase/client';

export type FacilityStatusPostErrorCode =
  | 'active-check-in-required'
  | 'account-required'
  | 'facility-unavailable'
  | 'session-required'
  | 'unknown';

export class FacilityStatusPostError extends Error {
  constructor(readonly code: FacilityStatusPostErrorCode) {
    super('Facility status request failed.');
    this.name = 'FacilityStatusPostError';
  }
}

type FacilityStatusPostResult = {
  id: string;
  facility_id: string;
  status_type: FacilityStatusType;
  created_at: string;
  expires_at: string;
};

export async function postFacilityStatus(
  facilityId: string,
  statusType: FacilityStatusType,
): Promise<void> {
  if (!isValidFacilityId(facilityId)) {
    throw new FacilityStatusPostError('facility-unavailable');
  }

  const normalizedFacilityId = facilityId.toLowerCase();
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('post_facility_status', {
    p_facility_id: normalizedFacilityId,
    p_status_type: statusType,
  });

  if (error) {
    throw mapDatabaseError(error.code, error.message);
  }

  if (!isPostResult(data, normalizedFacilityId, statusType)) {
    throw new FacilityStatusPostError('unknown');
  }
}

function mapDatabaseError(
  code: string | undefined,
  message: string | undefined,
): FacilityStatusPostError {
  if (code === 'P0002') {
    return new FacilityStatusPostError('facility-unavailable');
  }

  if (code === '42501') {
    if (message === 'Active check-in at facility required') {
      return new FacilityStatusPostError('active-check-in-required');
    }

    if (message === 'Completed account required') {
      return new FacilityStatusPostError('account-required');
    }

    if (message === 'Authentication required') {
      return new FacilityStatusPostError('session-required');
    }
  }

  return new FacilityStatusPostError('unknown');
}

function isPostResult(
  value: unknown,
  facilityId: string,
  statusType: FacilityStatusType,
): value is [FacilityStatusPostResult] {
  if (!Array.isArray(value) || value.length !== 1) {
    return false;
  }

  const row: unknown = value[0];

  return (
    isRecord(row) &&
    typeof row.id === 'string' &&
    isValidFacilityId(row.id) &&
    typeof row.facility_id === 'string' &&
    row.facility_id.toLowerCase() === facilityId &&
    row.status_type === statusType &&
    isTimestamp(row.created_at) &&
    isTimestamp(row.expires_at)
  );
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
