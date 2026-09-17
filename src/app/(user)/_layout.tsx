import { Tabs } from 'expo-router';

export default function UserLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: 'center' }}>
      <Tabs.Screen name="boards" options={{ headerShown: false, title: 'Boards' }} />
      <Tabs.Screen
        name="facilities/[facilityId]"
        options={{ headerShown: false, href: null, title: 'Facility' }}
      />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="profile" options={{ headerShown: false, title: 'Profile' }} />
    </Tabs>
  );
}
