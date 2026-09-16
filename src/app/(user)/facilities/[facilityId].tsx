import { useLocalSearchParams } from 'expo-router';

import { FacilityDetailScreen } from '@/features/facilities/facility-detail-screen';

export default function FacilityDetailRoute() {
  const { facilityId: routeFacilityId } = useLocalSearchParams<{ facilityId?: string | string[] }>();
  const facilityId = typeof routeFacilityId === 'string' ? routeFacilityId : undefined;

  return <FacilityDetailScreen facilityId={facilityId} key={facilityId ?? 'invalid'} />;
}
