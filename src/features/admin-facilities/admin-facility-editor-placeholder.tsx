import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, radii, spacing, typeScale } from '@/constants/theme';
import { isValidFacilityId } from '@/features/facilities/facilities-api';

export function AdminFacilityEditorPlaceholder({
  facilityId,
  mode,
}: {
  facilityId?: string;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const hasValidFacilityId = mode === 'create' || isValidFacilityId(facilityId);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(admin)/admin/facilities');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to facilities"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <CourtCheckSymbol android="arrow_back" color={colors.tealDark} ios="chevron.left" size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>{mode === 'create' ? 'Create Facility' : 'Edit Facility'}</Text>
      </View>

      <View accessibilityLiveRegion="polite" style={styles.content}>
        <View style={styles.iconTile}>
          <CourtCheckSymbol
            android={hasValidFacilityId ? 'edit_location' : 'error'}
            color={colors.teal}
            ios={hasValidFacilityId ? 'mappin.and.ellipse' : 'exclamationmark.circle'}
            size={28}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {hasValidFacilityId ? 'Facility editor comes next' : 'Facility unavailable'}
        </Text>
        <Text style={styles.body}>
          {hasValidFacilityId
            ? 'This route is ready. Facility details and geofence editing will be implemented in Step 17C.'
            : 'This facility link is invalid. Return to the facilities list and try again.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionText}>Back to Facilities</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cloud },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
  },
  headerTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  iconTile: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.tealTint,
  },
  title: { marginTop: spacing.lg, color: colors.ink, fontSize: typeScale.title, fontWeight: '900', textAlign: 'center' },
  body: { maxWidth: 330, marginTop: spacing.sm, color: colors.inkMuted, fontSize: typeScale.body, lineHeight: 22, textAlign: 'center' },
  action: { minHeight: 48, justifyContent: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.teal },
  actionText: { color: colors.white, fontSize: typeScale.button, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
