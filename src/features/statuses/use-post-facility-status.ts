import { useCallback, useEffect, useRef, useState } from 'react';

import type { FacilityStatusType } from '@/features/facilities/facilities-api';
import {
  FacilityStatusPostError,
  postFacilityStatus,
} from '@/features/statuses/facility-status-api';

export type FacilityStatusFeedback = {
  message: string;
  tone: 'error' | 'success';
};

type UsePostFacilityStatusOptions = {
  facilityId: string | undefined;
  onAuthorizationFailure: () => void;
  onFacilityUnavailable: () => void;
  onSuccess: () => void;
};

export function usePostFacilityStatus({
  facilityId,
  onAuthorizationFailure,
  onFacilityUnavailable,
  onSuccess,
}: UsePostFacilityStatusOptions) {
  const [postingType, setPostingType] = useState<FacilityStatusType | null>(null);
  const [feedback, setFeedback] = useState<FacilityStatusFeedback | null>(null);
  const isMounted = useRef(true);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const postStatus = useCallback(
    async (statusType: FacilityStatusType) => {
      if (!facilityId || submissionInFlight.current) {
        return;
      }

      submissionInFlight.current = true;
      setPostingType(statusType);
      setFeedback(null);

      try {
        await postFacilityStatus(facilityId, statusType);

        if (!isMounted.current) {
          return;
        }

        setFeedback({ message: 'Status report confirmed.', tone: 'success' });
        onSuccess();
      } catch (error) {
        if (!isMounted.current) {
          return;
        }

        setFeedback(getSafeFeedback(error));

        if (
          error instanceof FacilityStatusPostError &&
          error.code === 'active-check-in-required'
        ) {
          onAuthorizationFailure();
        } else if (
          error instanceof FacilityStatusPostError &&
          error.code === 'facility-unavailable'
        ) {
          onFacilityUnavailable();
        }
      } finally {
        submissionInFlight.current = false;

        if (isMounted.current) {
          setPostingType(null);
        }
      }
    },
    [facilityId, onAuthorizationFailure, onFacilityUnavailable, onSuccess],
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return { clearFeedback, feedback, postStatus, postingType };
}

function getSafeFeedback(error: unknown): FacilityStatusFeedback {
  if (error instanceof FacilityStatusPostError) {
    switch (error.code) {
      case 'active-check-in-required':
        return {
          message: 'You must be actively checked in at this facility to report its status.',
          tone: 'error',
        };
      case 'facility-unavailable':
        return {
          message: 'This facility is no longer available for status reports.',
          tone: 'error',
        };
      case 'account-required':
        return {
          message: 'A completed CourtCheck account is required to report a status.',
          tone: 'error',
        };
      case 'session-required':
        return {
          message: 'Your session is no longer valid. Please sign in again.',
          tone: 'error',
        };
      case 'unknown':
        break;
    }
  }

  return {
    message: 'CourtCheck could not post this status. Please try again.',
    tone: 'error',
  };
}
