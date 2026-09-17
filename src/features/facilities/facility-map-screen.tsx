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
  tournament_at_courts: { backgroundColor: '#D96A32', label: 'Tournament' },
  active: { backgroundColor: '#0E7C7C', label: 'Active now' },
  quiet: { backgroundColor: '#526773', label: 'Quiet' },
};

export function FacilityMapScreen() {
  const router = useRouter();
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
    <View style={styles.screen}>
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
            key={`${facility.id}-${facility.active_check_in_count}-${facility.activity_state}`}
            onPress={() => openFacility(facility.id)}
          />
        ))}
      </MapView>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.safeOverlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Clark County</Text>
            <Text style={styles.title}>Court map</Text>
          </View>
          {isRefreshing && hasUsableMap ? (
            <ActivityIndicator color="#0E7C7C" size="small" />
          ) : null}
        </View>

        {error && hasUsableMap ? <InlineError onRetry={refresh} /> : null}
      </SafeAreaView>

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

  return (
    <Marker
      accessibilityHint="Opens facility details"
      accessibilityLabel={`${facility.name}, ${playerLabel} checked in, ${activity.label}`}
      accessibilityRole="button"
      coordinate={{ latitude: facility.latitude, longitude: facility.longitude }}
      onPress={onPress}
      tracksViewChanges={false}>
      <View style={styles.markerContainer}>
        <View style={[styles.markerCard, { borderColor: activity.backgroundColor }]}>
          <Text numberOfLines={1} style={styles.markerName}>
            {facility.name}
          </Text>
          <View style={styles.markerActivityRow}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.activityDot, { backgroundColor: activity.backgroundColor }]}
            />
            <Text style={styles.markerCount}>{playerLabel}</Text>
          </View>
        </View>
        <View style={[styles.markerPointer, { borderTopColor: activity.backgroundColor }]} />
      </View>
    </Marker>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
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
        {isLoading ? <ActivityIndicator color="#0E7C7C" size="large" /> : null}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#DCEAE7',
  },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  safeOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D8E3E1',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 5,
  },
  eyebrow: {
    color: '#0E7C7C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    color: '#16263D',
    fontSize: 21,
    fontWeight: '800',
  },
  markerContainer: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  markerCard: {
    maxWidth: 154,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 2,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
    elevation: 4,
  },
  markerName: {
    color: '#16263D',
    fontSize: 11,
    fontWeight: '800',
  },
  markerActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  activityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  markerCount: {
    color: '#5C6E79',
    fontSize: 10,
    fontWeight: '700',
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E3B3B3',
    borderRadius: 13,
    backgroundColor: 'rgba(255, 247, 247, 0.97)',
  },
  inlineErrorText: {
    flex: 1,
    color: '#8D3535',
    fontSize: 12,
    fontWeight: '700',
  },
  retryLink: {
    color: '#0A6666',
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
    backgroundColor: 'rgba(220, 234, 231, 0.72)',
  },
  stateCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: '#D8E3E1',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  stateTitle: {
    marginTop: 12,
    color: '#16263D',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 7,
    color: '#667684',
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
    borderRadius: 14,
    backgroundColor: '#0E7C7C',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
