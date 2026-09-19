import { StyleSheet, View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';

import { colors } from '@/constants/theme';

export function FacilityLocationMarker({
  coordinate,
  editable = false,
  onChange,
}: {
  coordinate: LatLng;
  editable?: boolean;
  onChange?: (coordinate: LatLng) => void;
}) {
  return (
    <Marker
      accessibilityLabel={
        editable ? 'Facility Location, draggable marker' : 'Facility Location reference'
      }
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={coordinate}
      draggable={editable}
      onDragEnd={editable ? (event) => onChange?.(event.nativeEvent.coordinate) : undefined}
      tappable={editable}
      zIndex={2}>
      <View collapsable={false} pointerEvents="none" style={styles.markerTouchFrame}>
        <View style={styles.facilityMarker}>
          <View style={styles.facilityMarkerCenter}>
            <View style={styles.facilityMarkerDot} />
          </View>
        </View>
      </View>
    </Marker>
  );
}

export function CheckInAreaMarkers({
  checkInCoordinate,
  facilityCoordinate,
  onChangeCheckInCoordinate,
}: {
  checkInCoordinate: LatLng | null;
  facilityCoordinate: LatLng | null;
  onChangeCheckInCoordinate: (coordinate: LatLng) => void;
}) {
  const coordinatesOverlap =
    facilityCoordinate !== null &&
    checkInCoordinate !== null &&
    Math.abs(facilityCoordinate.latitude - checkInCoordinate.latitude) < 0.0000001 &&
    Math.abs(facilityCoordinate.longitude - checkInCoordinate.longitude) < 0.0000001;

  return (
    <>
      {checkInCoordinate ? (
        <CheckInAreaMarker
          coordinate={checkInCoordinate}
          includesFacilityLocation={coordinatesOverlap}
          onChange={onChangeCheckInCoordinate}
        />
      ) : null}
      {facilityCoordinate && !coordinatesOverlap ? (
        <FacilityLocationMarker coordinate={facilityCoordinate} />
      ) : null}
    </>
  );
}

function CheckInAreaMarker({
  coordinate,
  includesFacilityLocation,
  onChange,
}: {
  coordinate: LatLng;
  includesFacilityLocation: boolean;
  onChange: (coordinate: LatLng) => void;
}) {
  return (
    <Marker
      accessibilityLabel={
        includesFacilityLocation
          ? 'Facility Location and Check-in Area center, draggable Check-in Area marker'
          : 'Check-in Area center, draggable marker'
      }
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={coordinate}
      draggable
      onDragEnd={(event) => onChange(event.nativeEvent.coordinate)}
      zIndex={3}>
      <View collapsable={false} pointerEvents="none" style={styles.markerTouchFrame}>
        {includesFacilityLocation ? (
          <View style={styles.facilityMarker}>
            <View style={styles.facilityMarkerCenter}>
              <View style={styles.facilityMarkerDot} />
            </View>
          </View>
        ) : null}
        <View style={styles.checkInMarker}>
          <View style={styles.checkInMarkerDot} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerTouchFrame: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 18,
    backgroundColor: colors.teal,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 4,
  },
  facilityMarkerCenter: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  facilityMarkerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  checkInMarker: {
    position: 'absolute',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 11,
    backgroundColor: colors.orange,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 5,
  },
  checkInMarkerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
});
