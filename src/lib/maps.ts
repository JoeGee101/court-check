import { Linking, Platform } from 'react-native';

export type PublicFacilityDestination = {
  address: string;
  latitude: number;
  longitude: number;
  name: string;
};

export async function openFacilityDirections(
  facility: PublicFacilityDestination,
): Promise<void> {
  const destination = getDestination(facility);
  const encodedDestination = encodeURIComponent(destination);
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${encodedDestination}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;

  await Linking.openURL(url);
}

function getDestination({
  address,
  latitude,
  longitude,
}: PublicFacilityDestination): string {
  if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
    return `${latitude},${longitude}`;
  }

  const normalizedAddress = address.trim();

  if (!normalizedAddress) {
    throw new Error('Facility destination is unavailable.');
  }

  return normalizedAddress;
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}
