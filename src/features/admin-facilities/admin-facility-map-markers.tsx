import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';

import { colors } from '@/constants/theme';

export function FacilityLocationMarker({
  coordinate,
  editable = false,
  expanded = false,
  onChange,
}: {
  coordinate: LatLng;
  editable?: boolean;
  expanded?: boolean;
  onChange?: (coordinate: LatLng) => void;
}) {
  const dragAnimation = useMarkerDragAnimation({
    lift: expanded ? 12 : 9,
    scale: expanded ? 1.7 : 1.55,
  });

  return (
    <Marker
      accessibilityLabel={
        editable ? 'Facility Location, draggable marker' : 'Facility Location reference'
      }
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={coordinate}
      draggable={editable}
      onDragEnd={editable ? (event) => {
        dragAnimation.end();
        onChange?.(event.nativeEvent.coordinate);
      } : undefined}
      onDragStart={editable ? dragAnimation.start : undefined}
      stopPropagation={editable}
      tappable={editable}
      zIndex={2}>
      <View
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.markerFrame,
          editable ? styles.facilityTouchFrame : styles.markerReferenceFrame,
          editable && expanded && styles.facilityExpandedTouchFrame,
        ]}>
        <Animated.View style={[styles.markerVisualLayer, dragAnimation.style]}>
          <View style={styles.facilityMarker}>
            <View style={styles.facilityMarkerCenter}>
              <View style={styles.facilityMarkerDot} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Marker>
  );
}

export function CheckInAreaMarkers({
  checkInCoordinate,
  expanded = false,
  facilityCoordinate,
  onChangeCheckInCoordinate,
}: {
  checkInCoordinate: LatLng | null;
  expanded?: boolean;
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
          expanded={expanded}
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
  expanded,
  includesFacilityLocation,
  onChange,
}: {
  coordinate: LatLng;
  expanded: boolean;
  includesFacilityLocation: boolean;
  onChange: (coordinate: LatLng) => void;
}) {
  const dragAnimation = useMarkerDragAnimation({
    lift: expanded ? 10 : 8,
    scale: expanded ? 1.6 : 1.5,
  });

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
      onDragEnd={(event) => {
        dragAnimation.end();
        onChange(event.nativeEvent.coordinate);
      }}
      onDragStart={dragAnimation.start}
      stopPropagation
      zIndex={3}>
      <View
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.markerFrame,
          styles.checkInTouchFrame,
          expanded && styles.checkInExpandedTouchFrame,
        ]}>
        <Animated.View style={[styles.markerVisualLayer, dragAnimation.style]}>
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
        </Animated.View>
      </View>
    </Marker>
  );
}

function useMarkerDragAnimation({ lift, scale: activeScale }: { lift: number; scale: number }) {
  const [scale] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));

  const animate = (isDragging: boolean) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isDragging ? activeScale : 1,
        damping: 25,
        stiffness: 400,
        mass: 0.5,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: isDragging ? -lift : 0,
        damping: 25,
        stiffness: 400,
        mass: 0.5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    end: () => animate(false),
    start: () => animate(true),
    style: {
      transform: [{ translateY }, { scale }],
    },
  };
}

const styles = StyleSheet.create({
  markerFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityTouchFrame: {
    width: 88,
    height: 88,
  },
  facilityExpandedTouchFrame: {
    width: 104,
    height: 104,
  },
  checkInTouchFrame: {
    width: 80,
    height: 80,
  },
  checkInExpandedTouchFrame: {
    width: 92,
    height: 92,
  },
  markerReferenceFrame: {
    width: 52,
    height: 52,
  },
  markerVisualLayer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityMarker: {
    position: 'absolute',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 21,
    backgroundColor: colors.teal,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 4,
  },
  facilityMarkerCenter: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.white,
  },
  facilityMarkerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  checkInMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 15,
    backgroundColor: colors.orange,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 5,
  },
  checkInMarkerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
});
