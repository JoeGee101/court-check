import { isValidFacilityId } from '@/features/facilities/facilities-api';
import { getSupabaseClient } from '@/lib/supabase/client';

export type ActiveCheckIn = {
  facilityId: string;
  facilityName: string;
  checkedInAt: string;
  expiresAt: string;
  serverTime: string;
};

export type CheckOutResult = {
  facilityId: string;
  reason: 'manual' | 'expired';
};

export type ActiveCheckInErrorCode =
  | 'already-closed'
  | 'session-required'
  | 'load-failed'
  | 'checkout-failed';

export class ActiveCheckInError extends Error {
  constructor(readonly code: ActiveCheckInErrorCode) {
    super('Active check-in request failed.');
    this.name = 'ActiveCheckInError';
  }
}

export async function getMyActiveCheckIn(): Promise<ActiveCheckIn | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_my_active_check_in');

  if (error) {
    throw mapSessionError(error.code, error.message, 'load-failed');
  }

  if (!Array.isArray(data) || data.length > 1) {
    throw new ActiveCheckInError('load-failed');
  }

  if (data.length === 0) {
    return null;
  }

  const row: unknown = data[0];

  if (!isActiveCheckInRow(row)) {
    throw new ActiveCheckInError('load-failed');
  }

  return {
    facilityId: row.facility_id.toLowerCase(),
    facilityName: row.facility_name,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    serverTime: row.server_time,
  };
}

export async function checkOut(): Promise<CheckOutResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('check_out');

  if (error?.code === 'P0002') {
    throw new ActiveCheckInError('already-closed');
  }

  if (error) {
    throw mapSessionError(error.code, error.message, 'checkout-failed');
  }

  if (!isCheckOutRow(data)) {
    throw new ActiveCheckInError('checkout-failed');
  }

  return {
    facilityId: data[0].facility_id.toLowerCase(),
    reason: data[0].checkout_reason,
  };
}

function mapSessionError(
  code: string | undefined,
  message: string | undefined,
  fallback: 'load-failed' | 'checkout-failed',
) {
  if (code === '42501' && message === 'Authentication required') {
    return new ActiveCheckInError('session-required');
  }

  return new ActiveCheckInError(fallback);
}

function isActiveCheckInRow(value: unknown): value is {
  facility_id: string;
  facility_name: string;
  checked_in_at: string;
  expires_at: string;
  server_time: string;
} {
  return (
    isRecord(value) &&
    typeof value.facility_id === 'string' &&
    isValidFacilityId(value.facility_id) &&
    typeof value.facility_name === 'string' &&
    value.facility_name.trim().length > 0 &&
    isTimestamp(value.checked_in_at) &&
    isTimestamp(value.expires_at) &&
    isTimestamp(value.server_time)
  );
}

function isCheckOutRow(
  value: unknown,
): value is [
  {
    id: string;
    facility_id: string;
    checked_in_at: string;
    checked_out_at: string;
    checkout_reason: 'manual' | 'expired';
  },
] {
  if (!Array.isArray(value) || value.length !== 1) {
    return false;
  }

  const row: unknown = value[0];

  return (
    isRecord(row) &&
    typeof row.id === 'string' &&
    isValidFacilityId(row.id) &&
    typeof row.facility_id === 'string' &&
    isValidFacilityId(row.facility_id) &&
    isTimestamp(row.checked_in_at) &&
    isTimestamp(row.checked_out_at) &&
    (row.checkout_reason === 'manual' || row.checkout_reason === 'expired')
  );
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
