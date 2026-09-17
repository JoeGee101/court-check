import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, spacing, typeScale } from '@/constants/theme';
import { useAuth } from '@/features/auth/session-provider';
import {
  type FacilityActivityState,
  type FacilitySummary,
} from '@/features/facilities/facilities-api';
import { useFacilities } from '@/features/facilities/use-facilities';

const LAS_VEGAS_REGION: Region = {
  latitude: 36.1699,
  longitude: -115.1398,
  latitudeDelta: 0.48,
  longitudeDelta: 0.38,
};

const ACTIVITY_PRESENTATION: Record<
  FacilityActivityState,
  { backgroundColor: string; label: string }
> = {
  courts_closed: { backgroundColor: '#B84949', label: 'Courts closed' },
  maintenance: { backgroundColor: '#6B5A8E', label: 'Maintenance' },
  courts_wet_unsafe: { backgroundColor: '#B84949', label: 'Wet / unsafe' },
  tournament_at_courts: { backgroundColor: '#D96A32', label: 'Tournament / Event' },
  courts_full: { backgroundColor: '#B77A27', label: 'Courts full' },
  active: { backgroundColor: '#0E7C7C', label: 'Active now' },
  quiet: { backgroundColor: '#526773', label: 'Quiet' },
};

export function FacilityMapScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { error, facilities, isInitialLoading, isRefreshing, refresh } = useFacilities();
  const [showsUserLocation, setShowsUserLocation] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const updateExistingLocationPermission = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (isMounted) {
          setShowsUserLocation(permission.granted);
        }
      } catch {
        if (isMounted) {
          setShowsUserLocation(false);
        }
      }
    };

    const initialCheckTimer = setTimeout(() => {
      void updateExistingLocationPermission();
    }, 0);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void updateExistingLocationPermission();
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(initialCheckTimer);
      subscription.remove();
    };
  }, []);

  const openFacility = (facilityId: string) => {
    router.push({
      pathname: '/(user)/facilities/[facilityId]',
      params: { facilityId },
    });
  };

  const hasUsableMap = facilities.length > 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>Clark County</Text>
            <Text accessibilityRole="header" style={styles.title}>Court Map</Text>
          </View>
          <View style={styles.headerActions}>
            {isRefreshing && hasUsableMap ? (
              <ActivityIndicator color={colors.teal} size="small" />
            ) : null}
            <Pressable
              accessibilityLabel="Open profile"
              accessibilityRole="button"
              hitSlop={5}
              onPress={() => router.push('/(user)/profile')}
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
              <Text style={styles.avatarText}>
                {getUsernameInitials(profile?.anonymous_username)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.mapArea}>
        <MapView
          initialRegion={LAS_VEGAS_REGION}
          mapType="standard"
          pitchEnabled={false}
          rotateEnabled={false}
          showsCompass
          showsMyLocationButton={false}
          showsUserLocation={showsUserLocation}
          style={styles.map}
          toolbarEnabled={false}>
          {facilities.map((facility) => (
            <FacilityMarker
              facility={facility}
              key={`${facility.id}-${facility.active_check_in_count}-${facility.activity_state}-${facility.activity_reporter_count}`}
              onPress={() => openFacility(facility.id)}
            />
          ))}
        </MapView>

        {error && hasUsableMap ? <InlineError onRetry={refresh} /> : null}

        {isInitialLoading && !hasUsableMap ? (
          <MapStateCard isLoading title="Loading court map">
            Getting the latest facility activity…
          </MapStateCard>
        ) : error && !hasUsableMap ? (
          <MapStateCard actionLabel="Try again" onAction={refresh} title="Unable to load map">
            Check your connection and try again.
          </MapStateCard>
        ) : !isInitialLoading && !hasUsableMap ? (
          <MapStateCard title="No facilities available">
            Active facilities will appear here when they are available.
          </MapStateCard>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function FacilityMarker({
  facility,
  onPress,
}: {
  facility: FacilitySummary;
  onPress: () => void;
}) {
  const activity = ACTIVITY_PRESENTATION[facility.activity_state];
  const playerLabel = `${facility.active_check_in_count} ${
    facility.active_check_in_count === 1 ? 'player' : 'players'
  }`;
  const isReportedStatus =
    facility.activity_state !== 'active' && facility.activity_state !== 'quiet';
  const reportLabel = `${facility.activity_reporter_count} ${
    facility.activity_reporter_count === 1 ? 'report' : 'reports'
  }`;
  const accessibilityStatus = isReportedStatus
    ? `${activity.label}, ${reportLabel}`
    : activity.label;

  return (
    <Marker
      accessibilityHint="Opens facility details"
      accessibilityLabel={`${facility.name}, ${playerLabel} checked in, ${accessibilityStatus}`}
      accessibilityRole="button"
      coordinate={{ latitude: facility.latitude, longitude: facility.longitude }}
      onPress={onPress}
      tracksViewChanges={false}>
      <View style={styles.markerContainer}>
        <View style={styles.markerNamePill}>
          <Text numberOfLines={1} style={styles.markerName}>{facility.name}</Text>
          <View style={styles.markerStatusRow}>
            <View style={[styles.activityDot, { backgroundColor: activity.backgroundColor }]} />
            <Text numberOfLines={1} style={styles.markerStatus}>{activity.label}</Text>
          </View>
        </View>
        <View style={[styles.markerPin, { borderColor: activity.backgroundColor }]}>
          <Text style={styles.markerCount}>{facility.active_check_in_count}</Text>
          <Text style={styles.markerCountLabel}>HERE</Text>
          {isReportedStatus ? (
            <View style={[styles.reportBadge, { backgroundColor: activity.backgroundColor }]}>
              <Text style={styles.reportBadgeText}>{facility.activity_reporter_count}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.markerPointer, { borderTopColor: activity.backgroundColor }]} />
      </View>
    </Marker>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
      <CourtCheckSymbol android="error" color={colors.danger} ios="exclamationmark.circle" size={17} />
      <Text style={styles.inlineErrorText}>Couldn’t refresh court activity.</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
        <Text style={styles.retryLink}>Retry</Text>
      </Pressable>
    </View>
  );
}

function MapStateCard({
  actionLabel,
  children,
  isLoading = false,
  onAction,
  title,
}: {
  actionLabel?: string;
  children: string;
  isLoading?: boolean;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.stateOverlay}>
      <View style={styles.stateCard}>
        <View style={styles.stateIcon}>
          {isLoading ? (
            <ActivityIndicator color={colors.teal} size="large" />
          ) : (
            <CourtCheckSymbol android="map" color={colors.teal} ios="map" size={26} />
          )}
        </View>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateBody}>{children}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function getUsernameInitials(username: string | undefined) {
  if (!username) {
    return 'CC';
  }

  const uppercaseLetters = username.match(/[A-Z]/g)?.slice(0, 2).join('');
  return (uppercaseLetters || username.slice(0, 2)).toUpperCase();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
    zIndex: 2,
  },
  headingRow: {
    minHeight: controlHeights.compact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingCopy: {
    minWidth: 0,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typeScale.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.teal,
  },
  avatarText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  mapArea: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#DCEAE7',
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  markerContainer: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  markerNamePill: {
    maxWidth: 116,
    minWidth: 76,
    alignItems: 'center',
    marginBottom: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  markerName: {
    minWidth: 0,
    maxWidth: 98,
    color: colors.ink,
    fontSize: 9.5,
    fontWeight: '800',
  },
  markerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  markerStatus: {
    maxWidth: 88,
    color: colors.inkMuted,
    fontSize: 7.5,
    fontWeight: '700',
  },
  markerPin: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderRadius: 23,
    backgroundColor: colors.card,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 4,
  },
  activityDot: {
    width: 6,
    height: 6,
    flexShrink: 0,
    borderRadius: 3,
  },
  markerCount: {
    color: colors.tealDark,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  markerCountLabel: {
    marginTop: 1,
    color: colors.inkMuted,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  reportBadge: {
    position: 'absolute',
    top: -6,
    right: -7,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 10,
  },
  reportBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderRightWidth: 7,
    borderLeftWidth: 7,
    borderTopWidth: 9,
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  inlineError: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    left: spacing.lg,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E3B3B3',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 247, 247, 0.97)',
    zIndex: 2,
  },
  inlineErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  retryLink: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '800',
  },
  stateOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(243, 247, 246, 0.78)',
  },
  stateCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  stateIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: colors.tealTint,
  },
  stateTitle: {
    marginTop: 12,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 7,
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    backgroundColor: colors.teal,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
