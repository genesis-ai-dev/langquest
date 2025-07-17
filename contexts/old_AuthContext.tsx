import type { profile } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/old_localStore';
import { getSupabaseAuthKey } from '@/utils/supabaseUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

export type Profile = typeof profile.$inferSelect;

export type SessionType = 'normal' | 'password-reset' | 'email-verification';

const DEBUG_MODE = false;
const debug = (...args: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (DEBUG_MODE) {
    console.log('AuthContext:', ...args);
  }
};

interface AuthContextType {
  currentUser: Profile | null;
  setCurrentUser: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
  isLoading: boolean;
  sessionType: SessionType | null;
  isAuthenticated: boolean;
}

// Helper function to determine session type
function getSessionType(session: Session | null): SessionType | null {
  if (!session) return null;

  // Check if this is a password reset session
  const user = session.user;

  // Log session details for debugging
  console.log('[AuthContext] Checking session type, user metadata:', {
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    recovery_sent_at: user.recovery_sent_at,
    last_sign_in_at: user.last_sign_in_at,
    created_at: user.created_at,
    app_metadata: user.app_metadata,
    aud: user.aud
  });

  // Method 2: Check if user has email but no confirmed_at (might be in recovery flow)
  // This is less reliable but can be a fallback
  if (user.email && user.recovery_sent_at) {
    console.log(
      '[AuthContext] Detected password reset session via recovery_sent_at'
    );
    return 'password-reset';
  }

  // Check if this is an email verification session
  if (!user.email_confirmed_at && user.email) {
    return 'email-verification';
  }

  return 'normal';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useLocalStore((state) => state.currentUser);
  const setCurrentUser = useLocalStore((state) => state.setCurrentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    debug('useEffect - AuthContext initialization');

    const loadAuthData = async () => {
      console.log('🔄 [AuthProvider] Starting loadAuthData...');
      try {
        console.log('🔄 [AuthProvider] Getting supabase auth key...');
        const supabaseAuthKey = await getSupabaseAuthKey();
        console.log('🔄 [AuthProvider] Got auth key:', !!supabaseAuthKey);

        if (supabaseAuthKey) {
          console.log('🔄 [AuthProvider] Getting session from AsyncStorage...');
          const sessionString = await AsyncStorage.getItem(supabaseAuthKey);
          console.log('🔄 [AuthProvider] Got session string:', !!sessionString);

          if (sessionString) {
            console.log('🔄 [AuthProvider] Parsing session...');
            const session = JSON.parse(sessionString) as Session | null;
            console.log('🔄 [AuthProvider] Session user ID:', session?.user.id);

            if (session?.user.id) {
              // Set session type and authentication state
              const type = getSessionType(session);
              setSessionType(type);
              setIsAuthenticated(true);
              console.log('🔄 [AuthProvider] Session type:', type);

              // Check for password reset flag (fallback detection)
              const passwordResetFlag = await AsyncStorage.getItem(
                'langquest_password_reset_session'
              );
              if (passwordResetFlag === 'true' && type === 'normal') {
                console.log(
                  '🔄 [AuthProvider] Password reset flag detected, overriding session type'
                );
                setSessionType('password-reset');
                // Clear the flag
                await AsyncStorage.removeItem(
                  'langquest_password_reset_session'
                );
              }

              console.log(
                '🔄 [AuthProvider] Getting profile (offline-first)...'
              );
              // Use getUserProfile which checks local DB first, then falls back to online
              const profile = await system.supabaseConnector.getUserProfile(
                session.user.id
              );
              console.log('🔄 [AuthProvider] Got profile:', !!profile);

              if (profile) {
                // Validate that this is a real user profile with username or email
                if (!profile.username && !profile.email) {
                  console.log(
                    '⚠️ [AuthProvider] Profile has no username or email - treating as invalid session'
                  );
                  setCurrentUser(null);
                  setSessionType(null);
                  setIsAuthenticated(false);
                  return;
                }

                setCurrentUser(profile);

                // Sync terms acceptance from profile to local store
                if (profile.terms_accepted && profile.terms_accepted_at) {
                  const localStore = useLocalStore.getState();
                  if (!localStore.dateTermsAccepted) {
                    console.log(
                      '🔄 [AuthProvider] Syncing terms acceptance from profile to local store'
                    );
                    localStore.acceptTerms();
                  }
                }
              } else {
                console.log(
                  '⚠️ [AuthProvider] No profile found - keeping session but no user profile'
                );
                // Don't set currentUser to null - keep the session alive
                // The user can still access the app with cached data
              }
            }
          } else {
            console.log('🔄 [AuthProvider] No session string found');
            setSessionType(null);
            setIsAuthenticated(false);
          }
        } else {
          console.log('🔄 [AuthProvider] No auth key found');
          setSessionType(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Error loading auth data:', error);
        // Don't clear currentUser on error - maintain session persistence
        setSessionType(null);
        setIsAuthenticated(false);
      } finally {
        console.log('✅ [AuthProvider] Setting isLoading to false');
        setIsLoading(false);
      }
    };

    // Add timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log(
        '⚠️ [AuthProvider] Timeout fallback - forcing isLoading to false'
      );
      setIsLoading(false);
    }, 10000); // 10 second timeout

    void loadAuthData().finally(() => {
      clearTimeout(timeoutId);
    });

    const subscription = system.supabaseConnector.client.auth.onAuthStateChange(
      async (state: string, session: Session | null) => {
        debug('onAuthStateChange', state, session);

        // Update session type and authentication state
        const type = getSessionType(session);
        setSessionType(type);
        setIsAuthenticated(!!session);
        console.log(
          '🔄 [AuthProvider] Auth state changed:',
          state,
          'Session type:',
          type
        );

        // Check for password reset flag (fallback detection)
        if (session && type === 'normal') {
          const passwordResetFlag = await AsyncStorage.getItem(
            'langquest_password_reset_session'
          );
          if (passwordResetFlag === 'true') {
            console.log(
              '🔄 [AuthProvider] Password reset flag detected in auth state change, overriding session type'
            );
            setSessionType('password-reset');
            // Clear the flag
            await AsyncStorage.removeItem('langquest_password_reset_session');
          }
        }

        // If no session, just return without doing anything
        if (!session) {
          console.log(
            '⚠️ [AuthProvider] No session detected, staying logged out'
          );
          return;
        }

        if (!session.user.is_anonymous && state !== 'TOKEN_REFRESHED') {
          try {
            const profile = await system.supabaseConnector.getUserProfile(
              session.user.id
            );

            if (profile) {
              // Validate that this is a real user profile with username or email
              if (!profile.username && !profile.email) {
                console.log(
                  '⚠️ [AuthProvider] Profile has no username or email - treating as invalid session'
                );
                setCurrentUser(null);
                return;
              }

              setCurrentUser(profile);

              // Sync terms acceptance from profile to local store
              if (profile.terms_accepted && profile.terms_accepted_at) {
                const localStore = useLocalStore.getState();
                if (!localStore.dateTermsAccepted) {
                  console.log(
                    '🔄 [AuthProvider] Syncing terms acceptance from profile to local store (auth state change)'
                  );
                  localStore.acceptTerms();
                }
              }

              // Only reinitialize attachment queues if system is already initialized
              if (system.isInitialized() && system.isConnected()) {
                console.log(
                  'Reinitializing attachment queues after auth state change...'
                );
                await Promise.all([
                  system.tempAttachmentQueue?.init(),
                  system.permAttachmentQueue?.init()
                ]);
                console.log('Attachment queue reinitialization complete');
              }
            } else {
              console.log(
                '⚠️ [AuthProvider] No profile found during auth state change - keeping current user'
              );
              // Don't clear currentUser if profile fetch fails - user stays logged in
            }
          } catch (error) {
            console.error(
              '❌ [AuthProvider] Error during auth state change:',
              error
            );
            // Don't clear currentUser on error - maintain session persistence

            // Still try to sync terms if we have a current user
            if (
              currentUser &&
              currentUser.terms_accepted &&
              currentUser.terms_accepted_at
            ) {
              const localStore = useLocalStore.getState();
              if (!localStore.dateTermsAccepted) {
                console.log(
                  '🔄 [AuthProvider] Syncing terms acceptance from current user (auth state change - fallback)'
                );
                localStore.acceptTerms();
              }
            }
          }
        }
      }
    );

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, []); // 🔥 FIXED: Empty dependency array - this should only run ONCE!

  const signOut = useCallback(async () => {
    debug('signOut');
    try {
      // will bring you back to the sign-in screen
      setCurrentUser(null);
      setSessionType(null);
      setIsAuthenticated(false);

      await system.supabaseConnector.signOut();
      await system.powersync.disconnect();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [setCurrentUser]);

  const contextValue = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      signOut,
      isLoading,
      sessionType,
      isAuthenticated
    }),
    [
      currentUser,
      setCurrentUser,
      signOut,
      isLoading,
      sessionType,
      isAuthenticated
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function getCurrentUser() {
  return useLocalStore.getState().currentUser;
}
