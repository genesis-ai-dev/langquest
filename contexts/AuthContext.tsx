import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import RNAlert from '@blazejkustra/react-native-alert';
import type {
  AuthError,
  AuthResponse,
  Session,
  User
} from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type SessionType = 'normal' | 'password-reset' | null;

interface AuthContextType {
  // Auth state
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionType: SessionType;
  session: Session | null;
  currentUser: User | null;
  // System state
  isSystemReady: boolean;
  migrationNeeded: boolean;
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
      sessionType: null,
      session: null,
      currentUser: currentUserFromStore || null,
      isSystemReady: true, // Allow queries to work for anonymous browsing
      migrationNeeded: false,
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

function getSessionType(session: Session | null): SessionType {
  if (!session) return null;

  console.log('[AuthContext] Analyzing session type:', {
    hasSession: !!session,
    userId: session.user.id,
    email: session.user.email,
    recovery_sent_at: session.user.recovery_sent_at,
    role: session.user.role,
    user_metadata: session.user.user_metadata,
    app_metadata: session.user.app_metadata
  });

  // Check if this is a password recovery session
  // This is typically indicated by the presence of recovery metadata
  if (session.user.recovery_sent_at) {
    return 'password-reset';
  }

  return 'normal';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [appUpgradeNeeded, setAppUpgradeNeeded] = useState(false);
  const [upgradeError, setUpgradeError] = useState<{
    localVersion: string;
    serverVersion: string;
    reason: string;
  } | null>(null);

  // Initialize system when we have an authenticated session
  const initializeSystem = async () => {
    try {
      console.log('[AuthContext] Initializing system...');
      setIsSystemReady(false);
      setMigrationNeeded(false);
      setAppUpgradeNeeded(false);
      setUpgradeError(null);
      await system.init();
      setIsSystemReady(true);
      console.log('[AuthContext] System initialized successfully');
    } catch (error) {
      console.error('[AuthContext] System init failed:', error);

      // Check if this is an app upgrade needed error
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
          setIsSystemReady(false);
          return; // Don't show error alert for app upgrade
        }

        // Check if this is a migration needed error
        if ((error as { name: string }).name === 'MigrationNeededError') {
          console.log(
            '[AuthContext] Migration needed - showing migration screen'
          );
          setMigrationNeeded(true);
          setIsSystemReady(false);
          return; // Don't show error alert for migration
        }
      }

      setIsSystemReady(false);
      setMigrationNeeded(false);
      setAppUpgradeNeeded(false);
      setUpgradeError(null);
      // Show error to user for other errors
      RNAlert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please try logging out and back in.',
        [{ text: 'OK' }]
      );
    }
  };

  // Cleanup system when signing out
  const cleanupSystem = async () => {
    try {
      console.log('[AuthContext] Cleaning up system...');
      await system.cleanup();
      setIsSystemReady(false);
      console.log('[AuthContext] System cleanup complete');
    } catch (error) {
      console.error('[AuthContext] System cleanup failed:', error);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Setting up auth listener...');

    // Check for existing session
    void system.supabaseConnector.client.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('[AuthContext] Error getting session:', error);
        } else if (session) {
          console.log('[AuthContext] Found existing session');
          const detectedSessionType = getSessionType(session);
          console.log(
            '[AuthContext] Detected session type for existing session:',
            detectedSessionType
          );
          setSession(session);
          setSessionType(detectedSessionType);

          // Update the session in SupabaseConnector
          system.supabaseConnector.updateSession(session);

          // Always initialize system for existing sessions
          console.log(
            '[AuthContext] Starting system initialization from existing session'
          );
          void initializeSystem();
        } else {
          // No session - anonymous mode
          console.log('[AuthContext] No session found - anonymous mode');
          setSession(null);
          setSessionType(null);
          // Skip PowerSync initialization for anonymous users
          // Set system ready immediately to allow TanStack Query to work
          setIsSystemReady(true);
        }
        setIsLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription }
    } = system.supabaseConnector.client.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth event:', event);
        console.log('[AuthContext] Session in event:', {
          hasSession: !!session,
          sessionType: session ? getSessionType(session) : null
        });

        setSession(session);

        // Update the session in SupabaseConnector
        system.supabaseConnector.updateSession(session);

        switch (event) {
          case 'SIGNED_IN': {
            console.log('[AuthContext] User signed in');
            const detectedSessionType = getSessionType(session);
            console.log(
              '[AuthContext] Detected session type:',
              detectedSessionType
            );
            setSessionType(detectedSessionType);

            // Always initialize system when signed in
            console.log(
              '[AuthContext] Starting system initialization from SIGNED_IN event'
            );
            await initializeSystem();
            console.log(
              '[AuthContext] System initialization complete from SIGNED_IN event'
            );
            break;
          }

          case 'PASSWORD_RECOVERY':
            console.log('[AuthContext] Password recovery session');
            setSessionType('password-reset');
            // Don't initialize system for password reset
            break;

          case 'SIGNED_OUT':
            console.log('[AuthContext] User signed out');
            setSessionType(null);
            await cleanupSystem();
            // Clear authView from localStore to prevent showing auth modal after sign out
            useLocalStore.getState().setAuthView(null);
            // Set system ready for anonymous browsing after sign out
            setIsSystemReady(true);
            break;

          case 'TOKEN_REFRESHED':
            console.log('[AuthContext] Token refreshed');
            // Just update the session, no need to reinitialize
            break;

          case 'USER_UPDATED':
            console.log('[AuthContext] User updated');
            // Handle user updates if needed
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
    sessionType,
    session,
    currentUser: session?.user || null,
    isSystemReady,
    migrationNeeded,
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
