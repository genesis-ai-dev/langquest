import { useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

export function useAcceptedTerms() {
  const { currentUser } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem('terms_accepted').then((value) => {
      setTermsAccepted(!!value);
      setTermsLoading(false);
    });
  }, []);

  return {
    termsAccepted: currentUser?.terms_accepted ?? termsAccepted,
    termsLoading
  };
}
