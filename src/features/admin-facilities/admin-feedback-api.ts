import { getSupabaseClient } from '@/lib/supabase/client';

export type AdminFacilityFeedback = {
  id: string;
  category: 'missing_information' | 'suggest_facility';
  facilityName: string | null;
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
  createdAt: string;
  reporterUsername: string | null;
};

export async function listAdminFacilityFeedback(): Promise<AdminFacilityFeedback[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_facility_feedback', {
    p_limit: 100,
    p_offset: 0,
  });

  if (error || !Array.isArray(data) || !data.every(isFeedback)) {
    throw new Error('Facility feedback could not be loaded.');
  }

  return data;
}

export async function setAdminFacilityFeedbackStatus(
  feedbackId: string,
  status: AdminFacilityFeedback['status'],
): Promise<void> {
  if (!isUuid(feedbackId)) {
    throw new Error('Invalid feedback identifier.');
  }

  const { error } = await getSupabaseClient().rpc('admin_set_facility_feedback_status', {
    p_feedback_id: feedbackId,
    p_status: status,
  });

  if (error) {
    throw new Error('Feedback status could not be updated.');
  }
}

function isFeedback(value: unknown): value is AdminFacilityFeedback {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    (value.category === 'missing_information' || value.category === 'suggest_facility') &&
    (typeof value.facilityName === 'string' || value.facilityName === null) &&
    typeof value.message === 'string' &&
    value.message.length <= 1000 &&
    (value.status === 'new' || value.status === 'reviewed' || value.status === 'resolved') &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    (typeof value.reporterUsername === 'string' || value.reporterUsername === null)
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
