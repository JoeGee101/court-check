import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  listAdminFacilities,
  type AdminFacilitySummary,
} from '@/features/admin-facilities/admin-facilities-api';

type LoadMode = 'initial' | 'refresh' | 'silent';

export function useAdminFacilities() {
  const [facilities, setFacilities] = useState<AdminFacilitySummary[] | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const latestRequestId = useRef(0);
  const currentAppState = useRef<AppStateStatus>(AppState.currentState);

  const load = useCallback(async (mode: LoadMode): Promise<boolean> => {
    const requestId = ++latestRequestId.current;

    if (mode === 'initial') {
      setIsInitialLoading(true);
    } else if (mode === 'refresh') {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const nextFacilities = await listAdminFacilities();

      if (!isMounted.current) {
        return false;
      }

      if (requestId !== latestRequestId.current) {
        return true;
      }

      setFacilities(nextFacilities);
      return true;
    } catch {
      if (!isMounted.current) {
        return false;
      }

      if (requestId !== latestRequestId.current) {
        return true;
      }

      setError('CourtCheck could not load facility management. Please try again.');
      return false;
    } finally {
      if (isMounted.current && requestId === latestRequestId.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => {
      void load('initial');
    }, 0);

    return () => clearTimeout(initialLoadTimer);
  }, [load]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = currentAppState.current !== 'active';
      currentAppState.current = nextState;

      if (nextState === 'active' && wasInactive) {
        void load('silent');
      }
    });

    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      latestRequestId.current += 1;
    };
  }, []);

  const refresh = useCallback(() => load(facilities === null ? 'initial' : 'refresh'), [facilities, load]);

  const reconcile = useCallback(() => load('silent'), [load]);

  return {
    error,
    facilities: facilities ?? [],
    isInitialLoading,
    isRefreshing,
    reconcile,
    refresh,
  };
}
