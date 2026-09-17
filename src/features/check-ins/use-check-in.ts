import { useCallback, useEffect, useRef, useState } from 'react';

import { checkInAtFacility, CheckInError } from '@/features/check-ins/check-in-api';
import { ForegroundLocationError, getCheckInCoordinates } from '@/lib/location';

export type CheckInPhase = 'idle' | 'locating' | 'submitting' | 'success';

export type CheckInFeedback = {
  message: string;
  tone: 'error' | 'success';
  canOpenSettings?: boolean;
};

type UseCheckInOptions = {
  facilityId: string | undefined;
  onActiveCheckInConflict: () => void;
  onFacilityUnavailable: () => void;
  onSuccess: () => void;
};

export function useCheckIn({
  facilityId,
  onActiveCheckInConflict,
  onFacilityUnavailable,
  onSuccess,
}: UseCheckInOptions) {
  const [phase, setPhase] = useState<CheckInPhase>('idle');
  const [feedback, setFeedback] = useState<CheckInFeedback | null>(null);
  const isMounted = useRef(true);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const checkIn = useCallback(async () => {
    if (!facilityId || submissionInFlight.current || phase === 'success') {
      return;
    }

    submissionInFlight.current = true;
    setFeedback(null);
    setPhase('locating');
    let succeeded = false;

    try {
      const coordinates = await getCheckInCoordinates();

      if (!isMounted.current) {
        return;
      }

      setPhase('submitting');
      await checkInAtFacility(facilityId, coordinates);
      succeeded = true;

      if (!isMounted.current) {
        return;
      }

      setPhase('success');
      setFeedback({
        message: 'Check-in accepted. Updating live activity…',
        tone: 'success',
      });
      onSuccess();
    } catch (error) {
      if (!isMounted.current) {
        return;
      }

      const nextFeedback = getSafeFeedback(error);
      setFeedback(nextFeedback);
      setPhase('idle');

      if (error instanceof CheckInError && error.code === 'facility-unavailable') {
        onFacilityUnavailable();
      } else if (error instanceof CheckInError && error.code === 'already-checked-in') {
        onActiveCheckInConflict();
      }
    } finally {
      submissionInFlight.current = false;

      if (isMounted.current && !succeeded) {
        setPhase('idle');
      }
    }
  }, [facilityId, onActiveCheckInConflict, onFacilityUnavailable, onSuccess, phase]);

  const resetAfterConfirmedCheckout = useCallback(() => {
    if (!isMounted.current || submissionInFlight.current) {
      return;
    }

    setPhase('idle');
    setFeedback(null);
  }, []);

  return {
    checkIn,
    feedback,
    isBusy: phase === 'locating' || phase === 'submitting',
    phase,
    resetAfterConfirmedCheckout,
  };
}

function getSafeFeedback(error: unknown): CheckInFeedback {
  if (error instanceof ForegroundLocationError) {
    switch (error.code) {
      case 'services-disabled':
        return {
          message: 'Turn on Location Services to check in, then try again.',
          tone: 'error',
        };
      case 'permission-denied':
        return {
          message: 'Foreground location access is required to check in. Please try again.',
          tone: 'error',
        };
      case 'permission-blocked':
        return {
          message: 'Allow foreground location access in Settings to check in.',
          tone: 'error',
          canOpenSettings: true,
        };
      case 'timeout':
        return {
          message: 'We could not get your current location. Move to an open area and try again.',
          tone: 'error',
        };
      case 'unavailable':
        return {
          message: 'Your current location is unavailable. Please try again.',
          tone: 'error',
        };
    }
  }

  if (error instanceof CheckInError) {
    switch (error.code) {
      case 'outside-geofence':
        return {
          message:
            'You need to be at this facility to check in. If you are there, make sure Precise Location is enabled and try again.',
          tone: 'error',
        };
      case 'already-checked-in':
        return {
          message: 'You already have an active check-in. Check out before starting another.',
          tone: 'error',
        };
      case 'facility-unavailable':
        return {
          message: 'This facility is no longer available for check-in.',
          tone: 'error',
        };
      case 'account-required':
        return {
          message: 'A completed, phone-verified CourtCheck account is required to check in.',
          tone: 'error',
        };
      case 'session-required':
        return {
          message: 'Your session is no longer valid. Please sign in again.',
          tone: 'error',
        };
      case 'invalid-location':
        return {
          message: 'CourtCheck could not use this location. Please try again.',
          tone: 'error',
        };
      case 'unknown':
        break;
    }
  }

  return {
    message: 'CourtCheck could not complete check-in. Please try again.',
    tone: 'error',
  };
}
