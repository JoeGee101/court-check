import { useLocalSearchParams } from 'expo-router';

import { AdminFacilityEditorPlaceholder } from '@/features/admin-facilities/admin-facility-editor-placeholder';

export default function EditAdminFacilityRoute() {
  const { facilityId } = useLocalSearchParams<{ facilityId?: string | string[] }>();
  const normalizedFacilityId = Array.isArray(facilityId) ? facilityId[0] : facilityId;

  return <AdminFacilityEditorPlaceholder facilityId={normalizedFacilityId} mode="edit" />;
}
