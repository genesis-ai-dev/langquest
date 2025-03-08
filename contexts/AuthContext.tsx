import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, userService } from '@/database_services/userService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRouter } from 'expo-router';
import { system } from '@/db/powersync/system';
import { DrawerActions } from '@react-navigation/native';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (profile: User | null) => void;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { supabaseConnector } = system;
  const navigation = useNavigation();
  // Check for stored user session on app start
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          const profile = await userService.getUserById(storedUserId);
          if (profile) {
            setCurrentUser(profile);
          }
        }
      } catch (error) {
        console.error('Error loading stored user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredUser();
  }, []);

  // Update stored user ID whenever currentUser changes
  useEffect(() => {
    const updateStoredUser = async () => {
      try {
        if (currentUser) {
          await AsyncStorage.setItem('userId', currentUser.id);
        } else {
          await AsyncStorage.removeItem('userId');
        }
      } catch (error) {
        console.error('Error updating stored user:', error);
      }
    };

    updateStoredUser();
  }, [currentUser]);

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('userId');
      setCurrentUser(null);

      // Sign out and get new anonymous session
      await supabaseConnector.signOut();

      // Reinitialize system with new anonymous user
      await system.init();

      navigation.dispatch(DrawerActions.closeDrawer());
      router.replace('/'); // Navigate back to sign-in
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated: currentUser !== null,
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
