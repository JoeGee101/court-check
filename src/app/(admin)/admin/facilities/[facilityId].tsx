import { useLocalSearchParams } from 'expo-router';

import { AdminFacilityEditorScreen } from '@/features/admin-facilities/admin-facility-editor-screen';

export default function EditAdminFacilityRoute() {
  const { facilityId } = useLocalSearchParams<{ facilityId?: string | string[] }>();
  const normalizedFacilityId = Array.isArray(facilityId) ? facilityId[0] : facilityId;

  return (
    <AdminFacilityEditorScreen
      facilityId={normalizedFacilityId}
      mode="edit"
    />
  );
}
