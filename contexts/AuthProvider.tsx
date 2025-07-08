import type { profile } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
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
  useState
} from 'react';

export type Profile = typeof profile.$inferSelect;

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useLocalStore((state) => state.currentUser);
  const setCurrentUser = useLocalStore((state) => state.setCurrentUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    debug('useEffect - AuthContext initialization');

    const loadAuthData = async () => {
      try {
        const supabaseAuthKey = await getSupabaseAuthKey();

        if (supabaseAuthKey) {
          const sessionString = await AsyncStorage.getItem(supabaseAuthKey);
          if (sessionString) {
            const session = JSON.parse(sessionString) as Session | null;
            console.log('session', session?.user.id);
            const { data: profile } = (await system.supabaseConnector.client
              .from('profile')
              .select('*')
              .eq('id', session?.user.id)
              .single()) as { data: Profile };
            console.log('profile', profile);
            setCurrentUser(profile);
          }
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        console.log('setting auth isLoading to false');
        setIsLoading(false);
      }
    };

    void loadAuthData();

    const subscription = system.supabaseConnector.client.auth.onAuthStateChange(
      async (state: string, session: Session | null) => {
        debug('onAuthStateChange', state, session);

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
            setCurrentUser(profile);

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
            const profile = await system.supabaseConnector.getUserProfile(
              session.user.id
            );
            setCurrentUser(profile);
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
