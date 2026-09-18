import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { supabase, supabaseConfigError } from '@/lib/supabase/client';
import type { CourtCheckProfile, UserRole } from '@/types/user';

type AccountRow = CourtCheckProfile & {
  role: UserRole;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: CourtCheckProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  error: string | null;
  completeAccountDeletion: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CourtCheckProfile | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(supabase !== null);
  const [error, setError] = useState<string | null>(supabaseConfigError);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const sessionUserId = useRef<string | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    const nextUserId = nextSession?.user.id ?? null;

    if (sessionUserId.current !== nextUserId) {
      setProfile(null);
      setProfileUserId(null);
      setRole(null);
      setError(supabaseConfigError);
      sessionUserId.current = nextUserId;
    }

    setSession(nextSession);
  }, []);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      return;
    }

    let isMounted = true;

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        applySession(nextSession);
      }
    });

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      applySession(data.session);
      setIsSessionLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      return;
    }

    const updateAutoRefresh = (state: AppStateStatus) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    };

    updateAutoRefresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateAutoRefresh);

    return () => {
      subscription.remove();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    const client = supabase;

    if (isSessionLoading || !session || !client) {
      return;
    }

    let isCurrentRequest = true;
    const userId = session.user.id;

    void client
      .rpc('get_my_account')
      .maybeSingle<AccountRow>()
      .then(({ data, error: accountError }) => {
        if (!isCurrentRequest) {
          return;
        }

        if (accountError) {
          setError(accountError.message);
          return;
        }

        if (!data || data.id !== userId || (data.role !== 'user' && data.role !== 'admin')) {
          setError('CourtCheck could not load a valid account record for this session.');
          return;
        }

        const { role: accountRole, ...accountProfile } = data;

        setError(null);
        setProfile(accountProfile);
        setProfileUserId(userId);
        setRole(accountRole);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [isSessionLoading, refreshRevision, session]);

  const refreshProfile = useCallback(() => {
    setRefreshRevision((revision) => revision + 1);
  }, []);

  const completeAccountDeletion = useCallback(async () => {
    if (!supabase) {
      applySession(null);
      setIsSessionLoading(false);
      return;
    }

    // The server-side Auth identity has already been deleted. Local scope
    // removes the persisted device session even when the remote session no
    // longer exists; applying null immediately also tears down protected UI.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Server deletion is already authoritative. Never leave deleted-account
      // UI mounted because best-effort local cleanup raised unexpectedly.
    } finally {
      applySession(null);
      setRefreshRevision(0);
      setIsSessionLoading(false);
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      setError(supabaseConfigError ?? 'Supabase is not configured.');
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }
  }, []);

  const isLoading =
    isSessionLoading ||
    Boolean(session && profileUserId !== session.user.id && error === null);

  const value = useMemo<AuthContextValue>(
    () => ({
      completeAccountDeletion,
      session,
      user: session?.user ?? null,
      profile,
      role,
      isLoading,
      isOnboardingComplete: profile?.onboarding_completed_at != null,
      error,
      signOut,
      refreshProfile,
    }),
    [completeAccountDeletion, error, isLoading, profile, refreshProfile, role, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within SessionProvider.');
  }

  return context;
}
