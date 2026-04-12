import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import { getSupabaseAuthKey } from '@/utils/supabaseUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthError,
  AuthResponse,
  Session,
  User
} from '@supabase/supabase-js';
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';

interface AuthContextType {
  // Auth state
  isLoading: boolean;
  isAuthenticated: boolean;
  session: Session | null;
  currentUser: User | null;
  // System state
  migrationNeeded: boolean;
  setMigrationNeeded: (needed: boolean) => void;
  appUpgradeNeeded: boolean;
  upgradeError: {
    localVersion: string;
    serverVersion: string;
    reason: string;
  } | null;

  // Auth methods
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (
    email: string,
    password: string,
    data?: Record<string, unknown>
  ) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (
    email: string
  ) => Promise<{ data: object | null; error: AuthError | null }>;
  updatePassword: (
    newPassword: string
  ) => Promise<{ data: unknown; error: AuthError | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function useAuth() {
  const context = useContext(AuthContext);
  // Always call hooks unconditionally - get currentUser from localStore for fallback
  const currentUserFromStore = useLocalStore((state) => state.currentUser);

  // If context is not available (e.g., component rendered before AuthProvider),
  // fall back to local store for anonymous state
  if (!context) {
    // Return anonymous state - allows components to work outside AuthProvider
    // This is useful for components that render during initialization or
    // in parts of the app that don't require authentication
    return {
      isLoading: false,
      isAuthenticated: false,
      session: null,
      currentUser: currentUserFromStore || null,
      migrationNeeded: false,
      setMigrationNeeded: () => {
        // No-op fallback for components outside AuthProvider
      },
      appUpgradeNeeded: false,
      upgradeError: null,
      signIn: async () => {
        throw new Error('AuthProvider not available - cannot sign in');
      },
      signUp: async () => {
        throw new Error('AuthProvider not available - cannot sign up');
      },
      signOut: async () => {
        throw new Error('AuthProvider not available - cannot sign out');
      },
      resetPassword: async () => {
        throw new Error('AuthProvider not available - cannot reset password');
      },
      updatePassword: async () => {
        throw new Error('AuthProvider not available - cannot update password');
      }
    } as AuthContextType;
  }

  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [appUpgradeNeeded, setAppUpgradeNeeded] = useState(false);
  const [upgradeError, setUpgradeError] = useState<{
    localVersion: string;
    serverVersion: string;
    reason: string;
  } | null>(null);

  const initializeSystem = async () => {
    try {
      console.log('[AuthContext] Initializing system...');
      setMigrationNeeded(false);
      setAppUpgradeNeeded(false);
      setUpgradeError(null);
      await system.init();
      console.log('[AuthContext] System initialized successfully');
    } catch (error) {
      console.error('[AuthContext] System init failed:', error);

      if (error && typeof error === 'object' && 'name' in error) {
        if ((error as { name: string }).name === 'AppUpgradeNeededError') {
          console.log(
            '[AuthContext] App upgrade needed - showing upgrade screen'
          );
          const upgradeErr = error as unknown as {
            localVersion: string;
            serverVersion: string;
            reason: 'server_ahead' | 'server_behind';
          };
          setAppUpgradeNeeded(true);
          setUpgradeError(upgradeErr);
          setIsLoading(false);
          return;
        }

        if ((error as { name: string }).name === 'MigrationNeededError') {
          console.log(
            '[AuthContext] Migration needed - showing migration screen'
          );
          setMigrationNeeded(true);
          setIsLoading(false);
          return;
        }
      }

      setMigrationNeeded(false);
      setAppUpgradeNeeded(false);
      setUpgradeError(null);
      setIsLoading(false);
      RNAlert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please try logging out and back in.',
        [{ text: 'OK', isPreferred: true }]
      );
    }
  };

  const cleanupSystem = async () => {
    try {
      console.log('[AuthContext] Cleaning up system...');
      await system.cleanup();
      console.log('[AuthContext] System cleanup complete');
    } catch (error) {
      console.error('[AuthContext] System cleanup failed:', error);
    }
  };

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    console.log('[AuthContext] Setting up auth listener...');

    // =========================================================================
    // FAST OFFLINE PATH
    // =========================================================================
    // When offline with an expired token, Supabase's onAuthStateChange won't fire
    // INITIAL_SESSION until it exhausts its token refresh retries (~25+ seconds).
    // To avoid this delay, we race between:
    // 1. Fast path: Check network, if offline load session from AsyncStorage directly
    // 2. Normal path: Wait for Supabase's INITIAL_SESSION event
    // Whichever completes first wins, the other is skipped via hasInitializedRef.
    // =========================================================================

    const tryFastOfflinePath = async () => {
      try {
        // Use RPC call with timeout to definitively check if we're online
        // NetInfo can be unreliable with VPNs - RPC is a sure way to know
        const RPC_TIMEOUT_MS = 3000;

        const rpcCheck = async (): Promise<boolean> => {
          try {
            const { error } =
              await system.supabaseConnector.client.rpc('get_schema_info');
            return !error;
          } catch {
            return false;
          }
        };

        const timeoutPromise = new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), RPC_TIMEOUT_MS)
        );

