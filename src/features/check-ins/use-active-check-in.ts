import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  type ActiveCheckIn,
  ActiveCheckInError,
  checkOut,
  getMyActiveCheckIn,
} from '@/features/check-ins/active-check-in-api';
import { supabase } from '@/lib/supabase/client';

const REALTIME_INVALIDATION_DEBOUNCE_MS = 150;
const EXPIRY_REFETCH_BUFFER_MS = 250;
let nextSubscriptionId = 0;

type LoadMode = 'initial' | 'refresh' | 'silent';

export type CheckOutFeedback = {
  message: string;
  tone: 'error' | 'success';
};

export function useActiveCheckIn(onActivityChanged: () => void) {
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CheckOutFeedback | null>(null);
  const isMounted = useRef(true);
  const latestRequestId = useRef(0);
  const checkoutInFlight = useRef(false);
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const updateCountdownRef = useRef<(() => void) | null>(null);
  const onActivityChangedRef = useRef(onActivityChanged);

  const load = useCallback(async (mode: LoadMode) => {
    const requestId = ++latestRequestId.current;

    if (mode === 'initial') {
      setIsInitialLoading(true);
    } else if (mode === 'refresh') {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const nextActiveCheckIn = await getMyActiveCheckIn();

      if (!isMounted.current || requestId !== latestRequestId.current) {
        return nextActiveCheckIn;
      }

      setActiveCheckIn(nextActiveCheckIn);
      if (!nextActiveCheckIn) {
        setRemainingMs(null);
      }
      if (nextActiveCheckIn) {
        setFeedback(null);
      }

      return nextActiveCheckIn;
    } catch {
      if (!isMounted.current || requestId !== latestRequestId.current) {
        return;
      }

      setError('CourtCheck could not load your current check-in. Please try again.');
    } finally {
      if (isMounted.current && requestId === latestRequestId.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    return load('refresh');
  }, [load]);

  const scheduleSilentRefresh = useCallback(() => {
    if (invalidationTimer.current) {
      clearTimeout(invalidationTimer.current);
    }

    invalidationTimer.current = setTimeout(() => {
      invalidationTimer.current = null;
      void load('silent');
    }, REALTIME_INVALIDATION_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    isMounted.current = true;
    const initialLoadTimer = setTimeout(() => {
      void load('initial');
    }, 0);

    return () => {
      clearTimeout(initialLoadTimer);
      isMounted.current = false;
      latestRequestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    onActivityChangedRef.current = onActivityChanged;
  }, [onActivityChanged]);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      return;
    }

    const channel = client
      .channel(`my-active-check-in-activity-${++nextSubscriptionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facility_activity' },
        scheduleSilentRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          scheduleSilentRefresh();
        }
      });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        updateCountdownRef.current?.();
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
  }, [scheduleSilentRefresh]);

  useEffect(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }

    if (!activeCheckIn) {
      return;
    }

    // The expiry and reference time are database-authored. Date.now() is used only
    // to measure wall-clock time elapsed since that server snapshot so time spent
    // backgrounded is reflected immediately; it never changes canonical state.
    const serverDurationMs =
      Date.parse(activeCheckIn.expiresAt) - Date.parse(activeCheckIn.serverTime);
    const canonicalRemainingMs = Math.max(0, serverDurationMs);
    const clientWallClockAtSync = Date.now();
    let lastDisplayedRemainingMs = canonicalRemainingMs;
    const updateCountdown = () => {
      const elapsedWallClockMs = Math.max(0, Date.now() - clientWallClockAtSync);
      const wallClockRemainingMs = Math.max(
        0,
        canonicalRemainingMs - elapsedWallClockMs,
      );
      lastDisplayedRemainingMs = Math.min(
        lastDisplayedRemainingMs,
        wallClockRemainingMs,
      );
      setRemainingMs(lastDisplayedRemainingMs);

      if (lastDisplayedRemainingMs === 0 && countdownTimer.current) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    };

    updateCountdownRef.current = updateCountdown;
    updateCountdown();
    if (canonicalRemainingMs > 0) {
      countdownTimer.current = setInterval(updateCountdown, 1000);
    }
    const refetchDelayMs = Math.max(0, serverDurationMs) + EXPIRY_REFETCH_BUFFER_MS;

    expiryTimer.current = setTimeout(() => {
      expiryTimer.current = null;
      void load('refresh');
      onActivityChangedRef.current();
    }, refetchDelayMs);

    return () => {
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
      if (updateCountdownRef.current === updateCountdown) {
        updateCountdownRef.current = null;
      }
    };
  }, [activeCheckIn, load]);

  const checkout = useCallback(async () => {
    if (!activeCheckIn || checkoutInFlight.current) {
      return false;
    }

    checkoutInFlight.current = true;
    setIsCheckingOut(true);
    setFeedback(null);

    try {
      const result = await checkOut();

      if (!isMounted.current) {
        return false;
      }

      setFeedback({
        message:
          result.reason === 'expired'
            ? 'Your check-in had already expired.'
            : 'You’re checked out.',
        tone: 'success',
      });
      onActivityChanged();
      const reconciledActiveCheckIn = await refresh();

      return reconciledActiveCheckIn === null;
    } catch (checkoutError) {
      if (!isMounted.current) {
        return false;
      }

      if (
        checkoutError instanceof ActiveCheckInError &&
        checkoutError.code === 'already-closed'
      ) {
        setFeedback({ message: 'This check-in is already closed.', tone: 'success' });
        onActivityChanged();
        const reconciledActiveCheckIn = await refresh();

        return reconciledActiveCheckIn === null;
      } else if (
        checkoutError instanceof ActiveCheckInError &&
        checkoutError.code === 'session-required'
      ) {
        setFeedback({
          message: 'Your session is no longer valid. Please sign in again.',
          tone: 'error',
        });
      } else {
        setFeedback({
          message: 'CourtCheck could not check you out. Please try again.',
          tone: 'error',
        });
      }

      return false;
    } finally {
      checkoutInFlight.current = false;

      if (isMounted.current) {
        setIsCheckingOut(false);
      }
    }
  }, [activeCheckIn, onActivityChanged, refresh]);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    activeCheckIn,
    checkout,
    clearFeedback,
    error,
    feedback,
    isCheckingOut,
    isInitialLoading,
    isRefreshing,
    remainingMs,
    refresh,
  };
}
