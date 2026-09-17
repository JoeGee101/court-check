import { useLocalSearchParams } from 'expo-router';

import { AdminFacilityListScreen } from '@/features/admin-facilities/admin-facility-list-screen';

export default function AdminFacilitiesRoute() {
  const { focusFacilityId, success } = useLocalSearchParams<{
    focusFacilityId?: string | string[];
    success?: string | string[];
  }>();

  return (
    <AdminFacilityListScreen
      focusFacilityId={Array.isArray(focusFacilityId) ? focusFacilityId[0] : focusFacilityId}
      success={Array.isArray(success) ? success[0] : success}
    />
  );
}
