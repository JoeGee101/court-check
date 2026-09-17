import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { listFacilities, type FacilitySummary } from '@/features/facilities/facilities-api';
import { supabase } from '@/lib/supabase/client';

const SEARCH_DEBOUNCE_MS = 300;
const REALTIME_INVALIDATION_DEBOUNCE_MS = 150;
let nextFacilityListSubscriptionId = 0;

type LoadMode = 'initial' | 'refresh' | 'silent';

export function useFacilities() {
  const [facilities, setFacilities] = useState<FacilitySummary[] | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeChannelName] = useState(
    () => `facility-list-activity-${++nextFacilityListSubscriptionId}`,
  );
  const isMounted = useRef(true);
  const hasLoaded = useRef(false);
  const latestRequestId = useRef(0);
  const currentSearch = useRef('');
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query: string, mode: LoadMode) => {
    const requestId = ++latestRequestId.current;

    if (mode === 'initial') {
      setIsInitialLoading(true);
    } else if (mode === 'refresh') {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const nextFacilities = await listFacilities(query);

      if (!isMounted.current || requestId !== latestRequestId.current) {
        return;
      }

      setFacilities(nextFacilities);
      hasLoaded.current = true;
    } catch {
      if (!isMounted.current || requestId !== latestRequestId.current) {
        return;
      }

      setError('CourtCheck could not load facilities. Please try again.');
    } finally {
      if (isMounted.current && requestId === latestRequestId.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  const scheduleSilentRefresh = useCallback(() => {
    if (invalidationTimer.current) {
      clearTimeout(invalidationTimer.current);
    }

    invalidationTimer.current = setTimeout(() => {
      invalidationTimer.current = null;
      void load(currentSearch.current, 'silent');
    }, REALTIME_INVALIDATION_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    currentSearch.current = debouncedSearch;
    void load(debouncedSearch, hasLoaded.current ? 'refresh' : 'initial');
  }, [debouncedSearch, load]);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      return;
    }

    const channel = client
      .channel(realtimeChannelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facility_activity' },
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
  }, [realtimeChannelName, scheduleSilentRefresh]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      latestRequestId.current += 1;
    };
  }, []);

  const refresh = useCallback(() => {
    void load(currentSearch.current, facilities === null ? 'initial' : 'refresh');
  }, [facilities, load]);

  return {
    facilities: facilities ?? [],
    search,
    setSearch,
    isInitialLoading,
    isRefreshing,
    error,
    refresh,
  };
}
