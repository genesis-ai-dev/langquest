import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserWithRelations, userService } from '@/database_services/userService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

interface AuthContextType {
  currentUser: UserWithRelations | null;
  setCurrentUser: (user: UserWithRelations | null) => void;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for stored user session on app start
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          const user = await userService.getUserById(storedUserId);
          if (user) {
            setCurrentUser(user);
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
      router.replace('/'); // Navigate back to sign-in
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      setCurrentUser,
      isAuthenticated: currentUser !== null,
      signOut,
      isLoading,
    }}>
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