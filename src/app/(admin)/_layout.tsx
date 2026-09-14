import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen name="admin/index" options={{ title: 'Admin' }} />
      <Stack.Screen name="admin/facilities" options={{ title: 'Facilities' }} />
    </Stack>
  );
}
