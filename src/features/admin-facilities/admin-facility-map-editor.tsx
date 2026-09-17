import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Circle, Marker, type LatLng, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import { getAdminCurrentLocation } from '@/features/admin-facilities/admin-current-location';

export type AdminFacilityMapEditorMode = 'geofence' | 'public';

type Props = {
  geofenceCoordinate: LatLng | null;
  mode: AdminFacilityMapEditorMode;
  onChangeGeofenceCoordinate: (coordinate: LatLng) => void;
  onChangePublicCoordinate: (coordinate: LatLng) => void;
  onChangeRadius: (radius: string) => void;
  onClose: () => void;
  onUsePublicLocation: () => void;
  publicCoordinate: LatLng | null;
  radius: string;
  visible: boolean;
};

const LAS_VEGAS_REGION: Region = {
  latitude: 36.1699,
  longitude: -115.1398,
  latitudeDelta: 0.42,
  longitudeDelta: 0.34,
};

export function AdminFacilityMapEditor({
  geofenceCoordinate,
  mode,
  onChangeGeofenceCoordinate,
  onChangePublicCoordinate,
  onChangeRadius,
  onClose,
  onUsePublicLocation,
  publicCoordinate,
  radius,
  visible,
}: Props) {
  const safeAreaInsets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationRequestInFlight = useRef(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const selectedCoordinate = mode === 'public' ? publicCoordinate : geofenceCoordinate;
  const parsedRadius = parseRadius(radius);
  const radiusIsInvalid = radius.trim().length > 0 && parsedRadius === null;
  const focusCoordinate = mode === 'public' ? publicCoordinate : geofenceCoordinate ?? publicCoordinate;
  const focusLatitude = focusCoordinate?.latitude;
  const focusLongitude = focusCoordinate?.longitude;

  useEffect(() => {
    if (!visible) {
      const resetTimer = setTimeout(() => setLocationFeedback(null), 0);
      return () => clearTimeout(resetTimer);
    }

    const focusTimer = setTimeout(() => {
      if (focusLatitude !== undefined && focusLongitude !== undefined) {
        mapRef.current?.animateToRegion(
          regionAround({ latitude: focusLatitude, longitude: focusLongitude }),
          250,
        );
      }
    }, 250);

    return () => clearTimeout(focusTimer);
  }, [focusLatitude, focusLongitude, visible]);

  const setCoordinate = (coordinate: LatLng) => {
    setLocationFeedback(null);
    if (mode === 'public') {
      onChangePublicCoordinate(coordinate);
    } else {
      onChangeGeofenceCoordinate(coordinate);
    }
  };

  const handleUseMyLocation = async () => {
    if (mode !== 'public' || locationRequestInFlight.current) {
      return;
    }

    locationRequestInFlight.current = true;
    setIsGettingLocation(true);
    setLocationFeedback(null);

    try {
      const coordinate = await getAdminCurrentLocation();
      onChangePublicCoordinate(coordinate);
      mapRef.current?.animateToRegion(regionAround(coordinate), 400);
    } catch {
      setLocationFeedback('Your location could not be determined. Place the marker manually.');
    } finally {
      locationRequestInFlight.current = false;
      setIsGettingLocation(false);
    }
  };

  const initialCoordinate = selectedCoordinate ?? publicCoordinate;
  const closeEditor = () => {
    if (!locationRequestInFlight.current) {
      onClose();
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeEditor}
      presentationStyle="fullScreen"
      visible={visible}>
      <View style={styles.screen}>
        <MapView
          initialRegion={initialCoordinate ? regionAround(initialCoordinate) : LAS_VEGAS_REGION}
          mapType="standard"
          onPress={(event) => setCoordinate(event.nativeEvent.coordinate)}
          pitchEnabled={false}
          ref={mapRef}
          rotateEnabled={false}
          showsCompass
          showsMyLocationButton={false}
          showsUserLocation={false}
          style={StyleSheet.absoluteFill}
          toolbarEnabled={false}>
          {mode === 'geofence' && geofenceCoordinate && parsedRadius !== null ? (
            <Circle
              center={geofenceCoordinate}
              fillColor="rgba(232, 98, 44, 0.14)"
              radius={parsedRadius}
              strokeColor={colors.orange}
              strokeWidth={2}
            />
          ) : null}
          {mode === 'geofence' && geofenceCoordinate ? (
            <Marker
              accessibilityLabel="Check-in Area center"
              coordinate={geofenceCoordinate}
              draggable
              onDragEnd={(event) => onChangeGeofenceCoordinate(event.nativeEvent.coordinate)}
              pinColor={colors.orange}
              zIndex={1}
            />
          ) : null}
          {publicCoordinate ? (
            <Marker
              accessibilityLabel={
                mode === 'public' ? 'Facility Location' : 'Facility Location reference'
              }
              coordinate={publicCoordinate}
              draggable={mode === 'public'}
              onDragEnd={
                mode === 'public'
                  ? (event) => onChangePublicCoordinate(event.nativeEvent.coordinate)
                  : undefined
              }
              pinColor={colors.teal}
              tappable={mode === 'public'}
              zIndex={2}
            />
          ) : null}
        </MapView>

        <View pointerEvents="box-none" style={styles.safeArea}>
          <View
            style={[
              styles.topBar,
              {
                marginTop:
                  Math.max(safeAreaInsets.top, Platform.OS === 'ios' ? 54 : spacing.lg) +
                  spacing.sm,
              },
            ]}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>Admin map editor</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {mode === 'public' ? 'Facility Location' : 'Check-in Area'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Done editing map"
              accessibilityRole="button"
              disabled={isGettingLocation}
              onPress={closeEditor}
              style={({ pressed }) => [
                styles.doneButton,
                isGettingLocation && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={styles.flex}>
            <View
              style={[
                styles.bottomPanel,
                { marginBottom: Math.max(safeAreaInsets.bottom, spacing.md) + spacing.sm },
              ]}>
              <Text style={styles.coordinateText}>{formatCoordinateLabel(selectedCoordinate)}</Text>

              {mode === 'public' ? (
                <>
                  <Text style={styles.helpText}>
                    Tap or drag the teal marker. Use My Location places the Facility Location at your current position.
                  </Text>
                  {locationFeedback ? (
                    <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                      {locationFeedback}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ busy: isGettingLocation, disabled: isGettingLocation }}
                    disabled={isGettingLocation}
                    onPress={() => void handleUseMyLocation()}
                    style={({ pressed }) => [
                      styles.locationButton,
                      isGettingLocation && styles.disabled,
                      pressed && styles.pressed,
                    ]}>
                    {isGettingLocation ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <CourtCheckSymbol android="my_location" color={colors.white} ios="location.fill" size={18} />
                    )}
                    <Text style={styles.locationButtonText}>
                      {isGettingLocation ? 'Finding location…' : 'Use My Location'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.mapLegend}>
                    <LegendItem color={colors.teal} label="Facility Location" />
                    <LegendItem color={colors.orange} label="Check-in Area center" />
                  </View>
                  <Text style={styles.helpText}>
                    Tap or drag the orange marker to set the center. The circle shows the full check-in area.
                  </Text>
                  <View style={styles.geofenceControls}>
                    <View style={styles.radiusField}>
                      <Text style={styles.fieldLabel}>Radius in meters</Text>
                      <TextInput
                        accessibilityLabel="Check-in Area radius in meters"
                        keyboardType="number-pad"
                        onChangeText={onChangeRadius}
                        placeholder="10–1000"
                        placeholderTextColor="#84929B"
                        style={[styles.radiusInput, radiusIsInvalid && styles.invalidInput]}
                        value={radius}
                      />
                      {radiusIsInvalid ? (
                        <Text style={styles.radiusError}>Use a whole number from 10 to 1000.</Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!publicCoordinate}
                      onPress={onUsePublicLocation}
                      style={({ pressed }) => [
                        styles.publicLocationButton,
                        !publicCoordinate && styles.disabled,
                        pressed && styles.pressed,
                      ]}>
                      <CourtCheckSymbol android="content_copy" color={colors.tealDark} ios="location.fill" size={16} />
                      <Text style={styles.publicLocationText}>Use Facility Location</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function parseRadius(value: string) {
  if (!value.trim()) return null;
  const radius = Number(value);
  return Number.isInteger(radius) && radius >= 10 && radius <= 1000 ? radius : null;
}

function regionAround(coordinate: LatLng): Region {
  return { ...coordinate, latitudeDelta: 0.018, longitudeDelta: 0.018 };
}

function formatCoordinateLabel(coordinate: LatLng | null) {
  if (!coordinate) {
    return 'No point selected';
  }
  return `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  screen: { flex: 1, backgroundColor: colors.cloud },
  safeArea: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...shadows.card,
  },
  headingCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: colors.teal, fontSize: typeScale.eyebrow, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { marginTop: 2, color: colors.ink, fontSize: 19, fontWeight: '900' },
  doneButton: { minWidth: 66, minHeight: controlHeights.compact, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.teal },
  doneText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  bottomPanel: { margin: spacing.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, backgroundColor: 'rgba(255,255,255,0.97)', ...shadows.card },
  coordinateText: { color: colors.ink, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  helpText: { marginTop: 6, color: colors.inkMuted, fontSize: 12.5, lineHeight: 18 },
  mapLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  errorText: { marginTop: spacing.sm, color: colors.danger, fontSize: 12.5, lineHeight: 18 },
  locationButton: { minHeight: controlHeights.default, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, borderRadius: radii.lg, backgroundColor: colors.teal },
  locationButtonText: { color: colors.white, fontSize: typeScale.button, fontWeight: '900' },
  geofenceControls: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  radiusField: { minWidth: 0, flex: 0.8, gap: 5 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  radiusInput: { minHeight: controlHeights.compact, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.cloud, color: colors.ink, fontSize: 14 },
  invalidInput: { borderColor: colors.danger, backgroundColor: '#FFF9F9' },
  radiusError: { color: colors.danger, fontSize: 11.5, lineHeight: 16 },
  publicLocationButton: { minHeight: controlHeights.compact, flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.teal, borderRadius: radii.md, backgroundColor: colors.tealTint },
  publicLocationText: { color: colors.tealDark, fontSize: 12.5, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
});
