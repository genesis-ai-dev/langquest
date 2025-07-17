import { system } from '@/db/powersync/system';
import type { AuthError, AuthResponse, Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type SessionType = 'normal' | 'password-reset' | null;

interface AuthContextType {
  // Auth state
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionType: SessionType;
  session: Session | null;

  // System state
  isSystemReady: boolean;

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
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

  // Initialize system when we have an authenticated session
  const initializeSystem = async () => {
    try {
      console.log('[AuthContext] Initializing system...');
      setIsSystemReady(false);
      await system.init();
      setIsSystemReady(true);
      console.log('[AuthContext] System initialized successfully');
    } catch (error) {
      console.error('[AuthContext] System init failed:', error);
      setIsSystemReady(false);
      // You might want to show an error to the user here
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
          setSession(session);
          setSessionType(detectedSessionType);

          // Always initialize system for existing sessions
          void initializeSystem();
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

        switch (event) {
          case 'SIGNED_IN': {
            console.log('[AuthContext] User signed in');
            const detectedSessionType = getSessionType(session);
            setSessionType(detectedSessionType);

            // Always initialize system when signed in
            await initializeSystem();
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
      options: data ? { data } : undefined
    });
  };

  const signOut = async () => {
    await system.supabaseConnector.client.auth.signOut();
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
    isSystemReady,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
