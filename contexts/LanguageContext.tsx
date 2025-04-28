import { languageService } from '@/database_services/languageService';
import type { language } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = typeof language.$inferSelect;

interface LanguageContextType {
  currentLanguage: Language | null;
  setLanguage: (language: Language) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedId = await AsyncStorage.getItem('selectedLanguageId');
        if (savedId) {
          const lang = await languageService.getLanguageById(savedId);
          if (lang) {
            setCurrentLanguage(lang);
          }
        }
      } catch (error) {
        console.error('Error loading language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    try {
      setCurrentLanguage(lang);
      await AsyncStorage.setItem('selectedLanguageId', lang.id);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        isLoading
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
