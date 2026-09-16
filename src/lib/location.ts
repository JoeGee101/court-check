import * as Location from 'expo-location';

const LOCATION_TIMEOUT_MS = 15_000;

export type CheckInCoordinates = {
  latitude: number;
  longitude: number;
};

export type ForegroundLocationErrorCode =
  | 'services-disabled'
  | 'permission-denied'
  | 'permission-blocked'
  | 'timeout'
  | 'unavailable';

export class ForegroundLocationError extends Error {
  constructor(readonly code: ForegroundLocationErrorCode) {
    super('Foreground location unavailable.');
    this.name = 'ForegroundLocationError';
  }
}

export async function getCheckInCoordinates(): Promise<CheckInCoordinates> {
  let servicesEnabled: boolean;

  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    throw new ForegroundLocationError('unavailable');
  }

  if (!servicesEnabled) {
    throw new ForegroundLocationError('services-disabled');
  }

  let permission: Location.LocationPermissionResponse;

  try {
    permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== Location.PermissionStatus.GRANTED) {
      if (!permission.canAskAgain) {
        throw new ForegroundLocationError('permission-blocked');
      }

      permission = await Location.requestForegroundPermissionsAsync();
    }
  } catch (error) {
    if (error instanceof ForegroundLocationError) {
      throw error;
    }

    throw new ForegroundLocationError('unavailable');
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new ForegroundLocationError(
      permission.canAskAgain ? 'permission-denied' : 'permission-blocked',
    );
  }

  try {
    const location = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      LOCATION_TIMEOUT_MS,
    );
    const { latitude, longitude } = location.coords;

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ForegroundLocationError('unavailable');
    }

    return { latitude, longitude };
  } catch (error) {
    if (error instanceof ForegroundLocationError) {
      throw error;
    }

    throw new ForegroundLocationError('unavailable');
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ForegroundLocationError('timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
