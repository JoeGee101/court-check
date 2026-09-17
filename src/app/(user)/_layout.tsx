import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, spacing, typeScale } from '@/constants/theme';
import { useAuth } from '@/features/auth/session-provider';

export default function UserLayout() {
  const router = useRouter();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <Tabs
      screenLayout={({ children }) =>
        isAdmin ? (
          <View style={styles.playerAreaShell}>
            <View style={styles.playerScreen}>{children}</View>
            <View style={styles.adminContextBar}>
              <View style={styles.adminContextCopy}>
                <CourtCheckSymbol
                  android="visibility"
                  color={colors.tealDark}
                  ios="eye"
                  size={15}
                />
                <Text style={styles.adminContextText}>Viewing Player Area</Text>
              </View>
              <Pressable
                accessibilityHint="Returns to the CourtCheck administrator interface"
                accessibilityLabel="Return to Admin"
                accessibilityRole="button"
                hitSlop={4}
                onPress={() => router.dismissTo('/(admin)/admin')}
                style={({ pressed }) => [
                  styles.adminAction,
                  pressed && styles.adminActionPressed,
                ]}>
                <CourtCheckSymbol
                  android="admin_panel_settings"
                  color={colors.tealDark}
                  ios="shield"
                  size={16}
                />
                <Text style={styles.adminActionText}>Admin</Text>
                <CourtCheckSymbol
                  android="arrow_forward"
                  color={colors.tealDark}
                  ios="arrow.up.right"
                  size={13}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          children
        )
      }
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

const styles = StyleSheet.create({
  playerAreaShell: { flex: 1 },
  playerScreen: { flex: 1 },
  adminContextBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#C7DFDB',
    backgroundColor: colors.tealTint,
  },
  adminContextCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  adminContextText: {
    flexShrink: 1,
    color: colors.tealDark,
    fontSize: typeScale.bodySmall,
    fontWeight: '800',
  },
  adminAction: {
    minHeight: controlHeights.compact,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  adminActionPressed: { backgroundColor: 'rgba(14, 124, 124, 0.10)' },
  adminActionText: {
    color: colors.tealDark,
    fontSize: typeScale.bodySmall,
    fontWeight: '900',
  },
});