        const isOnline = await Promise.race([rpcCheck(), timeoutPromise]);

        // Only use fast path if we're offline (RPC failed or timed out)
        if (isOnline) {
          console.log(
            '[AuthContext] Server reachable - using normal Supabase flow'
          );
          return;
        }

        console.log(
          '[AuthContext] Server unreachable - trying fast session load from AsyncStorage'
        );

        const authKey = await getSupabaseAuthKey();
        if (!authKey) {
          console.log('[AuthContext] No auth key found');
          return;
        }

        const sessionString = await AsyncStorage.getItem(authKey);
        if (!sessionString) {
          console.log('[AuthContext] No session in AsyncStorage');
          return;
        }

        const storedData = JSON.parse(sessionString) as Record<string, unknown>;
        if (!storedData?.access_token || !storedData?.user) {
          console.log('[AuthContext] Invalid session format in AsyncStorage');
          return;
        }

        // Check if we already initialized via INITIAL_SESSION (race lost)
        if (hasInitializedRef.current) {
          console.log(
            '[AuthContext] Fast path: Already initialized via INITIAL_SESSION, skipping'
          );
          return;
        }

        // Win the race - mark as initialized
        hasInitializedRef.current = true;
        console.log(
          '[AuthContext] Fast path: Loading session from AsyncStorage (offline mode)'
        );

        const offlineSession = storedData as unknown as Session;
        setSession(offlineSession);
        system.supabaseConnector.updateSession(offlineSession);

