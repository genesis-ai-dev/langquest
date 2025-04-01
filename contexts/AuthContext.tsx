import { Profile, profileService } from '@/database_services/profileService';
import { system, useSystem } from '@/db/powersync/system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

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
  const { supabaseConnector } = useSystem();

  useEffect(() => {
    const getSession = async () => {
      const supabaseAuthKey = (await AsyncStorage.getAllKeys()).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token')
      );
      const session = JSON.parse(
        (await AsyncStorage.getItem(supabaseAuthKey!)) ?? '{}'
      ) as unknown as Session | null;
      const profile = await profileService.getProfileByUserId(
        session?.user.id ?? ''
      );
      if (profile) setCurrentUser(profile);
      setIsLoading(false);
    };
    getSession();

    const subscription = supabaseConnector.client.auth.onAuthStateChange(
      async (_, session) => {
        // always maintain a session
        if (!session) {
          await supabaseConnector.client.auth.signInAnonymously();
          return;
        }
        if (session?.user && !session.user.is_anonymous) {
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
      await system.powersync.disconnect();
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
