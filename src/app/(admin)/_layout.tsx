import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.cloud },
        headerShown: false,
      }}>
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="admin/facilities/index" />
      <Stack.Screen name="admin/facilities/new" />
      <Stack.Screen name="admin/facilities/[facilityId]" />
    </Stack>
  );
}
