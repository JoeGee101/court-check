import type MapView from 'react-native-maps';
import type { LatLng, Region } from 'react-native-maps';

export const LAS_VEGAS_REGION: Region = {
  latitude: 36.1699,
  longitude: -115.1398,
  latitudeDelta: 0.42,
  longitudeDelta: 0.34,
};

const DEFAULT_COORDINATE_DELTA = 0.018;
const MINIMUM_GEOFENCE_FRAME_RADIUS_M = 120;
const METERS_PER_LATITUDE_DEGREE = 111_320;

export function regionAround(coordinate: LatLng): Region {
  return {
    ...coordinate,
    latitudeDelta: DEFAULT_COORDINATE_DELTA,
    longitudeDelta: DEFAULT_COORDINATE_DELTA,
  };
}

export function frameFacilityLocation(
  map: MapView | null,
  coordinate: LatLng | null,
  animated: boolean,
) {
  if (!map || !coordinate) {
    return;
  }

  map.animateToRegion(regionAround(coordinate), animated ? 300 : 0);
}

export function frameCheckInArea(
  map: MapView | null,
  facilityCoordinate: LatLng | null,
  checkInCoordinate: LatLng | null,
  radiusM: number | null,
  animated: boolean,
) {
  const focusCoordinate = checkInCoordinate ?? facilityCoordinate;
  if (!map || !focusCoordinate) {
    return;
  }

  const coordinates = getCheckInFrameCoordinates(
    facilityCoordinate,
    checkInCoordinate,
    radiusM,
  );

  if (coordinates.length < 2 || coordinatesAreEffectivelyEqual(coordinates)) {
    map.animateToRegion(regionAround(focusCoordinate), animated ? 300 : 0);
    return;
  }

  map.fitToCoordinates(coordinates, {
    animated,
    edgePadding: { bottom: 28, left: 28, right: 28, top: 28 },
  });
}

function getCheckInFrameCoordinates(
  facilityCoordinate: LatLng | null,
  checkInCoordinate: LatLng | null,
  radiusM: number | null,
) {
  const coordinates: LatLng[] = [];
  if (facilityCoordinate) {
    coordinates.push(facilityCoordinate);
  }
  if (checkInCoordinate) {
    coordinates.push(checkInCoordinate);
  }

  if (!checkInCoordinate || radiusM === null || radiusM <= 0) {
    return coordinates;
  }

  const frameRadiusM = Math.max(radiusM, MINIMUM_GEOFENCE_FRAME_RADIUS_M);
  const latitudeOffset = frameRadiusM / METERS_PER_LATITUDE_DEGREE;
  const latitudeRadians = (checkInCoordinate.latitude * Math.PI) / 180;
  const longitudeScale = Math.max(Math.abs(Math.cos(latitudeRadians)), 0.01);
  const longitudeOffset = frameRadiusM / (METERS_PER_LATITUDE_DEGREE * longitudeScale);

  coordinates.push(
    {
      latitude: Math.min(90, checkInCoordinate.latitude + latitudeOffset),
      longitude: checkInCoordinate.longitude,
    },
    {
      latitude: Math.max(-90, checkInCoordinate.latitude - latitudeOffset),
      longitude: checkInCoordinate.longitude,
    },
    {
      latitude: checkInCoordinate.latitude,
      longitude: clampLongitude(checkInCoordinate.longitude + longitudeOffset),
    },
    {
      latitude: checkInCoordinate.latitude,
      longitude: clampLongitude(checkInCoordinate.longitude - longitudeOffset),
    },
  );

  return coordinates;
}

function coordinatesAreEffectivelyEqual(coordinates: LatLng[]) {
  const [first, ...rest] = coordinates;
  return rest.every(
    (coordinate) =>
      Math.abs(coordinate.latitude - first.latitude) < 0.000001 &&
      Math.abs(coordinate.longitude - first.longitude) < 0.000001,
  );
}

function clampLongitude(longitude: number) {
  return Math.max(-180, Math.min(180, longitude));
}
