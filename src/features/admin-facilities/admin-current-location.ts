import * as Location from 'expo-location';
import type { LatLng } from 'react-native-maps';

const LOCATION_TIMEOUT_MS = 15_000;

export async function getAdminCurrentLocation(): Promise<LatLng> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Location Services unavailable.');
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission unavailable.');
  }

  const location = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    LOCATION_TIMEOUT_MS,
  );
  const coordinate = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };

  if (!isValidCoordinate(coordinate)) {
    throw new Error('Location unavailable.');
  }

  return coordinate;
}

export async function reverseGeocodeAdminFacilityAddress(
  coordinate: LatLng,
): Promise<string | null> {
  if (!isValidCoordinate(coordinate)) {
    return null;
  }

  const [place] = await Location.reverseGeocodeAsync(coordinate);
  if (!place) {
    return null;
  }

  const street = [place.streetNumber, place.street]
    .filter(isNonEmptyString)
    .join(' ');
  const locality = place.city ?? place.district;
  const regionAndPostalCode = [place.region, place.postalCode]
    .filter(isNonEmptyString)
    .join(' ');
  const includeCountry = place.country && place.isoCountryCode?.toUpperCase() !== 'US';
  const address = [street, locality, regionAndPostalCode, includeCountry ? place.country : null]
    .filter(isNonEmptyString)
    .join(', ');

  return address || null;
}

function isValidCoordinate(coordinate: LatLng) {
  return (
    Number.isFinite(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Location timeout.')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
