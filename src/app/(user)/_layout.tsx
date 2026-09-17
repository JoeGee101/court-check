import { Tabs } from 'expo-router';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors } from '@/constants/theme';

export default function UserLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cloud },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: { marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 5 },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
        },
        tabBarStyle: {
          borderTopColor: colors.line,
          borderTopWidth: 1,
          backgroundColor: colors.card,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}>
      <Tabs.Screen
        name="boards"
        options={{
          tabBarIcon: ({ color }) => (
            <CourtCheckSymbol android="grid_view" color={color} ios="square.grid.2x2" size={20} />
          ),
          title: 'Boards',
        }}
      />
      <Tabs.Screen
        name="facilities/[facilityId]"
        options={{ href: null, title: 'Facility' }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => (
            <CourtCheckSymbol android="map" color={color} ios="map" size={20} />
          ),
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => (
            <CourtCheckSymbol android="person" color={color} ios="person" size={20} />
          ),
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
