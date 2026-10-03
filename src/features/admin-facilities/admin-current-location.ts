import * as Location from 'expo-location';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { LatLng } from 'react-native-maps';

const LOCATION_TIMEOUT_MS = 15_000;
const MAX_ANDROID_LOCATION_SEARCH_RESULTS = 1;
let adminFacilityLocationSearchRequestSequence = 0;

type ApplePlaceCompletion = {
  id: string;
  title: string;
  subtitle: string | null;
};

type ApplePlaceDetails = {
  address: string | null;
  facilityName: string | null;
  label: string;
  latitude: number;
  longitude: number;
};

type ApplePlaceSearchModule = {
  searchCompletions: (
    query: string,
    requestId: number,
    latitude: number | null,
    longitude: number | null,
  ) => Promise<ApplePlaceCompletion[]>;
  resolveCompletion: (completionId: string, requestId: number) => Promise<ApplePlaceDetails>;
  cancelSearch: (requestId: number) => Promise<void>;
};

const applePlaceSearchModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<ApplePlaceSearchModule>('CourtCheckApplePlaceSearch')
    : null;

export type AdminFacilityLocationSearchResult = {
  address: string | null;
  coordinate: LatLng | null;
  facilityName: string | null;
  id: string;
  label: string;
  nativeCompletionId?: string;
  requestId?: number;
};

export type ResolvedAdminFacilityLocationSearchResult = Omit<
  AdminFacilityLocationSearchResult,
  'coordinate' | 'nativeCompletionId' | 'requestId'
> & { coordinate: LatLng };

export class AdminLocationSearchPermissionError extends Error {
  constructor() {
    super('Location permission is required for native geocoding on Android.');
    this.name = 'AdminLocationSearchPermissionError';
  }
}

export function createAdminFacilityLocationSearchRequestId() {
  adminFacilityLocationSearchRequestSequence += 1;
  return adminFacilityLocationSearchRequestSequence;
}

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

  return formatAdminAddress(place);
}

export async function searchAdminFacilityLocations(
  query: string,
  requestId = 0,
  region?: LatLng | null,
): Promise<AdminFacilityLocationSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  if (Platform.OS === 'ios') {
    if (!applePlaceSearchModule) {
      throw new Error('Apple Maps place search is unavailable in this app build.');
    }

    const completions = await applePlaceSearchModule.searchCompletions(
      normalizedQuery,
      requestId,
      region?.latitude ?? null,
      region?.longitude ?? null,
    );

    return completions.slice(0, 5).flatMap((completion) => {
      const label = completion.title.trim();
      if (!label || !completion.id) {
        return [];
      }

      return [{
        address: completion.subtitle?.trim() || null,
        coordinate: null,
        facilityName: label,
        id: completion.id,
        label,
        nativeCompletionId: completion.id,
        requestId,
      }];
    });
  }

  if (Platform.OS === 'android') {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      throw new AdminLocationSearchPermissionError();
    }
  }

  const matches = (await Location.geocodeAsync(normalizedQuery))
    .filter((match) =>
      isValidCoordinate({ latitude: match.latitude, longitude: match.longitude }),
    )
    .slice(0, MAX_ANDROID_LOCATION_SEARCH_RESULTS);

  return Promise.all(matches.map(async (match, index) => {
    const coordinate = { latitude: match.latitude, longitude: match.longitude };
    let place: Location.LocationGeocodedAddress | null = null;
    try {
      [place] = await Location.reverseGeocodeAsync(coordinate);
    } catch {
      // Keep the forward-geocoded result usable when reverse geocoding fails.
    }

    const address = place ? formatAdminAddress(place) : null;
    const facilityName = place ? meaningfulPlaceName(place, address) : null;
    return {
      address,
      coordinate,
      facilityName,
      id: `${coordinate.latitude},${coordinate.longitude},${index}`,
      label:
        facilityName ??
        address ??
        `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`,
    };
  }));
}

export async function resolveAdminFacilityLocationSearchResult(
  result: AdminFacilityLocationSearchResult,
): Promise<ResolvedAdminFacilityLocationSearchResult> {
  if (result.coordinate) {
    return result as ResolvedAdminFacilityLocationSearchResult;
  }

  if (
    Platform.OS !== 'ios' ||
    !applePlaceSearchModule ||
    !result.nativeCompletionId ||
    result.requestId === undefined
  ) {
    throw new Error('The selected place is no longer available. Search again.');
  }

  const place = await applePlaceSearchModule.resolveCompletion(
    result.nativeCompletionId,
    result.requestId,
  );
  const coordinate = { latitude: place.latitude, longitude: place.longitude };
  if (!isValidCoordinate(coordinate)) {
    throw new Error('The selected place has no valid map location.');
  }

  const facilityName = meaningfulSearchFacilityName(place.facilityName, place.address);
  return {
    address: place.address,
    coordinate,
    facilityName,
    id: result.id,
    label: facilityName ?? place.label ?? result.label,
  };
}

export function cancelAdminFacilityLocationSearch(requestId: number) {
  if (Platform.OS === 'ios' && applePlaceSearchModule) {
    void applePlaceSearchModule.cancelSearch(requestId).catch(() => undefined);
  }
}

function formatAdminAddress(place: Location.LocationGeocodedAddress): string | null {
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

function meaningfulPlaceName(
  place: Location.LocationGeocodedAddress,
  address: string | null,
) {
  const name = place.name?.trim();
  if (!name) {
    return null;
  }

  const normalizedName = name.toLocaleLowerCase();
  const normalizedAddress = address?.trim().toLocaleLowerCase();
  const administrativeNames = [
    place.street,
    place.city,
    place.district,
    place.subregion,
    place.region,
  ].map((value) => value?.trim().toLocaleLowerCase());
  return normalizedName === normalizedAddress || administrativeNames.includes(normalizedName)
    ? null
    : name;
}

function meaningfulSearchFacilityName(name: string | null, address: string | null) {
  const normalizedName = name?.trim();
  if (!normalizedName) {
    return null;
  }

  const lowerName = normalizedName.toLocaleLowerCase();
  const addressParts = address
    ?.split(',')
    .map((part) => part.trim().toLocaleLowerCase()) ?? [];
  return lowerName === address?.trim().toLocaleLowerCase() || addressParts.includes(lowerName)
    ? null
    : normalizedName;
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
