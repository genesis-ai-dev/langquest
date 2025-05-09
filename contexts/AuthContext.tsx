import type { Profile } from '@/database_services/profileService';
import { profileService } from '@/database_services/profileService';
import { getSupabaseAuthKey } from '@/utils/supabaseUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSystem } from './SystemContext';

interface AuthContextType {
  currentUser: Profile | null;
  setCurrentUser: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { supabaseConnector, powersync } = useSystem();

  useEffect(() => {
    const loadAuthData = async () => {
      setIsLoading(true);
      const supabaseAuthKey = await getSupabaseAuthKey();

      if (supabaseAuthKey) {
        const session = JSON.parse(
          (await AsyncStorage.getItem(supabaseAuthKey)) ?? '{}'
        ) as Session | null;
        const profile = await profileService.getProfileByUserId(
          session?.user.id ?? ''
        );

        setCurrentUser(profile ?? null);
      }
      console.log('setting auth isLoading to false', isLoading);
      setIsLoading(false);
    };

    void loadAuthData();

    const subscription = supabaseConnector.client.auth.onAuthStateChange(
      async (state, session) => {
        // always maintain a session
        if (!session) {
          await supabaseConnector.client.auth.signInAnonymously();
          setCurrentUser(null);
          return;
        }
        if (!session.user.is_anonymous && state !== 'TOKEN_REFRESHED') {
          setCurrentUser(
            await supabaseConnector.getUserProfile(session.user.id)
          );
        }
      }
    );

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // will bring you back to the sign-in screen
      setCurrentUser(null);

      await supabaseConnector.signOut();
      await powersync.disconnect();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        signOut,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