        // Initialize system
        console.log('[AuthContext] Fast path: Starting system initialization');
        await initializeSystem();
        console.log(
          '[AuthContext] Fast path: System initialization complete (offline mode)'
        );
        setIsLoading(false);
      } catch (error) {
        console.warn('[AuthContext] Fast offline path failed:', error);
        // Don't set hasInitializedRef - let normal flow handle it
      }
    };

    // Start the fast offline path immediately (non-blocking)
    void tryFastOfflinePath();

    // =========================================================================
    // NORMAL SUPABASE PATH
    // =========================================================================
    // Listen for auth state changes - this is the normal flow when online
    // or as fallback when offline fast path fails.

    const {
      data: { subscription }
    } = system.supabaseConnector.client.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth event:', event);
        console.log('[AuthContext] Session in event:', {
          hasSession: !!session
        });

        // =======================================================================
        // CRITICAL FIX: Do NOT update session before the switch statement!
        // Previously, setSession(session) and updateSession(session) ran here,
        // which would clear the session even when we should skip the event.
        // Now session updates happen INSIDE each case, AFTER skip checks.
        // =======================================================================

        switch (event) {
          case 'INITIAL_SESSION': {
            // Check if fast offline path already initialized
            if (hasInitializedRef.current) {
              console.log(
                '[AuthContext] INITIAL_SESSION: Already initialized via fast path, ignoring completely'
              );
              // CRITICAL: Do NOT update session - keep the one from fast path
              return;
            }

            // Win the race - mark as initialized
            hasInitializedRef.current = true;

            // INITIAL_SESSION fires when Supabase loads the session from AsyncStorage.
            // IMPORTANT: When offline with expired token, Supabase may clear the session
            // and fire INITIAL_SESSION with null. We need to fall back to reading
            // the raw session from AsyncStorage to support offline-first usage.
            let effectiveSession = session;

            if (!effectiveSession) {
              console.log(
                '[AuthContext] INITIAL_SESSION has null session - checking AsyncStorage directly'
              );
              try {
                const authKey = await getSupabaseAuthKey();
                if (authKey) {
                  const sessionString = await AsyncStorage.getItem(authKey);
                  if (sessionString) {
                    const storedData = JSON.parse(sessionString) as Record<
                      string,
                      unknown
                    >;
                    // Supabase stores session in a specific format
                    if (storedData?.access_token && storedData?.user) {
                      console.log(
                        '[AuthContext] Found session in AsyncStorage (may be expired)'
                      );
                      effectiveSession = storedData as unknown as Session;
                    }
                  }
                }
              } catch (error) {
                console.warn(
                  '[AuthContext] Failed to read session from AsyncStorage:',
                  error
                );
              }
            }

            // Now update session state (only after we've determined effectiveSession)
            setSession(effectiveSession);
            system.supabaseConnector.updateSession(effectiveSession);

            if (effectiveSession) {
              console.log(
                '[AuthContext] Found existing session via INITIAL_SESSION'
              );

              // Initialize system for existing sessions
              console.log(
                '[AuthContext] Starting system initialization from INITIAL_SESSION'
              );
              await initializeSystem();
              console.log(
                '[AuthContext] System initialization complete from INITIAL_SESSION'
              );
            } else {
              console.log('[AuthContext] No session found - anonymous mode');
            }
            setIsLoading(false);
            break;
          }

          case 'SIGNED_IN': {
            setSession(session);
            system.supabaseConnector.updateSession(session);

            console.log('[AuthContext] User signed in');

            console.log(
              '[AuthContext] Starting system initialization from SIGNED_IN event'
            );
            await initializeSystem();
            console.log(
              '[AuthContext] System initialization complete from SIGNED_IN event'
            );

            setIsLoading(false);
            break;
          }

          case 'PASSWORD_RECOVERY':
            // Update connector immediately (system.init needs it), but
            // defer React state updates until after init completes -- same
            // pattern as SIGNED_IN to keep state transitions atomic.
            system.supabaseConnector.updateSession(session);

            console.log('[AuthContext] Password recovery session');

            if (!system.isPowerSyncInitialized()) {
              await initializeSystem();
            }

            setSession(session);
            setIsLoading(false);
            break;

          case 'SIGNED_OUT':
            if (__DEV__) {
              console.log('[AuthContext] User signed out (dev mode)');
              system.supabaseConnector.updateSession(null);
              await cleanupSystem();
              setSession(null);
            } else {
              console.log(
                '[AuthContext] SIGNED_OUT event ignored in production - users stay authenticated'
              );
            }
            break;

          case 'TOKEN_REFRESHED':
            // Only update session if we have a valid new session
            if (session) {
              setSession(session);
              system.supabaseConnector.updateSession(session);
              console.log('[AuthContext] Token refreshed successfully');
            } else {
              console.log(
                '[AuthContext] TOKEN_REFRESHED with null session - ignoring'
              );
            }
            break;

          case 'USER_UPDATED':
            // Update session for user updates
            if (session) {
              setSession(session);
              system.supabaseConnector.updateSession(session);
            }
            console.log('[AuthContext] User updated');
            break;

          default:
            console.log('[AuthContext] Unknown auth event:', event);
        }
      }
    );

    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  // Auth methods - thin wrappers around Supabase
  const signIn = async (email: string, password: string) => {
    return system.supabaseConnector.client.auth.signInWithPassword({
      email,
      password
    });
  };

  const signUp = async (
    email: string,
    password: string,
    data?: Record<string, unknown>
  ) => {
    return system.supabaseConnector.client.auth.signUp({
      email,
      password,
      options: {
        data: data || {},
        emailRedirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}${
          process.env.EXPO_PUBLIC_APP_VARIANT !== 'production'
            ? `?env=${process.env.EXPO_PUBLIC_APP_VARIANT}`
            : ''
        }`
      }
    });
  };

  const signOut = async () => {
    await system.supabaseConnector.signOut();
  };

  const resetPassword = async (email: string) => {
    return system.supabaseConnector.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}${
        process.env.EXPO_PUBLIC_APP_VARIANT !== 'production'
          ? `?env=${process.env.EXPO_PUBLIC_APP_VARIANT}`
          : ''
      }`
    });
  };

  const updatePassword = async (newPassword: string) => {
    return system.supabaseConnector.client.auth.updateUser({
      password: newPassword
    });
  };

  const value: AuthContextType = {
    isLoading,
    isAuthenticated: !!session,
    session,
    currentUser: session?.user || null,
    migrationNeeded,
    setMigrationNeeded,
    appUpgradeNeeded,
    upgradeError,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
