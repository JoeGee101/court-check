import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  type FacilityDetail,
  FacilityNotFoundError,
  getFacilityDetail,
  isValidFacilityId,
} from '@/features/facilities/facilities-api';
import { supabase } from '@/lib/supabase/client';

const REALTIME_INVALIDATION_DEBOUNCE_MS = 150;

export function useFacilityDetail(facilityId: string | undefined) {
  const normalizedFacilityId = isValidFacilityId(facilityId)
    ? facilityId.toLowerCase()
    : undefined;
  const hasValidFacilityId = normalizedFacilityId !== undefined;
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(hasValidFacilityId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNotFound, setIsNotFound] = useState(!hasValidFacilityId);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const latestRequestId = useRef(0);
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    () => {
      if (!normalizedFacilityId) {
        return;
      }

      const requestId = ++latestRequestId.current;

      void getFacilityDetail(normalizedFacilityId)
        .then((nextDetail) => {
          if (!isMounted.current || requestId !== latestRequestId.current) {
            return;
          }

          setDetail(nextDetail);
          setError(null);
          setIsNotFound(false);
        })
        .catch((requestError: unknown) => {
          if (!isMounted.current || requestId !== latestRequestId.current) {
            return;
          }

          if (requestError instanceof FacilityNotFoundError) {
            setDetail(null);
            setIsNotFound(true);
            setError(null);
          } else {
            setError('CourtCheck could not load this facility. Please try again.');
          }
        })
        .finally(() => {
          if (isMounted.current && requestId === latestRequestId.current) {
            setIsInitialLoading(false);
            setIsRefreshing(false);
          }
        });
    },
    [normalizedFacilityId],
  );

  const scheduleSilentRefresh = useCallback(() => {
    if (invalidationTimer.current) {
      clearTimeout(invalidationTimer.current);
    }

    invalidationTimer.current = setTimeout(() => {
      invalidationTimer.current = null;
      load();
    }, REALTIME_INVALIDATION_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      latestRequestId.current += 1;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const client = supabase;

    if (!client || !hasValidFacilityId) {
      return;
    }

    const channel = client
      .channel(`facility-detail-${normalizedFacilityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facility_activity',
          filter: `facility_id=eq.${normalizedFacilityId}`,
        },
        scheduleSilentRefresh,
      )
      .subscribe();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        scheduleSilentRefresh();
      }
    });

    return () => {
      appStateSubscription.remove();
      if (invalidationTimer.current) {
        clearTimeout(invalidationTimer.current);
        invalidationTimer.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [hasValidFacilityId, normalizedFacilityId, scheduleSilentRefresh]);

  const refresh = useCallback(() => {
    setError(null);
    if (detail === null) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    load();
  }, [detail, load]);

  return {
    detail,
    error,
    isInitialLoading,
    isNotFound,
    isRefreshing,
    refresh,
  };
}
