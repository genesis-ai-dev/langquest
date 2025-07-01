import type { Profile } from '@/database_services/profileService';
import { getProfileByUserId } from '@/hooks/db/useProfiles';
import { useLocalStore } from '@/store/localStore';
import { getSupabaseAuthKey } from '@/utils/supabaseUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useSystem } from './SystemContext';

interface AuthContextType {
  currentUser: Profile | null;
  setCurrentUser: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useLocalStore((state) => state.currentUser);
  const setCurrentUser = useLocalStore((state) => state.setCurrentUser);
  const [isLoading, setIsLoading] = useState(true);
  const system = useSystem();
  const mounted = useRef(true);
  const authInitialized = useRef(false);

  useEffect(() => {
    mounted.current = true;

    const loadAuthData = async () => {
      if (authInitialized.current) return;
      authInitialized.current = true;

      setIsLoading(true);
      try {
        const supabaseAuthKey = await getSupabaseAuthKey();

        if (supabaseAuthKey) {
          const sessionString = await AsyncStorage.getItem(supabaseAuthKey);
          if (sessionString) {
            const session = JSON.parse(sessionString) as Session | null;
            const profile = await getProfileByUserId(session?.user.id ?? '');
            if (mounted.current) {
              setCurrentUser(profile ?? null);
            }
          }
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        if (mounted.current) {
          console.log('setting auth isLoading to false');
          setIsLoading(false);
        }
      }
    };

    void loadAuthData();

    const subscription = system.supabaseConnector.client.auth.onAuthStateChange(
      async (state: string, session: Session | null) => {
        if (!mounted.current) return;

        // always maintain a session
        if (!session) {
          await system.supabaseConnector.client.auth.signInAnonymously();
          setCurrentUser(null);
          return;
        }

        if (!session.user.is_anonymous && state !== 'TOKEN_REFRESHED') {
          try {
            const profile = await system.supabaseConnector.getUserProfile(
              session.user.id
            );
            if (mounted.current) {
              setCurrentUser(profile);
            }

            // Only reinitialize attachment queues if system is already initialized
            if (system.isInitialized()) {
              console.log(
                'Reinitializing attachment queues after auth state change...'
              );
              await Promise.all([
                system.tempAttachmentQueue?.init(),
                system.permAttachmentQueue?.init()
              ]);
              console.log('Attachment queue reinitialization complete');
            }
          } catch (error) {
            console.error('Error during auth state change:', error);
            // Still set the user even if queue init fails
            if (mounted.current) {
              const profile = await system.supabaseConnector.getUserProfile(
                session.user.id
              );
              setCurrentUser(profile);
            }
          }
        }
      }
    );

    return () => {
      mounted.current = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [system, setCurrentUser]);

  const signOut = useCallback(async () => {
    try {
      // will bring you back to the sign-in screen
      setCurrentUser(null);

      await system.supabaseConnector.signOut();
      await system.powersync.disconnect();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [system, setCurrentUser]);

  const contextValue = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      signOut,
      isLoading
    }),
    [currentUser, setCurrentUser, signOut, isLoading]
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
