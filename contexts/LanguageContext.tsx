import { languageService } from '@/database_services/languageService';
import type { language } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = typeof language.$inferSelect;

interface LanguageContextType {
  currentLanguage: Language | null;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const LanguageProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const loadSavedLanguage = async () => {
      const savedId = await AsyncStorage.getItem('selectedLanguageId');
      if (savedId) {
        const lang = await languageService.getLanguageById(savedId);
        if (lang) {
          setCurrentLanguage(lang);
        }
      }
      setIsLoading(false);
    };

    void loadSavedLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setCurrentLanguage(lang);
    await AsyncStorage.setItem('selectedLanguageId', lang.id);
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
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
