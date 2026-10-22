import { getSupabaseClient } from '@/lib/supabase/client';
import { isValidFacilityId } from '@/features/facilities/facilities-api';

export type FacilityFeedbackCategory = 'missing_information' | 'suggest_facility';

export async function submitFacilityFeedback(input: {
  category: FacilityFeedbackCategory;
  facilityId: string | null;
  message: string;
}): Promise<void> {
  if (
    input.message.trim().length < 3 ||
    input.message.trim().length > 1000 ||
    (input.category === 'missing_information' &&
      (!input.facilityId || !isValidFacilityId(input.facilityId))) ||
    (input.category === 'suggest_facility' && input.facilityId !== null)
  ) {
    throw new Error('invalid-feedback');
  }

  const { error } = await getSupabaseClient().rpc('submit_facility_feedback', {
    p_category: input.category,
    p_facility_id: input.facilityId,
    p_message: input.message.trim(),
  });

  if (error) {
    throw new Error('facility-feedback-failed');
  }
}
